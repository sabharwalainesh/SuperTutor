/** Shared contract. Ainesh owns changes after the coordinated Go-led migration. */
export const SUBJECTS = ['coding', 'math', 'writing'] as const;
export type Subject = (typeof SUBJECTS)[number];
export const ASSESSMENTS = ['developing', 'demonstrated', 'uncertain'] as const;
export type Assessment = (typeof ASSESSMENTS)[number];
export const MAX_WORK_CHARS = 16_000;
export const MAX_MATERIAL_CHARS = 32_000;
/** Sessions and connector tokens both expire so an abandoned browser or pack cannot read work forever. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const CONNECTOR_TOKEN_TTL_MS = 180 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE = 'supertutor_session';
export const MAX_CONNECTOR_TOKENS = 5;

export type MaterialInput = { title: string; text: string; sourceUrl?: string };
export type Material = MaterialInput & { id: string; createdAt: number };
export type AssignmentInput = { title: string; subject: Subject; prompt: string; materials?: MaterialInput[] };
export type Assignment = Omit<AssignmentInput, 'materials'> & { id: string; materials: Material[]; createdAt: number };
export type WorkInput = { work: string; question?: string; errorOutput?: string };
export type Draft = WorkInput & { updatedAt: number };
export type AttemptInput = WorkInput & { clientRequestId?: string };
export type Attempt = WorkInput & { id: string; assignmentId: string; createdAt: number };
export type FeedbackInput = {
  attemptId: string;
  assessment: Assessment;
  explanation: string;
  nextStep: string;
  missedConcepts: string[];
  hintLevel: number;
};
export type Feedback = FeedbackInput & { id: string; assignmentId: string; author: 'go-agent'; updatedAt: number };
export type AssignmentContext = { assignment: Assignment; draft: Draft | null; attempts: Attempt[]; feedback: Feedback[] };
export type ProgressSummary = {
  assignmentId: string;
  attemptsTotal: number;
  reviewedAttempts: number;
  demonstratedAttempts: number;
  practiceTopics: { concept: string; mentions: number; lastSeenAt: number }[];
  latestNextStep: string | null;
};

/** Course sources named in the product plan. Only canvas is implemented; the rest are declared
 *  so the workspace can state their real status instead of implying they work. */
export const COURSE_SOURCES = ['canvas', 'lecture-video', 'drive', 'repository'] as const;
export type CourseSourceId = (typeof COURSE_SOURCES)[number];
export type CourseSourceStatus = 'connected' | 'available' | 'manual-only' | 'not-implemented';
export type CourseSource = {
  id: CourseSourceId;
  name: string;
  status: CourseSourceStatus;
  /** What actually happens today, in plain language. Shown in the UI verbatim. */
  detail: string;
  connectedAs?: string;
};
export type CanvasConnectionInput = { baseUrl: string; token: string };
/** The token itself is never returned once saved. */
export type CanvasConnection = { baseUrl: string; userName: string | null; connectedAt: number; lastUsedAt: number | null };
export type CanvasCourse = { id: number; name: string; courseCode: string | null };
export type CanvasAssignment = {
  id: number;
  name: string;
  description: string | null;
  htmlUrl: string | null;
  dueAt: string | null;
  pointsPossible: number | null;
};
export type CanvasImportInput = { courseId: number; assignmentId: number; subject: Subject };

/** Where this deployment's published connector and agents live. Links only; no capability implied. */
export type DeploymentConfig = {
  mcpEndpoint: string;
  connectorListingUrl: string | null;
  agentDirectoryUrl: string;
  connectorPublished: boolean;
  canvasOAuth?: { institutions: { id: string; name: string; baseUrl: string; enabled: boolean }[] };
};

/** Accounts. The web app authenticates with a session cookie; Go authenticates with a connector token. */
export type Credentials = { email: string; password: string };
/** What the browser may see about the signed-in student. Never includes a hash or a token. */
export type Account = { id: string; email: string; displayName?: string; createdAt: number; connectors: ConnectorTokenSummary[] };
export type ConnectorTokenSummary = { id: string; label: string; createdAt: number; expiresAt: number; lastUsedAt: number | null };
/** The secret is returned exactly once, by the call that creates it, and is only stored hashed. */
export type ConnectorTokenIssued = { token: ConnectorTokenSummary; secret: string };

export type TutorDatabase = {
  version: 3;
  users: Record<string, StoredUser>;
  /** ownerId is null only for pre-accounts records, which the first account claims. */
  records: Record<string, AssignmentContext & { ownerId: string | null }>;
  /** Short-lived browser-bound sign-in flows, shared by serverless instances. */
  canvasOAuthFlows?: Record<string, { institutionId: string; nonceHash: string; expires: number; ownerId: string | null }>;
  authRateLimits?: Record<string, { count: number; resetAt: number }>;
};
export type StoredUser = {
  /** Latest visible assignment workspace, refreshed by the website. Not an extension session. */
  activeAssignment?: { assignmentId: string; updatedAt: number };
  displayName?: string;
  canvasIdentity?: { baseUrl: string; userId: string };
  study?: import('./learning.js').StudySession;
  id: string;
  email: string;
  passwordHash: string;
  createdAt: number;
  connectors: StoredConnectorToken[];
  sessions: StoredSession[];
  /** A live third-party credential, unlike everything else here, so it is stored only when the
   *  student explicitly connects Canvas and is deleted outright on disconnect. */
  canvas?: StoredCanvasConnection;
};
export type StoredCanvasConnection = CanvasConnection & { token: string; oauth?: { refreshToken: string; expiresAt: number } };
export type StoredConnectorToken = { id: string; label: string; hash: string; createdAt: number; expiresAt: number; lastUsedAt: number | null };
export type StoredSession = { hash: string; createdAt: number; expiresAt: number };
export type ApiError = { error: string };
