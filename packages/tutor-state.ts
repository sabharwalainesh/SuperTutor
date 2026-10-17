import { lessonSchema, gradeSchema, lessonInputSchema, gradeInputSchema, type Lesson, type PracticeFeedback, type LessonInput, type GradeInput, type StudySession } from './learning.js';
import { SAMPLE_LESSON, SAMPLE_SOURCE } from './learning-fixtures.js';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createConnectorSecret, createSessionSecret, hashPassword, hashSecret, matchesHash, normalizeEmail, verifyPassword } from './auth.js';
import { databaseSchema, databaseV2Schema } from './schemas.js';
import type {
  Account, AssignmentInput, AttemptInput, CanvasConnection, ConnectorTokenIssued, Credentials, FeedbackInput,
  MaterialInput, ProgressSummary, StoredUser, TutorDatabase, WorkInput,
} from './types.js';
import { CONNECTOR_TOKEN_TTL_MS, MAX_CONNECTOR_TOKENS, SESSION_TTL_MS } from './types.js';

export class StateError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const MAX_SESSIONS_PER_USER = 10;
const MAX_ASSIGNMENTS_PER_USER = 200;
// Compared against an unknown email so sign-in costs the same whether or not the account exists.
const DUMMY_HASH = 'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

const emptyDatabase = (): TutorDatabase => ({ version: 3, users: {}, records: {} });

const loadDatabase = (filePath?: string): TutorDatabase => {
  if (!filePath || !existsSync(filePath)) return emptyDatabase();
  const raw: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
  const current = databaseSchema.safeParse(raw);
  if (current.success) return current.data;
  // Version 2 predates accounts: keep the work, leave it unowned, and let the first account claim it.
  const legacy = databaseV2Schema.safeParse(raw);
  if (legacy.success) {
    const records = Object.fromEntries(Object.entries(legacy.data.records).map(([id, record]) => [id, { ...record, ownerId: null }]));
    return { version: 3, users: {}, records };
  }
  throw current.error;
};

/** One authoritative store. The web API and the MCP bridge share this instance in the server process. */
export class TutorStore {
  private data: TutorDatabase;
  private changed = false;
  constructor(private filePath?: string) {
    this.data = loadDatabase(filePath);
  }
  /** Internal persistence boundary; never return a database snapshot from a browser/MCP route. */
  static fromSnapshot(snapshot: unknown): TutorStore {
    const store = new TutorStore();
    store.data = databaseSchema.parse(snapshot);
    return store;
  }
  exportSnapshot(): TutorDatabase { return structuredClone(this.data); }
  get hasChanges(): boolean { return this.changed; }
  private commit(next: TutorDatabase) {
    if (this.filePath) {
      mkdirSync(dirname(this.filePath), { recursive: true });
      const temporary = `${this.filePath}.${randomUUID()}.tmp`;
      writeFileSync(temporary, JSON.stringify(next, null, 2), { mode: 0o600 });
      renameSync(temporary, this.filePath);
    }
    this.data = next;
    this.changed = true;
  }
  private mutate<T>(action: (data: TutorDatabase) => T): T {
    const next = structuredClone(this.data);
    const result = action(next);
    this.commit(next);
    return structuredClone(result);
  }
  /** A record belonging to someone else is reported as missing, so IDs cannot be probed. */
  private record(id: string, ownerId: string, data = this.data) {
    const value = data.records[id];
    if (!value || value.ownerId !== ownerId) throw new StateError(404, 'Assignment not found. Select an assignment from the workspace.');
    return value;
  }
  private user(ownerId: string, data = this.data) {
    const user = data.users[ownerId];
    if (!user) throw new StateError(401, 'Sign in again to continue.');
    return user;
  }

  // --- Accounts -------------------------------------------------------------
  private toAccount(user: StoredUser): Account {
    return {
      id: user.id, email: user.email, createdAt: user.createdAt, ...(user.displayName ? { displayName: user.displayName } : {}),
      connectors: user.connectors.map(({ id, label, createdAt, expiresAt, lastUsedAt }) => ({ id, label, createdAt, expiresAt, lastUsedAt })),
    };
  }
  getAccount(ownerId: string): Account { return this.toAccount(this.user(ownerId)); }

  setActiveAssignment(ownerId: string, assignmentId: string) {
    this.record(assignmentId, ownerId);
    return this.mutate(data => {
      const active = { assignmentId, updatedAt: Date.now() };
      this.user(ownerId, data).activeAssignment = active;
      return active;
    });
  }
  getActiveAssignment(ownerId: string) {
    const active = this.user(ownerId).activeAssignment;
    // A closed or abandoned tab must not silently select an old question indefinitely.
    if (!active || active.updatedAt < Date.now() - 15 * 60_000) return null;
    this.record(active.assignmentId, ownerId);
    return structuredClone(active);
  }
  getOpenAssignmentContext(ownerId: string) {
    const active = this.getActiveAssignment(ownerId);
    if (!active) throw new StateError(404, 'No recently open assignment. Ask the student to open their question in SuperTutor or choose an assignment from list_assignments.');
    return this.getContext(ownerId, active.assignmentId);
  }

  /** Shared by cloud instances, so a cold start cannot reset the sign-in attempt limit. */
  limitAuthentication(key: string) {
    const now = Date.now();
    const id = hashSecret(key);
    const existing = this.data.authRateLimits?.[id];
    if (existing && existing.resetAt > now && existing.count >= 10) throw new StateError(429, 'Too many attempts. Wait a few minutes and try again.');
    this.mutate(data => {
      data.authRateLimits ??= {};
      for (const [hash, limit] of Object.entries(data.authRateLimits)) if (limit.resetAt <= now) delete data.authRateLimits[hash];
      if (!data.authRateLimits[id] && Object.keys(data.authRateLimits).length >= 10_000) throw new StateError(429, 'Too many sign-in requests. Try again in a few minutes.');
      const current = data.authRateLimits[id] ?? { count: 0, resetAt: now + 15 * 60_000 };
      current.count += 1;
      data.authRateLimits[id] = current;
    });
  }

  async createAccount({ email, password }: Credentials): Promise<{ account: Account; sessionSecret: string }> {
    const normalized = normalizeEmail(email);
    if (Object.values(this.data.users).some((user) => user.email === normalized)) {
      throw new StateError(409, 'An account with that email already exists. Sign in instead.');
    }
    const passwordHash = await hashPassword(password);
    const sessionSecret = createSessionSecret();
    const now = Date.now();
    const account = this.mutate((data) => {
      if (Object.values(data.users).some((user) => user.email === normalized)) {
        throw new StateError(409, 'An account with that email already exists. Sign in instead.');
      }
      const user: StoredUser = {
        id: randomUUID(), email: normalized, passwordHash, createdAt: now, connectors: [],
        sessions: [{ hash: hashSecret(sessionSecret), createdAt: now, expiresAt: now + SESSION_TTL_MS }],
      };
      data.users[user.id] = user;
      // The local demo's pre-accounts work belongs to whoever signs up first on this install.
      if (Object.keys(data.users).length === 1) {
        for (const record of Object.values(data.records)) if (record.ownerId === null) record.ownerId = user.id;
      }
      return this.toAccount(user);
    });
    return { account, sessionSecret };
  }

  async signIn({ email, password }: Credentials): Promise<{ account: Account; sessionSecret: string }> {
    const normalized = normalizeEmail(email);
    const existing = Object.values(this.data.users).find((user) => user.email === normalized);
    const valid = await verifyPassword(password, existing?.passwordHash ?? DUMMY_HASH);
    if (!existing || !valid) throw new StateError(401, 'That email and password do not match an account.');
    const sessionSecret = createSessionSecret();
    const now = Date.now();
    const account = this.mutate((data) => {
      const user = this.user(existing.id, data);
      user.sessions = [...user.sessions.filter((session) => session.expiresAt > now), { hash: hashSecret(sessionSecret), createdAt: now, expiresAt: now + SESSION_TTL_MS }]
        .slice(-MAX_SESSIONS_PER_USER);
      return this.toAccount(user);
    });
    return { account, sessionSecret };
  }

  /** Returns the owner id for a live session cookie, or null. Expired sessions are dropped lazily. */
  resolveSession(secret: string): string | null {
    const now = Date.now();
    const user = Object.values(this.data.users).find((candidate) => candidate.sessions.some((session) => session.expiresAt > now && matchesHash(secret, session.hash)));
    return user?.id ?? null;
  }
  signOut(secret: string) {
    const ownerId = this.resolveSession(secret);
    if (!ownerId) return;
    this.mutate((data) => {
      const user = this.user(ownerId, data);
      user.sessions = user.sessions.filter((session) => !matchesHash(secret, session.hash));
    });
  }

  beginCanvasOAuthFlow(state: string, flow: { institutionId: string; nonceHash: string; expires: number; ownerId: string | null }) {
    this.mutate(data => {
      data.canvasOAuthFlows ??= {};
      for (const [key, value] of Object.entries(data.canvasOAuthFlows)) if (value.expires <= Date.now()) delete data.canvasOAuthFlows[key];
      if (Object.keys(data.canvasOAuthFlows).length >= 1000) throw new StateError(429, 'Too many Canvas sign-in requests. Try again in a few minutes.');
      data.canvasOAuthFlows[hashSecret(state)] = flow;
    });
  }
  consumeCanvasOAuthFlow(state: string, nonce: unknown) {
    const key = hashSecret(state);
    const flow = this.data.canvasOAuthFlows?.[key];
    if (!flow || flow.expires <= Date.now() || typeof nonce !== 'string' || !matchesHash(nonce, flow.nonceHash)) {
      throw new StateError(400, 'Canvas sign-in expired or could not be verified. Start again from the website.');
    }
    this.mutate(data => { delete data.canvasOAuthFlows![key]; });
    return structuredClone(flow);
  }

  /** Canvas IDs are scoped to an institution. Never link accounts by an unverified email. */
  signInWithCanvas(input: { baseUrl: string; userId: string; userName: string; token: string; oauth: { refreshToken: string; expiresAt: number } }, connectOwnerId?: string): { account: Account; sessionSecret: string } {
    const sessionSecret = createSessionSecret();
    const account = this.mutate(data => {
      const existing = Object.values(data.users).find(user => user.canvasIdentity?.baseUrl === input.baseUrl && user.canvasIdentity.userId === input.userId);
      if (connectOwnerId && existing && existing.id !== connectOwnerId) throw new StateError(409, 'That Canvas account is already linked to a different SuperTutor account. Sign in with Canvas to open that account.');
      const now = Date.now();
      const user = connectOwnerId ? this.user(connectOwnerId,data) : existing ?? {
        id: randomUUID(), email: `canvas-${randomUUID()}@canvas.invalid`, passwordHash: 'canvas-oauth-only', createdAt: now, connectors: [], sessions: [],
      } as StoredUser;
      if (connectOwnerId && user.canvasIdentity && (user.canvasIdentity.baseUrl !== input.baseUrl || user.canvasIdentity.userId !== input.userId)) throw new StateError(409, 'This account already has a different Canvas sign-in linked. Use that account to reconnect.');
      const isNew = !data.users[user.id];
      user.canvasIdentity = { baseUrl: input.baseUrl, userId: input.userId }; user.displayName = input.userName;
      user.canvas = { baseUrl: input.baseUrl, userName: input.userName, token: input.token, oauth: input.oauth, connectedAt: now, lastUsedAt: null };
      user.sessions = [...user.sessions.filter(session => session.expiresAt > now), { hash: hashSecret(sessionSecret), createdAt: now, expiresAt: now + SESSION_TTL_MS }].slice(-MAX_SESSIONS_PER_USER);
      data.users[user.id] = user;
      if (isNew && Object.keys(data.users).length === 1) for (const record of Object.values(data.records)) if (record.ownerId === null) record.ownerId = user.id;
      return this.toAccount(user);
    });
    return { account, sessionSecret };
  }
  refreshCanvasCredential(ownerId: string, previousToken: string, next: { token: string; refreshToken: string; expiresAt: number }) {
    this.mutate(data => {
      const canvas = this.user(ownerId,data).canvas;
      if (!canvas || canvas.token !== previousToken || !canvas.oauth) throw new StateError(409, 'Your Canvas connection changed. Try again.');
      canvas.token = next.token; canvas.oauth = { refreshToken: next.refreshToken, expiresAt: next.expiresAt };
    });
  }

  // --- Canvas, the student's own course connection ---------------------------
  /** Saves a verified connection. The token is a live third-party credential, never returned. */
  saveCanvasConnection(ownerId: string, connection: { baseUrl: string; token: string; userName: string | null }): CanvasConnection {
    return this.mutate((data) => {
      const user = this.user(ownerId, data);
      user.canvas = { ...connection, connectedAt: Date.now(), lastUsedAt: null };
      const { token: _token, oauth: _oauth, ...safe } = user.canvas;
      return safe;
    });
  }
  getCanvasConnection(ownerId: string): CanvasConnection | null {
    const canvas = this.user(ownerId).canvas;
    if (!canvas) return null;
    const { token: _token, oauth: _oauth, ...safe } = canvas;
    return structuredClone(safe);
  }
  /** Internal: the credential itself, for server-side Canvas calls only. */
  useCanvasCredential(ownerId: string): { baseUrl: string; token: string; oauth?: { refreshToken: string; expiresAt: number } } {
    const canvas = this.user(ownerId).canvas;
    if (!canvas) throw new StateError(409, 'Connect Canvas before importing an assignment.');
    const now = Date.now();
    if (canvas.lastUsedAt === null || now - canvas.lastUsedAt > 60_000) {
      this.mutate((data) => {
        const stored = this.user(ownerId, data).canvas;
        if (stored) stored.lastUsedAt = now;
      });
    }
    return { baseUrl: canvas.baseUrl, token: canvas.token, ...(canvas.oauth ? { oauth: structuredClone(canvas.oauth) } : {}) };
  }
  disconnectCanvas(ownerId: string) {
    this.mutate((data) => { delete this.user(ownerId, data).canvas; });
  }

  // --- Connector tokens for Superhuman Go -----------------------------------
  issueConnectorToken(ownerId: string, label?: string): ConnectorTokenIssued {
    const secret = createConnectorSecret();
    const now = Date.now();
    const token = this.mutate((data) => {
      const user = this.user(ownerId, data);
      const live = user.connectors.filter((item) => item.expiresAt > now);
      if (live.length >= MAX_CONNECTOR_TOKENS) throw new StateError(409, `Revoke an existing connector token first. The limit is ${MAX_CONNECTOR_TOKENS}.`);
      const created = { id: randomUUID(), label: label?.trim() || 'Superhuman Go', hash: hashSecret(secret), createdAt: now, expiresAt: now + CONNECTOR_TOKEN_TTL_MS, lastUsedAt: null };
      user.connectors = [...live, created];
      return created;
    });
    const { hash: _hash, ...summary } = token;
    return { token: summary, secret };
  }
  revokeConnectorToken(ownerId: string, tokenId: string) {
    return this.mutate((data) => {
      const user = this.user(ownerId, data);
      const next = user.connectors.filter((item) => item.id !== tokenId);
      if (next.length === user.connectors.length) throw new StateError(404, 'That connector token no longer exists.');
      user.connectors = next;
      return this.toAccount(user);
    });
  }
  /** Returns the owner id for a valid connector token and records the use. */
  resolveConnectorToken(secret: string): string | null {
    const now = Date.now();
    let ownerId: string | null = null;
    let tokenId = '';
    for (const user of Object.values(this.data.users)) {
      const match = user.connectors.find((item) => item.expiresAt > now && matchesHash(secret, item.hash));
      if (match) { ownerId = user.id; tokenId = match.id; break; }
    }
    if (!ownerId) return null;
    // Throttle the write so a chatty agent does not rewrite the state file on every tool call.
    const owner = this.data.users[ownerId];
    const current = owner.connectors.find((item) => item.id === tokenId);
    if (current && (current.lastUsedAt === null || now - current.lastUsedAt > 60_000)) {
      this.mutate((data) => {
        const token = data.users[ownerId!]?.connectors.find((item) => item.id === tokenId);
        if (token) token.lastUsedAt = now;
      });
    }
    return ownerId;
  }

  // --- Go-authored study lessons and practice --------------------------------
  getStudySession(ownerId: string): StudySession | null { return structuredClone(this.user(ownerId).study ?? null); }
  startStudySession(ownerId: string, input: LessonInput): StudySession {
    const parsed = lessonInputSchema.parse(input);
    return this.mutate(data => {
      const id = randomUUID();
      const study: StudySession = { id, source: parsed.sample ? SAMPLE_SOURCE : parsed.text, requestedCount: parsed.sample ? 3 : parsed.count,
        lesson: parsed.sample ? { ...structuredClone(SAMPLE_LESSON), id } : null, answers: {}, answerRevisions: {}, feedback: {}, sample: parsed.sample, updatedAt: Date.now() };
      this.user(ownerId,data).study = study;
      return study;
    });
  }
  private study(ownerId: string, sessionId: string, data = this.data): StudySession {
    const study = this.user(ownerId,data).study;
    if (!study || study.id !== sessionId) throw new StateError(409, 'This study session has changed. Read the current study session before continuing.');
    return study;
  }
  recordStudyLesson(ownerId: string, sessionId: string, input: Lesson): StudySession {
    const lesson = lessonSchema.parse(input);
    return this.mutate(data => {
      const study = this.study(ownerId,sessionId,data);
      if (study.lesson) throw new StateError(409, 'This session already has a lesson. Start a new session to replace it.');
      if (lesson.questions.length !== study.requestedCount) throw new StateError(400, `Create exactly ${study.requestedCount} practice questions.`);
      study.lesson = { ...lesson, id: sessionId }; study.updatedAt = Date.now();
      return study;
    });
  }
  submitPracticeAnswer(ownerId: string, input: GradeInput): StudySession {
    const parsed = gradeInputSchema.parse(input);
    return this.mutate(data => {
      const study = this.study(ownerId,parsed.sessionId,data);
      if (!study.lesson?.questions.some(question => question.id === parsed.questionId)) throw new StateError(404, 'Choose a question from the current lesson.');
      if (study.answers[parsed.questionId] === parsed.answer) return study;
      study.answers[parsed.questionId] = parsed.answer;
      study.answerRevisions[parsed.questionId] = randomUUID();
      delete study.feedback[parsed.questionId]; study.updatedAt = Date.now();
      return study;
    });
  }
  recordPracticeFeedback(ownerId: string, sessionId: string, answerRevision: string, input: PracticeFeedback): StudySession {
    const feedback = gradeSchema.parse(input);
    return this.mutate(data => {
      const study = this.study(ownerId,sessionId,data);
      if (!study.lesson?.questions.some(question => question.id === feedback.questionId)) throw new StateError(404, 'That question is not in this lesson.');
      if (!study.answers[feedback.questionId]) throw new StateError(409, 'Wait for the student to submit an answer.');
      if (study.answerRevisions[feedback.questionId] !== answerRevision) throw new StateError(409, 'The student revised this answer. Read the current answer before recording feedback.');
      study.feedback[feedback.questionId] = feedback; study.updatedAt = Date.now();
      return study;
    });
  }
  clearStudySession(ownerId: string) { this.mutate(data => { delete this.user(ownerId,data).study; }); }

  // --- Assignments ----------------------------------------------------------
  listAssignments(ownerId: string) {
    return Object.values(this.data.records)
      .filter((record) => record.ownerId === ownerId)
      .map((record) => structuredClone(record.assignment))
      .sort((a, b) => b.createdAt - a.createdAt);
  }
  getContext(ownerId: string, id: string) {
    const { ownerId: _ownerId, ...context } = this.record(id, ownerId);
    return structuredClone(context);
  }
  createAssignment(ownerId: string, input: AssignmentInput) {
    return this.mutate((data) => {
      this.user(ownerId, data);
      const owned = Object.values(data.records).filter((record) => record.ownerId === ownerId).length;
      if (owned >= MAX_ASSIGNMENTS_PER_USER) throw new StateError(409, 'You have reached the assignment limit for this account.');
      const now = Date.now();
      const assignment = { ...input, id: randomUUID(), materials: (input.materials ?? []).map((m) => ({ ...m, id: randomUUID(), createdAt: now })), createdAt: now };
      data.records[assignment.id] = { ownerId, assignment, draft: null, attempts: [], feedback: [] };
      return assignment;
    });
  }
  addMaterial(ownerId: string, id: string, input: MaterialInput) {
    return this.mutate((data) => {
      const record = this.record(id, ownerId, data);
      if (record.assignment.materials.length >= 10) throw new StateError(409, 'This assignment already has ten materials. Start another assignment for additional sources.');
      const material = { ...input, id: randomUUID(), createdAt: Date.now() };
      record.assignment.materials.push(material);
      return material;
    });
  }
  saveDraft(ownerId: string, id: string, input: WorkInput) {
    return this.mutate((data) => {
      const draft = { ...input, updatedAt: Date.now() };
      this.record(id, ownerId, data).draft = draft;
      return draft;
    });
  }
  recordAttempt(ownerId: string, id: string, input: AttemptInput) {
    return this.mutate((data) => {
      const record = this.record(id, ownerId, data);
      const { clientRequestId, ...work } = input;
      if (clientRequestId) {
        const existing = record.attempts.find((a) => a.id === clientRequestId);
        if (existing) {
          if (existing.work !== work.work || (existing.question ?? '') !== (work.question ?? '') || (existing.errorOutput ?? '') !== (work.errorOutput ?? '')) throw new StateError(409, 'That request ID already belongs to a different attempt.');
          return existing;
        }
      }
      const attempt = { ...work, id: clientRequestId ?? randomUUID(), assignmentId: id, createdAt: Date.now() };
      record.attempts.push(attempt);
      return attempt;
    });
  }
  recordFeedback(ownerId: string, id: string, input: FeedbackInput) {
    return this.mutate((data) => {
      const record = this.record(id, ownerId, data);
      if (!record.attempts.some((a) => a.id === input.attemptId)) throw new StateError(404, 'Record the student attempt in this assignment before attaching feedback.');
      const previous = record.feedback.findIndex((f) => f.attemptId === input.attemptId);
      if (previous >= 0) {
        const { id: _id, assignmentId: _assignmentId, author: _author, updatedAt: _updatedAt, ...saved } = record.feedback[previous];
        if (JSON.stringify(saved) === JSON.stringify(input)) return record.feedback[previous];
      }
      const feedback = { ...input, id: previous < 0 ? randomUUID() : record.feedback[previous].id, assignmentId: id, author: 'go-agent' as const, updatedAt: Date.now() };
      if (previous < 0) record.feedback.push(feedback); else record.feedback[previous] = feedback;
      return feedback;
    });
  }
  getProgress(ownerId: string, id: string): ProgressSummary {
    const { attempts, feedback } = this.record(id, ownerId);
    const concepts = new Map<string, { concept: string; mentions: number; lastSeenAt: number }>();
    for (const item of feedback) for (const concept of new Set(item.missedConcepts)) {
      const previous = concepts.get(concept);
      concepts.set(concept, { concept, mentions: (previous?.mentions ?? 0) + 1, lastSeenAt: Math.max(previous?.lastSeenAt ?? 0, item.updatedAt) });
    }
    return {
      assignmentId: id, attemptsTotal: attempts.length, reviewedAttempts: feedback.length,
      demonstratedAttempts: feedback.filter((f) => f.assessment === 'demonstrated').length,
      practiceTopics: [...concepts.values()].sort((a, b) => b.mentions - a.mentions),
      latestNextStep: [...feedback].sort((a, b) => b.updatedAt - a.updatedAt)[0]?.nextStep ?? null,
    };
  }
}
