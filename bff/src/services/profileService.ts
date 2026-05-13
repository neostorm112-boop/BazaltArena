import { AppError } from '../errors/AppError.js'
import type { UserRepository } from '../repositories/userRepo.js'

export interface ProfileForm {
  username?: string
  telegram?: string
  about?: string
}

const avatar = (seed: string) =>
  `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(seed)}&scale=62&radius=12`

export function createProfileService(deps: { users: UserRepository }) {
  return {
    async patch(userId: string, form: ProfileForm) {
      const user = await deps.users.findById(userId)
      if (!user) throw AppError.notFound('User not found')

      const handle = (form.username ?? user.handle).trim().replace(/^@/, '')
      const telegram = (form.telegram ?? user.telegram).trim()
      const about = form.about ?? user.bio

      if (handle !== user.handle) {
        const exists = await deps.users.findByEmailOrHandle(handle)
        if (exists && exists.id !== user.id) throw AppError.conflict('Handle is already taken')
      }

      const updated = await deps.users.update(user.id, {
        handle,
        telegram,
        bio: about,
        avatarUrl: avatar(handle),
        githubUrl: `/${handle}`,
      })
      return updated
    },
  }
}
