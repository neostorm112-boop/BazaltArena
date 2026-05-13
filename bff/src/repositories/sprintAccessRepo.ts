import type { PrismaClient, SprintAccess, User, UserRole } from '@prisma/client'

export interface SprintAccessRepository {
  find(userId: string, sprintId: string): Promise<SprintAccess | null>
  upsert(input: {
    userId: string
    sprintId: string
    canSubmit: boolean
    canView: boolean
  }): Promise<SprintAccess>
  delete(userId: string, sprintId: string): Promise<void>
  listBySprint(sprintId: string): Promise<SprintAccess[]>
  listByUser(userId: string): Promise<SprintAccess[]>
  grantNewMemberActiveSprint(userId: string): Promise<void>
  /** Resolve role + effective flags (ADMIN bypass). */
  effectiveRights(
    userId: string,
    sprintId: string
  ): Promise<{
    user: User
    canSubmit: boolean
    canView: boolean
  } | null>
}

export function createSprintAccessRepository(prisma: PrismaClient): SprintAccessRepository {
  return {
    find: (userId, sprintId) =>
      prisma.sprintAccess.findUnique({
        where: { sprint_access_user_sprint_unique: { userId, sprintId } },
      }),
    upsert: ({ userId, sprintId, canSubmit, canView }) =>
      prisma.sprintAccess.upsert({
        where: { sprint_access_user_sprint_unique: { userId, sprintId } },
        create: { userId, sprintId, canSubmit, canView },
        update: { canSubmit, canView },
      }),
    delete: async (userId, sprintId) => {
      await prisma.sprintAccess.deleteMany({ where: { userId, sprintId } })
    },
    listBySprint: (sprintId) => prisma.sprintAccess.findMany({ where: { sprintId } }),
    listByUser: (userId) => prisma.sprintAccess.findMany({ where: { userId } }),
    async grantNewMemberActiveSprint(userId) {
      const active = await prisma.sprint.findFirst({ where: { active: true } })
      if (!active) return
      await prisma.sprintAccess.upsert({
        where: { sprint_access_user_sprint_unique: { userId, sprintId: active.id } },
        create: { userId, sprintId: active.id, canSubmit: true, canView: true },
        update: {},
      })
    },
    async effectiveRights(userId, sprintId) {
      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (!user) return null
      const row = await prisma.sprintAccess.findUnique({
        where: { sprint_access_user_sprint_unique: { userId, sprintId } },
      })
      const eff = effectiveAccess(user.role, row)
      return { user, ...eff }
    },
  }
}

/** Default when no row: view yes, submit no. ADMIN bypass. */
export function effectiveAccess(
  role: UserRole,
  row: SprintAccess | null
): { canSubmit: boolean; canView: boolean } {
  if (role === 'ADMIN') return { canSubmit: true, canView: true }
  if (!row) return { canSubmit: false, canView: true }
  return { canSubmit: row.canSubmit, canView: row.canView }
}
