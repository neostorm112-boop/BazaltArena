/**
 * Простая Redis-обёртка для кэширования read-only эндпоинтов.
 *
 * API:
 *   cached<T>(key, ttlSec, loader): Promise<T>
 *
 * Семантика:
 *  - Если в Redis есть валидный JSON по ключу — вернуть его.
 *  - Иначе — вызвать loader(), сохранить результат в Redis с EX TTL, вернуть.
 *  - Если Redis недоступен — просто вызываем loader (degrade gracefully).
 *  - Если в кэше битый JSON — игнорируем, перезаписываем.
 *
 * Инвалидация — через `invalidate(prefix)` (DEL по pattern).
 * Использовать только для read-эндпоинтов без чувствительных данных.
 *
 * Где НЕ использовать:
 *  - Персональные ответы (likedByMe, мой профиль) — там кэш должен быть keyed-by-user
 *    и инвалидируется на каждое действие, что обычно дороже чем сам запрос.
 */
import { getRedis } from './redis.js'
import { logger } from './logger.js'

export async function cached<T>(key: string, ttlSec: number, loader: () => Promise<T>): Promise<T> {
  const redis = getRedis()
  if (!redis) return loader()

  try {
    const raw = await redis.get(key)
    if (raw) {
      try {
        return JSON.parse(raw) as T
      } catch {
        // Битый JSON — продолжим как cache miss.
      }
    }
  } catch (err) {
    logger.error({ err, key }, 'Cache read failed')
    return loader()
  }

  const value = await loader()
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSec)
  } catch (err) {
    logger.error({ err, key }, 'Cache write failed')
  }
  return value
}

/**
 * Удаляет все ключи по шаблону. Для cache-инвалидации после write.
 * Использует SCAN (не KEYS), чтобы не блокировать Redis на больших keyspaces.
 */
export async function invalidate(pattern: string): Promise<number> {
  const redis = getRedis()
  if (!redis) return 0
  let cursor = '0'
  let deleted = 0
  try {
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
      if (keys.length > 0) {
        const removed = await redis.del(...keys)
        deleted += removed
      }
      cursor = next
    } while (cursor !== '0')
  } catch (err) {
    logger.error({ err, pattern }, 'Cache invalidate failed')
  }
  return deleted
}

/** Префиксы ключей — централизованно, чтобы invalidate знал что чистить. */
export const CacheKeys = {
  meta: () => 'cache:meta:v1',
  metaPattern: () => 'cache:meta:*',
} as const
