/** Русские подписи статуса отправки (как в админке), без изменения payload. */

export const SUBMISSION_STATUS_LABEL = {
  PENDING: 'Ожидает проверки',
  REVIEWED: 'Проверено',
  ACCEPTED: 'В зале славы',
  REJECTED: 'Отклонено',
}

export function submissionStatusLabel(code) {
  return SUBMISSION_STATUS_LABEL[code] ?? String(code ?? '—')
}
