import type { Submission, User, SprintAccess } from '@prisma/client'
import type { SprintAccessRepository } from '../../src/repositories/sprintAccessRepo.js'
import type { UserRepository } from '../../src/repositories/userRepo.js'
import type { LikeRepository } from '../../src/repositories/likeRepo.js'
import type {
  SubmissionRepository,
  SubmissionWithAuthor,
} from '../../src/repositories/submissionRepo.js'
import type { SprintRepository, SortBy } from '../../src/repositories/sprintRepo.js'

let userIdCounter = 0

export function makeUser(overrides: Partial<User> = {}): User {
  userIdCounter += 1
  const id = overrides.id ?? `u_${userIdCounter}`
  return {
    id,
    email: overrides.email ?? `user${userIdCounter}@example.com`,
    handle: overrides.handle ?? `user${userIdCounter}`,
    passwordHash: overrides.passwordHash ?? 'hash',
    role: overrides.role ?? 'USER',
    avatarUrl: overrides.avatarUrl ?? `/avatar/${id}`,
    bio: overrides.bio ?? '',
    skillsLabel: overrides.skillsLabel ?? '',
    realName: overrides.realName ?? '',
    stack: overrides.stack ?? [],
    telegram: overrides.telegram ?? '',
    githubUrl: overrides.githubUrl ?? '',
    moneyEarned: overrides.moneyEarned ?? 0,
    points: overrides.points ?? 0,
    statsMonthKey: overrides.statsMonthKey ?? '',
    pointsAtMonthStart: overrides.pointsAtMonthStart ?? 0,
    moneyAtMonthStart: overrides.moneyAtMonthStart ?? 0,
    sprintsAcceptedAtMonthStart: overrides.sprintsAcceptedAtMonthStart ?? 0,
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  }
}

export function makeInMemoryUserRepo(initial: User[] = []): UserRepository & {
  list(): User[]
} {
  const byId = new Map<string, User>()
  for (const user of initial) byId.set(user.id, user)
  const repo: UserRepository & { list(): User[] } = {
    list: () => Array.from(byId.values()),
    async findById(id) {
      return byId.get(id) ?? null
    },
    async findByEmail(email) {
      return Array.from(byId.values()).find((u) => u.email === email.toLowerCase().trim()) ?? null
    },
    async findByEmailOrHandle(loginOrEmail) {
      const value = loginOrEmail.trim().toLowerCase()
      const handle = value.replace(/^@/, '')
      return Array.from(byId.values()).find((u) => u.email === value || u.handle === handle) ?? null
    },
    async create(input) {
      const id = String(input.id ?? `u_${byId.size + 100}`)
      const user = makeUser({
        ...(input as Partial<User>),
        id,
      })
      byId.set(id, user)
      return user
    },
    async update(id, data) {
      const existing = byId.get(id)
      if (!existing) throw new Error('Not found')
      const updated: User = { ...existing }
      for (const [key, value] of Object.entries(data)) {
        ;(updated as Record<string, unknown>)[key] = value as unknown
      }
      byId.set(id, updated)
      return updated
    },
  }
  return repo
}

export function makeInMemoryLikeRepo(): LikeRepository & {
  rows(): Array<{ userId: string; submissionId: string }>
} {
  const set = new Set<string>()
  const key = (a: string, b: string) => `${a}::${b}`
  return {
    rows: () =>
      Array.from(set).map((k) => {
        const [userId, submissionId] = k.split('::')
        return { userId, submissionId }
      }),
    async addLike(userId, submissionId) {
      const k = key(userId, submissionId)
      if (set.has(k)) return false
      set.add(k)
      return true
    },
    async removeLike(userId, submissionId) {
      return set.delete(key(userId, submissionId))
    },
    async hasLike(userId, submissionId) {
      return set.has(key(userId, submissionId))
    },
    async likedSubmissionIds(userId, submissionIds) {
      return new Set(submissionIds.filter((id) => set.has(key(userId, id))))
    },
  }
}

export function makeInMemorySubmissionRepo(initial: Submission[] = []): SubmissionRepository & {
  raw(): Submission[]
} {
  const byId = new Map<string, Submission>()
  const usersById = new Map<string, User>()
  for (const sub of initial) byId.set(sub.id, sub)
  const withAuthor = (s: Submission): SubmissionWithAuthor => ({
    ...s,
    user: usersById.has(s.userId)
      ? {
          id: usersById.get(s.userId)!.id,
          handle: usersById.get(s.userId)!.handle,
          avatarUrl: usersById.get(s.userId)!.avatarUrl,
        }
      : { id: s.userId, handle: s.userId, avatarUrl: '/avatar/anon' },
  })
  return {
    raw: () => Array.from(byId.values()),
    async listBySprint(sprintId, sortBy: SortBy) {
      const items = Array.from(byId.values()).filter((s) => s.sprintId === sprintId)
      const t = (d: Date) => d.getTime()
      items.sort((a, b) => {
        if (sortBy === 'likes') {
          return (
            b.likesCount - a.likesCount ||
            b.mentorScore - a.mentorScore ||
            t(a.createdAt) - t(b.createdAt)
          )
        }
        if (sortBy === 'mentor') {
          return (
            b.mentorScore - a.mentorScore ||
            t(a.createdAt) - t(b.createdAt) ||
            b.likesCount - a.likesCount
          )
        }
        return (
          b.mentorScore - a.mentorScore ||
          b.likesCount - a.likesCount ||
          t(a.createdAt) - t(b.createdAt)
        )
      })
      return items.map(withAuthor)
    },
    async findById(id) {
      return byId.get(id) ?? null
    },
    async findByUserAndSprint(userId, sprintId) {
      return (
        Array.from(byId.values()).find((s) => s.userId === userId && s.sprintId === sprintId) ??
        null
      )
    },
    async upsert({ userId, sprintId, repoUrl, demoUrl }) {
      const existing = Array.from(byId.values()).find(
        (s) => s.userId === userId && s.sprintId === sprintId
      )
      if (existing) {
        const updated: Submission = {
          ...existing,
          repoUrl,
          demoUrl: demoUrl ?? null,
          status: 'PENDING',
          updatedAt: new Date(),
        }
        byId.set(existing.id, updated)
        return updated
      }
      const id = `s_${byId.size + 1}`
      const created: Submission = {
        id,
        userId,
        sprintId,
        repoUrl,
        demoUrl: demoUrl ?? null,
        mentorScore: 0,
        mentorComment: null,
        status: 'PENDING',
        likesCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      byId.set(id, created)
      return created
    },
    async incrementLikes(id, delta) {
      const found = byId.get(id)
      if (!found) return
      byId.set(id, { ...found, likesCount: Math.max(0, found.likesCount + delta) })
    },
    async resetLikes(id, value) {
      const found = byId.get(id)
      if (!found) return
      byId.set(id, { ...found, likesCount: value })
    },
  }
}

export function makeInMemorySprintRepo(
  initial: Array<{
    id: string
    active?: boolean
    endsAt?: Date | null
  }>
): SprintRepository {
  const items = initial.map((s) => ({
    id: s.id,
    slug: s.id,
    title: `Sprint ${s.id}`,
    tabLabel: `tab-${s.id}`,
    tabIcon: null,
    completedLabel: 'Активный',
    tags: [] as string[],
    active: s.active ?? false,
    startsAt: null,
    endsAt: s.endsAt ?? null,
    brief: {},
    metrics: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  }))
  return {
    async list() {
      return items
    },
    async findById(id) {
      return items.find((s) => s.id === id) ?? null
    },
    async findBySlug(slug) {
      return items.find((s) => s.slug === slug) ?? null
    },
    async findActive() {
      return items.find((s) => s.active) ?? null
    },
    async countSubmissions() {
      return 0
    },
  }
}

export function makeMockSprintAccess(): SprintAccessRepository {
  const dummyUser = (id: string): User =>
    makeUser({ id, role: 'USER', email: `${id}@t.com`, handle: id })
  return {
    find: async () => null,
    upsert: async (input) =>
      ({
        id: 'sa1',
        userId: input.userId,
        sprintId: input.sprintId,
        canSubmit: input.canSubmit,
        canView: input.canView,
        createdAt: new Date(),
        updatedAt: new Date(),
      }) as SprintAccess,
    delete: async () => undefined,
    listBySprint: async () => [],
    listByUser: async () => [],
    grantNewMemberActiveSprint: async () => undefined,
    async effectiveRights(userId) {
      return { user: dummyUser(userId), canSubmit: true, canView: true }
    },
  }
}
