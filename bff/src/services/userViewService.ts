import type { PrismaClient, Sprint, User } from '@prisma/client'
import { sprintResourceLinksField } from '../validation/schemas.js'
import type { AchievementRepository } from '../repositories/achievementRepo.js'
import type { SprintRepository } from '../repositories/sprintRepo.js'
import type { UserRepository } from '../repositories/userRepo.js'
import type { MemberNotificationService } from './memberNotificationService.js'

export interface MePayload {
  user: { id: string; handle: string; role: string; avatarUrl: string }
  activeSprint: {
    id: string
    title: string
    tabIcon: string | null
    endsAt: string | null
    systemActive: boolean
    resourceLinks: Array<{ label: string; href: string; icon: string }>
  } | null
  stats: {
    position: number
    leaderboardSize: number
    points: number
    cards: Array<Record<string, unknown>>
  }
  notificationsUnread: number
  notifications: Array<{
    id: string
    title: string
    body: string
    createdAt: string
    unread: boolean
  }>
  profile: {
    bio: string
    skillsLabel: string
    contacts: { telegram: string; email: string; github: string }
    statsCards: Array<Record<string, unknown>>
    achievements: Array<{
      id: string
      title: string
      subtitle: string
      icon: string
      variant: 'earned' | 'locked'
    }>
    form: { username: string; email: string; telegram: string; about: string }
  }
  sprintHistory: {
    items: Array<{
      id: string
      sprintId: string
      sprintTitle: string
      repoUrl: string
      demoUrl: string | null
      status: string
      mentorScore: number
      mentorComment: string | null
      createdAt: string
    }>
  }
}

function resourceLinksFromBrief(
  brief: unknown
): Array<{ label: string; href: string; icon: string }> {
  if (!brief || typeof brief !== 'object' || Array.isArray(brief)) return []
  const raw = (brief as { resourceLinks?: unknown }).resourceLinks
  const parsed = sprintResourceLinksField.safeParse(raw)
  return parsed.success ? parsed.data : []
}

function activeSprintPayload(sprint: Sprint | null) {
  if (!sprint) return null
  return {
    id: sprint.id,
    title: sprint.title.toUpperCase(),
    tabIcon: sprint.tabIcon ?? null,
    endsAt: sprint.endsAt ? sprint.endsAt.toISOString() : null,
    systemActive: sprint.active,
    resourceLinks: resourceLinksFromBrief(sprint.brief),
  }
}

function utcMonthKey(d = new Date()): string {
  return d.toISOString().slice(0, 7)
}

function clampNumber(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, n))
}

function buildStatsCards(
  user: User,
  rank: number,
  leaderboardSize: number,
  sprintsAccepted: number
): Array<Record<string, unknown>> {
  const ptsDelta = user.points - user.pointsAtMonthStart
  const moneyDelta = user.moneyEarned - user.moneyAtMonthStart
  const sprDelta = sprintsAccepted - user.sprintsAcceptedAtMonthStart
  const pointsFrom = user.pointsAtMonthStart

  let pointsTrendLabel: string
  let pointsVariant: string
  let pointsTrendIcon: string
  if (ptsDelta === 0) {
    pointsTrendLabel = 'без изменений за месяц'
    pointsVariant = 'slate'
    pointsTrendIcon = 'trending_flat'
  } else if (pointsFrom <= 0 && ptsDelta > 0) {
    pointsTrendLabel = `+${ptsDelta.toLocaleString('ru-RU')} б. за месяц`
    pointsVariant = 'malachite'
    pointsTrendIcon = 'trending_up'
  } else if (pointsFrom <= 0) {
    pointsTrendLabel = `${ptsDelta.toLocaleString('ru-RU')} б.`
    pointsVariant = ptsDelta < 0 ? 'rose' : 'slate'
    pointsTrendIcon = ptsDelta < 0 ? 'trending_down' : 'trending_flat'
  } else {
    const pct = clampNumber((ptsDelta / pointsFrom) * 100, -999, 999)
    const rounded = Math.round(pct * 10) / 10
    const sign = rounded > 0 ? '+' : ''
    pointsTrendLabel = `${sign}${rounded.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}% за месяц`
    pointsVariant = rounded > 0 ? 'malachite' : rounded < 0 ? 'rose' : 'slate'
    pointsTrendIcon = rounded > 0 ? 'trending_up' : rounded < 0 ? 'trending_down' : 'trending_flat'
  }

  let moneyTrendLabel: string
  let moneyVariant: string
  let moneyTrendIcon: string
  if (moneyDelta === 0) {
    moneyTrendLabel = 'без изменений за месяц'
    moneyVariant = 'slate'
    moneyTrendIcon = 'trending_flat'
  } else {
    const sign = moneyDelta > 0 ? '+' : '−'
    const abs = Math.abs(moneyDelta).toLocaleString('ru-RU')
    moneyTrendLabel = `${sign}${abs} ₽ за месяц`
    moneyVariant = moneyDelta > 0 ? 'spring' : 'rose'
    moneyTrendIcon = moneyDelta > 0 ? 'trending_up' : 'trending_down'
  }

  let sprTrendLabel: string
  let sprVariant: string
  let sprTrendIcon: string
  if (sprDelta === 0) {
    sprTrendLabel = 'без новых принятых за месяц'
    sprVariant = 'slate'
    sprTrendIcon = 'trending_flat'
  } else if (sprDelta > 0) {
    sprTrendLabel = `+${sprDelta} за месяц`
    sprVariant = 'malachite'
    sprTrendIcon = 'trending_up'
  } else {
    sprTrendLabel = `${sprDelta} к началу месяца`
    sprVariant = 'rose'
    sprTrendIcon = 'trending_down'
  }

  return [
    {
      key: 'points',
      label: 'Баллы',
      value: String(user.points),
      trendLabel: pointsTrendLabel,
      trendVariant: pointsVariant,
      trendIcon: pointsTrendIcon,
      icon: 'star',
      iconTint: 'turquoise',
    },
    {
      key: 'rank',
      label: 'Глобальный ранг',
      value: `#${rank}`,
      trendLabel: leaderboardSize > 0 ? `из ${leaderboardSize.toLocaleString('ru-RU')}` : '—',
      trendVariant: 'malachite',
      trendIcon: 'trending_flat',
      icon: 'leaderboard',
      iconTint: 'turquoise',
    },
    {
      key: 'sprints',
      label: 'Спринтов пройдено',
      value: String(sprintsAccepted),
      trendLabel: sprTrendLabel,
      trendVariant: sprVariant,
      trendIcon: sprTrendIcon,
      icon: 'bolt',
      iconTint: 'turquoise',
    },
    {
      key: 'money',
      label: 'Заработано денег',
      value: `${user.moneyEarned.toLocaleString('ru-RU')} ₽`,
      trendLabel: moneyTrendLabel,
      trendVariant: moneyVariant,
      trendIcon: moneyTrendIcon,
      icon: 'payments',
      iconTint: 'spring',
    },
  ]
}

export function createUserViewService(deps: {
  prisma: PrismaClient
  users: UserRepository
  sprints: SprintRepository
  achievements: AchievementRepository
  notifications: MemberNotificationService
}) {
  return {
    async markAllNotificationsRead(userId: string): Promise<number> {
      await deps.notifications.markAllRead(userId)
      return deps.notifications.countUnread(userId)
    },

    async me(userId: string): Promise<MePayload | null> {
      let user = await deps.users.findById(userId)
      if (!user) return null

      const [
        sprint,
        achievements,
        leaderboardSize,
        sprintsAccepted,
        history,
        notifUnread,
        notifRows,
      ] = await Promise.all([
        deps.sprints.findActive(),
        deps.achievements.listForUser(userId),
        deps.prisma.user.count(),
        deps.prisma.submission.count({ where: { userId, status: 'ACCEPTED' } }),
        deps.prisma.submission.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 25,
          include: { sprint: { select: { title: true, id: true } } },
        }),
        deps.notifications.countUnread(userId),
        deps.notifications.listForMe(userId),
      ])

      const monthKey = utcMonthKey()
      if (user.statsMonthKey !== monthKey) {
        user = await deps.prisma.user.update({
          where: { id: userId },
          data: {
            statsMonthKey: monthKey,
            pointsAtMonthStart: user.points,
            moneyAtMonthStart: user.moneyEarned,
            sprintsAcceptedAtMonthStart: sprintsAccepted,
          },
        })
      }

      const usersWithMorePoints = await deps.prisma.user.count({
        where: { points: { gt: user.points } },
      })
      const samePointsTie = await deps.prisma.user.count({
        where: { AND: [{ points: user.points }, { id: { lt: user.id } }] },
      })
      const position = usersWithMorePoints + samePointsTie + 1

      const cards = buildStatsCards(user, position, leaderboardSize, sprintsAccepted)

      return {
        user: {
          id: user.id,
          handle: user.handle,
          role: user.role === 'ADMIN' ? 'Архитектор' : 'Участник',
          avatarUrl: user.avatarUrl,
        },
        activeSprint: activeSprintPayload(sprint),
        stats: {
          position,
          leaderboardSize,
          points: user.points,
          cards,
        },
        notificationsUnread: notifUnread,
        notifications: notifRows.map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          createdAt: n.createdAt.toISOString(),
          unread: n.readAt == null,
        })),
        profile: {
          bio: user.bio,
          skillsLabel: user.stack.length > 0 ? user.stack.join(', ') : user.skillsLabel,
          contacts: {
            telegram: user.telegram,
            email: user.email,
            github: user.githubUrl,
          },
          statsCards: cards,
          achievements: achievements.map((a) => ({
            id: a.id,
            title: a.title,
            subtitle: a.subtitle,
            icon: a.icon,
            variant: a.earned ? 'earned' : 'locked',
          })),
          form: {
            username: user.handle,
            email: user.email,
            telegram: user.telegram,
            about: user.bio,
          },
        },
        sprintHistory: {
          items: history.map((h) => ({
            id: h.id,
            sprintId: h.sprintId,
            sprintTitle: h.sprint.title,
            repoUrl: h.repoUrl,
            demoUrl: h.demoUrl,
            status: h.status,
            mentorScore: h.mentorScore,
            mentorComment: h.mentorComment ?? null,
            createdAt: h.createdAt.toISOString(),
          })),
        },
      }
    },
  }
}
