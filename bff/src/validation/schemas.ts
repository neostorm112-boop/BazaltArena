import { z } from 'zod'

/** Prisma @default(cuid()) ids */
export const cuidParam = z.string().cuid()

/** Prisma `SubmissionStatus` — для админ-фильтров и PATCH. */
export const submissionStatusEnum = z.enum(['PENDING', 'REVIEWED', 'ACCEPTED', 'REJECTED'])

const REPO_URL_MAX = 500

/**
 * Private / link-local hosts that we never want to accept in a user-submitted URL.
 * Blocks the obvious SSRF entry points (cloud metadata, internal services, loopback).
 * The list is intentionally pattern-based rather than parsed as IPs because users
 * occasionally type host names (`localhost.localdomain`) that resolve to loopback.
 */
const PRIVATE_HOST_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /\.localhost$/i,
  /^127(?:\.\d{1,3}){3}$/,
  /^0(?:\.\d{1,3}){3}$/,
  /^10(?:\.\d{1,3}){3}$/,
  /^192\.168(?:\.\d{1,3}){2}$/,
  /^172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}$/,
  /^169\.254(?:\.\d{1,3}){2}$/,
  /^::1$/,
  /^fe80:/i,
  /^fc[0-9a-f]{2}:/i,
  /^fd[0-9a-f]{2}:/i,
]

function isPrivateHost(host: string): boolean {
  const cleaned = host.replace(/^\[/, '').replace(/\]$/, '').trim()
  if (!cleaned) return true
  return PRIVATE_HOST_PATTERNS.some((re) => re.test(cleaned))
}

function allowPrivateRepoHosts(): boolean {
  const flag = process.env.ALLOW_PRIVATE_REPO_URLS
  return flag === '1' || flag === 'true'
}

/**
 * Strict URL validator for repository / demo links coming from members and admins.
 * Rejects:
 *   - any scheme other than http/https
 *   - lengths above {@link REPO_URL_MAX}
 *   - hosts on loopback / private / link-local networks (SSRF guard; can be relaxed
 *     in dev via the `ALLOW_PRIVATE_REPO_URLS` env flag)
 */
export const repoUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(REPO_URL_MAX)
  .superRefine((raw, ctx) => {
    let url: URL
    try {
      url = new URL(raw)
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid URL' })
      return
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Only http/https URLs are allowed',
      })
      return
    }
    if (!url.hostname) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'URL must include a hostname' })
      return
    }
    if (!allowPrivateRepoHosts() && isPrivateHost(url.hostname)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Private / internal hosts are not allowed',
      })
    }
  })

const urlOrEmpty = z.union([repoUrlSchema, z.literal('')])

/** Same rules as registration handle (after optional leading `@`). */
const usernameOrHandleShape = z
  .string()
  .min(2)
  .max(64)
  .transform((s) => s.trim().replace(/^@/, ''))
  .refine((h) => /^[a-zA-Z0-9_-]+$/.test(h), { message: 'Invalid username' })

export const authLoginBody = z
  .object({
    email: z.string().trim().min(1).max(320),
    password: z.string().min(1).max(512),
  })
  .strict()

export const authRegisterBody = z
  .object({
    email: z.string().trim().email().max(320),
    password: z.string().min(8).max(512),
    handle: usernameOrHandleShape,
  })
  .strict()

export const authRefreshBody = z
  .object({
    refreshToken: z.string().min(10).max(8192),
  })
  .strict()

export const meProfilePatchBody = z
  .object({
    form: z
      .object({
        username: usernameOrHandleShape.optional(),
        telegram: z.string().min(2).max(64).optional(),
        about: z.string().max(1024).optional(),
      })
      .strict(),
  })
  .strict()
  .refine((b) => Object.keys(b.form).length > 0, {
    message: 'form must include at least one field to update',
    path: ['form'],
  })

export const submissionUpsertBody = z
  .object({
    repoUrl: repoUrlSchema,
    demoUrl: urlOrEmpty.optional(),
  })
  .strict()
  .transform((v) => ({
    ...v,
    demoUrl: v.demoUrl === '' ? undefined : v.demoUrl,
  }))

export const solutionIdParams = z.object({ id: cuidParam }).strict()

export const sprintIdParams = z.object({ id: cuidParam }).strict()

/** Sprint `brief.resourceLinks[]` — persisted JSON, validated on admin write. */
export const sprintResourceLinkItem = z
  .object({
    label: z.string().trim().min(1).max(120),
    href: z.string().url().max(2048),
    icon: z.string().trim().min(1).max(64),
  })
  .strict()

export const sprintResourceLinksField = z.array(sprintResourceLinkItem).max(20)

const adminSprintBriefJson = z.record(z.unknown()).transform((rec) => {
  const out: Record<string, unknown> = { ...rec }
  if ('resourceLinks' in out && out.resourceLinks !== undefined) {
    out.resourceLinks = sprintResourceLinksField.parse(out.resourceLinks)
  }
  return out
})

/** GET query: unknown keys rejected; `sortBy` defaults to efficiency when omitted. */
export const listSortQuery = z
  .object({
    sortBy: z.enum(['efficiency', 'likes', 'mentor']).optional(),
  })
  .strict()
  .transform((q) => ({ sortBy: q.sortBy ?? ('efficiency' as const) }))

export const adminUsersQuery = z
  .object({
    search: z.string().trim().max(200).optional(),
    skip: z.coerce.number().int().min(0).default(0),
    take: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict()

export const adminUserIdParams = z.object({ id: cuidParam }).strict()

const adminPatchUserGithub = z.string().max(512).optional()

const adminPatchUserStack = z
  .array(z.string().min(1).max(64))
  .max(30)
  .optional()
  .transform((arr) => (arr === undefined ? undefined : arr.map((s) => s.trim()).filter(Boolean)))

const adminPatchUserFieldKeys = [
  'role',
  'email',
  'points',
  'handle',
  'bio',
  'telegram',
  'github',
  'realName',
  'stack',
  'moneyEarned',
] as const

export const adminPatchUserBody = z
  .object({
    role: z.enum(['ADMIN', 'USER']).optional(),
    email: z.string().trim().email().max(320).optional(),
    points: z.coerce.number().int().min(0).optional(),
    handle: usernameOrHandleShape.optional(),
    bio: z.string().max(500).optional(),
    telegram: z.string().max(64).optional(),
    github: adminPatchUserGithub.optional(),
    realName: z.string().max(120).optional(),
    stack: adminPatchUserStack,
    moneyEarned: z.coerce.number().int().min(0).max(2_000_000_000).optional(),
  })
  .strict()
  .refine((b) => adminPatchUserFieldKeys.some((k) => b[k as keyof typeof b] !== undefined), {
    message: 'At least one field is required',
  })

export type AdminPatchUserBody = z.infer<typeof adminPatchUserBody>

/**
 * Refuses sprint windows that land entirely in the past — admins were creating
 * sprints with backdated `startsAt`/`endsAt` and the system silently flipped them
 * straight to "Завершённый". Setting `allowPast: true` is an explicit opt-in for
 * the rare case where you really do want to backfill a past sprint.
 *
 * `endsAt` is treated as the load-bearing signal: if it is in the future the
 * sprint is "still happening" and the start date can legitimately be in the past.
 * If `endsAt` is missing or null we fall back to `startsAt`.
 */
function refineSprintDates(
  body: { startsAt?: string | null; endsAt?: string | null; allowPast?: boolean },
  ctx: z.RefinementCtx
) {
  if (body.allowPast) return
  const now = Date.now()
  const ends = body.endsAt ? Date.parse(body.endsAt) : Number.NaN
  const starts = body.startsAt ? Date.parse(body.startsAt) : Number.NaN
  if (Number.isFinite(ends)) {
    if (ends <= now) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'endsAt must be in the future (set allowPast: true to override)',
        path: ['endsAt'],
      })
    }
    return
  }
  if (Number.isFinite(starts) && starts < now) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'startsAt must be in the future (set allowPast: true to override)',
      path: ['startsAt'],
    })
  }
}

export const adminCreateSprintBody = z
  .object({
    slug: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[a-z0-9-]+$/),
    title: z.string().min(1).max(256),
    tabLabel: z.string().min(1).max(128),
    tabIcon: z.union([z.string().max(64), z.null()]).optional(),
    completedLabel: z.string().min(1).max(128),
    tags: z.array(z.string().max(64)).max(50).default([]),
    active: z.boolean().optional(),
    published: z.boolean().optional(),
    archived: z.boolean().optional(),
    brief: adminSprintBriefJson.default({}),
    metrics: z.record(z.unknown()).default({}),
    startsAt: z.union([z.string().datetime(), z.null()]).optional(),
    endsAt: z.union([z.string().datetime(), z.null()]).optional(),
    allowPast: z.boolean().optional(),
  })
  .strict()
  .superRefine(refineSprintDates)

export const adminBatchSprintAccessBody = z
  .object({
    userIds: z.array(cuidParam).min(1).max(200),
    canSubmit: z.boolean(),
    canView: z.boolean(),
  })
  .strict()

export const adminBatchSubmissionIdsBody = z
  .object({
    ids: z.array(cuidParam).min(1).max(100),
  })
  .strict()

export const adminPatchSprintBody = z
  .object({
    title: z.string().min(1).max(256).optional(),
    tabLabel: z.string().min(1).max(128).optional(),
    completedLabel: z.string().min(1).max(128).optional(),
    tags: z.array(z.string().max(64)).max(50).optional(),
    brief: adminSprintBriefJson.optional(),
    metrics: z.record(z.unknown()).optional(),
    startsAt: z.union([z.string().datetime(), z.null()]).optional(),
    endsAt: z.union([z.string().datetime(), z.null()]).optional(),
    published: z.boolean().optional(),
    archived: z.boolean().optional(),
    active: z.boolean().optional(),
    slug: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    tabIcon: z.union([z.string().max(64), z.null()]).optional(),
    allowPast: z.boolean().optional(),
  })
  .strict()
  .refine(
    (b) => {
      const keys = Object.keys(b).filter((k) => k !== 'allowPast')
      return keys.length > 0
    },
    { message: 'At least one field is required' }
  )
  .superRefine((b, ctx) => {
    // Only validate the dates that are actually being changed. Patching an unrelated
    // field on an already-past sprint should not start failing because of historical
    // dates we never asked to touch.
    if (b.startsAt === undefined && b.endsAt === undefined) return
    refineSprintDates(b, ctx)
  })

export const adminSprintIdParams = z.object({ id: cuidParam }).strict()

export const adminSprintAccessParams = z.object({ sprintId: cuidParam }).strict()

export const adminSprintAccessUserParams = z
  .object({
    sprintId: cuidParam,
    userId: cuidParam,
  })
  .strict()

export const adminPutSprintAccessBody = z
  .object({
    userId: cuidParam,
    canSubmit: z.boolean(),
    canView: z.boolean(),
  })
  .strict()

export const adminSubmissionsQuery = z
  .object({
    sprintId: cuidParam.optional(),
    userId: cuidParam.optional(),
    /** Список через запятую, например `PENDING` или `PENDING,REVIEWED`. */
    status: z
      .string()
      .optional()
      .transform((raw) => {
        if (raw == null || !String(raw).trim()) return undefined
        const uniq = [
          ...new Set(
            String(raw)
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          ),
        ]
        return uniq.length ? uniq : undefined
      })
      .pipe(z.union([z.undefined(), z.array(submissionStatusEnum).min(1).max(4)]).optional()),
    skip: z.coerce.number().int().min(0).default(0),
    take: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict()

export const adminSubmissionIdParams = z.object({ id: cuidParam }).strict()

export const adminPatchSubmissionBody = z
  .object({
    mentorScore: z.number().int().min(0).max(100).optional(),
    status: submissionStatusEnum.optional(),
    repoUrl: repoUrlSchema.optional(),
    demoUrl: z.union([repoUrlSchema, z.null()]).optional(),
    mentorComment: z
      .union([z.string().max(8000), z.literal(''), z.null()])
      .optional()
      .transform((v) => {
        if (v === undefined) return undefined
        if (v === null) return null
        const t = v.trim()
        return t === '' ? null : t
      }),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, { message: 'At least one field is required' })

export const adminUpsertAchievementBody = z
  .object({
    id: cuidParam.optional(),
    slug: z
      .string({ required_error: 'Укажите служебный ключ' })
      .min(1, 'Укажите служебный ключ')
      .max(128, 'Не длиннее 128 символов')
      .regex(/^[a-z0-9_-]+$/, 'Латиница, цифры, дефис и подчёркивание'),
    title: z
      .string({ required_error: 'Укажите заголовок' })
      .min(1, 'Укажите заголовок')
      .max(256, 'Не длиннее 256 символов'),
    subtitle: z
      .string({ required_error: 'Укажите описание' })
      .min(1, 'Укажите описание')
      .max(512, 'Не длиннее 512 символов'),
    icon: z
      .string({ required_error: 'Укажите значок' })
      .min(1, 'Укажите значок')
      .max(128, 'Не длиннее 128 символов'),
  })
  .strict()

export const adminAchievementIdParams = z.object({ id: cuidParam }).strict()

export const adminUserAchievementParams = z
  .object({
    userId: cuidParam,
    achievementId: cuidParam,
  })
  .strict()

export const adminSprintAchievementGrantParams = z
  .object({
    sprintId: cuidParam,
    achievementId: cuidParam,
  })
  .strict()

export const adminAuditLogsQuery = z
  .object({
    skip: z.coerce.number().int().min(0).default(0),
    take: z.coerce.number().int().min(1).max(100).default(25),
    userId: cuidParam.optional(),
  })
  .strict()

export const adminUserAchievementsCollectionParams = z.object({ userId: cuidParam }).strict()

export const adminUserSprintsCollectionParams = z.object({ userId: cuidParam }).strict()
