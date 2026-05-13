import { Redis } from 'ioredis'
import { env } from '../config/env.js'
import { logger } from './logger.js'

let client: Redis | null = null

export function getRedis(): Redis | null {
  if (!env.REDIS_URL) return null
  if (!client) {
    const next = new Redis(env.REDIS_URL, {
      lazyConnect: false,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    })
    next.on('error', (err) => {
      logger.error({ err }, 'Redis client error')
    })
    client = next
  }
  return client
}

export async function disconnectRedis() {
  if (!client) return
  try {
    await client.quit()
  } catch (error) {
    logger.error({ err: error }, 'Failed to disconnect Redis')
  } finally {
    client = null
  }
}

export function setRedisForTests(redisClient: Redis | null) {
  client = redisClient
}
