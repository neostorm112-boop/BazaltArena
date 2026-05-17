import { randomUUID } from 'node:crypto'
import { env } from '../config/env.js'
import { getRedis } from '../infra/redis.js'

// Refresh-token rotation with replay detection.
//
// Data model:
//   session:<jti>   -> familyId        (value tells us which family the jti belongs to)
//   family:<famId>  -> currentJti      (head of the rotation chain — at most one active jti per family)
//
// Rotation is atomic via a Lua script (or single-threaded JS in the in-memory fallback):
// the script consumes the old session marker AND installs the new one in one shot.
// If two concurrent refresh requests race with the same jti, exactly one wins.
// The loser sees a missing session marker — if the family is still alive, that
// means the jti was already consumed → replay.

const sessionKey = (jti: string) => `session:${jti}`
const familyKey = (familyId: string) => `family:${familyId}`

interface SessionEntry {
  familyId: string
  expiresAt: number
}
interface FamilyEntry {
  jti: string
  expiresAt: number
}

const memorySessions = new Map<string, SessionEntry>()
const memoryFamilies = new Map<string, FamilyEntry>()

function cleanupMemorySessions() {
  const now = Date.now()
  for (const [k, v] of memorySessions) if (v.expiresAt <= now) memorySessions.delete(k)
  for (const [k, v] of memoryFamilies) if (v.expiresAt <= now) memoryFamilies.delete(k)
}

export function newFamilyId(): string {
  return randomUUID()
}

export async function registerSession(
  jti: string,
  familyId: string,
  ttlSeconds = env.JWT_REFRESH_TTL_SECONDS
): Promise<void> {
  const redis = getRedis()
  if (redis) {
    await redis.set(sessionKey(jti), familyId, 'EX', ttlSeconds)
    await redis.set(familyKey(familyId), jti, 'EX', ttlSeconds)
    return
  }
  cleanupMemorySessions()
  const expiresAt = Date.now() + ttlSeconds * 1000
  memorySessions.set(jti, { familyId, expiresAt })
  memoryFamilies.set(familyId, { jti, expiresAt })
}

export async function isSessionActive(jti: string): Promise<boolean> {
  const redis = getRedis()
  if (redis) {
    return (await redis.get(sessionKey(jti))) !== null
  }
  cleanupMemorySessions()
  return memorySessions.has(jti)
}

// Used by logout: drops both the active session and the family head so that any
// leftover refresh token cannot be replayed against the same family.
export async function revokeSession(jti: string): Promise<void> {
  const redis = getRedis()
  if (redis) {
    const familyId = await redis.get(sessionKey(jti))
    await redis.del(sessionKey(jti))
    if (familyId) await redis.del(familyKey(familyId))
    return
  }
  const entry = memorySessions.get(jti)
  memorySessions.delete(jti)
  if (entry) memoryFamilies.delete(entry.familyId)
}

export type RotateOutcome = 'ok' | 'replay' | 'mismatch' | 'unknown'

// Atomic refresh-token rotation:
//   1. read session:<oldJti>
//   2. verify it belongs to the claimed family
//   3. delete the old session marker
//   4. install session:<newJti> and update family:<fam> head
// Returns 'ok' on success, 'replay' if the old session is gone but the family
// is still alive (token reuse), 'mismatch' if the jti belongs to another
// family (tampering), 'unknown' if both are gone (benign — expired/logged out).
const ROTATE_LUA = `
local oldVal = redis.call('GET', KEYS[1])
if oldVal then
  if oldVal ~= ARGV[1] then
    return 'mismatch'
  end
  redis.call('DEL', KEYS[1])
  redis.call('SET', KEYS[3], ARGV[1], 'EX', ARGV[2])
  redis.call('SET', KEYS[2], ARGV[3], 'EX', ARGV[2])
  return 'ok'
end
local famHead = redis.call('GET', KEYS[2])
if famHead then
  return 'replay'
end
return 'unknown'
`

export async function rotateSession(args: {
  oldJti: string
  newJti: string
  familyId: string
  ttlSeconds?: number
}): Promise<RotateOutcome> {
  const ttl = args.ttlSeconds ?? env.JWT_REFRESH_TTL_SECONDS
  const redis = getRedis()
  if (redis) {
    const result = (await redis.eval(
      ROTATE_LUA,
      3,
      sessionKey(args.oldJti),
      familyKey(args.familyId),
      sessionKey(args.newJti),
      args.familyId,
      String(ttl),
      args.newJti
    )) as string
    if (result === 'ok' || result === 'replay' || result === 'mismatch' || result === 'unknown') {
      return result
    }
    return 'unknown'
  }
  // In-memory path: the body below runs synchronously (no awaits between
  // check and mutate), so two concurrent callers can never both succeed.
  cleanupMemorySessions()
  const existing = memorySessions.get(args.oldJti)
  if (!existing) {
    return memoryFamilies.has(args.familyId) ? 'replay' : 'unknown'
  }
  if (existing.familyId !== args.familyId) return 'mismatch'
  memorySessions.delete(args.oldJti)
  const expiresAt = Date.now() + ttl * 1000
  memorySessions.set(args.newJti, { familyId: args.familyId, expiresAt })
  memoryFamilies.set(args.familyId, { jti: args.newJti, expiresAt })
  return 'ok'
}

// Burns down the whole family — used on replay detection.
const REVOKE_FAMILY_LUA = `
local head = redis.call('GET', KEYS[1])
if head then
  redis.call('DEL', 'session:' .. head)
  redis.call('DEL', KEYS[1])
  return 1
end
return 0
`

export async function revokeFamily(familyId: string): Promise<boolean> {
  const redis = getRedis()
  if (redis) {
    const result = (await redis.eval(REVOKE_FAMILY_LUA, 1, familyKey(familyId))) as number
    return result === 1
  }
  const head = memoryFamilies.get(familyId)
  if (!head) return false
  memorySessions.delete(head.jti)
  memoryFamilies.delete(familyId)
  return true
}

export function _resetSessionStoreForTests() {
  memorySessions.clear()
  memoryFamilies.clear()
}
