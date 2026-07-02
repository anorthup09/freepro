const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.RESEND_FROM_EMAIL || 'FreePro <noreply@resend.dev>';

async function sendQuestionNotification({ pocEmail, pocName, projectTitle, projectCode, question, shareToken }) {
  if (!resend || !pocEmail) return;
  const shareUrl = `${process.env.FRONTEND_URL || 'https://freepro-production.up.railway.app'}/share/${shareToken}`;
  try {
    await resend.emails.send({
      from: FROM,
      to: pocEmail,
      subject: `New question on ${projectCode} — ${projectTitle}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
          <div style="background:#E8500A;padding:20px 24px;border-radius:8px 8px 0 0">
            <span style="font-size:20px;font-weight:700;color:#fff">Free<em>Pro</em></span>
          </div>
          <div style="background:#f9f9f9;padding:24px;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 8px 8px">
            <p style="margin:0 0 8px;font-size:14px;color:#666">Hi ${pocName || 'there'},</p>
            <p style="margin:0 0 20px;font-size:14px;color:#666">A new question was submitted on the Crew View for <strong>${projectCode} — ${projectTitle}</strong>:</p>
            <div style="background:#fff;border:1px solid #e5e5e5;border-left:3px solid #E8500A;border-radius:4px;padding:14px 16px;margin-bottom:24px;font-size:14px;color:#1a1a1a">
              ${question}
            </div>
            <a href="${shareUrl}" style="display:inline-block;background:#E8500A;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:13px;font-weight:600">View &amp; Answer →</a>
          </div>
        </div>
      `,
    });
  } catch (e) {
    console.error('Email send failed:', e.message);
  }
}

module.exports = { sendQuestionNotification };
