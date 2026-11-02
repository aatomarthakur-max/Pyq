import axios from 'axios';

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin-token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const fileUrl = (p, download = false) =>
  p.file_path
    ? `${API}/papers/${p.id}/file${download ? '?download=true' : ''}`
    : p.official_url;

export function errorText(err) {
  const d = err?.response?.data?.detail;
  if (!d) return 'Something went wrong. Please try again.';
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map((e) => e?.msg || JSON.stringify(e)).join(' ');
  return String(d);
}

export const pick = (lang, obj, key) =>
  (lang === 'hi' && obj?.[`${key}_hi`]) || obj?.[key] || '';
