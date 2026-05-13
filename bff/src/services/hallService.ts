import type { PrismaClient, Sprint } from '@prisma/client'
import { AppError } from '../errors/AppError.js'
import type { LikeRepository } from '../repositories/likeRepo.js'
import type { SprintAccessRepository } from '../repositories/sprintAccessRepo.js'
import type { SprintRepository, SortBy } from '../repositories/sprintRepo.js'
import type { SubmissionRepository, SubmissionWithAuthor } from '../repositories/submissionRepo.js'

const RANK_BADGES = ['gold', 'slate', 'bronze'] as const

const DEFAULT_QUOTE = {
  text: 'Качество кода — это не роскошь, а контракт между разработчиком и будущим собой.',
  attribution: 'Архитектор Basalt Arena',
}

function formatDate(date: Date): string {
  const iso = date.toISOString()
  return iso.slice(0, 10)
}

function decorateSolution(submission: SubmissionWithAuthor, index: number, likedSet: Set<string>) {
  const rank = index + 1
  const badge = rank <= 3 ? RANK_BADGES[rank - 1] : 'muted'
  const displayName = submission.user.handle.replace(/^@/, '')
  return {
    id: submission.id,
    rank,
    rankBadge: badge,
    showCrown: rank === 1,
    displayName,
    handle: displayName,
    avatarUrl: submission.user.avatarUrl,
    avatarSeed: submission.user.handle,
    dateLabel: formatDate(submission.createdAt),
    mentorScore: submission.mentorScore,
    codeUrl: submission.repoUrl,
    demoUrl: submission.demoUrl ?? '#',
    likes: submission.likesCount,
    likedByMe: likedSet.has(submission.id),
  }
}

function describeSprint(
  sprint: Sprint,
  submissions: SubmissionWithAuthor[],
  likedSet: Set<string>,
  participantsWithoutSubmission: Array<{ id: string; handle: string; avatarUrl: string }>
) {
  return {
    id: sprint.id,
    heroTitle: sprint.title,
    title: sprint.title,
    /** Текущий активный спринт арены в БД — для подписи на зале независимо от текста completedLabel. */
    arenaActive: sprint.active === true,
    tabLabel: sprint.tabLabel,
    tabIcon: sprint.tabIcon ?? null,
    completedLabel: sprint.completedLabel,
    tags: sprint.tags,
    brief: sprint.brief,
    metrics: sprint.metrics,
    solutions: submissions.map((s, i) => decorateSolution(s, i, likedSet)),
    participantsWithoutSubmission,
    endsAt: sprint.endsAt ? sprint.endsAt.toISOString() : null,
  }
}

/** В зале: только арена (даже без решений) и завершённые спринты с решениями; арена всегда первая. */
function filterHallSprintsForPublic<
  T extends { id: string; solutions: unknown[]; endsAt: string | null },
>(details: T[], activeId: string | null | undefined): T[] {
  const eligible = details.filter((s) => {
    const isArena = activeId != null && s.id === activeId
    return isArena || s.solutions.length > 0
  })
  if (!activeId) {
    return [...eligible].sort((a, b) => {
      const ta = a.endsAt ? new Date(a.endsAt).getTime() : 0
      const tb = b.endsAt ? new Date(b.endsAt).getTime() : 0
      return tb - ta
    })
  }
  const active = eligible.find((s) => s.id === activeId)
  const rest = eligible
    .filter((s) => s.id !== activeId)
    .sort((a, b) => {
      const ta = a.endsAt ? new Date(a.endsAt).getTime() : 0
      const tb = b.endsAt ? new Date(b.endsAt).getTime() : 0
      return tb - ta
    })
  return active ? [active, ...rest] : rest
}

export interface HallService {
  hall(userId: string | undefined, sortBy: SortBy): Promise<unknown>
  sprintList(userId: string | undefined, sortBy: SortBy): Promise<unknown>
  sprintById(userId: string | undefined, id: string, sortBy: SortBy): Promise<unknown>
}

export function createHallService(deps: {
  prisma: PrismaClient
  sprints: SprintRepository
  submissions: SubmissionRepository
  likes: LikeRepository
  sprintAccess: SprintAccessRepository
}): HallService {
  async function participantsWithoutSubmissionForSprint(sprintId: string) {
    return deps.prisma.user.findMany({
      where: {
        role: 'USER',
        submissions: { none: { sprintId } },
      },
      select: { id: true, handle: true, avatarUrl: true },
      orderBy: { handle: 'asc' },
      take: 200,
    })
  }

  async function loadSprintsWithSolutions(userId: string | undefined, sortBy: SortBy) {
    const sprints = await deps.sprints.list()
    const detailed = await Promise.all(
      sprints.map(async (sprint) => {
        const rights = userId ? await deps.sprintAccess.effectiveRights(userId, sprint.id) : null
        const canView = rights?.canView ?? true
        const participants = canView ? await participantsWithoutSubmissionForSprint(sprint.id) : []
        if (!canView) {
          return describeSprint(sprint, [], new Set(), [])
        }
        const submissions = await deps.submissions.listBySprint(sprint.id, sortBy)
        const ids = submissions.map((s) => s.id)
        const likedSet = userId
          ? await deps.likes.likedSubmissionIds(userId, ids)
          : new Set<string>()
        return describeSprint(sprint, submissions, likedSet, participants)
      })
    )
    return detailed
  }

  return {
    async hall(userId, sortBy) {
      const [activeModel, sprints] = await Promise.all([
        deps.sprints.findActive(),
        loadSprintsWithSolutions(userId, sortBy),
      ])
      const activeId = activeModel?.id ?? null
      const visible = filterHallSprintsForPublic(sprints, activeId)
      const hallHero = visible[0] ?? null
      const pastWinners = visible
        .filter((s) => hallHero && s.id !== hallHero.id && s.solutions.length > 0)
        .map((s, idx) => {
          const top = (s as { solutions: ReturnType<typeof decorateSolution>[] }).solutions[0]
          return {
            sprintRank: `#${visible.length - idx - 1}`,
            title: s.title,
            handle: top?.handle ?? 'unknown',
          }
        })
      return {
        page: {
          breadcrumbs: [{ label: 'BASALT ARENA' }, { label: 'ЗАЛ СЛАВЫ', muted: true }],
          title: 'Зал славы',
          description:
            'Лучшие решения сообщества. Сортировка: эффективность (балл и лайки), лайки или оценка наставника.',
        },
        sprints: visible,
        pastWinners,
        quote: DEFAULT_QUOTE,
        loadMoreRemaining: 0,
      }
    },
    async sprintList(userId, sortBy) {
      const sprints = await loadSprintsWithSolutions(userId, sortBy)
      return { sprints }
    },
    async sprintById(userId, id, sortBy) {
      const sprint = await deps.sprints.findById(id)
      if (!sprint) return null
      if (!sprint.published || sprint.archived) return null
      if (userId) {
        const rights = await deps.sprintAccess.effectiveRights(userId, id)
        if (!rights?.canView) {
          throw AppError.forbidden('No view access for this sprint')
        }
      }
      const submissions = await deps.submissions.listBySprint(id, sortBy)
      const ids = submissions.map((s) => s.id)
      const likedSet = userId ? await deps.likes.likedSubmissionIds(userId, ids) : new Set<string>()
      const participants = userId ? await participantsWithoutSubmissionForSprint(id) : []
      return { sprint: describeSprint(sprint, submissions, likedSet, participants) }
    },
  }
}
