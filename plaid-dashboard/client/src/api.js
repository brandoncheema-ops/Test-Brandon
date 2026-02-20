import axios from 'axios';

// In production (same origin), use /api. In development, use localhost:8000
const API_BASE = process.env.REACT_APP_API_URL ||
  (window.location.port === '3001' ? 'http://localhost:8000/api' : '/api');

const api = axios.create({ baseURL: API_BASE });

export default api;
