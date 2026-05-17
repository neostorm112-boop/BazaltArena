import { describe, expect, it, vi } from 'vitest'
import { createSubmissionService } from '../../src/services/submissionService.js'
import {
  makeInMemorySubmissionRepo,
  makeInMemorySprintRepo,
  makeMockSprintAccess,
} from './helpers.js'

describe('submissionService.submit — isCreate semantics', () => {
  it('fires onAfterSubmissionUpsert exactly once with isCreate=true on first submit', async () => {
    const sprints = makeInMemorySprintRepo([{ id: 'sp1', active: true, endsAt: null }])
    const submissions = makeInMemorySubmissionRepo([])
    const onUpsert = vi.fn(async () => {})
    const svc = createSubmissionService({
      sprints,
      submissions,
      sprintAccess: makeMockSprintAccess(),
      onAfterSubmissionUpsert: onUpsert,
    })
    await svc.submit({
      userId: 'u1',
      sprintId: 'sp1',
      repoUrl: 'https://example.com/repo',
    })
    expect(onUpsert).toHaveBeenCalledTimes(1)
    expect(onUpsert.mock.calls[0][0]).toMatchObject({ userId: 'u1', isCreate: true })
  })

  it('second submit by same user to same sprint reports isCreate=false', async () => {
    const sprints = makeInMemorySprintRepo([{ id: 'sp1', active: true, endsAt: null }])
    const submissions = makeInMemorySubmissionRepo([])
    const onUpsert = vi.fn(async () => {})
    const svc = createSubmissionService({
      sprints,
      submissions,
      sprintAccess: makeMockSprintAccess(),
      onAfterSubmissionUpsert: onUpsert,
    })
    await svc.submit({ userId: 'u1', sprintId: 'sp1', repoUrl: 'r1' })
    await svc.submit({ userId: 'u1', sprintId: 'sp1', repoUrl: 'r2' })
    expect(onUpsert).toHaveBeenCalledTimes(2)
    expect(onUpsert.mock.calls[0][0].isCreate).toBe(true)
    expect(onUpsert.mock.calls[1][0].isCreate).toBe(false)
  })

  it('two concurrent submits to the same sprint do not both report isCreate=true', async () => {
    // The in-memory upsert mirrors the DB-level atomicity: only the first call sees
    // "no existing row" and gets isCreate=true. The second one — even though it ran
    // before the first finished — observes the inserted row and gets isCreate=false.
    const sprints = makeInMemorySprintRepo([{ id: 'sp1', active: true, endsAt: null }])
    const submissions = makeInMemorySubmissionRepo([])
    const upserts: boolean[] = []
    const svc = createSubmissionService({
      sprints,
      submissions,
      sprintAccess: makeMockSprintAccess(),
      onAfterSubmissionUpsert: async ({ isCreate }) => {
        upserts.push(isCreate)
      },
    })
    await Promise.all([
      svc.submit({ userId: 'u1', sprintId: 'sp1', repoUrl: 'r1' }),
      svc.submit({ userId: 'u1', sprintId: 'sp1', repoUrl: 'r2' }),
    ])
    expect(upserts.filter(Boolean)).toHaveLength(1)
    expect(upserts.filter((v) => !v)).toHaveLength(1)
  })

  it('rejects when sprint is past its endsAt', async () => {
    const sprints = makeInMemorySprintRepo([
      { id: 'sp1', active: true, endsAt: new Date(Date.now() - 1000) },
    ])
    const submissions = makeInMemorySubmissionRepo([])
    const svc = createSubmissionService({
      sprints,
      submissions,
      sprintAccess: makeMockSprintAccess(),
    })
    await expect(
      svc.submit({ userId: 'u1', sprintId: 'sp1', repoUrl: 'r' })
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('granter failure does not break submission', async () => {
    const sprints = makeInMemorySprintRepo([{ id: 'sp1', active: true, endsAt: null }])
    const submissions = makeInMemorySubmissionRepo([])
    const svc = createSubmissionService({
      sprints,
      submissions,
      sprintAccess: makeMockSprintAccess(),
      onAfterSubmissionUpsert: async () => {
        throw new Error('granter died')
      },
    })
    const row = await svc.submit({ userId: 'u1', sprintId: 'sp1', repoUrl: 'r' })
    expect(row.id).toBeTruthy()
  })
})
