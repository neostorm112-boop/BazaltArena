import { z } from 'zod'

/** Prisma @default(cuid()) ids */
export const cuidParam = z.string().cuid()

/** Prisma `SubmissionStatus` — для админ-фильтров и PATCH. */
export const submissionStatusEnum = z.enum(['PENDING', 'REVIEWED', 'ACCEPTED', 'REJECTED'])

const urlOrEmpty = z.union([z.string().url(), z.literal('')])

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
    repoUrl: z.string().url().max(2048),
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
  })
  .strict()

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
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, { message: 'At least one field is required' })

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
    mentorScore: z.coerce.number().int().min(0).max(100).optional(),
    status: submissionStatusEnum.optional(),
    repoUrl: z.string().url().max(2048).optional(),
    demoUrl: z.union([z.string().url().max(2048), z.null()]).optional(),
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
