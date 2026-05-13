import { describe, expect, it } from 'vitest'
import { sortOrderForSubmissions } from '../../src/repositories/sprintRepo.js'

describe('sortOrderForSubmissions', () => {
  it('puts mentorScore first for efficiency', () => {
    expect(sortOrderForSubmissions('efficiency')).toEqual([
      { mentorScore: 'desc' },
      { likesCount: 'desc' },
      { createdAt: 'asc' },
    ])
  })

  it('puts likesCount first for likes', () => {
    expect(sortOrderForSubmissions('likes')).toEqual([
      { likesCount: 'desc' },
      { mentorScore: 'desc' },
      { createdAt: 'asc' },
    ])
  })

  it('puts mentorScore first then createdAt for mentor', () => {
    expect(sortOrderForSubmissions('mentor')).toEqual([
      { mentorScore: 'desc' },
      { createdAt: 'asc' },
      { likesCount: 'desc' },
    ])
  })
})
