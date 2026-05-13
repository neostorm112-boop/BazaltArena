import argon2 from 'argon2'
import { AppError } from '../errors/AppError.js'
import type { MemberAudit } from '../infra/memberAudit.js'
import type { UserRepository } from '../repositories/userRepo.js'
import { issueTokens, verifyRefreshToken, type TokenPair } from './tokenService.js'
import { isSessionActive, registerSession, revokeSession } from './sessionStore.js'
import type { User } from '@prisma/client'

export interface PublicUser {
  id: string
  handle: string
  role: string
  avatarUrl: string
}

export interface AuthResult extends TokenPair {
  user: PublicUser
}

export interface AuthService {
  login(input: { loginOrEmail: string; password: string }): Promise<AuthResult>
  register(input: {
    email: string
    handle: string
    password: string
    devKey: string | undefined
  }): Promise<AuthResult>
  refresh(input: { refreshToken: string }): Promise<AuthResult>
  logout(jti: string): Promise<void>
}

export interface AuthServiceDeps {
  users: UserRepository
  devRegisterKey?: string
  hashPassword?: (raw: string) => Promise<string>
  verifyPassword?: (hash: string, raw: string) => Promise<boolean>
  avatar?: (seed: string) => string
  onMemberRegistered?: (userId: string) => Promise<void>
  memberAudit?: MemberAudit
}

function publicUser(user: User): PublicUser {
  return {
    id: user.id,
    handle: user.handle,
    role: user.role,
    avatarUrl: user.avatarUrl,
  }
}

const defaultAvatar = (seed: string) =>
  `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(seed)}&scale=62&radius=12`

export function createAuthService(deps: AuthServiceDeps): AuthService {
  const hashPassword = deps.hashPassword ?? ((raw) => argon2.hash(raw, { type: argon2.argon2id }))
  const verifyPassword = deps.verifyPassword ?? ((hash, raw) => argon2.verify(hash, raw))
  const avatar = deps.avatar ?? defaultAvatar

  return {
    async login({ loginOrEmail, password }) {
      const user = await deps.users.findByEmailOrHandle(loginOrEmail)
      if (!user) throw AppError.invalidCredentials()
      const ok = await verifyPassword(user.passwordHash, password)
      if (!ok) throw AppError.invalidCredentials()
      const tokens = issueTokens(user)
      await registerSession(tokens.jti)
      await deps.memberAudit?.log(user.id, 'AUTH_LOGIN', {})
      return { ...tokens, user: publicUser(user) }
    },

    async register({ email, handle, password, devKey }) {
      if (deps.devRegisterKey && devKey !== deps.devRegisterKey) {
        throw AppError.forbidden('Registration is restricted')
      }
      const normalizedEmail = email.trim().toLowerCase()
      const normalizedHandle = handle.trim().replace(/^@/, '')
      const [byEmail, byHandle] = await Promise.all([
        deps.users.findByEmail(normalizedEmail),
        deps.users.findByEmailOrHandle(normalizedHandle),
      ])
      if (byEmail) throw AppError.conflict('Email is already taken')
      if (byHandle) throw AppError.conflict('Handle is already taken')
      const passwordHash = await hashPassword(password)
      const created = await deps.users.create({
        email: normalizedEmail,
        handle: normalizedHandle,
        passwordHash,
        role: 'USER',
        avatarUrl: avatar(normalizedHandle),
        telegram: `@${normalizedHandle}`,
        githubUrl: `/${normalizedHandle}`,
      })
      if (deps.onMemberRegistered) await deps.onMemberRegistered(created.id)
      const tokens = issueTokens(created)
      await registerSession(tokens.jti)
      await deps.memberAudit?.log(created.id, 'AUTH_REGISTER', {})
      return { ...tokens, user: publicUser(created) }
    },

    async refresh({ refreshToken }) {
      const claims = verifyRefreshToken(refreshToken)
      if (!(await isSessionActive(claims.jti))) {
        throw AppError.unauthorized('Refresh token revoked')
      }
      const user = await deps.users.findById(claims.sub)
      if (!user) {
        await revokeSession(claims.jti)
        throw AppError.unauthorized('User no longer exists')
      }
      await revokeSession(claims.jti)
      const tokens = issueTokens(user)
      await registerSession(tokens.jti)
      await deps.memberAudit?.log(user.id, 'AUTH_REFRESH', {})
      return { ...tokens, user: publicUser(user) }
    },

    async logout(jti) {
      await revokeSession(jti)
    },
  }
}
