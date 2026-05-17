import { AppError } from '../errors/AppError.js'
import type { SprintAccessRepository } from '../repositories/sprintAccessRepo.js'
import type { SprintRepository } from '../repositories/sprintRepo.js'
import type { SubmissionRepository } from '../repositories/submissionRepo.js'

export type MemberSubmissionRow = {
  id: string
  sprintId: string
  userId: string
  repoUrl: string
  demoUrl: string | null
  createdAt: Date
  /** True when this upsert created a new row; false when an existing submission was updated. */
  isCreate: boolean
}

export interface SubmissionService {
  submit(input: {
    userId: string
    sprintId: string
    repoUrl: string
    demoUrl?: string
  }): Promise<MemberSubmissionRow>
  submitToActive(input: {
    userId: string
    repoUrl: string
    demoUrl?: string
  }): Promise<MemberSubmissionRow>
}

export function createSubmissionService(deps: {
  sprints: SprintRepository
  submissions: SubmissionRepository
  sprintAccess: SprintAccessRepository
  onAfterSubmission?: (sprintId: string) => Promise<void>
  onAfterSubmissionUpsert?: (input: {
    userId: string
    sprintId: string
    submissionId: string
    isCreate: boolean
  }) => Promise<void>
}): SubmissionService {
  async function assertCanSubmit(userId: string, sprintId: string) {
    const rights = await deps.sprintAccess.effectiveRights(userId, sprintId)
    if (!rights) throw AppError.unauthorized('User not found')
    if (!rights.canSubmit) throw AppError.forbidden('No submit access for this sprint')
  }

  async function commitSubmission(input: {
    userId: string
    sprintId: string
    repoUrl: string
    demoUrl?: string
  }) {
    const sprint = await deps.sprints.findById(input.sprintId)
    if (!sprint) throw AppError.notFound('Sprint not found')
    if (!sprint.published || sprint.archived) throw AppError.notFound('Sprint not found')
    if (sprint.endsAt && sprint.endsAt.getTime() < Date.now()) {
      throw AppError.conflict('Sprint is already closed')
    }
    await assertCanSubmit(input.userId, input.sprintId)
    // Atomic upsert returns a race-safe `isCreate` (Postgres `xmax = 0`), so we no
    // longer do a separate findByUserAndSprint — two concurrent calls would both have
    // seen "no existing row" and fired onSubmissionUpsert with isCreate=true twice.
    const { submission, isCreate } = await deps.submissions.upsert(input)
    await deps.onAfterSubmission?.(input.sprintId)
    if (deps.onAfterSubmissionUpsert) {
      try {
        await deps.onAfterSubmissionUpsert({
          userId: input.userId,
          sprintId: input.sprintId,
          submissionId: submission.id,
          isCreate,
        })
      } catch {
        /* achievement check must not break submission flow */
      }
    }
    return { ...submission, isCreate }
  }

  return {
    submit: commitSubmission,
    async submitToActive(input) {
      const sprint = await deps.sprints.findActive()
      if (!sprint) throw AppError.notFound('No active sprint')
      return commitSubmission({ ...input, sprintId: sprint.id })
    },
  }
}
