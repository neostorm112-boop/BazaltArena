import { PrismaClient } from '@prisma/client'
import { env } from '../config/env.js'
import { logger } from './logger.js'

export const prisma = new PrismaClient({
  datasources: { db: { url: env.DATABASE_URL } },
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
})

export async function disconnectPrisma() {
  try {
    await prisma.$disconnect()
  } catch (error) {
    logger.error({ err: error }, 'Failed to disconnect Prisma')
  }
}
