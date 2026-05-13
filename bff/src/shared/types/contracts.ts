export type DataEntity = 'sprint' | 'submission' | 'user'

export interface DataUpdatedPayload {
  source?: string
  entity?: DataEntity
  at: string
}

export interface ApiEnvelopeError {
  code: string
  message: string
  requestId: string
  details?: unknown
}
