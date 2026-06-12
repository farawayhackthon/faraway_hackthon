const TOKEN_KEY = 'token';
const USER_KEY = 'user';
const ROLE_KEY = 'role';

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage;
}

export function getToken(): string {
  return getStorage()?.getItem(TOKEN_KEY) ?? '';
}

export function getRole(): string {
  return getStorage()?.getItem(ROLE_KEY) ?? '';
}

export function getUser<T = { id: string; name: string; role: string; username: string }>(): T | null {
  const raw = getStorage()?.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setAuth(token: string, user: unknown, role: string): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(TOKEN_KEY, token);
  storage.setItem(USER_KEY, JSON.stringify(user));
  storage.setItem(ROLE_KEY, role);
}

export function clearAuth(): void {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(TOKEN_KEY);
  storage.removeItem(USER_KEY);
  storage.removeItem(ROLE_KEY);
}

export function isAuthenticated(): boolean {
  return Boolean(getToken() && getRole());
}
