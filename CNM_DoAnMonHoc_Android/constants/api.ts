const envApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const envSocketUrl = process.env.EXPO_PUBLIC_SOCKET_URL?.trim();
const defaultRemoteApiUrl = 'https://ngochien-ott.duckdns.org';

export const API_BASE_URL = (envApiUrl || defaultRemoteApiUrl).replace(/\/$/, '');
export const SOCKET_URL = (envSocketUrl || envApiUrl || defaultRemoteApiUrl).replace(/\/$/, '');
