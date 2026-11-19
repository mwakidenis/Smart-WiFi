// frontend/src/lib/api.ts
// ContentManager-based AJAX client for Smart Wifi
// Follows the Comprehensive System Prompt & Engineering Specification

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach JWT token
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('token');
      }
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  register: (body: { email: string; phone: string; password: string; name?: string }) =>
    api.post('/auth/register', body),
  login: (body: { email?: string; phone?: string; password: string }) =>
    api.post('/auth/login', body),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

export const packageApi = {
  list: () => api.get('/packages'),
};

export const paymentApi = {
  stkPush: (body: { phone: string; amount: number; packageId?: string }) =>
    api.post('/mpesa/stk-push', body),
  callback: (body: Record<string, unknown>) =>
    api.post('/mpesa/callback', body),
};

export const sessionApi = {
  status: (params: { macAddress?: string | null; ipAddress?: string | null }) =>
    api.get('/session/status', { params }),
  restore: (body: { phone?: string; mpesaReceiptNumber?: string; macAddress: string }) =>
    api.post('/session/restore', body),
};

export const loanApi = {
  eligibility: () => api.get('/loans/eligibility'),
  borrow: (body: { amount: number }) => api.post('/api/loans/borrow', body),
  list: () => api.get('/api/loans'),
  repay: (id: string, body: { amount: number }) =>
    api.post(`/api/loans/${id}/repay`, body),
  approve: (id: string) => api.post(`/api/loans/${id}/approve`),
};

export const adminApi = {
  routerHealth: () => api.get('/admin/router-health'),
  sessions: () => api.get('/admin/sessions'),
  revenue: () => api.get('/admin/revenue'),
  users: () => api.get('/admin/users'),
  provisionMac: (body: { macAddress: string; comment?: string }) =>
    api.post('/admin/provision-mac', body),
};

export const timeApi = {
  remaining: (phone: string) => api.get(`/time-remaining?phone=${encodeURIComponent(phone)}`),
};

export const supportApi = {
  create: (body: { phone: string; transactionCode?: string; message: string }) =>
    api.post('/support', body),
  list: () => api.get('/support'),
};

export const healthApi = {
  health: () => api.get('/health'),
  time: () => api.get('/time'),
};
