import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const api = axios.create({
  baseURL: `${API_URL}/api`,
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
});

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  signup: (data) => api.post('/auth/signup', data),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  getMe: () => api.get('/auth/me')
};

// Users APIs
export const usersAPI = {
  getAll: (params) => api.get('/users', { params }),
  getAllWithMembership: (params) => api.get('/admin/users-with-membership', { params }),
  getById: (id) => api.get(`/users/${id}`),
  create: (data, role = 'member') => api.post(`/users?role=${role}`, data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  bulkDelete: (userIds) => api.post('/admin/users/bulk-delete', userIds),
  toggleStatus: (id, action) => api.post(`/admin/users/${id}/toggle-status`, { action }),
  revokeMembership: (id) => api.post(`/admin/users/${id}/revoke-membership`),
  resetPassword: (id, newPassword) => api.post(`/admin/users/${id}/reset-password`, { new_password: newPassword }),
  changePassword: (data) => api.post('/users/change-password', data)
};

// Plans APIs
export const plansAPI = {
  getAll: (activeOnly = false) => api.get('/plans', { params: { active_only: activeOnly } }),
  create: (data) => api.post('/plans', data),
  update: (id, data) => api.put(`/plans/${id}`, data),
  delete: (id) => api.delete(`/plans/${id}`)
};

// Memberships APIs
export const membershipsAPI = {
  getAll: (userId) => api.get('/memberships', { params: { user_id: userId } }),
  getActive: (userId) => api.get(`/memberships/active/${userId}`),
  create: (data) => api.post('/memberships', data),
  cancel: (id) => api.put(`/memberships/${id}/cancel`)
};

// Payments APIs
export const paymentsAPI = {
  getAll: (params) => api.get('/payments', { params }),
  getTodayCollection: () => api.get('/payments/today-collection'),
  getSummary: (period, date) => api.get('/payments/summary', { params: { period, date } }),
  create: (data) => api.post('/payments', data)
};

// Payment Requests APIs
export const paymentRequestsAPI = {
  getAll: (status) => api.get('/payment-requests', { params: { status } }),
  create: (data) => api.post('/payment-requests', data),
  approve: (id, discount, paymentMethod) => 
    api.put(`/payment-requests/${id}/approve?discount=${discount}&payment_method=${paymentMethod}`)
};

// Attendance APIs
export const attendanceAPI = {
  getAll: (params) => api.get('/attendance', { params }),
  getToday: () => api.get('/attendance/today'),
  getUserHistory: (userId) => api.get(`/attendance/user/${userId}`),
  mark: (memberId) => api.post('/attendance', { member_id: memberId })
};

// Holidays APIs
export const holidaysAPI = {
  getAll: () => api.get('/holidays'),
  create: (data) => api.post('/holidays', data),
  delete: (id) => api.delete(`/holidays/${id}`)
};

// Announcements APIs
export const announcementsAPI = {
  getAll: () => api.get('/announcements'),
  create: (data) => api.post('/announcements', data),
  delete: (id) => api.delete(`/announcements/${id}`)
};

// Settings APIs
export const settingsAPI = {
  get: () => api.get('/settings'),
  updateSMTP: (data) => api.put('/settings/smtp', data),
  testSMTP: (email) => api.post(`/settings/smtp/test?to_email=${email}`),
  updateWhatsApp: (data) => api.put('/settings/whatsapp', data),
  testWhatsApp: (number) => api.post(`/settings/whatsapp/test?to_number=${number}`)
};

// Dashboard APIs
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats')
};

// Health Logs APIs
export const healthLogsAPI = {
  getAll: (userId) => api.get('/health-logs', { params: { user_id: userId } }),
  create: (data) => api.post('/health-logs', data)
};

// Trainer APIs
export const trainerAPI = {
  getClients: () => api.get('/trainer/clients'),
  getTrainers: () => api.get('/trainers')
};

// Razorpay APIs
export const razorpayAPI = {
  createOrder: (planId) => api.post('/razorpay/create-order', { plan_id: planId }),
  verifyPayment: (data) => api.post('/razorpay/verify-payment', data)
};

// Upload APIs
export const uploadAPI = {
  profilePhoto: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload/profile-photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};

// Seed API
export const seedAPI = {
  seed: () => api.post('/seed')
};

export default api;
