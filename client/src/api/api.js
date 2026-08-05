import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('at_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response && err.response.status === 401) {
      localStorage.removeItem('at_token');
      localStorage.removeItem('at_user');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export const errMsg = (err) =>
  err?.response?.data?.error || err?.message || 'Something went wrong. Please try again.';

// --- Auth ---
export const login = (username, password) => api.post('/auth/login', { username, password });
export const getMe = () => api.get('/auth/me');
export const changePassword = (currentPassword, newPassword) =>
  api.post('/auth/change-password', { currentPassword, newPassword });

// --- Dashboard ---
export const getDashboardSummary = () => api.get('/dashboard/summary');
export const getAvailableAssets = (params) => api.get('/items', { params: { ...params, status: 'available' } });

// --- Items ---
export const listItems = (params) => api.get('/items', { params });
export const getItem = (id) => api.get(`/items/${id}`);
export const createItem = (data) => api.post('/items', data);
export const updateItem = (id, data) => api.put(`/items/${id}`, data);
export const listCategories = () => api.get('/items/categories');
export const createCategory = (data) => api.post('/items/categories', data);
export const listSubcategories = (category_id) => api.get('/items/subcategories', { params: category_id ? { category_id } : {} });
export const createSubcategory = (data) => api.post('/items/subcategories', data);
export const importItems = (formData) =>
  api.post('/items/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const downloadImportTemplate = async () => {
  const res = await api.get('/items/import/template', { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'asset-import-template.xlsx');
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// --- Checkouts ---
export const listCheckouts = (params) => api.get('/checkouts', { params });
export const checkOutItem = (data) => api.post('/checkouts', data);
export const checkInItem = (id, data) => api.post(`/checkouts/${id}/checkin`, data);

// --- Maintenance ---
export const listTickets = (params) => api.get('/maintenance', { params });
export const createTicket = (data) => api.post('/maintenance', data);
export const updateTicket = (id, data) => api.put(`/maintenance/${id}`, data);

// --- Retirements ---
export const listRetirements = (params) => api.get('/retirements', { params });
export const retireItem = (data) => api.post('/retirements', data);

// --- Asset History (hierarchical: category -> subcategory -> asset -> timeline) ---
export const listHistoryCategories = () => api.get('/history/categories');
export const listHistorySubcategories = (category_id) => api.get('/history/subcategories', { params: { category_id } });
export const listHistoryAssets = (params) => api.get('/history/assets', { params });
export const getAssetTimeline = (itemId, params) => api.get(`/history/timeline/${itemId}`, { params });

// --- Audit ---
export const listAudit = (params) => api.get('/audit', { params });

// --- Users ---
export const listUsers = () => api.get('/users');
export const createUser = (data) => api.post('/users', data);
export const updateUser = (id, data) => api.put(`/users/${id}`, data);

// --- Backups ---
export const listBackups = () => api.get('/backups');
export const createBackup = () => api.post('/backups');
export const restoreBackup = (formData) =>
  api.post('/backups/restore', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const restoreFromExisting = (filename) => api.post('/backups/restore', { filename });
export const downloadBackupFile = async (filename) => {
  const res = await api.get(`/backups/download/${filename}`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// --- Reports ---
// Reports require the Authorization header, so we fetch as a blob via axios
// (which the interceptor above attaches the token to) and trigger a download.
export const downloadReport = async (type, params = {}) => {
  const res = await api.get(`/reports/${type}`, { params, responseType: 'blob' });
  const disposition = res.headers['content-disposition'] || '';
  const match = disposition.match(/filename="(.+)"/);
  const filename = match ? match[1] : `${type}-report`;
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export default api;
