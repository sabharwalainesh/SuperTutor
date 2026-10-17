import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number, options: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;
// Deliberately slow: a stolen state file should not yield plaintext passwords.
// 128 * N * r exceeds the default maxmem, so maxmem is set explicitly.
const SCRYPT = { N: 32_768, r: 8, p: 1, maxmem: 72 * 1024 * 1024 };
const KEY_BYTES = 32;

const equal = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const hashPassword = async (password: string) => {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password.normalize('NFKC'), salt, KEY_BYTES, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64url')}$${derived.toString('base64url')}`;
};

/** Returns false rather than throwing on an unreadable stored hash, so one bad record cannot crash sign-in. */
export const verifyPassword = async (password: string, stored: string) => {
  const [scheme, n, r, p, salt, expected] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !expected) return false;
  const options = { N: Number(n), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem };
  if (!Number.isInteger(options.N) || !Number.isInteger(options.r) || !Number.isInteger(options.p)) return false;
  try {
    const derived = await scryptAsync(password.normalize('NFKC'), Buffer.from(salt, 'base64url'), Buffer.from(expected, 'base64url').length, options);
    return equal(derived.toString('base64url'), expected);
  } catch { return false; }
};

/** Session ids and connector tokens are high-entropy secrets, so a fast digest is the right store. */
export const hashSecret = (secret: string) => createHash('sha256').update(secret).digest('hex');
export const matchesHash = (secret: string, hash: string) => equal(hashSecret(secret), hash);
export const createSessionSecret = () => randomBytes(32).toString('base64url');
/** The st_ prefix makes a leaked token recognizable in logs and in Pack Studio. */
export const createConnectorSecret = () => `st_${randomBytes(32).toString('base64url')}`;
