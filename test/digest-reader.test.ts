import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/types.js';

describe('readNight', () => {
  it('reads runs/2026-10-28.jsonl into one row per job, counting but not throwing on the bad line', () => {
    const rows = readNight('runs', '2026-10-28');

    expect(rows.map((r) => r.job)).toEqual(['digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs']);

    const digest = rows.find((r) => r.job === 'digest/render');
    expect(digest?.owner).toBeNull();

    const fixtures = rows.find((r) => r.job === 'fixtures/refresh');
    expect(fixtures?.runs).toBe(4);
    expect(fixtures?.retries).toBe(3);
    expect(fixtures?.lastStatus).toBe('ok');

    const notes = rows.find((r) => r.job === 'notes/backup');
    expect(notes?.lastStatus).toBe('fail');
    expect(notes?.lastError).toBe('quota exceeded');
  });

  it('throws when the night has no file', () => {
    expect(() => readNight('runs', '2099-01-01')).toThrow();
  });
});
