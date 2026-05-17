import { describe, expect, it } from 'vitest'
import { loadEnv } from '../../src/config/env.js'

// 32+ символов, чтобы пройти Zod min(32).
const STRONG_ACCESS = 'A'.repeat(40)
const STRONG_REFRESH = 'B'.repeat(40)

function baseProdEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_SECRET: STRONG_ACCESS,
    JWT_REFRESH_SECRET: STRONG_REFRESH,
    CORS_ORIGINS: 'https://example.com',
    DEV_REGISTER_KEY: 'prod-register-secret',
    TRUST_PROXY: '1',
    ...overrides,
  }
}

describe('loadEnv — production hardening', () => {
  it('passes when all required prod vars are set', () => {
    const env = loadEnv(baseProdEnv())
    expect(env.NODE_ENV).toBe('production')
    expect(env.DEV_REGISTER_KEY).toBe('prod-register-secret')
  })

  it('fails when DEV_REGISTER_KEY is missing in prod', () => {
    expect(() => loadEnv(baseProdEnv({ DEV_REGISTER_KEY: undefined }))).toThrow(
      /DEV_REGISTER_KEY is required in production/
    )
  })

  it('fails when DEV_REGISTER_KEY is empty in prod (min(1))', () => {
    // Пустая строка должна срубаться Zod-валидацией min(1), а не пройти как «задано».
    expect(() => loadEnv(baseProdEnv({ DEV_REGISTER_KEY: '' }))).toThrow()
  })

  it('fails when JWT_ACCESS_SECRET is missing in prod (no dev defaults applied)', () => {
    expect(() => loadEnv(baseProdEnv({ JWT_ACCESS_SECRET: undefined }))).toThrow(
      /JWT_ACCESS_SECRET/
    )
  })

  it('fails when JWT_REFRESH_SECRET is missing in prod (no dev defaults applied)', () => {
    expect(() => loadEnv(baseProdEnv({ JWT_REFRESH_SECRET: undefined }))).toThrow(
      /JWT_REFRESH_SECRET/
    )
  })

  it('fails when NODE_ENV is unset (ambiguous environment, no defaults applied)', () => {
    // NODE_ENV в схеме имеет default('development'), но applyDevDefaults в этой версии
    // подставляет дев-секреты ТОЛЬКО при явном development/test.
    // Если NODE_ENV не задан и других обязательных секретов нет — стартап должен упасть.
    expect(() =>
      loadEnv({
        DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
        // нет NODE_ENV, нет JWT_*_SECRET — должны упасть на Zod required.
      })
    ).toThrow(/JWT_ACCESS_SECRET|JWT_REFRESH_SECRET/)
  })

  it('fails when RATE_LIMIT_DISABLED is truthy in prod', () => {
    expect(() => loadEnv(baseProdEnv({ RATE_LIMIT_DISABLED: 'true' }))).toThrow(
      /RATE_LIMIT_DISABLED/
    )
  })

  it('fails when REDIS_URL is missing in prod', () => {
    expect(() => loadEnv(baseProdEnv({ REDIS_URL: undefined }))).toThrow(/REDIS_URL/)
  })
})

describe('loadEnv — dev/test defaults', () => {
  it('applies JWT/DATABASE defaults only with explicit NODE_ENV=development', () => {
    const env = loadEnv({ NODE_ENV: 'development' })
    expect(env.JWT_ACCESS_SECRET).toMatch(/^basalt-dev-access-secret/)
    expect(env.JWT_REFRESH_SECRET).toMatch(/^basalt-dev-refresh-secret/)
    expect(env.DATABASE_URL).toContain('127.0.0.1:5433')
  })

  it('applies defaults with NODE_ENV=test but skips REDIS_URL', () => {
    const env = loadEnv({ NODE_ENV: 'test' })
    expect(env.JWT_ACCESS_SECRET).toBeTruthy()
    expect(env.REDIS_URL).toBeUndefined()
  })
})
