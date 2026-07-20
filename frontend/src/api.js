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
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status} on ${path}) — please try again`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
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
  me: async () => {
    const u = await req('GET', '/auth/me');
    // Server reissues the token when the account's role changed since sign-in
    if (u?.refreshedToken) localStorage.setItem('fp_token', u.refreshedToken);
    return u;
  },
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
  holdEditCost: (id, role) => req('POST', `/avo/edits/${id}/hold-cost`, { role: role || 'editor' }),
  avoEditContract: (id) => req('POST', `/avo/edits/${id}/contract`),
  addAvoMilestone: (id, data) => req('POST', `/avo/edits/${id}/custom-milestones`, data),
  updateAvoMilestone: (id, mid, data) => req('PATCH', `/avo/edits/${id}/custom-milestones/${mid}`, data),
  deleteAvoMilestone: (id, mid) => req('DELETE', `/avo/edits/${id}/custom-milestones/${mid}`),
  avoContractors: (pageId) => req('GET', `/avo/pages/${pageId}/contractors`),
  addAvoContractor: (pageId, data) => req('POST', `/avo/pages/${pageId}/contractors`, data),
  updateAvoContractor: (id, data) => req('PATCH', `/avo/contractors/${id}`, data),
  deleteAvoContractor: (id) => req('DELETE', `/avo/contractors/${id}`),
  holdAvoContractorCost: (id) => req('POST', `/avo/contractors/${id}/hold-cost`),
  avoContractorContract: (id) => req('POST', `/avo/contractors/${id}/contract`),
  vccReport: () => req('GET', '/finance/vcc-report'),
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
  setUserMfaRequired: (id, required) => req('PATCH', `/users/${id}/mfa-required`, { required }),
  resetPassword: (token, password) => req('POST', '/auth/reset-password', { token, password }),
  dashboardToday: () => req('GET', '/dashboard/today'),
  dashboardTeam: () => req('GET', '/dashboard/team'),
  hubGreeting: () => req('GET', '/dashboard/greeting'),
  onTrip: () => req('GET', '/dashboard/on-trip'),
  funFactPrompt: () => req('GET', '/dashboard/funfact/prompt'),
  submitFunFact: (answer) => req('POST', '/dashboard/funfact', { answer }),
  funFactToday: () => req('GET', '/dashboard/funfact/today'),
  submitWob: (data) => req('POST', '/dashboard/wob', data),
  myWobs: () => req('GET', '/dashboard/wob/mine'),
  allWobs: () => req('GET', '/dashboard/wob/all'),
  mailStatus: () => req('GET', '/mail/status'),
  mailAutomations: () => req('GET', '/mail/automations'),
  updateMailAutomation: (key, data) => req('PATCH', `/mail/automations/${key}`, data),
  previewMailAutomation: (key) => req('GET', `/mail/automations/${key}/preview`),
  mailOutbox: (status) => req('GET', `/mail/outbox${status ? `?status=${status}` : ''}`),
  mailOutboxEntry: (id) => req('GET', `/mail/outbox/${id}`),
  deleteMailDraft: (id) => req('DELETE', `/mail/outbox/${id}`),
  requestInvoice: (bid, data) => req('POST', `/finance/budget/${bid}/invoice-request`, data),
  sendClientInvoice: (bid, label, amount, extra) => req('POST', `/finance/budget/${bid}/send-invoice`, { label, amount, ...(extra || {}) }),
  addMyTask: (data) => req('POST', '/dashboard/tasks', data),
  ptoList: () => req('GET', '/team/pto'),
  createPto: (data) => req('POST', '/team/pto', data),
  updatePto: (id, data) => req('PATCH', `/team/pto/${id}`, data),
  deletePto: (id) => req('DELETE', `/team/pto/${id}`),
  avoProjectCodes: () => req('GET', '/avo/project-codes'),
  avoProjects: () => req('GET', '/avo/projects'),
  createAvoProject: (code, title) => req('POST', '/avo/projects', { code, title }),
  avoProject: (id) => req('GET', `/avo/projects/${id}`),
  avoProjectByCode: (code) => req('GET', `/avo/projects/by-code/${encodeURIComponent(code)}`),
  updateAvoProject: (id, data) => req('PATCH', `/avo/projects/${id}`, data),
  deleteAvoProject: (id) => req('DELETE', `/avo/projects/${id}`),
  addAvoGridRow: (pageId, kind) => req('POST', `/avo/projects/${pageId}/${kind}`, {}),
  createAvoTable: (pageId, name) => req('POST', `/avo/projects/${pageId}/tables`, { name }),
  updateAvoTable: (tid, data) => req('PATCH', `/avo/tables/${tid}`, data),
  deleteAvoTable: (tid) => req('DELETE', `/avo/tables/${tid}`),
  addAvoTableRow: (tid) => req('POST', `/avo/tables/${tid}/rows`, {}),
  updateAvoTableRow: (rid, data) => req('PATCH', `/avo/table-rows/${rid}`, data),
  deleteAvoTableRow: (rid) => req('DELETE', `/avo/table-rows/${rid}`),
  uploadAvoAsset: (pageId, data) => req('POST', `/avo/projects/${pageId}/assets`, data),
  updateAvoAsset: (aid, data) => req('PATCH', `/avo/assets/${aid}`, data),
  deleteAvoAsset: (aid) => req('DELETE', `/avo/assets/${aid}`),
  updateAvoGridRow: (kind, rowId, data) => req('PATCH', `/avo/grid/${kind}/${rowId}`, data),
  deleteAvoGridRow: (kind, rowId) => req('DELETE', `/avo/grid/${kind}/${rowId}`),
  vendorInvoices: (pid) => req('GET', `/finance/${pid}/vendor-invoices`),
  searchInvoices: (params) => req('GET', `/finance/vendor-invoices/search?${new URLSearchParams(params)}`),
  uploadVendorInvoice: (pid, data) => req('POST', `/finance/${pid}/vendor-invoices`, data),
  deleteVendorInvoice: (id) => req('DELETE', `/finance/vendor-invoices/${id}`),
  extractVendorInvoice: (id) => req('POST', `/finance/vendor-invoices/${id}/extract`),
  projectOverview: (pid) => req('GET', `/project-overview/${pid}`),
  addCallNote: (pid, data) => req('POST', `/project-overview/${pid}/call-notes`, data),
  updateCallNote: (id, data) => req('PATCH', `/call-notes/${id}`, data),
  deleteCallNote: (id) => req('DELETE', `/call-notes/${id}`),
  addProjectTask: (pid, data) => req('POST', `/project-overview/${pid}/tasks`, data),
  uploadProjectDoc: (pid, data) => req('POST', `/project-overview/${pid}/docs`, data),
  listProjectDocs: (pid, kind) => req('GET', `/project-overview/${pid}/docs${kind ? `?kind=${kind}` : ''}`),
  deleteProjectDoc: (id) => req('DELETE', `/project-docs/${id}`),
  updateProjectTask: (id, data) => req('PATCH', `/project-tasks/${id}`, data),
  deleteProjectTask: (id) => req('DELETE', `/project-tasks/${id}`),
  feedbackList: () => req('GET', '/feedback'),
  addFeedback: (text, attachment) => req('POST', '/feedback', { text, attachment }),
  updateFeedback: (id, data) => req('PATCH', `/feedback/${id}`, data),
  deleteFeedback: (id) => req('DELETE', `/feedback/${id}`),
  replyFeedback: (id, text, attachment) => req('POST', `/feedback/${id}/replies`, { text, attachment }),
  editFeedbackReply: (id, idx, text, attachment) => req('PATCH', `/feedback/${id}/replies/${idx}`, { text, attachment }),
  clientRoster: () => req('GET', '/clients/roster'),
  addClient: (name, force) => req('POST', '/clients/roster', { name, force }),
  clientContacts: () => req('GET', '/clients/contacts'),
  clientContactPeople: () => req('GET', '/clients/contact-people'),
  saveContactPerson: (data) => req('POST', '/clients/contact-people', data),
  saveClientContact: (client, data) => req('PATCH', `/clients/${encodeURIComponent(client)}/contact`, data),
  clientMeta: (client) => req('GET', `/clients/${encodeURIComponent(client)}/meta`),
  setClientHubPassword: (client, hubPassword) => req('PATCH', `/clients/${encodeURIComponent(client)}/meta`, { hubPassword }),
  clientResources: (client) => req('GET', `/clients/${encodeURIComponent(client)}/resources`),
  uploadClientResource: (client, data) => req('POST', `/clients/${encodeURIComponent(client)}/resources`, data),
  deleteClientResource: (id) => req('DELETE', `/clients/resources/${id}`),
  taggableUsers: () => req('GET', '/finance/taggable-users'),
  budgetTags: (bid) => req('GET', `/finance/budgets/${bid}/tags`),
  addBudgetTag: (bid, userId) => req('POST', `/finance/budgets/${bid}/tags`, { userId }),
  addBudgetTagByName: (bid, name) => req('POST', `/finance/budgets/${bid}/tags`, { name }),
  removeBudgetTag: (bid, userId) => req('DELETE', `/finance/budgets/${bid}/tags/${userId}`),
  getHarbinger: (pid) => req('GET', `/finance/${pid}/harbinger`),
  submitHarbinger: (pid, data) => req('POST', `/finance/${pid}/harbinger`, data),
  harbingerSow: (pid) => req('POST', `/finance/${pid}/harbinger-sow`, {}),
  gearRequests: () => req('GET', '/gear-requests'),
  gearOverview: () => req('GET', '/gear-requests/overview'),
  gearReport: () => req('GET', '/gear-requests/report'),
  vendorContractReport: () => req('GET', '/reports/vendor-contracts'),
  vendorContractDetail: (aid) => req('GET', `/reports/vendor-contracts/${aid}/detail`),
  gearRequestProjects: () => req('GET', '/gear-requests/available-projects'),
  gearRequestForProject: (pid) => req('GET', `/gear-requests/project/${pid}`),
  createGearRequest: (data) => req('POST', '/gear-requests', data),
  amendGearRequest: (pid, data) => req('POST', `/gear-requests/project/${pid}/amend`, data),
  gearActivity: (pid) => req('GET', `/gear-requests/project/${pid}/activity`),
  addGearActivity: (pid, body) => req('POST', `/gear-requests/project/${pid}/activity`, { body }),
  updateProject: (id, data) => req('PATCH', `/projects/${id}`, data),
  deleteProject: (id) => req('DELETE', `/projects/${id}`),

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
  resourceTags: () => req('GET', '/resources/tags'),
  addResourceTag: (name) => req('POST', '/resources/tags', { name }),
  resourceLinks: (kind) => req('GET', `/resources/${kind}`),
  addResourceLink: (kind, data) => req('POST', `/resources/${kind}`, data),
  updateResourceLink: (kind, id, data) => req('PATCH', `/resources/${kind}/${id}`, data),
  deleteResourceLink: (kind, id) => req('DELETE', `/resources/${kind}/${id}`),
  getProjectTalentCalls: (projectId) => req('GET', `/projects/${projectId}/talent-day-calls`),
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
  createPosition: (name, sortOrder) => req('POST', '/crew/positions', { name, ...(sortOrder != null ? { sortOrder } : {}) }),

  // Crew assignments
  getProjectCrew: (projectId) => req('GET', `/projects/${projectId}/crew`),
  draftCallSheetEmail: (projectId, length) => req('POST', `/projects/${projectId}/call-sheet-email-draft`, { length }),
  addCrewSlot: (projectId, data) => req('POST', `/projects/${projectId}/crew`, data),
  createProjectCrew: (projectId, data) => req('POST', `/projects/${projectId}/crews`, data),
  updateProjectCrew: (projectId, cid, data) => req('PATCH', `/projects/${projectId}/crews/${cid}`, data),
  deleteProjectCrew: (projectId, cid) => req('DELETE', `/projects/${projectId}/crews/${cid}`),
  updateCrewSlot: (projectId, id, data) => req('PATCH', `/projects/${projectId}/crew/${id}`, data),
  removeCrewSlot: (projectId, id) => req('DELETE', `/projects/${projectId}/crew/${id}`),
  createContract: (projectId, aid, data) => req('POST', `/projects/${projectId}/crew/${aid}/contract`, data),
  getContracts: (projectId) => req('GET', `/projects/${projectId}/contracts`),
  getContract: (token) => req('GET', `/contract/${token}`),
  signContract: (token, name) => req('POST', `/contract/${token}/sign`, { name }),
  emailContract: (projectId, cid, data) => req('POST', `/projects/${projectId}/contracts/${cid}/email`, data || {}),
  contractEmailPrefill: (projectId, cid) => req('GET', `/projects/${projectId}/contracts/${cid}/email-prefill`),

  // ProFi — project finance
  financeProjects: () => req('GET', '/finance/projects'),
  financeBundle: (pid) => req('GET', `/finance/${pid}`),
  createBudget: (pid) => req('POST', `/finance/${pid}/budget`),
  driveRoster: () => req('GET', '/gear-assets/drives'),
  assignDrive: (assetId, projectId) => req('POST', `/gear-assets/drives/${assetId}/assign`, { projectId }),
  returnDrive: (assetId) => req('POST', `/gear-assets/drives/${assetId}/return`),
  gearInventory: (projectId) => req('GET', `/gear-assets/inventory${projectId ? `?projectId=${projectId}` : ''}`),
  getAssets: (q) => req('GET', '/gear-assets' + (q ? '?q=' + encodeURIComponent(q) : '')),
  createAsset: (data) => req('POST', '/gear-assets', data),
  updateAsset: (id, data) => req('PATCH', `/gear-assets/${id}`, data),
  deleteAsset: (id) => req('DELETE', `/gear-assets/${id}`),
  importAssets: (rows) => req('POST', '/gear-assets/import', { rows }),
  linkShootCandidates: (sid) => req('GET', `/finance/section/${sid}/link-candidates`),
  linkShootProject: (sid, projectId) => req('POST', `/finance/section/${sid}/link-shoot`, { projectId }),
  startBudgetVersion: (bid) => req('POST', `/finance/budget/${bid}/version`),
  budgetVersions: (pid) => req('GET', `/finance/${pid}/versions`),
  budgetVersion: (vid) => req('GET', `/finance/versions/${vid}`),
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
  addTentativeEstimate: (eid) => req('POST', `/finance/estimates/${eid}/tentative`),
  removeTentativeEstimate: (eid) => req('DELETE', `/finance/estimates/${eid}/tentative`),

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
  uploadShotPhoto: (projectId, shotId, data) => req('POST', `/projects/${projectId}/shot-list/shots/${shotId}/photos`, data),
  shotReferencePhotos: (projectId) => req('GET', `/projects/${projectId}/shot-list/reference-photos`),
  deleteShotPhoto: (pid) => req('DELETE', `/projects/shot-photos/${pid}`),
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
  placeSearch: (q) => req('GET', `/util/place-search?q=${encodeURIComponent(q)}`),

  // Foodie recs
  getFoodieRecs: () => req('GET', '/foodie'),
  addFoodieRec: (data) => req('POST', '/foodie', data),
  deleteFoodieRec: (id) => req('DELETE', `/foodie/${id}`),
  rateFoodieRec: (id, rating) => req('POST', `/foodie/${id}/rate`, { rating }),
  addFoodiePhoto: (id, data) => req('POST', `/foodie/${id}/photos`, data),
  deleteFoodiePhoto: (id) => req('DELETE', `/foodie/photos/${id}`),
  geoSearch: (q) => req('GET', `/util/geo-search?q=${encodeURIComponent(q)}`),
  flightLookup: (flight, date, origin) => req('GET', `/util/flight-lookup?flight=${encodeURIComponent(flight)}&date=${date}${origin ? `&origin=${encodeURIComponent(origin)}` : ''}`),
  flightStatus: (flight, date, origin) => req('GET', `/util/flight-status?flight=${encodeURIComponent(flight)}&date=${date}${origin ? `&origin=${encodeURIComponent(origin)}` : ''}`),
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
