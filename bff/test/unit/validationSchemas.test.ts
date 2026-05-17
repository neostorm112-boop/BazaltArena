/**
 * Unit tests for the hardened input schemas added on this branch:
 *   - submissionUpsertBody / adminPatchSubmissionBody.repoUrl — strict URL guard
 *     against XSS + SSRF (no javascript:, no ftp:, no localhost, no RFC1918).
 *   - adminCreateSprintBody / adminPatchSprintBody — refuse past-dated sprints
 *     unless `allowPast: true` is set explicitly.
 *   - adminPatchSubmissionBody.mentorScore — clamp 0..100, no silent coercion.
 *
 * These tests touch only the Zod schemas; nothing about Prisma or HTTP.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  adminCreateSprintBody,
  adminPatchSprintBody,
  adminPatchSubmissionBody,
  repoUrlSchema,
  submissionUpsertBody,
} from '../../src/validation/schemas.js'

describe('repoUrlSchema', () => {
  const originalFlag = process.env.ALLOW_PRIVATE_REPO_URLS

  beforeEach(() => {
    // SSRF guard is always-on for these tests so we exercise the production behavior.
    delete process.env.ALLOW_PRIVATE_REPO_URLS
  })

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.ALLOW_PRIVATE_REPO_URLS
    else process.env.ALLOW_PRIVATE_REPO_URLS = originalFlag
  })

  it('accepts a normal GitHub URL', () => {
    expect(repoUrlSchema.safeParse('https://github.com/user/repo').success).toBe(true)
  })

  it('accepts a plain http URL', () => {
    expect(repoUrlSchema.safeParse('http://example.com/foo').success).toBe(true)
  })

  it('rejects javascript: scheme (XSS vector)', () => {
    const r = repoUrlSchema.safeParse('javascript:alert(1)')
    expect(r.success).toBe(false)
  })

  it('rejects ftp: scheme', () => {
    expect(repoUrlSchema.safeParse('ftp://example.com/foo').success).toBe(false)
  })

  it('rejects data: scheme', () => {
    expect(repoUrlSchema.safeParse('data:text/html,<script>alert(1)</script>').success).toBe(false)
  })

  it('rejects localhost (SSRF guard)', () => {
    expect(repoUrlSchema.safeParse('http://localhost:1').success).toBe(false)
    expect(repoUrlSchema.safeParse('http://localhost/repo').success).toBe(false)
  })

  it('rejects loopback IPv4 (SSRF guard)', () => {
    expect(repoUrlSchema.safeParse('http://127.0.0.1/').success).toBe(false)
    expect(repoUrlSchema.safeParse('http://127.0.0.5/').success).toBe(false)
  })

  it('rejects 0.0.0.0 (SSRF guard)', () => {
    expect(repoUrlSchema.safeParse('http://0.0.0.0/').success).toBe(false)
  })

  it('rejects RFC1918 ranges (SSRF guard)', () => {
    expect(repoUrlSchema.safeParse('http://10.0.0.1/').success).toBe(false)
    expect(repoUrlSchema.safeParse('http://192.168.1.1/').success).toBe(false)
    expect(repoUrlSchema.safeParse('http://172.16.5.5/').success).toBe(false)
    expect(repoUrlSchema.safeParse('http://172.31.255.255/').success).toBe(false)
  })

  it('rejects AWS metadata link-local address', () => {
    expect(repoUrlSchema.safeParse('http://169.254.169.254/latest/meta-data/').success).toBe(false)
  })

  it('does not reject public 172.x outside RFC1918 range', () => {
    expect(repoUrlSchema.safeParse('http://172.32.0.1/').success).toBe(true)
    expect(repoUrlSchema.safeParse('http://172.15.0.1/').success).toBe(true)
  })

  it('rejects oversize URL (>500 chars)', () => {
    const long = 'https://example.com/' + 'a'.repeat(600)
    const r = repoUrlSchema.safeParse(long)
    expect(r.success).toBe(false)
  })

  it('rejects non-URL string', () => {
    expect(repoUrlSchema.safeParse('not a url').success).toBe(false)
  })

  it('honors ALLOW_PRIVATE_REPO_URLS=true override (dev workflow)', () => {
    process.env.ALLOW_PRIVATE_REPO_URLS = 'true'
    expect(repoUrlSchema.safeParse('http://localhost:3000/repo').success).toBe(true)
  })
})

describe('submissionUpsertBody', () => {
  it('passes a clean payload', () => {
    const r = submissionUpsertBody.safeParse({ repoUrl: 'https://github.com/u/r' })
    expect(r.success).toBe(true)
  })

  it('rejects unknown keys (strict)', () => {
    const r = submissionUpsertBody.safeParse({
      repoUrl: 'https://github.com/u/r',
      junk: 'x',
    })
    expect(r.success).toBe(false)
  })

  it('rejects javascript: in repoUrl', () => {
    const r = submissionUpsertBody.safeParse({ repoUrl: 'javascript:alert(1)' })
    expect(r.success).toBe(false)
  })
})

describe('adminPatchSubmissionBody.mentorScore', () => {
  it('accepts 0', () => {
    const r = adminPatchSubmissionBody.safeParse({ mentorScore: 0 })
    expect(r.success).toBe(true)
  })

  it('accepts 100', () => {
    const r = adminPatchSubmissionBody.safeParse({ mentorScore: 100 })
    expect(r.success).toBe(true)
  })

  it('rejects 200', () => {
    const r = adminPatchSubmissionBody.safeParse({ mentorScore: 200 })
    expect(r.success).toBe(false)
  })

  it('rejects -1', () => {
    const r = adminPatchSubmissionBody.safeParse({ mentorScore: -1 })
    expect(r.success).toBe(false)
  })

  it('rejects float (must be int)', () => {
    const r = adminPatchSubmissionBody.safeParse({ mentorScore: 12.5 })
    expect(r.success).toBe(false)
  })

  it('rejects string (no silent coerce)', () => {
    const r = adminPatchSubmissionBody.safeParse({ mentorScore: '50' })
    expect(r.success).toBe(false)
  })
})

describe('adminCreateSprintBody date guard', () => {
  const base = {
    slug: 'test-sprint',
    title: 'Test',
    tabLabel: 'T',
    completedLabel: 'Done',
  }

  it('rejects a fully-past window', () => {
    const r = adminCreateSprintBody.safeParse({
      ...base,
      startsAt: '2000-01-01T00:00:00.000Z',
      endsAt: '2000-02-01T00:00:00.000Z',
    })
    expect(r.success).toBe(false)
  })

  it('rejects a past-only startsAt (no endsAt)', () => {
    const r = adminCreateSprintBody.safeParse({
      ...base,
      startsAt: '2000-01-01T00:00:00.000Z',
    })
    expect(r.success).toBe(false)
  })

  it('accepts past startsAt when endsAt is in the future (currently running)', () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const r = adminCreateSprintBody.safeParse({
      ...base,
      startsAt: '2000-01-01T00:00:00.000Z',
      endsAt: future,
    })
    expect(r.success).toBe(true)
  })

  it('accepts a fully-future window', () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const r = adminCreateSprintBody.safeParse({
      ...base,
      startsAt: future,
      endsAt: future,
    })
    expect(r.success).toBe(true)
  })

  it('accepts a past window when allowPast=true', () => {
    const r = adminCreateSprintBody.safeParse({
      ...base,
      startsAt: '2000-01-01T00:00:00.000Z',
      endsAt: '2000-02-01T00:00:00.000Z',
      allowPast: true,
    })
    expect(r.success).toBe(true)
  })

  it('accepts when dates are omitted entirely', () => {
    const r = adminCreateSprintBody.safeParse(base)
    expect(r.success).toBe(true)
  })
})

describe('adminPatchSprintBody date guard', () => {
  it('passes when patching unrelated field on an already-past sprint', () => {
    // We never asked to change startsAt/endsAt → no date validation should fire.
    const r = adminPatchSprintBody.safeParse({ title: 'New Title' })
    expect(r.success).toBe(true)
  })

  it('rejects when explicitly patching endsAt to the past', () => {
    const r = adminPatchSprintBody.safeParse({
      endsAt: '2000-01-01T00:00:00.000Z',
    })
    expect(r.success).toBe(false)
  })

  it('accepts past patch when allowPast=true', () => {
    const r = adminPatchSprintBody.safeParse({
      endsAt: '2000-01-01T00:00:00.000Z',
      allowPast: true,
    })
    expect(r.success).toBe(true)
  })

  it('still requires at least one non-allowPast field', () => {
    const r = adminPatchSprintBody.safeParse({ allowPast: true })
    expect(r.success).toBe(false)
  })
})
