import axios from 'axios';
import { API_BASE_URL } from '@/constants/api';
import { getSession } from '@/services/session-storage';

let isBootstrapped = false;

export function bootstrapHttp() {
  if (isBootstrapped) return;

  axios.defaults.baseURL = API_BASE_URL;
  axios.defaults.timeout = 20000;

  axios.interceptors.request.use(async config => {
    const session = await getSession();
    const headers = config.headers ?? {};

    if (session?.token) {
      headers.Authorization = `Bearer ${session.token}`;
    }

    if (session?.sessionId) {
      headers['X-Session-Id'] = session.sessionId;
    }

    config.headers = headers;
    return config;
  });

  isBootstrapped = true;
}

export function getApiErrorMessage(error: any, fallback = 'Da co loi xay ra') {
  return error?.response?.data?.message || error?.message || fallback;
}

bootstrapHttp();
