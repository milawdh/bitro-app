import { describe, expect, it } from 'vitest';
import { canAdvanceLesson, lessonDefinitions, runLessonPreview } from './lesson-data';
describe('authored lesson safeguards', () => {
  it('requires a successful checkpoint before reaching completion', () => {
    expect(canAdvanceLesson(3, false)).toBe(false);
    expect(canAdvanceLesson(3, true)).toBe(true);
    expect(canAdvanceLesson(2, false)).toBe(true);
  });
  it('does not claim to compile modified code', () => {
    const lesson = lessonDefinitions.variables;
    expect(runLessonPreview(lesson.code, lesson)).toEqual({ supported: true, output: ['50'] });
    expect(runLessonPreview(lesson.code.replace('42', '100'), lesson).supported).toBe(false);
  });
  it('all sample lessons have meaningful assessment and correctly indexed answers', () => {
    expect(Object.keys(lessonDefinitions)).toHaveLength(8);
    for (const lesson of Object.values(lessonDefinitions)) {
      expect(lesson.choices[lesson.answer]).toBeTruthy();
      expect(lesson.objectives).toHaveLength(3);
      expect(lesson.code.length).toBeGreaterThan(30);
    }
  });
});
