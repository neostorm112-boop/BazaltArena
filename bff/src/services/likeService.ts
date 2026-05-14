import type { PrismaClient } from '@prisma/client'
import { AppError } from '../errors/AppError.js'
import type { MemberAudit } from '../infra/memberAudit.js'
import type { LikeRepository } from '../repositories/likeRepo.js'
import type { SprintAccessRepository } from '../repositories/sprintAccessRepo.js'
import type { SubmissionRepository } from '../repositories/submissionRepo.js'

export interface LikeResult {
  submissionId: string
  liked: boolean
  likes: number
}

export interface LikeService {
  like(userId: string, submissionId: string): Promise<LikeResult>
  unlike(userId: string, submissionId: string): Promise<LikeResult>
}

export function createLikeService(deps: {
  prisma?: PrismaClient
  likes: LikeRepository
  submissions: SubmissionRepository
  sprintAccess: SprintAccessRepository
  onAfterLikeChange?: (sprintId: string) => Promise<void>
  onAfterLikeMutation?: (input: {
    submissionId: string
    likes: number
    liked: boolean
  }) => Promise<void>
  memberAudit?: MemberAudit
}): LikeService {
  async function readLikeState(submissionId: string) {
    const submission = await deps.submissions.findById(submissionId)
    if (!submission) throw AppError.notFound('Solution not found')
    return submission
  }

  async function assertCanViewSprint(userId: string, sprintId: string) {
    const rights = await deps.sprintAccess.effectiveRights(userId, sprintId)
    if (!rights) throw AppError.unauthorized('User not found')
    if (!rights.canView) throw AppError.forbidden('No view access for this sprint')
  }

  return {
    async like(userId, submissionId) {
      const submission = await readLikeState(submissionId)
      await assertCanViewSprint(userId, submission.sprintId)

      let likesCount: number
      let mutated = false

      if (deps.prisma) {
        likesCount = await deps.prisma.$transaction(async (tx) => {
          const inserted = await tx.solutionLike.createMany({
            data: [{ userId, submissionId }],
            skipDuplicates: true,
          })
          mutated = inserted.count > 0
          if (mutated) {
            await tx.submission.update({
              where: { id: submissionId },
              data: { likesCount: { increment: 1 } },
            })
          }
          const row = await tx.submission.findUniqueOrThrow({
            where: { id: submissionId },
            select: { likesCount: true },
          })
          return row.likesCount
        })
      } else {
        const inserted = await deps.likes.addLike(userId, submissionId)
        mutated = inserted
        if (inserted) {
          await deps.submissions.incrementLikes(submissionId, 1)
        }
        const updated = await readLikeState(submissionId)
        likesCount = updated.likesCount
      }

      if (mutated) {
        await deps.memberAudit?.log(userId, 'SOLUTION_LIKE', {
          submissionId,
          sprintId: submission.sprintId,
        })
      }

      await deps.onAfterLikeChange?.(submission.sprintId)
      if (mutated && deps.onAfterLikeMutation) {
        try {
          await deps.onAfterLikeMutation({
            submissionId: submission.id,
            likes: likesCount,
            liked: true,
          })
        } catch {
          /* achievement check must not break like flow */
        }
      }
      return { submissionId: submission.id, liked: true, likes: likesCount }
    },

    async unlike(userId, submissionId) {
      const submission = await readLikeState(submissionId)
      await assertCanViewSprint(userId, submission.sprintId)

      let likesCount: number
      let mutated = false

      if (deps.prisma) {
        likesCount = await deps.prisma.$transaction(async (tx) => {
          const del = await tx.solutionLike.deleteMany({ where: { userId, submissionId } })
          mutated = del.count > 0
          if (!mutated) {
            const row = await tx.submission.findUniqueOrThrow({
              where: { id: submissionId },
              select: { likesCount: true },
            })
            return row.likesCount
          }
          await tx.submission.updateMany({
            where: { id: submissionId, likesCount: { gt: 0 } },
            data: { likesCount: { decrement: 1 } },
          })
          const row = await tx.submission.findUniqueOrThrow({
            where: { id: submissionId },
            select: { likesCount: true },
          })
          return Math.max(0, row.likesCount)
        })
      } else {
        const removed = await deps.likes.removeLike(userId, submissionId)
        mutated = removed
        if (removed && submission.likesCount > 0) {
          await deps.submissions.incrementLikes(submissionId, -1)
        }
        const updated = await readLikeState(submissionId)
        likesCount = Math.max(0, updated.likesCount)
      }

      if (mutated) {
        await deps.memberAudit?.log(userId, 'SOLUTION_UNLIKE', {
          submissionId,
          sprintId: submission.sprintId,
        })
      }

      await deps.onAfterLikeChange?.(submission.sprintId)
      return { submissionId: submission.id, liked: false, likes: likesCount }
    },
  }
}
