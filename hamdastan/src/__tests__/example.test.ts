import { describe, it, expect } from 'vitest';

describe('Example test', () => {
  it('should pass a basic assertion', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle string operations', () => {
    const greeting = 'سلام دنیا';
    expect(greeting).toContain('سلام');
  });
});
