import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { CanvasAssignment, CanvasCourse } from './types.js';

export class CanvasError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const TIMEOUT_MS = 12_000;
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * The Canvas host comes from the student, so it is a server-side request to an address we do not
 * control. Allow only https, resolve the hostname first, and refuse anything that points at a
 * private, loopback, or link-local address so this cannot be used to probe the internal network.
 */
const privateIPv4 = (ip: string) => {
  const [a, b] = ip.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31
    || a === 192 && b === 168 || a === 100 && b >= 64 && b <= 127 || a >= 224;
};
const privateIPv6 = (ip: string) => {
  const value = ip.toLowerCase();
  return value === '::1' || value === '::' || value.startsWith('fc') || value.startsWith('fd')
    || value.startsWith('fe80') || value.startsWith('::ffff:');
};

export const assertPublicHost = async (hostname: string) => {
  const literal = isIP(hostname);
  const addresses = literal
    ? [{ address: hostname, family: literal }]
    : await lookup(hostname, { all: true, verbatim: true }).catch(() => { throw new CanvasError(400, 'That Canvas address could not be resolved. Check the hostname.'); });
  if (!addresses.length) throw new CanvasError(400, 'That Canvas address could not be resolved. Check the hostname.');
  for (const { address, family } of addresses) {
    const blocked = family === 4 ? privateIPv4(address) : privateIPv6(address);
    if (blocked) throw new CanvasError(400, 'That address is not a public Canvas host.');
  }
};

/** Normalizes what students paste: a full course URL, a bare hostname, or an origin. */
export const normalizeCanvasBaseUrl = (input: string) => {
  const trimmed = input.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try { url = new URL(withScheme); } catch { throw new CanvasError(400, 'Enter your Canvas web address, for example canvas.instructure.com.'); }
  if (url.protocol !== 'https:') throw new CanvasError(400, 'Canvas must be reached over HTTPS.');
  if (!url.hostname.includes('.')) throw new CanvasError(400, 'Enter the full Canvas hostname, for example canvas.instructure.com.');
  return `https://${url.host}`;
};

const canvasRequest = async <T>(baseUrl: string, token: string, path: string): Promise<T> => {
  const url = new URL(path, `${baseUrl}/`);
  await assertPublicHost(url.hostname);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      // A redirect could leave the host we just checked, so handle none.
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new CanvasError(502, 'Canvas did not respond. Check the address and try again.');
  }
  if (response.status >= 300 && response.status < 400) throw new CanvasError(502, 'Canvas redirected the request. Check that the address is your institution\'s Canvas host.');
  if (response.status === 401 || response.status === 403) throw new CanvasError(401, 'Canvas rejected that access token. Generate a new one in Canvas under Account → Settings.');
  if (response.status === 404) throw new CanvasError(404, 'Canvas has no such course or assignment for this account.');
  if (!response.ok) throw new CanvasError(502, `Canvas returned an error (${response.status}).`);
  const length = Number(response.headers.get('content-length') ?? 0);
  if (length > MAX_BYTES) throw new CanvasError(502, 'That Canvas response was too large to read.');
  const text = (await response.text()).slice(0, MAX_BYTES);
  try { return JSON.parse(text) as T; } catch { throw new CanvasError(502, 'Canvas returned a response SuperTutor could not read.'); }
};

/** Confirms the token works and returns the Canvas display name, so the UI can show who is connected. */
export const fetchCanvasIdentity = async (baseUrl: string, token: string) => {
  const user = await canvasRequest<{ name?: string; short_name?: string }>(baseUrl, token, 'api/v1/users/self');
  return user.name ?? user.short_name ?? null;
};

export const fetchCanvasCourses = async (baseUrl: string, token: string): Promise<CanvasCourse[]> => {
  const courses = await canvasRequest<{ id: number; name?: string; course_code?: string }[]>(
    baseUrl, token, 'api/v1/courses?enrollment_state=active&per_page=50',
  );
  return courses.filter((course) => typeof course.id === 'number')
    .map((course) => ({ id: course.id, name: course.name ?? `Course ${course.id}`, courseCode: course.course_code ?? null }));
};

export const fetchCanvasAssignments = async (baseUrl: string, token: string, courseId: number): Promise<CanvasAssignment[]> => {
  const assignments = await canvasRequest<Record<string, unknown>[]>(
    baseUrl, token, `api/v1/courses/${courseId}/assignments?per_page=50&order_by=due_at`,
  );
  return assignments.filter((item) => typeof item.id === 'number').map((item) => ({
    id: item.id as number,
    name: typeof item.name === 'string' ? item.name : `Assignment ${item.id}`,
    description: typeof item.description === 'string' ? item.description : null,
    htmlUrl: typeof item.html_url === 'string' ? item.html_url : null,
    dueAt: typeof item.due_at === 'string' ? item.due_at : null,
    pointsPossible: typeof item.points_possible === 'number' ? item.points_possible : null,
  }));
};

export const fetchCanvasAssignment = (baseUrl: string, token: string, courseId: number, assignmentId: number) =>
  fetchCanvasAssignments(baseUrl, token, courseId).then((items) => {
    const found = items.find((item) => item.id === assignmentId);
    if (!found) throw new CanvasError(404, 'That assignment is no longer listed in Canvas.');
    return found;
  });

/**
 * Canvas assignment descriptions are instructor-authored HTML. Reduce them to text: the tutor
 * treats this as untrusted source material, and no markup should reach the editor or Go.
 */
export const canvasHtmlToText = (html: string) => {
  const withBreaks = html
    .replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6])\s*\/?>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '• ')
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
  const stripped = withBreaks.replace(/<[^>]+>/g, '');
  const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' };
  return stripped
    .replace(/&(#\d+|[a-z]+);/gi, (match, name: string) => entities[name.toLowerCase()] ?? match)
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
};
