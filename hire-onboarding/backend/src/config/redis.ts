import IORedis from 'ioredis';
import { getEnv } from './env';
import { getLogger } from './logger';

const logger = getLogger('redis');

let _redis: IORedis | null = null;

export function getRedis(): IORedis {
  if (!_redis) {
    const env = getEnv();
    _redis = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
    });

    _redis.on('connect', () => logger.info('Redis connected'));
    _redis.on('error', (err) => logger.error({ err }, 'Redis error'));
  }
  return _redis;
}

export async function destroyRedis(): Promise<void> {
  if (_redis) {
    await _redis.quit();
    _redis = null;
    logger.info('Redis connection closed');
  }
}
