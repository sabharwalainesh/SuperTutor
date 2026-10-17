import type { Account } from '../../../../packages/types.js';

/** A successful connector use is evidence of account setup, never extension installation here. */
export function goConnection(account: Pick<Account, 'connectors'> | null, now = Date.now()) {
  const tokens = account?.connectors ?? [];
  const live = tokens.filter(token => token.expiresAt > now);
  return {
    linked: live.some(token => token.lastUsedAt !== null),
    pending: live.length > 0 && live.every(token => token.lastUsedAt === null),
    expired: tokens.length > 0 && live.length === 0,
  };
}

export const shouldOfferGoSetup = (supported: boolean, installationConfirmed: boolean, linked: boolean) =>
  !supported || (!installationConfirmed && !linked);
