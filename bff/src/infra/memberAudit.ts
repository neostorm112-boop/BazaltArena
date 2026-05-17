import type { Prisma, PrismaClient } from '@prisma/client'
import { safeAudit } from './safeAudit.js'

/**
 * Best-effort audit for member (non-admin) flows. Matches {@link AdminRepository.appendAuditLog}
 * semantics without coupling services to the admin repository. Failures are logged via pino;
 * they never propagate to the caller, so business operations are not blocked.
 */
export function createMemberAudit(prisma: PrismaClient) {
  return {
    async log(actorId: string, action: string, details: Prisma.JsonObject = {}) {
      await safeAudit(
        () =>
          prisma.auditLog.create({
            data: { actorId, action, details },
          }),
        { action, actorId }
      )
    },
  }
}

export type MemberAudit = ReturnType<typeof createMemberAudit>
