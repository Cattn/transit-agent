#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({ options: {
  state: { type: 'string' }, repo: { type: 'string', default: 'Cattn/transit-agent' },
  reviewer: { type: 'string', default: 'Cattn' }, since: { type: 'string' },
  interval: { type: 'string', default: '60' }, 'max-minutes': { type: 'string', default: '100' },
  ack: { type: 'string' },
} });
const { repo, reviewer, state: statePath } = args;
const intervalMs = Number(args.interval) * 1000;
const maxMs = Number(args['max-minutes']) * 60_000;
const overlapMs = 120_000;
const signature = '— 🤖 babysitter bot';

function github(path) {
  try {
    const output = execFileSync('gh', ['api', '--paginate', '--jq', '.[] | @json', path], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
    });
    return output.trim() ? output.trim().split('\n').map((line) => JSON.parse(line)) : [];
  } catch (error) {
    throw new Error(`GitHub API ${path}: ${error.stderr?.trim() || error.message}`);
  }
}

function save(state) {
  const temporary = `${statePath}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(state), { mode: 0o600 });
  renameSync(temporary, statePath);
}

function floorSecond(time) {
  return Math.floor(time / 1000) * 1000;
}

function digest(events) {
  console.log(JSON.stringify({ repo, reviewer, events }, null, 2));
}

function poll(state) {
  const now = floorSecond(Date.now());
  const cutoff = Math.max(state.start, state.cursor - overlapMs);
  const since = encodeURIComponent(new Date(cutoff - 1000).toISOString());
  const root = `repos/${repo}`;
  const updated = github(`${root}/issues?state=all&since=${since}&per_page=100`);
  const open = github(`${root}/pulls?state=open&per_page=100`);
  const heads = Object.fromEntries(open.map((pr) => [pr.number, pr.head.sha]));
  const events = [];
  const seen = Object.fromEntries(Object.entries(state.seen).filter(([, at]) => at >= cutoff));

  function emit(id, at, event) {
    const time = Date.parse(at);
    if (!Number.isFinite(time) || time < cutoff || Object.hasOwn(seen, id)) return;
    seen[id] = time;
    events.push({ id, at, ...event });
  }

  for (const comment of github(`${root}/issues/comments?since=${since}&per_page=100`)) {
    const body = comment.body?.trim() ?? '';
    if (body.endsWith(signature) || body.includes('<!-- agent -->')) continue;
    emit(`comment:${comment.id}:${comment.updated_at}`, comment.updated_at, {
      kind: 'comment', number: Number(comment.issue_url.split('/').at(-1)),
      subject: new URL(comment.html_url).pathname.includes('/pull/') ? 'pr' : 'issue',
      edited: comment.created_at !== comment.updated_at, author: comment.user?.login, url: comment.html_url,
    });
  }

  for (const comment of github(`${root}/pulls/comments?since=${since}&per_page=100`)) {
    emit(`inline:${comment.id}:${comment.updated_at}`, comment.updated_at, {
      kind: 'pr_review_comment', number: Number(comment.pull_request_url.split('/').at(-1)),
      author: comment.user?.login, url: comment.html_url,
    });
  }

  for (const item of updated) {
    emit(`item:${item.number}:${item.updated_at}`, item.updated_at, {
      kind: item.pull_request ? 'pr_updated' : 'issue_updated', number: item.number,
      url: item.html_url, state: item.state, created: Date.parse(item.created_at) >= cutoff,
      ...(item.pull_request && { mergedAt: item.pull_request.merged_at ?? null }),
    });
  }

  for (const pr of open) {
    const previous = state.heads[pr.number];
    if (previous && previous !== pr.head.sha) {
      events.push({ id: `head:${pr.number}:${now}`, at: new Date(now).toISOString(),
        kind: 'pr_head_changed', number: pr.number, url: pr.html_url, head: pr.head.sha });
    }
  }

  const candidates = new Map([...updated, ...open].map((item) => [item.number, item]));
  for (const [number, item] of candidates) {
    for (const entry of github(`${root}/issues/${number}/timeline?per_page=100`)) {
      if (!entry.id || ['commented', 'committed'].includes(entry.event)) continue;
      const target = entry.requested_reviewer?.login;
      const personal = target?.toLowerCase() === reviewer.toLowerCase();
      const kind = entry.event === 'review_requested' && personal ? 'pr_review_requested'
        : entry.event === 'review_request_removed' && personal ? 'pr_review_request_removed'
        : 'timeline';
      emit(`timeline:${number}:${entry.event}:${entry.id}`, entry.created_at ?? entry.submitted_at, {
        kind, number, action: entry.event, subject: item.pull_request || item.head ? 'pr' : 'issue',
        url: entry.html_url ?? item.html_url, author: entry.actor?.login ?? entry.user?.login,
        ...(target && { reviewer: target }),
      });
    }
  }

  events.sort((first, second) => first.at.localeCompare(second.at));
  return { ...state, cursor: Math.max(state.cursor, now), seen, heads, pending: events };
}

async function main() {
  if (!statePath) throw new Error('--state <file> is required');
  if (!Number.isFinite(intervalMs) || intervalMs <= 0 || !Number.isFinite(maxMs) || maxMs < 0) {
    throw new Error('--interval must be positive and --max-minutes must be nonnegative');
  }
  const exists = existsSync(statePath);
  const start = floorSecond(args.since ? Date.parse(args.since) : Date.now());
  if (!Number.isFinite(start) || start > Date.now()) throw new Error('--since must be a past ISO timestamp');
  if (exists && args.since) throw new Error('--since is only used when creating state');
  let state = exists ? JSON.parse(readFileSync(statePath, 'utf8'))
    : { version: 1, repo, reviewer, start, cursor: start, seen: {}, heads: {}, pending: [] };
  if (state.version !== 1 || state.repo !== repo || state.reviewer.toLowerCase() !== reviewer.toLowerCase()) {
    throw new Error('Use a new state file for this watcher version, repository, and reviewer');
  }
  if (args.ack) {
    if (!exists || !state.pending.some(({ id }) => id === args.ack)) throw new Error('Unknown pending event ID');
    save({ ...state, pending: state.pending.filter(({ id }) => id !== args.ack) });
    return;
  }

  if (!exists) save(state);
  const deadline = Date.now() + maxMs;
  while (!state.pending.length) {
    state = poll(state);
    save(state);
    if (state.pending.length) break;
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      process.exitCode = 2;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(intervalMs, remaining)));
  }
  digest(state.pending);
}

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
