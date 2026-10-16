import { emptySession, type Session } from '../../../../packages/types.js';

const KEY = 'supertutor.session.v1';

export const loadSession = (): Session => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptySession();
    const parsed = JSON.parse(raw) as Session;
    // Shallow guard: a stale shape should reset, not crash the demo.
    if (!parsed || typeof parsed !== 'object' || !('answers' in parsed)) return emptySession();
    return { ...emptySession(), ...parsed };
  } catch {
    return emptySession();
  }
};

export const saveSession = (session: Session) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...session, updatedAt: Date.now() }));
  } catch {
    // Storage full or blocked — the app keeps working, it just won't survive a reload.
  }
};

export const clearSession = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* no-op */
  }
};
