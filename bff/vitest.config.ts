import { defineConfig } from 'vitest/config'

const projectArg = process.argv.find((arg) => arg.startsWith('--project='))
const project = projectArg?.split('=')[1] ?? process.env.VITEST_PROJECT ?? 'unit'

const integration = project === 'integration'

export default defineConfig({
  test: {
    environment: 'node',
    include: integration ? ['test/integration/**/*.test.ts'] : ['test/unit/**/*.test.ts'],
    testTimeout: integration ? 120_000 : 5_000,
    hookTimeout: integration ? 120_000 : 10_000,
    setupFiles: integration ? ['test/integration/setup-rate-limit-off.ts'] : [],
  },
})
