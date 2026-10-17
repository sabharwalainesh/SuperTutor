import { Pool, type PoolClient } from 'pg';
import { TutorStore } from './tutor-state.js';

export interface TransactionalStore {
  run<T>(action: (store: TutorStore) => Promise<T>): Promise<T>;
}

/** The small-deployment snapshot is serialized under a PostgreSQL row lock. */
export class PostgresState implements TransactionalStore {
  private initialized?: Promise<void>;
  constructor(private pool: Pool) {}

  private initialize() {
    this.initialized ??= (async () => {
      await this.pool.query(`CREATE TABLE IF NOT EXISTS supertutor_state (
        id integer PRIMARY KEY CHECK (id = 1),
        data jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
      await this.pool.query('INSERT INTO supertutor_state (id, data) VALUES (1, $1::jsonb) ON CONFLICT (id) DO NOTHING', [JSON.stringify(new TutorStore().exportSnapshot())]);
    })().catch(error => { this.initialized = undefined; throw error; });
    return this.initialized;
  }

  async run<T>(action: (store: TutorStore) => Promise<T>): Promise<T> {
    await this.initialize();
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL lock_timeout = '8s'");
      await client.query("SET LOCAL statement_timeout = '20s'");
      const result = await client.query('SELECT data FROM supertutor_state WHERE id = 1 FOR UPDATE');
      if (result.rows.length !== 1) throw new Error('Missing SuperTutor state row.');
      // Validation failure rolls back; it must never silently replace corrupt data.
      const store = TutorStore.fromSnapshot(result.rows[0].data);
      const value = await action(store);
      if (store.hasChanges) {
        await client.query('UPDATE supertutor_state SET data = $1::jsonb, updated_at = now() WHERE id = 1', [JSON.stringify(store.exportSnapshot())]);
      }
      await client.query('COMMIT');
      return value;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => { /* Preserve the original failure. */ });
      throw error;
    } finally {
      client.release();
    }
  }
}

let state: PostgresState | undefined;
export function getPostgresState(): PostgresState {
  const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!connectionString) throw new Error('Database is not configured.');
  state ??= new PostgresState(new Pool({ connectionString, max: 3, connectionTimeoutMillis: 8_000, idleTimeoutMillis: 10_000 }));
  return state;
}
