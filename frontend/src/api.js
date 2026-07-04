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

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  // Auth
  login: (email, password) => req('POST', '/auth/login', { email, password }),
  register: (name, email, password) => req('POST', '/auth/register', { name, email, password }),
  me: () => req('GET', '/auth/me'),

  // Projects
  getProjects: () => req('GET', '/projects'),
  getProject: (id) => req('GET', `/projects/${id}`),
  createProject: (data) => req('POST', '/projects', data),
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
    const r = await fetch(url);
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
    const r = await fetch(url);
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Failed');
    return data;
  },
  createShareQuestion: async (token, pw, question) => {
    const url = `${BACKEND}/api/share/${token}/questions${pw ? `?pw=${encodeURIComponent(pw)}` : ''}`;
    const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ question }) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Failed');
    return data;
  },
  // Shot List Days
  getDays: (projectId) => req('GET', `/projects/${projectId}/shot-list/days`),
  createDay: (projectId, data) => req('POST', `/projects/${projectId}/shot-list/days`, data),
  updateDay: (projectId, id, data) => req('PATCH', `/projects/${projectId}/shot-list/days/${id}`, data),
  deleteDay: (projectId, id) => req('DELETE', `/projects/${projectId}/shot-list/days/${id}`),

  // Shot List
  updateShareShot: (token, shotId, data) => req('PATCH', `/share/${token}/shots/${shotId}`, data),
  updateShareScene: (token, sceneId, data) => req('PATCH', `/share/${token}/scenes/${sceneId}`, data),
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
    const r = await fetch(url, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ answer }) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Failed');
    return data;
  },
};
