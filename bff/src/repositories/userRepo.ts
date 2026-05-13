import type { Prisma, PrismaClient, User } from '@prisma/client'

export interface UserRepository {
  findById(id: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  findByEmailOrHandle(loginOrEmail: string): Promise<User | null>
  create(input: Prisma.UserCreateInput): Promise<User>
  update(id: string, data: Prisma.UserUpdateInput): Promise<User>
}

export function createUserRepository(prisma: PrismaClient): UserRepository {
  return {
    findById: (id) => prisma.user.findUnique({ where: { id } }),
    findByEmail: (email) =>
      prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } }),
    findByEmailOrHandle: (loginOrEmail) => {
      const value = loginOrEmail.trim().toLowerCase()
      const handle = value.replace(/^@/, '')
      return prisma.user.findFirst({
        where: { OR: [{ email: value }, { handle }] },
      })
    },
    create: (input) => prisma.user.create({ data: input }),
    update: (id, data) => prisma.user.update({ where: { id }, data }),
  }
}
