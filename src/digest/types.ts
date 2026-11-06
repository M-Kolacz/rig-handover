import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type RunStatus = 'ok' | 'retry' | 'fail';

export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

function parseLine(line: string): RunLine | null {
  try {
    const parsed = JSON.parse(line) as RunLine;
    if (typeof parsed.at !== 'string' || typeof parsed.job !== 'string' || typeof parsed.status !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// Throws ENOENT when `runs/<night>.jsonl` is missing, so callers (the route) can turn that
// into a 404. An empty file, or one with only bad lines, returns [].
export function readNight(runsDir: string, night: string): DigestRow[] {
  const raw = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  const rows = new Map<string, DigestRow>();

  for (const line of raw.split('\n')) {
    if (line.trim() === '') continue;
    const parsed = parseLine(line);
    if (!parsed) continue;

    const existing = rows.get(parsed.job);
    if (!existing) {
      rows.set(parsed.job, {
        job: parsed.job,
        owner: parsed.owner,
        runs: 1,
        retries: parsed.status === 'retry' ? 1 : 0,
        lastStatus: parsed.status,
        lastError: parsed.error ?? null,
        firstAt: parsed.at,
        lastAt: parsed.at,
      });
      continue;
    }

    existing.runs += 1;
    if (parsed.status === 'retry') existing.retries += 1;
    existing.owner = parsed.owner;
    existing.lastStatus = parsed.status;
    existing.lastError = parsed.error ?? null;
    existing.lastAt = parsed.at;
  }

  return [...rows.values()].sort((a, b) => a.job.localeCompare(b.job));
}
