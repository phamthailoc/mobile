import * as SecureStore from 'expo-secure-store';

const SESSION_STORAGE_KEY = 'cnm.mobile.session.v1';

export type AuthSession = {
  token: string;
  username: string;
  displayName?: string;
  role?: string;
  avatar?: string | null;
  sessionId?: string;
  [key: string]: any;
};

let cachedSession: AuthSession | null = null;
let isHydrated = false;

function normalizeSession(session: any): AuthSession | null {
  if (!session) return null;

  const source = session?.user || session?.data || session;
  const token = source?.token || source?.accessToken || source?.jwt || source?.authToken || session?.token || session?.accessToken || session?.jwt || session?.authToken || '';
  const sessionId = source?.sessionId || source?.session_id || session?.sessionId || session?.session_id || '';
  const username = source?.username || session?.username || session?.user?.username || '';

  return {
    ...source,
    ...session,
    token,
    sessionId,
    username,
    displayName: source?.displayName || session?.displayName || session?.user?.displayName || '',
    role: source?.role || session?.role || session?.user?.role || '',
    avatar: source?.avatar ?? session?.avatar ?? session?.user?.avatar ?? null,
  };
}

async function hydrateFromStorage() {
  if (isHydrated) return;

  try {
    const raw = await SecureStore.getItemAsync(SESSION_STORAGE_KEY);
    cachedSession = normalizeSession(raw ? JSON.parse(raw) : null);
  } catch {
    cachedSession = null;
  } finally {
    isHydrated = true;
  }
}

export async function getSession() {
  await hydrateFromStorage();
  return cachedSession;
}

export async function saveSession(session: AuthSession) {
  cachedSession = normalizeSession(session);
  isHydrated = true;
  await SecureStore.setItemAsync(SESSION_STORAGE_KEY, JSON.stringify(cachedSession));
}

export async function clearSession() {
  cachedSession = null;
  isHydrated = true;
  await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
}

export function getSessionSync() {
  return cachedSession;
}
