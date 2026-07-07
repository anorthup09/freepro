// Same-origin by default: the backend serves this app, so API calls must go to
// the host the page was loaded from — a hardcoded host splits reads/writes
// across deployments with separate databases. VITE_API_URL overrides for dev.
const BACKEND = import.meta.env.VITE_API_URL
  || (typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'https://freepro-production.up.railway.app'
      : '');
const BASE = BACKEND + '/api';

function token() {
  return localStorage.getItem('fp_token');
}

// Save-state broadcast: non-GET requests flip a tiny status the UI can show
// ("Saving…" → "Saved") without wiring every call site.
const saveListeners = new Set();
let inflight = 0;
export function onSaveState(fn) { saveListeners.add(fn); return () => saveListeners.delete(fn); }
function emitSave(state) { for (const fn of saveListeners) fn(state); }

async function req(method, path, body) {
  const isWrite = method !== 'GET';
  if (isWrite) { inflight++; emitSave('saving'); }
  try {
    return await reqInner(method, path, body);
  } finally {
    if (isWrite) { inflight--; if (inflight <= 0) { inflight = 0; emitSave('saved'); } }
  }
}

async function reqInner(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (res.status === 204) return null;
  const text = await res.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch { /* non-JSON body (proxy error page, etc.) */ } }
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status} on ${path}) — please try again`);
  if (data === null) throw new Error(`Server returned an unexpected response (${res.status} on ${path}${text ? ': ' + text.slice(0, 80) : ', empty body'})`);
  return data;
}

// Logged-in users bypass share passwords server-side — attach their token
function shareAuthHeaders() {
  const t = localStorage.getItem('fp_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export const api = {
  // Auth
  login: (email, password) => req('POST', '/auth/login', { email, password }),
  register: (name, email, password) => req('POST', '/auth/register', { name, email, password }),
  me: () => req('GET', '/auth/me'),
  mfaVerify: (mfaToken, code) => req('POST', '/auth/mfa/verify', { mfaToken, code }),
  mfaSetup: () => req('POST', '/auth/mfa/setup'),
  mfaEnable: (code) => req('POST', '/auth/mfa/enable', { code }),
  mfaDisable: (code) => req('POST', '/auth/mfa/disable', { code }),

  // Projects
  getProjects: () => req('GET', '/projects'),
  getCrewViews: () => req('GET', '/crew-views'),
  getUsers: () => req('GET', '/users'),
  updateUserRole: (id, role) => req('PATCH', `/users/${id}`, { role }),
  deleteUser: (id) => req('DELETE', `/users/${id}`),
  getProject: (id) => req('GET', `/projects/${id}`),
  createProject: (data) => req('POST', '/projects', data),
  searchClientLogos: (q) => req('GET', `/projects/logos?q=${encodeURIComponent(q || '')}`),
  crewCalendar: () => req('GET', '/projects/crew-calendar'),
  // AvocadoPost
  avoEdits: () => req('GET', '/avo/edits'),
  avoEdit: (id) => req('GET', `/avo/edits/${id}`),
  createAvoEdit: (data) => req('POST', '/avo/edits', data),
  updateAvoEdit: (id, data) => req('PATCH', `/avo/edits/${id}`, data),
  deleteAvoEdit: (id) => req('DELETE', `/avo/edits/${id}`),
  avoComment: (id, body) => req('POST', `/avo/edits/${id}/comments`, { body }),
  avoRfr: (id) => req('POST', `/avo/edits/${id}/rfr`, {}),
  avoSent: (id) => req('POST', `/avo/edits/${id}/sent`, {}),
  avoUploadFile: (id, data) => req('POST', `/avo/edits/${id}/files`, data),
  avoDeleteFile: (fid) => req('DELETE', `/avo/files/${fid}`),
  avoGanttShare: (kind, ref) => req('POST', '/avo/gantt-share', { kind, ref }),
  getGanttShare: (token) => req('GET', `/gantt-share/${token}`),
  forgotPassword: (email) => req('POST', '/auth/forgot-password', { email }),
  setUserPassword: (id, password) => req('PATCH', `/users/${id}/password`, { password }),
  resetPassword: (token, password) => req('POST', '/auth/reset-password', { token, password }),
  ptoList: () => req('GET', '/team/pto'),
  createPto: (data) => req('POST', '/team/pto', data),
  updatePto: (id, data) => req('PATCH', `/team/pto/${id}`, data),
  deletePto: (id) => req('DELETE', `/team/pto/${id}`),
  avoProjectCodes: () => req('GET', '/avo/project-codes'),
  avoProjects: () => req('GET', '/avo/projects'),
  createAvoProject: (code, title) => req('POST', '/avo/projects', { code, title }),
  avoProject: (id) => req('GET', `/avo/projects/${id}`),
  updateAvoProject: (id, data) => req('PATCH', `/avo/projects/${id}`, data),
  deleteAvoProject: (id) => req('DELETE', `/avo/projects/${id}`),
  addAvoGridRow: (pageId, kind) => req('POST', `/avo/projects/${pageId}/${kind}`, {}),
  updateAvoGridRow: (kind, rowId, data) => req('PATCH', `/avo/grid/${kind}/${rowId}`, data),
  deleteAvoGridRow: (kind, rowId) => req('DELETE', `/avo/grid/${kind}/${rowId}`),
  getHarbinger: (pid) => req('GET', `/finance/${pid}/harbinger`),
  submitHarbinger: (pid, data) => req('POST', `/finance/${pid}/harbinger`, data),
  gearRequests: () => req('GET', '/gear-requests'),
  gearRequestProjects: () => req('GET', '/gear-requests/available-projects'),
  gearRequestForProject: (pid) => req('GET', `/gear-requests/project/${pid}`),
  createGearRequest: (data) => req('POST', '/gear-requests', data),
  updateProject: (id, data) => req('PATCH', `/projects/${id}`, data),

  // Locations
  createLocation: (projectId, data) => req('POST', `/projects/${projectId}/locations`, data),
  updateLocation: (projectId, id, data) => req('PATCH', `/projects/${projectId}/locations/${id}`, data),
  deleteLocation: (projectId, id) => req('DELETE', `/projects/${projectId}/locations/${id}`),

  // Tech specs
  saveTechSpecs: (projectId, data) => req('PUT', `/projects/${projectId}/tech-specs`, data),

  // Contacts
  createContact: (projectId, data) => req('POST', `/projects/${projectId}/contacts`, data),
  updateContact: (projectId, id, data) => req('PATCH', `/projects/${projectId}/contacts/${id}`, data),
  deleteContact: (projectId, id) => req('DELETE', `/projects/${projectId}/contacts/${id}`),

  // Talent
  getTalent: (projectId) => req('GET', `/projects/${projectId}/talent`),
  createTalent: (projectId, data) => req('POST', `/projects/${projectId}/talent`, data),
  updateTalent: (projectId, id, data) => req('PATCH', `/projects/${projectId}/talent/${id}`, data),
  deleteTalent: (projectId, id) => req('DELETE', `/projects/${projectId}/talent/${id}`),
  getTalentDayCalls: (projectId, talentId) => req('GET', `/projects/${projectId}/talent/${talentId}/day-calls`),
  saveTalentDayCalls: (projectId, talentId, calls) => req('PUT', `/projects/${projectId}/talent/${talentId}/day-calls`, calls),

  // Crew roster
  getCrew: () => req('GET', '/crew'),
  getCrewMember: (id) => req('GET', `/crew/${id}`),
  createCrewMember: (data) => req('POST', '/crew', data),
  updateCrewMember: (id, data) => req('PATCH', `/crew/${id}`, data),
  deleteCrewMember: (id) => req('DELETE', `/crew/${id}`),

  // Positions
  getPositions: () => req('GET', '/crew/positions'),

  // Crew assignments
  getProjectCrew: (projectId) => req('GET', `/projects/${projectId}/crew`),
  addCrewSlot: (projectId, data) => req('POST', `/projects/${projectId}/crew`, data),
  updateCrewSlot: (projectId, id, data) => req('PATCH', `/projects/${projectId}/crew/${id}`, data),
  removeCrewSlot: (projectId, id) => req('DELETE', `/projects/${projectId}/crew/${id}`),
  createContract: (projectId, aid, data) => req('POST', `/projects/${projectId}/crew/${aid}/contract`, data),
  getContracts: (projectId) => req('GET', `/projects/${projectId}/contracts`),
  getContract: (token) => req('GET', `/contract/${token}`),
  signContract: (token, name) => req('POST', `/contract/${token}/sign`, { name }),
  emailContract: (projectId, cid, to) => req('POST', `/projects/${projectId}/contracts/${cid}/email`, { to }),

  // ProFi — project finance
  financeProjects: () => req('GET', '/finance/projects'),
  financeBundle: (pid) => req('GET', `/finance/${pid}`),
  createBudget: (pid) => req('POST', `/finance/${pid}/budget`),
  updateBudget: (bid, data) => req('PATCH', `/finance/budget/${bid}`, data),
  addBudgetSection: (bid, data) => req('POST', `/finance/budget/${bid}/sections`, data),
  updateBudgetSection: (sid, data) => req('PATCH', `/finance/sections/${sid}`, data),
  deleteBudgetSection: (sid) => req('DELETE', `/finance/sections/${sid}`),
  addBudgetLine: (sid, data) => req('POST', `/finance/sections/${sid}/lines`, data),
  updateBudgetLine: (lid, data) => req('PATCH', `/finance/lines/${lid}`, data),
  deleteBudgetLine: (lid) => req('DELETE', `/finance/lines/${lid}`),
  addVccEntry: (pid, data) => req('POST', `/finance/${pid}/vcc`, data),
  updateVccEntry: (id, data) => req('PATCH', `/finance/vcc/${id}`, data),
  deleteVccEntry: (id) => req('DELETE', `/finance/vcc/${id}`),
  syncFreePro: (pid) => req('POST', `/finance/${pid}/sync-freepro`),
  importOdc: (pid, fileBase64, filename) => req('POST', `/finance/${pid}/odc-import`, { fileBase64, filename }),
  shareBudget: (bid) => req('POST', `/finance/budget/${bid}/share`),
  getBudgetShare: (token) => req('GET', `/budget-share/${token}`),
  weeklyFinanceReport: () => req('POST', '/finance/weekly-report'),
  pushTravelHold: (sid) => req('POST', `/finance/sections/${sid}/push-travel-hold`),
  pullTravelActuals: (sid) => req('POST', `/finance/sections/${sid}/pull-travel-actuals`),
  savePipeline: (pid, pipeline) => req('PATCH', `/finance/pipeline/${pid}`, { pipeline }),
  createEstimate: (pid, label) => req('POST', `/finance/${pid}/estimates`, { label }),
  deleteEstimate: (eid) => req('DELETE', `/finance/estimates/${eid}`),
  mergeEstimate: (eid) => req('POST', `/finance/estimates/${eid}/merge`),

  // Schedule
  getSchedule: (projectId) => req('GET', `/projects/${projectId}/schedule`),
  getDay: (projectId, dayId) => req('GET', `/projects/${projectId}/schedule/days/${dayId}`),
  createDay: (projectId, data) => req('POST', `/projects/${projectId}/schedule/days`, data),
  updateDay: (projectId, dayId, data) => req('PATCH', `/projects/${projectId}/schedule/days/${dayId}`, data),
  deleteDay: (projectId, dayId) => req('DELETE', `/projects/${projectId}/schedule/days/${dayId}`),
  createEvent: (projectId, dayId, data) => req('POST', `/projects/${projectId}/schedule/days/${dayId}/events`, data),
  updateEvent: (projectId, eventId, data) => req('PATCH', `/projects/${projectId}/schedule/events/${eventId}`, data),
  deleteEvent: (projectId, eventId) => req('DELETE', `/projects/${projectId}/schedule/events/${eventId}`),
  saveDayCalls: (projectId, dayId, calls) => req('PUT', `/projects/${projectId}/schedule/days/${dayId}/calls`, calls),
  updateDayCall: (projectId, callId, data) => req('PATCH', `/projects/${projectId}/schedule/calls/${callId}`, data),
  saveCatering: (projectId, dayId, data) => req('POST', `/projects/${projectId}/schedule/days/${dayId}/catering`, data),

  // Deliverables
  getDeliverables: (projectId) => req('GET', `/projects/${projectId}/deliverables`),
  createDeliverable: (projectId, data) => req('POST', `/projects/${projectId}/deliverables`, data),
  updateDeliverable: (projectId, id, data) => req('PATCH', `/projects/${projectId}/deliverables/${id}`, data),
  deleteDeliverable: (projectId, id) => req('DELETE', `/projects/${projectId}/deliverables/${id}`),

  // Shares
  getShares: (id) => req('GET', `/projects/${id}/shares`),
  createShare: (id, data) => req('POST', `/projects/${id}/shares`, data),
  deleteShare: (id, sid) => req('DELETE', `/projects/${id}/shares/${sid}`),
  getPublicShare: async (token, pw) => {
    const url = pw ? `${BACKEND}/api/share/${token}?pw=${encodeURIComponent(pw)}` : `${BACKEND}/api/share/${token}`;
    const t = localStorage.getItem('fp_token');
    const r = await fetch(url, t ? { headers: { Authorization: `Bearer ${t}` } } : undefined);
    const data = await r.json();
    if (!r.ok) return { _status: r.status, ...data };
    return data;
  },

  // Travel
  getHotels: (projectId) => req('GET', `/projects/${projectId}/travel/hotels`),
  createHotel: (projectId, data) => req('POST', `/projects/${projectId}/travel/hotels`, data),
  deleteHotel: (projectId, hotelId) => req('DELETE', `/projects/${projectId}/travel/hotels/${hotelId}`),
  addGuest: (projectId, hotelId, data) => req('POST', `/projects/${projectId}/travel/hotels/${hotelId}/guests`, data),
  updateGuest: (projectId, guestId, data) => req('PATCH', `/projects/${projectId}/travel/guests/${guestId}`, data),
  deleteGuest: (projectId, guestId) => req('DELETE', `/projects/${projectId}/travel/guests/${guestId}`),
  getFlights: (projectId) => req('GET', `/projects/${projectId}/travel/flights`),
  createFlight: (projectId, data) => req('POST', `/projects/${projectId}/travel/flights`, data),
  updateFlight: (projectId, id, data) => req('PATCH', `/projects/${projectId}/travel/flights/${id}`, data),
  deleteFlight: (projectId, id) => req('DELETE', `/projects/${projectId}/travel/flights/${id}`),
  getDrives: (projectId) => req('GET', `/projects/${projectId}/travel/drives`),
  createDrive: (projectId, data) => req('POST', `/projects/${projectId}/travel/drives`, data),
  deleteDrive: (projectId, id) => req('DELETE', `/projects/${projectId}/travel/drives/${id}`),
  hotelSearch: (q) => req('GET', `/util/hotel-search?q=${encodeURIComponent(q)}`),
  geoSearch: (q) => req('GET', `/util/geo-search?q=${encodeURIComponent(q)}`),
  flightLookup: (flight, date) => req('GET', `/util/flight-lookup?flight=${encodeURIComponent(flight)}&date=${date}`),
  flightStatus: (flight, date) => req('GET', `/util/flight-status?flight=${encodeURIComponent(flight)}&date=${date}`),
  getRentalCars: (projectId) => req('GET', `/projects/${projectId}/travel/rental-cars`),
  createRentalCar: (projectId, data) => req('POST', `/projects/${projectId}/travel/rental-cars`, data),
  updateRentalCar: (projectId, id, data) => req('PATCH', `/projects/${projectId}/travel/rental-cars/${id}`, data),
  deleteRentalCar: (projectId, id) => req('DELETE', `/projects/${projectId}/travel/rental-cars/${id}`),

  // Agency contacts
  createAgencyContact: (projectId, data) => req('POST', `/projects/${projectId}/agency-contacts`, data),
  updateAgencyContact: (projectId, id, data) => req('PATCH', `/projects/${projectId}/agency-contacts/${id}`, data),
  deleteAgencyContact: (projectId, id) => req('DELETE', `/projects/${projectId}/agency-contacts/${id}`),

  // Gear
  saveGear: (projectId, data) => req('PUT', `/projects/${projectId}/gear`, data),

  // Online Rentals
  createOnlineRental: (projectId, data) => req('POST', `/projects/${projectId}/online-rentals`, data),
  updateOnlineRental: (projectId, id, data) => req('PATCH', `/projects/${projectId}/online-rentals/${id}`, data),
  deleteOnlineRental: (projectId, id) => req('DELETE', `/projects/${projectId}/online-rentals/${id}`),

  // Gear Items
  getGearItems: (projectId) => req('GET', `/projects/${projectId}/gear-items`),
  createGearItem: (projectId, data) => req('POST', `/projects/${projectId}/gear-items`, data),
  updateGearItem: (projectId, id, data) => req('PATCH', `/projects/${projectId}/gear-items/${id}`, data),
  deleteGearItem: (projectId, id) => req('DELETE', `/projects/${projectId}/gear-items/${id}`),

  // Questions
  getQuestions: (projectId) => req('GET', `/projects/${projectId}/questions`),
  createQuestion: (projectId, data) => req('POST', `/projects/${projectId}/questions`, data),
  answerQuestion: (projectId, qid, data) => req('PATCH', `/projects/${projectId}/questions/${qid}`, data),
  deleteQuestion: (projectId, qid) => req('DELETE', `/projects/${projectId}/questions/${qid}`),

  // Share Questions
  getShareQuestions: async (token, pw) => {
    const url = `${BACKEND}/api/share/${token}/questions${pw ? `?pw=${encodeURIComponent(pw)}` : ''}`;
    const r = await fetch(url, { headers: shareAuthHeaders() });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Failed');
    return data;
  },
  createShareQuestion: async (token, pw, question) => {
    const url = `${BACKEND}/api/share/${token}/questions${pw ? `?pw=${encodeURIComponent(pw)}` : ''}`;
    const r = await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json', ...shareAuthHeaders() }, body: JSON.stringify({ question }) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Failed');
    return data;
  },
  // Shot List Days
  getSlDays: (projectId) => req('GET', `/projects/${projectId}/shot-list/days`),
  createSlDay: (projectId, data) => req('POST', `/projects/${projectId}/shot-list/days`, data),
  updateSlDay: (projectId, id, data) => req('PATCH', `/projects/${projectId}/shot-list/days/${id}`, data),
  deleteSlDay: (projectId, id) => req('DELETE', `/projects/${projectId}/shot-list/days/${id}`),

  // Shot List
  updateShareShot: (token, shotId, data) => req('PATCH', `/share/${token}/shots/${shotId}`, data),
  updateShareScene: (token, sceneId, data) => req('PATCH', `/share/${token}/scenes/${sceneId}`, data),
  // Scripts
  getScripts: (projectId) => req('GET', `/projects/${projectId}/scripts`),
  createScript: (projectId, data) => req('POST', `/projects/${projectId}/scripts`, data),
  updateScript: (projectId, sid, data) => req('PATCH', `/projects/${projectId}/scripts/${sid}`, data),
  deleteScript: (projectId, sid) => req('DELETE', `/projects/${projectId}/scripts/${sid}`),
  fetchScriptBlob: async (projectId, sid) => {
    const r = await fetch(`${BACKEND}/api/projects/${projectId}/scripts/${sid}/file`, { headers: { Authorization: `Bearer ${localStorage.getItem('fp_token')}` } });
    if (!r.ok) throw new Error('Could not load script file');
    return r.blob();
  },

  getShotList: (projectId) => req('GET', `/projects/${projectId}/shot-list`),
  createScene: (projectId, data) => req('POST', `/projects/${projectId}/shot-list/scenes`, data),
  updateScene: (projectId, sceneId, data) => req('PATCH', `/projects/${projectId}/shot-list/scenes/${sceneId}`, data),
  deleteScene: (projectId, sceneId) => req('DELETE', `/projects/${projectId}/shot-list/scenes/${sceneId}`),
  createShot: (projectId, sceneId, data) => req('POST', `/projects/${projectId}/shot-list/scenes/${sceneId}/shots`, data),
  updateShot: (projectId, shotId, data) => req('PATCH', `/projects/${projectId}/shot-list/shots/${shotId}`, data),
  deleteShot: (projectId, shotId) => req('DELETE', `/projects/${projectId}/shot-list/shots/${shotId}`),

  // Shot List Breaks
  getBreaks: (projectId) => req('GET', `/projects/${projectId}/shot-list/breaks`),
  createBreak: (projectId, data) => req('POST', `/projects/${projectId}/shot-list/breaks`, data),
  updateBreak: (projectId, id, data) => req('PATCH', `/projects/${projectId}/shot-list/breaks/${id}`, data),
  deleteBreak: (projectId, id) => req('DELETE', `/projects/${projectId}/shot-list/breaks/${id}`),

  answerShareQuestion: async (token, pw, qid, answer) => {
    const url = `${BACKEND}/api/share/${token}/questions/${qid}${pw ? `?pw=${encodeURIComponent(pw)}` : ''}`;
    const r = await fetch(url, { method:'PATCH', headers:{ 'Content-Type':'application/json', ...shareAuthHeaders() }, body: JSON.stringify({ answer }) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Failed');
    return data;
  },
};
