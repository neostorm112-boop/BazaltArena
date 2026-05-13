/** @typedef {Record<string, unknown> | null | undefined} AuditDetails */

import { ROLE_LABEL, submissionStatusLabel } from './copy.js'

/** Короткий тип события (колонка «тип»). */
export const ACTION_LABELS = {
  USER_PATCH: 'Профиль и аккаунт пользователя',
  SPRINT_CREATE: 'Создание спринта',
  SPRINT_PATCH: 'Редактирование спринта',
  SPRINT_ACTIVATE: 'Активация спринта',
  SPRINT_DUPLICATE: 'Дублирование спринта',
  SPRINT_ACCESS_UPSERT: 'Доступ к спринту',
  SPRINT_ACCESS_DELETE: 'Сброс доступа к спринту',
  SPRINT_ACCESS_BATCH: 'Массовое изменение доступа',
  SUBMISSION_SUBMIT: 'Отправка решения',
  SUBMISSION_CREATE: 'Новая отправка решения',
  SUBMISSION_UPDATE: 'Обновление отправки решения',
  SUBMISSION_PATCH: 'Проверка отправки',
  SUBMISSION_BATCH_ACCEPT: 'Публикация в зал славы',
  ACHIEVEMENT_UPSERT: 'Справочник ачивок',
  ACHIEVEMENT_DELETE: 'Удаление ачивки',
  ACHIEVEMENT_GRANT: 'Выдача ачивки',
  ACHIEVEMENT_REVOKE: 'Отзыв ачивки',
  ACHIEVEMENT_GRANT_SPRINT: 'Ачивка по спринту',
  SOLUTION_LIKE: 'Лайк решения',
  SOLUTION_UNLIKE: 'Снятие лайка',
  AUTH_LOGIN: 'Вход в аккаунт',
  AUTH_REGISTER: 'Регистрация',
  AUTH_REFRESH: 'Обновление сессии',
  AUTH_LOGOUT: 'Выход',
  PROFILE_PATCH: 'Правки профиля',
  NOTIFICATIONS_MARK_ALL_READ: 'Уведомления прочитаны',
}

const PROFILE_FIELD_LABELS = {
  bio: 'О себе',
  telegram: 'Телеграм',
  github: 'GitHub',
  realName: 'Имя',
  stack: 'Стек',
  moneyEarned: 'Заработано (₽)',
}

const ACCOUNT_FIELD_LABELS = {
  role: 'Роль',
  email: 'Почта',
  points: 'Баллы',
  handle: 'Ник',
}

const SPRINT_PATCH_LABELS = {
  title: 'название',
  slug: 'короткий адрес в ссылке',
  tabLabel: 'подпись вкладки',
  tabIcon: 'иконка вкладки',
  completedLabel: 'подпись после сдачи',
  tags: 'теги',
  active: 'активный спринт',
  startsAt: 'дата начала',
  endsAt: 'дата окончания',
  brief: 'материалы спринта',
  metrics: 'метрики',
  published: 'публикация на сайте',
  archived: 'архив',
}

function formatId(id) {
  if (id == null || typeof id !== 'string') return '—'
  return id.length > 14 ? `${id.slice(0, 10)}…` : id
}

function formatScalar(v) {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? 'да' : 'нет'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'string') return v.length > 120 ? `${v.slice(0, 120)}…` : v
  if (Array.isArray(v)) return v.join(', ') || '—'
  return 'изменены вложенные данные'
}

function formatChangeEntry(label, from, to, key) {
  if (key === 'role') {
    return `${label}: ${ROLE_LABEL[from] ?? from} → ${ROLE_LABEL[to] ?? to}`
  }
  if (key === 'stack' && (Array.isArray(from) || Array.isArray(to))) {
    return `${label}: обновлён список тегов`
  }
  return `${label}: ${formatScalar(from)} → ${formatScalar(to)}`
}

function collectUserPatchLines(details) {
  /** @type {string[]} */
  const lines = []
  const ac = details?.accountChanges
  const pc = details?.profileChanges
  if (ac && typeof ac === 'object') {
    for (const [key, val] of Object.entries(ac)) {
      if (val && typeof val === 'object' && 'from' in val && 'to' in val) {
        const label = ACCOUNT_FIELD_LABELS[key] ?? key
        lines.push(formatChangeEntry(label, val.from, val.to, key))
      }
    }
  }
  if (pc && typeof pc === 'object') {
    for (const [key, val] of Object.entries(pc)) {
      if (val && typeof val === 'object' && 'from' in val && 'to' in val) {
        const label = PROFILE_FIELD_LABELS[key] ?? key
        lines.push(formatChangeEntry(label, val.from, val.to, key))
      }
    }
  }
  return lines
}

function describeSprintPatch(patch) {
  if (!patch || typeof patch !== 'object') return 'Спринт обновлён.'
  const keys = Object.keys(patch).filter((k) => patch[k] !== undefined)
  if (keys.length === 0) return 'Без существенных правок.'
  const parts = keys.map((k) => SPRINT_PATCH_LABELS[k] ?? 'другие настройки')
  return `Обновлено: ${parts.join(', ')}.`
}

function describeSubmissionPatch(patch) {
  if (!patch || typeof patch !== 'object') return 'Данные работы обновлены.'
  const bits = []
  if ('mentorScore' in patch && patch.mentorScore !== undefined) {
    bits.push(`баллы ментора: ${patch.mentorScore}`)
  }
  if ('status' in patch && patch.status != null) {
    bits.push(`статус: ${submissionStatusLabel(patch.status)}`)
  }
  if ('repoUrl' in patch && patch.repoUrl !== undefined) {
    bits.push('обновлена ссылка на репозиторий')
  }
  if ('demoUrl' in patch && patch.demoUrl !== undefined) {
    bits.push(patch.demoUrl ? 'обновлена ссылка на демо' : 'ссылка на демо удалена')
  }
  if ('mentorComment' in patch && patch.mentorComment !== undefined) {
    bits.push(
      patch.mentorComment == null || String(patch.mentorComment).trim() === ''
        ? 'комментарий ментора сброшен'
        : 'обновлён комментарий ментора'
    )
  }
  return bits.length ? bits.join('; ') + '.' : 'Данные работы обновлены.'
}

/**
 * Человекочитаемое описание события аудита (без сырых структур из лога).
 * @param {string} action
 * @param {AuditDetails} details
 */
export function auditLogDescription(action, details) {
  const d = details && typeof details === 'object' ? details : {}

  switch (action) {
    case 'USER_PATCH': {
      const lines = collectUserPatchLines(d)
      const target = d.targetUserId
      const head = target
        ? `Правки по пользователю ${formatId(String(target))}.`
        : 'Изменение пользователя.'
      if (lines.length === 0) return `${head} Подробный список полей в записи не сохранён.`
      return `${head}\n${lines.map((x) => `· ${x}`).join('\n')}`
    }
    case 'SPRINT_CREATE': {
      const title = typeof d.title === 'string' ? d.title : 'без названия'
      const slug = typeof d.slug === 'string' ? d.slug : ''
      const active = d.active === true ? ' Сразу назначен текущим боем на арене.' : ''
      const base = slug
        ? `Создан спринт «${title}», короткий адрес: ${slug}.`
        : `Создан спринт «${title}».`
      return `${base}${active}`.trim()
    }
    case 'SPRINT_PATCH': {
      const sid = formatId(d.sprintId)
      return `Спринт ${sid}. ${describeSprintPatch(d.patch)}`
    }
    case 'SPRINT_ACTIVATE': {
      return `На арене закреплён спринт ${formatId(d.sprintId)}; с остальных снята метка «активный».`
    }
    case 'SPRINT_DUPLICATE': {
      const slug = typeof d.slug === 'string' ? d.slug : '—'
      return `Создана копия спринта ${formatId(d.sourceSprintId)} → новый ${formatId(d.sprintId)} (адрес: ${slug}).`
    }
    case 'SPRINT_ACCESS_UPSERT': {
      const submit = d.canSubmit === true ? 'может сдавать работу' : 'не может сдавать работу'
      const view = d.canView === true ? 'видит спринт и зал' : 'не видит спринт и зал'
      return `Участник ${formatId(d.userId)}, спринт ${formatId(d.sprintId)}: ${submit}; ${view}.`
    }
    case 'SPRINT_ACCESS_DELETE': {
      return `Сброшены отдельные права: участник ${formatId(d.userId)}, спринт ${formatId(d.sprintId)}.`
    }
    case 'SPRINT_ACCESS_BATCH': {
      const n = typeof d.userCount === 'number' ? d.userCount : 0
      const submit = d.canSubmit === true ? 'включена отправка' : 'отключена отправка'
      const view = d.canView === true ? 'включён просмотр зала' : 'отключён просмотр зала'
      return `Спринт ${formatId(d.sprintId)}: для ${n} чел. ${submit}, ${view}.`
    }
    case 'SUBMISSION_SUBMIT':
    case 'SUBMISSION_CREATE':
    case 'SUBMISSION_UPDATE': {
      const demo = d.demoUrl ? ` Демо: ${formatScalar(d.demoUrl)}` : ''
      const head =
        action === 'SUBMISSION_CREATE'
          ? 'Новая работа'
          : action === 'SUBMISSION_UPDATE'
            ? 'Обновлена работа'
            : 'Отправка работы'
      return `${head}: спринт ${formatId(d.sprintId)}, запись ${formatId(d.submissionId)}. Репозиторий: ${formatScalar(d.repoUrl)}.${demo}`
    }
    case 'SUBMISSION_PATCH': {
      const tail = describeSubmissionPatch(d.patch)
      return `Работа ${formatId(d.submissionId)}, спринт ${formatId(d.sprintId)}, участник ${formatId(d.userId)}. ${tail}`
    }
    case 'SOLUTION_LIKE': {
      return `Лайк решения ${formatId(d.submissionId)} (спринт ${formatId(d.sprintId)}).`
    }
    case 'SOLUTION_UNLIKE': {
      return `Снят лайк с решения ${formatId(d.submissionId)} (спринт ${formatId(d.sprintId)}).`
    }
    case 'AUTH_LOGIN': {
      return 'Вход по паролю.'
    }
    case 'AUTH_REGISTER': {
      return 'Создана учётная запись участника.'
    }
    case 'AUTH_REFRESH': {
      return 'Выпущена новая пара токенов (refresh).'
    }
    case 'AUTH_LOGOUT': {
      return 'Сессия завершена (logout).'
    }
    case 'PROFILE_PATCH': {
      const fields = Array.isArray(d.fields) ? d.fields.join(', ') : ''
      return fields ? `Изменены поля профиля: ${fields}.` : 'Обновлён профиль.'
    }
    case 'NOTIFICATIONS_MARK_ALL_READ': {
      const n = typeof d.unreadRemaining === 'number' ? d.unreadRemaining : '—'
      return `Все уведомления отмечены прочитанными. Непрочитанных осталось: ${n}.`
    }
    case 'SUBMISSION_BATCH_ACCEPT': {
      const upd = typeof d.updated === 'number' ? d.updated : 0
      const sprintIds = Array.isArray(d.sprintIds) ? d.sprintIds : []
      return `${upd} работ принято в зал славы (статус и баллы обновлены). Затронуто спринтов: ${sprintIds.length}.`
    }
    case 'ACHIEVEMENT_GRANT_SPRINT': {
      const g = typeof d.granted === 'number' ? d.granted : 0
      return `Ачивка ${formatId(d.achievementId)} выдана по спринту ${formatId(d.sprintId)}: затронуто записей — ${g}.`
    }
    case 'ACHIEVEMENT_UPSERT': {
      const t = typeof d.title === 'string' ? d.title : 'ачивка'
      const s = typeof d.slug === 'string' ? d.slug : ''
      return `В справочнике сохранена награда «${t}»${s ? `, короткое имя: ${s}` : ''}. Запись ${formatId(d.achievementId)}.`
    }
    case 'ACHIEVEMENT_DELETE': {
      return `Награда удалена из справочника (${formatId(d.achievementId)}). У участников она тоже снимется.`
    }
    case 'ACHIEVEMENT_GRANT': {
      return `Участнику ${formatId(d.userId)} выдана награда из справочника (${formatId(d.achievementId)}).`
    }
    case 'ACHIEVEMENT_REVOKE': {
      return `У участника ${formatId(d.userId)} снята награда (${formatId(d.achievementId)}).`
    }
    default:
      return `Событие зарегистрировано, тип «${action}»; текстовое описание для него пока не задано.`
  }
}

export function auditLogTitle(action) {
  return ACTION_LABELS[action] ?? 'Прочее'
}
