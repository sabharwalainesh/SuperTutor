import { Router, type CookieOptions, type RequestHandler } from 'express';
import { connectorTokenInputSchema, credentialsSchema, idSchema } from './schemas.js';
import type { TutorStore } from './tutor-state.js';
import { SESSION_COOKIE, SESSION_TTL_MS } from './types.js';

/** SameSite=Lax keeps the cookie off cross-site writes, which is this app's CSRF defense. */
export const sessionCookieOptions = (secure: boolean): CookieOptions => ({
  httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: SESSION_TTL_MS,
});

export const createSessionMiddleware = (store: TutorStore): RequestHandler => (req, res, next) => {
  const secret = req.cookies?.[SESSION_COOKIE];
  res.locals.ownerId = typeof secret === 'string' && secret ? store.resolveSession(secret) : null;
  next();
};

export const requireAccount: RequestHandler = (_req, res, next) => {
  if (!res.locals.ownerId) return res.status(401).json({ error: 'Sign in to open your workspace.' });
  next();
};

export const createAuthRouter = (store: TutorStore, { secureCookies }: { secureCookies: boolean }) => {
  const router = Router();
  const options = sessionCookieOptions(secureCookies);
  const identify = (req: { ip?: string; body?: unknown }) => {
    const email = typeof (req.body as { email?: unknown })?.email === 'string' ? (req.body as { email: string }).email.toLowerCase() : '';
    return `${req.ip ?? 'unknown'}|${email}`;
  };

  router.post('/signup', async (req, res, next) => {
    try {
      store.limitAuthentication(identify(req));
      const result = credentialsSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json({ error: result.error.issues[0].message });
      const { account, sessionSecret } = await store.createAccount(result.data);
      res.cookie(SESSION_COOKIE, sessionSecret, options).status(201).json(account);
    } catch (error) { next(error); }
  });

  router.post('/signin', async (req, res, next) => {
    try {
      store.limitAuthentication(identify(req));
      const result = credentialsSchema.safeParse(req.body);
      // Do not reveal which half was wrong, or that the email format decided it.
      if (!result.success) return res.status(401).json({ error: 'That email and password do not match an account.' });
      const { account, sessionSecret } = await store.signIn(result.data);
      res.cookie(SESSION_COOKIE, sessionSecret, options).json(account);
    } catch (error) { next(error); }
  });

  router.post('/signout', (req, res) => {
    const secret = req.cookies?.[SESSION_COOKIE];
    if (typeof secret === 'string' && secret) store.signOut(secret);
    res.clearCookie(SESSION_COOKIE, { ...options, maxAge: undefined }).json({ ok: true });
  });

  router.get('/me', (_req, res) => {
    if (!res.locals.ownerId) return res.status(401).json({ error: 'Not signed in.' });
    res.json(store.getAccount(res.locals.ownerId));
  });

  router.post('/connectors', requireAccount, (req, res) => {
    const result = connectorTokenInputSchema.safeParse(req.body ?? {});
    if (!result.success) return res.status(400).json({ error: result.error.issues[0].message });
    res.status(201).json(store.issueConnectorToken(res.locals.ownerId, result.data.label));
  });

  router.delete('/connectors/:id', requireAccount, (req, res) => {
    const result = idSchema.safeParse(req.params.id);
    if (!result.success) return res.status(400).json({ error: 'That connector token no longer exists.' });
    res.json(store.revokeConnectorToken(res.locals.ownerId, result.data));
  });

  return router;
};
