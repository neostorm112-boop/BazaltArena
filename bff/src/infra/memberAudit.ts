import type { Prisma, PrismaClient } from '@prisma/client'

/**
 * Best-effort audit for member (non-admin) flows. Matches {@link AdminRepository.appendAuditLog}
 * semantics without coupling services to the admin repository.
 */
export function createMemberAudit(prisma: PrismaClient) {
  return {
    async log(actorId: string, action: string, details: Prisma.JsonObject = {}) {
      try {
        await prisma.auditLog.create({
          data: { actorId, action, details },
        })
      } catch {
        /* audit must not break member flows */
      }
    },
  }
}

export type MemberAudit = ReturnType<typeof createMemberAudit>
