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
    const existing = await deps.submissions.findByUserAndSprint(input.userId, input.sprintId)
    const row = await deps.submissions.upsert(input)
    await deps.onAfterSubmission?.(input.sprintId)
    return { ...row, isCreate: !existing }
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
