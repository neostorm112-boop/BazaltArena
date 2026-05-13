import type { PrismaClient, Submission, User } from '@prisma/client'
import { type SortBy, sortOrderForSubmissions } from './sprintRepo.js'

export interface SubmissionWithAuthor extends Submission {
  user: Pick<User, 'id' | 'handle' | 'avatarUrl'>
}

export interface SubmissionRepository {
  listBySprint(sprintId: string, sortBy: SortBy): Promise<SubmissionWithAuthor[]>
  findById(id: string): Promise<Submission | null>
  findByUserAndSprint(userId: string, sprintId: string): Promise<Submission | null>
  upsert(input: {
    userId: string
    sprintId: string
    repoUrl: string
    demoUrl?: string | null
  }): Promise<Submission>
  incrementLikes(id: string, delta: number): Promise<void>
  resetLikes(id: string, value: number): Promise<void>
}

export function createSubmissionRepository(prisma: PrismaClient): SubmissionRepository {
  return {
    listBySprint: (sprintId, sortBy) =>
      prisma.submission.findMany({
        where: { sprintId },
        orderBy: sortOrderForSubmissions(sortBy),
        include: { user: { select: { id: true, handle: true, avatarUrl: true } } },
      }),
    findById: (id) => prisma.submission.findUnique({ where: { id } }),
    findByUserAndSprint: (userId, sprintId) =>
      prisma.submission.findUnique({
        where: { submission_user_sprint_unique: { userId, sprintId } },
      }),
    upsert: ({ userId, sprintId, repoUrl, demoUrl }) =>
      prisma.submission.upsert({
        where: { submission_user_sprint_unique: { userId, sprintId } },
        update: { repoUrl, demoUrl: demoUrl ?? null, status: 'PENDING' },
        create: { userId, sprintId, repoUrl, demoUrl: demoUrl ?? null },
      }),
    incrementLikes: async (id, delta) => {
      await prisma.submission.update({
        where: { id },
        data: { likesCount: { increment: delta } },
      })
    },
    resetLikes: async (id, value) => {
      await prisma.submission.update({ where: { id }, data: { likesCount: value } })
    },
  }
}
