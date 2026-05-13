import { describe, expect, it, vi } from 'vitest'
import { createLikeService } from '../../src/services/likeService.js'
import {
  makeInMemoryLikeRepo,
  makeInMemorySubmissionRepo,
  makeMockSprintAccess,
} from './helpers.js'
import type { Submission } from '@prisma/client'

function seedSubmission(): Submission {
  return {
    id: 's_1',
    userId: 'author',
    sprintId: 'sp_1',
    repoUrl: 'https://example.com/repo',
    demoUrl: null,
    mentorScore: 0,
    mentorComment: null,
    status: 'PENDING',
    likesCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('likeService.like', () => {
  it('increments likes on first call, stays idempotent on repeat', async () => {
    const likes = makeInMemoryLikeRepo()
    const submissions = makeInMemorySubmissionRepo([seedSubmission()])
    const service = createLikeService({
      likes,
      submissions,
      sprintAccess: makeMockSprintAccess(),
    })

    const a = await service.like('user_1', 's_1')
    expect(a).toEqual({ submissionId: 's_1', liked: true, likes: 1 })

    const b = await service.like('user_1', 's_1')
    expect(b.likes).toBe(1)
    expect(likes.rows()).toHaveLength(1)
  })

  it('unlike decrements once, then is idempotent', async () => {
    const likes = makeInMemoryLikeRepo()
    const submissions = makeInMemorySubmissionRepo([{ ...seedSubmission(), likesCount: 1 }])
    await likes.addLike('user_1', 's_1')
    const service = createLikeService({
      likes,
      submissions,
      sprintAccess: makeMockSprintAccess(),
    })

    const first = await service.unlike('user_1', 's_1')
    expect(first).toEqual({ submissionId: 's_1', liked: false, likes: 0 })
    const second = await service.unlike('user_1', 's_1')
    expect(second.likes).toBe(0)
  })

  it('logs SOLUTION_LIKE only when the like row is new', async () => {
    const audit = { log: vi.fn() }
    const likes = makeInMemoryLikeRepo()
    const submissions = makeInMemorySubmissionRepo([seedSubmission()])
    const service = createLikeService({
      likes,
      submissions,
      sprintAccess: makeMockSprintAccess(),
      memberAudit: audit,
    })

    await service.like('user_1', 's_1')
    expect(audit.log).toHaveBeenCalledTimes(1)
    expect(audit.log).toHaveBeenCalledWith('user_1', 'SOLUTION_LIKE', {
      submissionId: 's_1',
      sprintId: 'sp_1',
    })

    await service.like('user_1', 's_1')
    expect(audit.log).toHaveBeenCalledTimes(1)
  })

  it('logs SOLUTION_UNLIKE only when a like row was removed', async () => {
    const audit = { log: vi.fn() }
    const likes = makeInMemoryLikeRepo()
    const submissions = makeInMemorySubmissionRepo([{ ...seedSubmission(), likesCount: 1 }])
    await likes.addLike('user_1', 's_1')
    const service = createLikeService({
      likes,
      submissions,
      sprintAccess: makeMockSprintAccess(),
      memberAudit: audit,
    })

    await service.unlike('user_1', 's_1')
    expect(audit.log).toHaveBeenCalledWith('user_1', 'SOLUTION_UNLIKE', {
      submissionId: 's_1',
      sprintId: 'sp_1',
    })
    await service.unlike('user_1', 's_1')
    expect(audit.log).toHaveBeenCalledTimes(1)
  })

  it('throws NOT_FOUND for unknown submission', async () => {
    const likes = makeInMemoryLikeRepo()
    const submissions = makeInMemorySubmissionRepo([])
    const service = createLikeService({
      likes,
      submissions,
      sprintAccess: makeMockSprintAccess(),
    })
    await expect(service.like('user_1', 's_missing')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
