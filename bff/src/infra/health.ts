/**
 * Health-check с проверкой зависимостей.
 *
 * Идея: эндпоинт `/api/v1/health` отвечает 200 если БД и Redis отвечают,
 * иначе 503. Это позволяет k8s/Docker/Lightsail health checks
 * автоматически рестартовать упавший контейнер.
 *
 * Стратегия проверки:
 *  - Postgres: `SELECT 1` через Prisma raw query (1-2 мс)
 *  - Redis: `PING` через ioredis (1-2 мс)
 *
 * Таймаут на каждый чек — 1 секунда, чтобы health не висел на медленной БД.
 */
import type { PrismaClient } from '@prisma/client'
import type { Redis } from 'ioredis'

export type DependencyStatus = 'ok' | 'fail'

export interface HealthReport {
  ok: boolean
  service: string
  version: string
  deps: {
    db: DependencyStatus
    redis: DependencyStatus
  }
  uptimeSec: number
}

const CHECK_TIMEOUT_MS = 1000

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('health check timeout')), ms)),
  ])
}

async function checkDb(prisma: PrismaClient): Promise<DependencyStatus> {
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, CHECK_TIMEOUT_MS)
    return 'ok'
  } catch {
    return 'fail'
  }
}

async function checkRedis(redis: Redis | null): Promise<DependencyStatus> {
  if (!redis) return 'fail'
  try {
    const res = await withTimeout(redis.ping(), CHECK_TIMEOUT_MS)
    return res === 'PONG' ? 'ok' : 'fail'
  } catch {
    return 'fail'
  }
}

export async function runHealthCheck(input: {
  prisma: PrismaClient
  redis: Redis | null
  version: string
}): Promise<HealthReport> {
  const [db, redis] = await Promise.all([checkDb(input.prisma), checkRedis(input.redis)])
  return {
    ok: db === 'ok' && redis === 'ok',
    service: 'basalt-bff',
    version: input.version,
    deps: { db, redis },
    uptimeSec: Math.round(process.uptime()),
  }
}
