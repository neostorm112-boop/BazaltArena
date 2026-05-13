import type { Response } from 'express'

export function respondSuccess<T>(res: Response, data: T, status = 200) {
  return res.status(status).json(data)
}

export function respondCreated<T>(res: Response, data: T) {
  return respondSuccess(res, data, 201)
}

export function respondNoContent(res: Response) {
  return res.status(204).send()
}
