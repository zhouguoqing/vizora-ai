import { describe, expect, it } from 'vitest';
import { screenDesignTarget, screenExamples } from './home-v2';

describe('homepage V2 examples', () => {
  it('offers three distinct data-screen concepts with bounded project prompts', () => {
    expect(screenExamples).toHaveLength(3);
    expect(new Set(screenExamples.map(example => example.id)).size).toBe(3);
    for (const example of screenExamples) {
      expect(example.prompt).toContain('大屏');
      expect(example.prompt.length).toBeLessThanOrEqual(5000);
      expect(example.metrics).toHaveLength(3);
      expect(example.trend).toHaveLength(7);
      expect(example.trend.every(value => value >= 0 && value <= 100)).toBe(true);
      expect(example.regions.every(region => region.value >= 0 && region.value <= 100)).toBe(true);
    }
  });
  it('routes anonymous visitors through registration with a workspace return path', () => {
    expect(screenDesignTarget(false)).toEqual({ path: '/register', query: { redirect: '/workspace' } });
  });
  it('routes authenticated visitors to the existing workspace without claiming generation', () => {
    expect(screenDesignTarget(true)).toEqual({ path: '/workspace' });
  });
});
