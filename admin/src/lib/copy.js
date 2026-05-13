/** Русские подписи для кодов статуса и ролей на экране (состав запросов к серверу не меняется). */

export const ROLE_LABEL = {
  USER: 'Пользователь',
  ADMIN: 'Администратор',
  /** Устаревшие значения в старых записях аудита */
  MEMBER: 'Участник',
  MENTOR: 'Ментор',
}

export const SUBMISSION_STATUS_LABEL = {
  PENDING: 'Ожидает проверки',
  REVIEWED: 'Проверено',
  ACCEPTED: 'В зале славы',
  REJECTED: 'Отклонено',
}

export function roleLabel(code) {
  return ROLE_LABEL[code] ?? String(code ?? '—')
}

export function submissionStatusLabel(code) {
  return SUBMISSION_STATUS_LABEL[code] ?? String(code ?? '—')
}

export function yesNoRu(v) {
  return v ? 'да' : 'нет'
}
