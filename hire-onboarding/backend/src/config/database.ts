import knex, { Knex } from 'knex';
import { getEnv } from './env';
import { getLogger } from './logger';

const logger = getLogger('database');

let _db: Knex | null = null;

export function getDb(): Knex {
  if (!_db) {
    const env = getEnv();
    _db = knex({
      client: 'pg',
      connection: env.DATABASE_URL,
      pool: {
        min: env.DATABASE_POOL_MIN,
        max: env.DATABASE_POOL_MAX,
      },
      migrations: {
        directory: __dirname + '/../infrastructure/database/migrations',
        extension: 'ts',
      },
    });

    logger.info('Database connection pool initialized');
  }
  return _db;
}

export async function destroyDb(): Promise<void> {
  if (_db) {
    await _db.destroy();
    _db = null;
    logger.info('Database connection pool destroyed');
  }
}
