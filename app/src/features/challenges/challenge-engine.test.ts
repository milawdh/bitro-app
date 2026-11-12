import { describe, expect, it } from 'vitest';
import { challenges, validateChallenge } from './challenge-engine';

describe('structured challenge assessment', () => {
  it('requires all answers and does not accept omitted responses', () => {
    const result = validateChallenge(challenges[0], {});
    expect(result.passed).toBe(false);
    expect(result.unanswered).toHaveLength(challenges[0].questions.length);
    expect(result.correct).toBe(0);
  });
  it('rejects choices outside the supported scenario', () => {
    const challenge = challenges[0];
    const answers = Object.fromEntries(challenge.questions.map((q) => [q.id, 'arbitrary-code']));
    expect(validateChallenge(challenge, answers).unanswered).toHaveLength(challenge.questions.length);
    expect(validateChallenge(challenge, answers).passed).toBe(false);
  });
  it.each(challenges)('passes each complete correct scenario: $slug', (challenge) => {
    const answers = Object.fromEntries(challenge.questions.map((q) => [q.id, q.correctOption]));
    expect(validateChallenge(challenge, answers)).toMatchObject({passed:true, correct:challenge.questions.length, unanswered:[]});
  });
  it('does not pass a partially correct attempt', () => {
    const challenge = challenges[1];
    const answers = Object.fromEntries(challenge.questions.map((q) => [q.id, q.correctOption]));
    answers[challenge.questions[0].id] = challenge.questions[0].options.find((o) => o.id !== challenge.questions[0].correctOption)!.id;
    const result = validateChallenge(challenge, answers);
    expect(result.passed).toBe(false);
    expect(result.correct).toBe(challenge.questions.length - 1);
    expect(result.unanswered).toHaveLength(0);
  });
});
