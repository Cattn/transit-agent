#!/usr/bin/env node
// Waits until something changes on GitHub (issues, PRs, comments, reviews), prints a JSON digest, and exits.
// Meant to run as a background command: when it exits, the agent that started it wakes up and handles the digest.
//
// Usage: node plans/tools/watch-github.mjs --state <file> [--repo Cattn/transit-agent] [--interval 60] [--max-minutes 100]
// Exit codes: 0 = new activity (digest on stdout), 2 = no activity before --max-minutes (just restart it), 1 = error.
// Requires an authenticated `gh` CLI. No npm dependencies.
//
// Comments containing the marker <!-- agent --> are ignored, so agents that post replies don't wake themselves.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]]);
  return acc;
}, []));
const repo = args.repo ?? 'Cattn/transit-agent';
const intervalMs = Number(args.interval ?? 60) * 1000;
const maxMs = Number(args['max-minutes'] ?? 100) * 60_000;
const statePath = args.state;
if (!statePath) { console.error('--state <file> is required'); process.exit(1); }

const MARKER = '<!-- agent -->';
const state = existsSync(statePath)
  ? JSON.parse(readFileSync(statePath, 'utf8'))
  : { since: new Date().toISOString(), seen: {} };

function gh(path) {
  const out = execFileSync('gh', ['api', '--paginate', '--slurp', path], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return JSON.parse(out).flat();
}

function snippet(body) {
  return (body ?? '').replace(/\s+/g, ' ').trim().slice(0, 400);
}

function poll() {
  const since = state.since;
  const now = new Date().toISOString();
  const events = [];

  for (const c of gh(`repos/${repo}/issues/comments?since=${since}&per_page=100`)) {
    const key = `ic-${c.id}-${c.updated_at}`;
    if (state.seen[key] || (c.body ?? '').includes(MARKER)) continue;
    state.seen[key] = true;
    events.push({ kind: c.created_at === c.updated_at ? 'comment' : 'comment_edited', number: Number(c.issue_url.split('/').pop()), author: c.user.login, url: c.html_url, at: c.updated_at, text: snippet(c.body) });
  }
  for (const c of gh(`repos/${repo}/pulls/comments?since=${since}&per_page=100`)) {
    const key = `rc-${c.id}-${c.updated_at}`;
    if (state.seen[key] || (c.body ?? '').includes(MARKER)) continue;
    state.seen[key] = true;
    events.push({ kind: 'pr_review_comment', number: Number(c.pull_request_url.split('/').pop()), author: c.user.login, url: c.html_url, at: c.updated_at, file: c.path, text: snippet(c.body) });
  }
  for (const i of gh(`repos/${repo}/issues?state=all&since=${since}&per_page=100`)) {
    const key = `iu-${i.number}-${i.updated_at}`;
    if (state.seen[key]) continue;
    state.seen[key] = true;
    events.push({ kind: i.pull_request ? 'pr_updated' : 'issue_updated', number: i.number, title: i.title, state: i.state, assignees: i.assignees.map((a) => a.login), labels: i.labels.map((l) => l.name), url: i.html_url, at: i.updated_at, created: i.created_at >= since });
  }
  // Reviews (approve / request changes) on open PRs.
  for (const pr of gh(`repos/${repo}/pulls?state=open&per_page=100`)) {
    for (const r of gh(`repos/${repo}/pulls/${pr.number}/reviews?per_page=100`)) {
      const key = `rv-${r.id}`;
      if (state.seen[key] || !r.submitted_at || r.submitted_at < since || (r.body ?? '').includes(MARKER)) continue;
      state.seen[key] = true;
      events.push({ kind: 'pr_review', number: pr.number, author: r.user.login, review: r.state, url: r.html_url, at: r.submitted_at, text: snippet(r.body) });
    }
  }

  // Overlap the next window by 2 minutes (GitHub timestamps are coarse); `seen` dedupes.
  state.since = new Date(Date.parse(now) - 120_000).toISOString();
  // Keep the seen map from growing forever.
  const keys = Object.keys(state.seen);
  if (keys.length > 5000) for (const k of keys.slice(0, keys.length - 2000)) delete state.seen[k];
  writeFileSync(statePath, JSON.stringify(state));
  // "issue_updated" fires for every comment too; drop it when a comment on the same issue already explains it.
  const commented = new Set(events.filter((e) => e.kind.startsWith('comment') || e.kind.startsWith('pr_review')).map((e) => e.number));
  return events.filter((e) => !((e.kind === 'issue_updated' || e.kind === 'pr_updated') && !e.created && commented.has(e.number)));
}

const started = Date.now();
for (;;) {
  try {
    const events = poll();
    if (events.length) {
      console.log(JSON.stringify({ repo, events }, null, 2));
      process.exit(0);
    }
  } catch (err) {
    console.error(`poll failed: ${err.message}`);
  }
  if (Date.now() - started > maxMs) { console.log(JSON.stringify({ repo, events: [], timeout: true })); process.exit(2); }
  await new Promise((r) => setTimeout(r, intervalMs));
}
