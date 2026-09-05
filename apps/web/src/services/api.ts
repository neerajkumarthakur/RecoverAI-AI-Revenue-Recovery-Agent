import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
});

api.interceptors.request.use((config) => {
  const apiKey = localStorage.getItem('recoverai_api_key') || import.meta.env.VITE_DEMO_API_KEY || '';
  if (apiKey) {
    config.headers.Authorization = `Bearer ${apiKey}`;
  }
  return config;
});

// API functions
export const dashboardApi = {
  getSummary: () => api.get('/dashboard/summary'),
  getRecoveryTrends: () => api.get('/dashboard/recovery-trends'),
  getFailureBreakdown: () => api.get('/dashboard/failure-breakdown'),
};

export const casesApi = {
  list: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get('/recovery-cases', { params }),
  get: (id: string) => api.get(`/recovery-cases/${id}`),
  analyze: (id: string) => api.post(`/recovery-cases/${id}/analyze`),
  approve: (id: string) => api.post(`/recovery-cases/${id}/approve`),
  reject: (id: string, reason?: string) =>
    api.post(`/recovery-cases/${id}/reject`, { reason }),
};

export const paymentsApi = {
  list: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get('/payments', { params }),
  get: (id: string) => api.get(`/payments/${id}`),
};

export default api;
