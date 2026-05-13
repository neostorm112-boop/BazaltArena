/** Runs before integration test modules load (see vitest.config.ts). */
if (process.env.INTEGRATION === '1') {
  process.env.RATE_LIMIT_DISABLED = 'true'
}
