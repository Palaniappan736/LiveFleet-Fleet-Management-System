import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Auth APIs
export const authAPI = {
  register: (email, password, name, role) =>
    api.post('/auth/register', { email, password, name, role }),
  login: (email, password) =>
    api.post('/auth/login', { email, password }),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (name, phone) =>
    api.put('/auth/profile', { name, phone })
};

// OBD Live APIs (MQTT-backed)
export const obdLiveAPI = {
  getLatest: (busId) => api.get(`/obd-live/${busId}`),
  getAll:    ()      => api.get('/obd-live/all'),
  getStatus: ()      => api.get('/obd-live/status'),
  getHistory: (busId, limit = 100) => api.get(`/obd-live/${busId}/history?limit=${limit}`),
};

// MQTT management APIs — used by Settings page
export const mqttAPI = {
  getStatus:    ()       => api.get('/obd-live/mqtt/status'),
  connect:      (config) => api.post('/obd-live/mqtt/connect', config),
  disconnect:   ()       => api.post('/obd-live/mqtt/disconnect'),
  getDbStatus:  ()       => api.get('/obd-live/db/status'),
};

// System mode APIs
export const systemAPI = {
  getMode: () => api.get('/obd-live/system/mode'),
  setMode: (mode) => api.put('/obd-live/system/mode', { mode }),
};

// Demo APIs
export const demoAPI = {
  getDemoBuses: () => api.get('/demo/buses'),
  getDemoBusById: (id) => api.get(`/demo/buses/${id}`),
  getDemoDrivers: () => api.get('/demo/drivers'),
  getDemoReports: () => api.get('/demo/reports')
};

// Bus APIs
export const busAPI = {
  getAllBuses: () => api.get('/buses'),
  getBus: (id) => api.get(`/buses/${id}`),
  createBus: (data) => api.post('/buses', data),
  updateBus: (id, data) => api.put(`/buses/${id}`, data),
  deleteBus: (id) => api.delete(`/buses/${id}`),
  getStudentBus: () => api.get('/buses/student/my-bus')
};

// Location APIs
export const locationAPI = {
  updateLocation: (busId, latitude, longitude) =>
    api.post('/location/update', { busId, latitude, longitude }),
  getLastLocation: (busId) =>
    api.get(`/location/${busId}/latest`),
  getLocationHistory: (busId, limit = 100) =>
    api.get(`/location/${busId}/history?limit=${limit}`)
};

// Fuel APIs
export const fuelAPI = {
  updateFuel: (busId, fuelLevel) =>
    api.post('/fuel/update', { busId, fuelLevel }),
  getFuel: (busId, days = 7) =>
    api.get(`/fuel/${busId}?days=${days}`),
  getFuelSummary: (busId) =>
    api.get(`/fuel/${busId}/summary`)
};

// Alert APIs
export const alertAPI = {
  getAlerts: (unread = false) =>
    api.get(`/alerts?unread=${unread}`),
  getBusAlerts: (busId) =>
    api.get(`/alerts/bus/${busId}`),
  createAlert: (busId, type, message, severity) =>
    api.post('/alerts', { busId, type, message, severity }),
  markRead: (id) => api.put(`/alerts/${id}/read`),
  deleteAlert: (id) => api.delete(`/alerts/${id}`)
};

// Maintenance APIs
export const maintenanceAPI = {
  createMaintenance: (busId, issue, scheduledDate, priority) =>
    api.post('/maintenance', { busId, issue, scheduledDate, priority }),
  getMaintenance: (busId) =>
    api.get(`/maintenance/${busId}`),
  updateMaintenance: (id, status, notes) =>
    api.put(`/maintenance/${id}`, { status, notes }),
  getPendingMaintenance: () =>
    api.get('/maintenance/pending/all')
};

// Driver APIs
export const driverAPI = {
  getAllDrivers: () => api.get('/drivers'),
  createDriver: (name, phone, licenseNumber, email) =>
    api.post('/drivers', { name, phone, licenseNumber, email }),
  updateDriver: (id, data) =>
    api.put(`/drivers/${id}`, data),
  deleteDriver: (id) => api.delete(`/drivers/${id}`)
};

// Route APIs
export const routeAPI = {
  getAllRoutes: () => api.get('/routes'),
  getRoute: (id) => api.get(`/routes/${id}`),
  createRoute: (routeName, stops) =>
    api.post('/routes', { routeName, stops }),
  updateRoute: (id, data) =>
    api.put(`/routes/${id}`, data),
  deleteRoute: (id) => api.delete(`/routes/${id}`)
};

// Reports APIs
export const reportsAPI = {
  getMonthlyReport: (busId, month, year) => api.get(`/reports/monthly/${busId}?month=${month}&year=${year}`),
  getFleetSummary:  () => api.get('/reports/fleet-summary'),
  getHistory:       (busId, { from, to, limit = 100, offset = 0 } = {}) =>
    api.get(`/reports/history/${busId}?limit=${limit}&offset=${offset}${from ? `&from=${from}` : ''}${to ? `&to=${to}` : ''}`),
  getExportCsvUrl:  (busId, month, year) => {
    const token = localStorage.getItem('token') || '';
    return { url: `${API_BASE_URL}/reports/export/csv/${busId}?month=${month}&year=${year}`, token };
  },
};

// Student APIs
export const studentAPI = {
  getStudentBuses: () => api.get('/buses/student/my-bus')
};

export default api;

