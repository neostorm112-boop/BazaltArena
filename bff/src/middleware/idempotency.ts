/**
 * Idempotency-Key middleware.
 *
 * Защита от дублирующих write-запросов при плохой сети.
 *
 * Как работает:
 *  1. Клиент шлёт `POST /submissions` с заголовком `Idempotency-Key: <uuid>`.
 *  2. Если для этого ключа в Redis ещё нет ответа — выполняем хендлер,
 *     перехватываем `res.json/send` и сохраняем (status + body) в Redis
 *     с TTL 24 часа.
 *  3. Если ответ для ключа уже сохранён — отдаём кэшированный, не выполняя хендлер.
 *
 * Это **не** замена бизнес-логики (уникальные индексы в БД и т.п.) — а
 * защита от двойного выполнения дорогих операций (отправка email, начисление баллов).
 *
 * Ограничения:
 *  - Если Redis недоступен, middleware **не блокирует** запрос, а пропускает.
 *    Лучше провести операцию один раз, чем падать на временной потере Redis.
 *  - Ключ обязан быть длиной 8-128 символов из [A-Za-z0-9_\-].
 */
import type { Request, Response, NextFunction } from 'express'
import { getRedis } from '../infra/redis.js'
import { logger } from '../infra/logger.js'

const IDEMPOTENCY_TTL_SECONDS = 24 * 3600
const KEY_PREFIX = 'idem:'
const KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/

interface CachedResponse {
  status: number
  body: unknown
}

export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction): void {
  const rawKey = req.header('Idempotency-Key')
  if (!rawKey) {
    // Заголовок не передан — обычный flow без идемпотентности.
    return next()
  }
  if (!KEY_PATTERN.test(rawKey)) {
    res.status(400).json({
      code: 'BAD_IDEMPOTENCY_KEY',
      message: 'Idempotency-Key must match /^[A-Za-z0-9_-]{8,128}$/',
    })
    return
  }

  const redis = getRedis()
  if (!redis) {
    // Без Redis fallback: пропускаем без кэша — не блокируем боевой запрос.
    logger.warn({ key: rawKey }, 'Idempotency middleware fallback: no Redis')
    return next()
  }

  // Прицепляем scope (auth user или ip) — на случай если разные пользователи
  // случайно сгенерируют одинаковый ключ.
  const scope = req.auth?.sub ?? req.ip ?? 'anon'
  const cacheKey = `${KEY_PREFIX}${scope}:${rawKey}`

  redis
    .get(cacheKey)
    .then((existing) => {
      if (existing) {
        try {
          const cached = JSON.parse(existing) as CachedResponse
          res.setHeader('Idempotent-Replay', 'true')
          res.status(cached.status).json(cached.body)
        } catch {
          // Битый JSON в кэше — игнорируем кэш и пропускаем дальше.
          next()
        }
        return
      }

      // Перехватываем res.json, чтобы сохранить ответ.
      const originalJson = res.json.bind(res)
      res.json = (body: unknown) => {
        const status = res.statusCode
        // Кэшируем только успешные ответы и 4xx (клиентские ошибки).
        // 5xx не кэшируем — это серверные сбои, повтор может пройти.
        if (status < 500) {
          const payload: CachedResponse = { status, body }
          redis
            .set(cacheKey, JSON.stringify(payload), 'EX', IDEMPOTENCY_TTL_SECONDS)
            .catch((err) => logger.error({ err, cacheKey }, 'Idempotency cache write failed'))
        }
        return originalJson(body)
      }
      next()
    })
    .catch((err) => {
      logger.error({ err, cacheKey }, 'Idempotency cache read failed')
      next()
    })
}
