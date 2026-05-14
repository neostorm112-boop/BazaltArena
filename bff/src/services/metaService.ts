import type { PrismaClient } from '@prisma/client'
import { getRedis } from '../infra/redis.js'

export interface MetaPayload {
  app: { build: string; copyrightYear: number }
  server: { timeUtcDisplay: string }
  sprintTeaser: { sprintNumber: number; title: string; systemActive: boolean }
  marketing: {
    fighters: number
    totalSprints: number
    prizePoolShort: string
    prizeCurrency: string
  }
  /** Сохраняем плоские поля для обратной совместимости с локальным `client/`. */
  build: string
  serverTimeUtcDisplay: string
  copyrightYear: number
}

export interface MetaService {
  getMeta(): Promise<MetaPayload>
}

const CACHE_KEY = 'meta:public:v1'
const CACHE_TTL_SECONDS = 60

function shortenRub(amount: number): string {
  if (amount >= 1_000_000) {
    const m = amount / 1_000_000
    return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`
  }
  if (amount >= 1_000) {
    const k = amount / 1_000
    return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(0)}K`
  }
  return String(amount)
}

function extractPrizeRub(metrics: unknown): number {
  if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) return 0
  const v = (metrics as Record<string, unknown>).prizeRub
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function sprintNumberFromTitle(title: string): number | null {
  const match = title.match(/#(\d+)/)
  if (!match) return null
  const n = Number(match[1])
  return Number.isFinite(n) ? n : null
}

export function createMetaService(deps: { prisma: PrismaClient; build?: string }): MetaService {
  const build = deps.build ?? 'v2.0.0'

  async function compute(): Promise<MetaPayload> {
    const [fighters, sprints] = await Promise.all([
      deps.prisma.user.count({ where: { role: 'USER' } }),
      deps.prisma.sprint.findMany({
        where: { published: true, archived: false },
        select: { id: true, title: true, metrics: true, active: true, startsAt: true },
        orderBy: { startsAt: 'desc' },
      }),
    ])
    const totalSprints = sprints.length
    const prizeRub = sprints.reduce((acc, s) => acc + extractPrizeRub(s.metrics), 0)
    const active = sprints.find((s) => s.active) ?? sprints[0] ?? null
    const sprintNumber = active ? (sprintNumberFromTitle(active.title) ?? 1) : 1
    const teaserTitle = active?.title ?? 'Basalt Arena'
    const teaserActive = active?.active ?? false

    const now = new Date()
    const timeUtcDisplay = now.toISOString().slice(11, 16)
    const copyrightYear = now.getUTCFullYear()
    return {
      app: { build, copyrightYear },
      server: { timeUtcDisplay },
      sprintTeaser: {
        sprintNumber,
        title: teaserTitle,
        systemActive: teaserActive,
      },
      marketing: {
        fighters,
        totalSprints,
        prizePoolShort: shortenRub(prizeRub),
        prizeCurrency: '₽',
      },
      build,
      serverTimeUtcDisplay: timeUtcDisplay,
      copyrightYear,
    }
  }

  return {
    async getMeta() {
      const redis = getRedis()
      if (redis) {
        try {
          const cached = await redis.get(CACHE_KEY)
          if (cached) return JSON.parse(cached) as MetaPayload
        } catch {
          /* cache miss is non-fatal */
        }
      }
      const fresh = await compute()
      if (redis) {
        try {
          await redis.set(CACHE_KEY, JSON.stringify(fresh), 'EX', CACHE_TTL_SECONDS)
        } catch {
          /* ignore */
        }
      }
      return fresh
    },
  }
}
