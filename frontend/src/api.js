const BACKEND = import.meta.env.VITE_API_URL || 'https://freepro-production.up.railway.app';
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
  createTalent: (projectId, data) => req('POST', `/projects/${projectId}/talent`, data),
  updateTalent: (projectId, id, data) => req('PATCH', `/projects/${projectId}/talent/${id}`, data),
  deleteTalent: (projectId, id) => req('DELETE', `/projects/${projectId}/talent/${id}`),

  // Crew roster
  getCrew: () => req('GET', '/crew'),
  createCrewMember: (data) => req('POST', '/crew', data),
  updateCrewMember: (id, data) => req('PATCH', `/crew/${id}`, data),

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

  // Deliverables
  getDeliverables: (projectId) => req('GET', `/projects/${projectId}/deliverables`),
  createDeliverable: (projectId, data) => req('POST', `/projects/${projectId}/deliverables`, data),
  updateDeliverable: (projectId, id, data) => req('PATCH', `/projects/${projectId}/deliverables/${id}`, data),
  deleteDeliverable: (projectId, id) => req('DELETE', `/projects/${projectId}/deliverables/${id}`),

  // Shares
  getShares: (id) => req('GET', `/projects/${id}/shares`),
  createShare: (id, data) => req('POST', `/projects/${id}/shares`, data),
  deleteShare: (id, sid) => req('DELETE', `/projects/${id}/shares/${sid}`),
  getPublicShare: (token) => fetch(`${BACKEND}/share/${token}`).then(r => r.json()),

  // Travel
  getHotels: (projectId) => req('GET', `/projects/${projectId}/travel/hotels`),
  createHotel: (projectId, data) => req('POST', `/projects/${projectId}/travel/hotels`, data),
  addGuest: (projectId, hotelId, data) => req('POST', `/projects/${projectId}/travel/hotels/${hotelId}/guests`, data),
  updateGuest: (projectId, guestId, data) => req('PATCH', `/projects/${projectId}/travel/guests/${guestId}`, data),
  deleteGuest: (projectId, guestId) => req('DELETE', `/projects/${projectId}/travel/guests/${guestId}`),
  getFlights: (projectId) => req('GET', `/projects/${projectId}/travel/flights`),
  createFlight: (projectId, data) => req('POST', `/projects/${projectId}/travel/flights`, data),
  deleteFlight: (projectId, id) => req('DELETE', `/projects/${projectId}/travel/flights/${id}`),
  getDrives: (projectId) => req('GET', `/projects/${projectId}/travel/drives`),
  createDrive: (projectId, data) => req('POST', `/projects/${projectId}/travel/drives`, data),
  deleteDrive: (projectId, id) => req('DELETE', `/projects/${projectId}/travel/drives/${id}`),
  hotelSearch: (q) => req('GET', `/util/hotel-search?q=${encodeURIComponent(q)}`),
  flightLookup: (flight, date) => req('GET', `/util/flight-lookup?flight=${encodeURIComponent(flight)}&date=${date}`),
  flightStatus: (flight, date) => req('GET', `/util/flight-status?flight=${encodeURIComponent(flight)}&date=${date}`),
  getRentalCars: (projectId) => req('GET', `/projects/${projectId}/travel/rental-cars`),
  createRentalCar: (projectId, data) => req('POST', `/projects/${projectId}/travel/rental-cars`, data),
  deleteRentalCar: (projectId, id) => req('DELETE', `/projects/${projectId}/travel/rental-cars/${id}`),
};
