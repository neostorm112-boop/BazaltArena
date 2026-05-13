import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { createMemberAudit } from '../../src/infra/memberAudit.js'

describe('createMemberAudit', () => {
  it('does not throw when prisma insert fails', async () => {
    const prisma = {
      auditLog: {
        create: vi.fn().mockRejectedValue(new Error('db unavailable')),
      },
    } as unknown as PrismaClient
    const audit = createMemberAudit(prisma)
    await expect(audit.log('actor_1', 'TEST_ACTION', { a: 1 })).resolves.toBeUndefined()
  })

  it('persists when prisma succeeds', async () => {
    const prisma = {
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'log1' }),
      },
    } as unknown as PrismaClient
    const audit = createMemberAudit(prisma)
    await audit.log('actor_1', 'TEST_ACTION', { k: 'v' })
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: { actorId: 'actor_1', action: 'TEST_ACTION', details: { k: 'v' } },
    })
  })
})
