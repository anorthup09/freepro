const zlib = require('zlib');
const sql = require('./db');

// Nightly logical backup: every table serialized to JSON, gzipped, pushed to
// S3-compatible storage (AWS S3, Cloudflare R2, Backblaze B2). Configure with:
//   BACKUP_S3_BUCKET, BACKUP_S3_ACCESS_KEY, BACKUP_S3_SECRET_KEY
//   BACKUP_S3_ENDPOINT (for R2/B2), BACKUP_S3_REGION (default us-east-1)
function isConfigured() {
  return !!(process.env.BACKUP_S3_BUCKET && process.env.BACKUP_S3_ACCESS_KEY && process.env.BACKUP_S3_SECRET_KEY);
}

async function buildBackup() {
  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name`;
  const dump = { generatedAt: new Date().toISOString(), format: 'freepro-json-v1', tables: {} };
  for (const { table_name } of tables) {
    const rows = await sql.unsafe(`SELECT * FROM "${table_name}"`);
    dump.tables[table_name] = rows.map(r => {
      const out = {};
      for (const [k, v] of Object.entries(r)) {
        out[k] = Buffer.isBuffer(v) ? { __b64: v.toString('base64') } : v;
      }
      return out;
    });
  }
  return zlib.gzipSync(Buffer.from(JSON.stringify(dump)));
}

async function uploadBackup() {
  if (!isConfigured()) return { skipped: true, reason: 'BACKUP_S3_* env vars not set' };
  const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
  const client = new S3Client({
    region: process.env.BACKUP_S3_REGION || 'us-east-1',
    ...(process.env.BACKUP_S3_ENDPOINT ? { endpoint: process.env.BACKUP_S3_ENDPOINT } : {}),
    forcePathStyle: !!process.env.BACKUP_S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.BACKUP_S3_ACCESS_KEY,
      secretAccessKey: process.env.BACKUP_S3_SECRET_KEY,
    },
  });
  const body = await buildBackup();
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const key = `freepro-backups/freepro-${stamp}.json.gz`;
  await client.send(new PutObjectCommand({
    Bucket: process.env.BACKUP_S3_BUCKET,
    Key: key,
    Body: body,
    ContentType: 'application/gzip',
  }));
  return { skipped: false, key, bytes: body.length };
}

// Fire at ~08:10 UTC daily (2–3am US Central), then every 24h
function scheduleNightlyBackup() {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 8, 10, 0));
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  const run = async () => {
    try {
      const r = await uploadBackup();
      console.log(r.skipped ? `Backup skipped: ${r.reason}` : `Backup uploaded: ${r.key} (${Math.round(r.bytes / 1024)} KB)`);
    } catch (e) {
      console.error('Nightly backup failed:', e.message);
    }
  };
  setTimeout(() => { run(); setInterval(run, 24 * 60 * 60 * 1000); }, next - now);
  console.log(`Nightly backup scheduled for ${next.toISOString()}${isConfigured() ? '' : ' (will skip until BACKUP_S3_* env vars are set)'}`);
}

module.exports = { buildBackup, uploadBackup, scheduleNightlyBackup, isConfigured };
