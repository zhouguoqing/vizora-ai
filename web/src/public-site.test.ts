import { describe, expect, it } from 'vitest';
import { usesSharedGreenTheme } from './public-site';

describe('shared green theme routes', () => {
  it('applies consistently to all regular pages while the independent V2 page keeps its own green theme', () => {
    for (const path of [
      '/', '/features', '/solutions', '/templates', '/resources', '/contact',
      '/pricing', '/terms', '/privacy', '/login', '/register', '/verify-email',
      '/resend-verification', '/forgot-password', '/reset-password', '/workspace',
      '/billing', '/missing',
    ]) {
      expect(usesSharedGreenTheme(path)).toBe(true);
    }
    expect(usesSharedGreenTheme('/home-v2')).toBe(false);
  });
});
