import { Prisma, type PrismaClient, type Submission, type User } from '@prisma/client'
import { type SortBy, sortOrderForSubmissions } from './sprintRepo.js'

export interface SubmissionWithAuthor extends Submission {
  user: Pick<User, 'id' | 'handle' | 'avatarUrl'>
}

export type UpsertedSubmission = { submission: Submission; isCreate: boolean }

export interface SubmissionRepository {
  listBySprint(sprintId: string, sortBy: SortBy): Promise<SubmissionWithAuthor[]>
  findById(id: string): Promise<Submission | null>
  findByUserAndSprint(userId: string, sprintId: string): Promise<Submission | null>
  /**
   * Atomic upsert keyed on (userId, sprintId). Returns whether the row was created
   * (vs updated) — detected via Postgres' `xmax = 0` trick on the RETURNING clause,
   * so the answer is consistent under concurrent calls. Callers no longer need a
   * pre-flight findByUserAndSprint check.
   */
  upsert(input: {
    userId: string
    sprintId: string
    repoUrl: string
    demoUrl?: string | null
  }): Promise<UpsertedSubmission>
  incrementLikes(id: string, delta: number): Promise<void>
  resetLikes(id: string, value: number): Promise<void>
}

type SubmissionRow = {
  id: string
  userId: string
  sprintId: string
  repoUrl: string
  demoUrl: string | null
  mentorScore: number
  mentorComment: string | null
  status: Submission['status']
  likesCount: number
  createdAt: Date
  updatedAt: Date
  is_create: boolean
}

function newId(): string {
  // Mirrors @default(cuid()) shape (string, opaque). Length is not load-bearing.
  return 'c' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
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
    upsert: async ({ userId, sprintId, repoUrl, demoUrl }) => {
      const id = newId()
      const demo = demoUrl ?? null
      // Postgres trick: on an INSERT path, the just-inserted row has xmax = 0;
      // on the UPDATE path of ON CONFLICT, xmax is set to the txid that wrote it.
      // This gives us an atomic, race-free signal of which branch executed.
      const rows = await prisma.$queryRaw<SubmissionRow[]>`
        INSERT INTO "Submission" ("id", "userId", "sprintId", "repoUrl", "demoUrl", "status", "updatedAt")
        VALUES (${id}, ${userId}, ${sprintId}, ${repoUrl}, ${demo}, 'PENDING', NOW())
        ON CONFLICT ("userId", "sprintId") DO UPDATE
        SET "repoUrl" = EXCLUDED."repoUrl",
            "demoUrl" = EXCLUDED."demoUrl",
            "status"  = 'PENDING',
            "updatedAt" = NOW()
        RETURNING "id", "userId", "sprintId", "repoUrl", "demoUrl", "mentorScore",
                  "mentorComment", "status", "likesCount", "createdAt", "updatedAt",
                  (xmax = 0) AS is_create
      `
      const row = rows[0]
      if (!row)
        throw new Prisma.PrismaClientKnownRequestError('Submission upsert returned no row', {
          code: 'P2025',
          clientVersion: Prisma.prismaVersion.client,
        })
      const { is_create, ...rest } = row
      return { submission: rest as Submission, isCreate: is_create }
    },
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
