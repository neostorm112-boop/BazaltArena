import { Prisma, type PrismaClient } from '@prisma/client'

export interface LikeRepository {
  /** Returns true if a new like was inserted; false if already present. */
  addLike(userId: string, submissionId: string): Promise<boolean>
  /** Returns true if a like was removed; false if there was none. */
  removeLike(userId: string, submissionId: string): Promise<boolean>
  hasLike(userId: string, submissionId: string): Promise<boolean>
  likedSubmissionIds(userId: string, submissionIds: string[]): Promise<Set<string>>
}

export function createLikeRepository(prisma: PrismaClient): LikeRepository {
  return {
    addLike: async (userId, submissionId) => {
      try {
        await prisma.solutionLike.create({ data: { userId, submissionId } })
        return true
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          return false
        }
        throw error
      }
    },
    removeLike: async (userId, submissionId) => {
      const result = await prisma.solutionLike.deleteMany({ where: { userId, submissionId } })
      return result.count > 0
    },
    hasLike: async (userId, submissionId) => {
      const found = await prisma.solutionLike.findUnique({
        where: { solution_like_unique: { userId, submissionId } },
      })
      return found !== null
    },
    likedSubmissionIds: async (userId, submissionIds) => {
      if (submissionIds.length === 0) return new Set()
      const rows = await prisma.solutionLike.findMany({
        where: { userId, submissionId: { in: submissionIds } },
        select: { submissionId: true },
      })
      return new Set(rows.map((r) => r.submissionId))
    },
  }
}
