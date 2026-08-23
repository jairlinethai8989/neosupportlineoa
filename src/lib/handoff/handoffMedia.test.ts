import { describe, expect, it } from 'vitest';
import { createHandoffMediaPath, isOwnedHandoffMediaPath } from './handoffMedia';

describe('handoff media paths', () => {
  it('keeps uploads inside the redeemed handoff prefix', () => {
    expect(createHandoffMediaPath('handoff-123', 'png', 'fixed-id')).toBe(
      'handoff/handoff-123/fixed-id.png'
    );
  });

  it('rejects traversal and paths owned by another handoff', () => {
    expect(isOwnedHandoffMediaPath('handoff-123', 'handoff/handoff-123/file.png')).toBe(true);
    expect(isOwnedHandoffMediaPath('handoff-123', 'handoff/other/file.png')).toBe(false);
    expect(isOwnedHandoffMediaPath('handoff-123', 'handoff/handoff-123/../secret.png')).toBe(false);
  });
});
