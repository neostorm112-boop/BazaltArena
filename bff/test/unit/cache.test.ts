/**
 * Юнит-тесты для Redis-обёртки `cached()` и `invalidate()`.
 *
 * Мокаем Redis через ioredis-mock.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import RedisMock from 'ioredis-mock'
import type { Redis as RedisType } from 'ioredis'
import { CacheKeys, cached, invalidate } from '../../src/infra/cache.js'
import { setRedisForTests } from '../../src/infra/redis.js'

describe('cache helpers', () => {
  beforeEach(() => {
    setRedisForTests(new (RedisMock as unknown as typeof RedisType)() as never)
  })
  afterEach(() => {
    setRedisForTests(null)
  })

  it('первый вызов идёт в loader, второй — из кэша', async () => {
    let loaderCalls = 0
    const loader = async () => {
      loaderCalls += 1
      return { data: 'meta', n: loaderCalls }
    }

    const r1 = await cached('cache:meta:v1', 60, loader)
    const r2 = await cached('cache:meta:v1', 60, loader)

    expect(loaderCalls).toBe(1)
    expect(r1).toEqual({ data: 'meta', n: 1 })
    expect(r2).toEqual({ data: 'meta', n: 1 })
  })

  it('разные ключи — независимые загрузки', async () => {
    let calls = 0
    const loader = async () => {
      calls += 1
      return { n: calls }
    }
    await cached('key:a', 60, loader)
    await cached('key:b', 60, loader)
    expect(calls).toBe(2)
  })

  it('invalidate по pattern удаляет ключи', async () => {
    await cached('cache:meta:v1', 60, async () => ({ x: 1 }))
    await cached('cache:meta:v2', 60, async () => ({ x: 2 }))
    await cached('other:key', 60, async () => ({ y: 1 }))

    const deleted = await invalidate('cache:meta:*')
    expect(deleted).toBe(2)

    // После инвалидации loader снова вызывается:
    let calls = 0
    await cached('cache:meta:v1', 60, async () => {
      calls += 1
      return { x: 1 }
    })
    expect(calls).toBe(1)
  })

  it('CacheKeys.meta() возвращает стабильный ключ', () => {
    expect(CacheKeys.meta()).toBe('cache:meta:v1')
    expect(CacheKeys.metaPattern()).toBe('cache:meta:*')
  })

  it('битый JSON в кэше — перезаписывается', async () => {
    // Положим невалидный JSON напрямую через mock
    const redisMock = new (RedisMock as unknown as typeof RedisType)() as never as RedisType
    setRedisForTests(redisMock)
    await redisMock.set('cache:meta:v1', '{not json')

    const result = await cached('cache:meta:v1', 60, async () => ({ fresh: true }))
    expect(result).toEqual({ fresh: true })
  })
})
