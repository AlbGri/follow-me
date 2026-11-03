/**
 * @typedef {{id: string, name: string, lat: number, lng: number, time: string}} Stop
 * @typedef {{id: string, label: string, stops: Stop[]}} Day
 * @typedef {{id: string, title: string, days: Day[]}} Trip
 * @typedef {{trips: Trip[], currentId: string}} State
 */

const STORAGE_KEY = 'followme.state';

/** @returns {State} stato salvato, o uno nuovo con un viaggio vuoto. */
export function loadState() {
  let state = null;
  try {
    state = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    // dati corrotti: si riparte da zero
  }
  if (!state?.trips?.length) {
    const trip = createTrip();
    state = { trips: [trip], currentId: trip.id };
  }
  if (!state.trips.some((trip) => trip.id === state.currentId)) {
    state.currentId = state.trips[0].id;
  }
  return state;
}

/** @param {State} state */
export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** @returns {Trip} */
export function createTrip() {
  return { id: newId(), title: '', days: [createDay()] };
}

/** @returns {Day} */
export function createDay() {
  return { id: newId(), label: '', stops: [] };
}

/** @returns {Stop} */
export function createStop(name, lat, lng) {
  return { id: newId(), name, lat: roundCoordinate(lat), lng: roundCoordinate(lng), time: '' };
}

// 5 decimali = circa 1 metro, abbastanza per una tappa
export function roundCoordinate(value) {
  return Math.round(value * 1e5) / 1e5;
}

function newId() {
  return crypto.randomUUID();
}
