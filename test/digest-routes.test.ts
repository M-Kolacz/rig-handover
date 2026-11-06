import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const baseConfig = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('digest routes', () => {
  it('GET /digest/:night renders 200 for a real night', async () => {
    const res = await createApp(baseConfig).request('/digest/2026-10-28');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('fixtures/refresh');
  });

  it('GET /api/digest/:night returns the same jobs, same order, as the page', async () => {
    const [pageRes, jsonRes] = await Promise.all([
      createApp(baseConfig).request('/digest/2026-10-28'),
      createApp(baseConfig).request('/api/digest/2026-10-28'),
    ]);
    const page = await pageRes.text();
    const rows = (await jsonRes.json()) as { job: string }[];
    expect(jsonRes.status).toBe(200);

    const pageOrder = rows.map((r) => r.job).filter((job) => page.indexOf(job) >= 0);
    const sortedByPagePosition = [...pageOrder].sort((a, b) => page.indexOf(a) - page.indexOf(b));
    expect(pageOrder).toEqual(sortedByPagePosition);
    expect(rows.map((r) => r.job)).toEqual(['digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs']);
  });

  it('GET /digest/:night 404s for a night with no file', async () => {
    const res = await createApp(baseConfig).request('/digest/2099-01-01');
    expect(res.status).toBe(404);
  });

  it('GET /api/digest/:night 404s for a night with no file', async () => {
    const res = await createApp(baseConfig).request('/api/digest/2099-01-01');
    expect(res.status).toBe(404);
  });

  describe('with a temp runs dir', () => {
    let runsDir: string;

    beforeEach(() => {
      runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
    });

    afterEach(() => {
      rmSync(runsDir, { recursive: true, force: true });
    });

    it('renders "nothing ran" for an empty night', async () => {
      writeFileSync(join(runsDir, '2026-01-01.jsonl'), '');
      const config = { ...baseConfig, runsDir };
      const res = await createApp(config).request('/digest/2026-01-01');
      expect(res.status).toBe(200);
      expect(await res.text()).toContain('nothing ran');
    });

    it('renders a night with a bad line, counted but not thrown', async () => {
      writeFileSync(
        join(runsDir, '2026-01-02.jsonl'),
        ['{"at":"2026-01-02T00:00:00+01:00","job":"a","status":"ok","owner":null}', 'not json'].join('\n'),
      );
      const config = { ...baseConfig, runsDir };
      const res = await createApp(config).request('/digest/2026-01-02');
      expect(res.status).toBe(200);
      expect(await res.text()).toContain('>a<');
    });
  });
});
