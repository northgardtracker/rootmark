// Composite-action step: post or update a sticky, top-level PR summary comment.
//
// This is intentionally a top-level conversation comment, NOT an inline review
// comment: current findings are file-level and do not carry line numbers, so
// there is no safe anchor for inline review threads.
//
// Only the pure rendering/escaping logic is shared (./lib.mjs, mirrored and
// parity-tested against ../src/action-comment.ts). Everything here is I/O:
// read the results, find an existing marker comment, and create or update it
// through the GitHub REST API using the global `fetch` (Node 18+). Built-in
// modules only; no external dependencies.
//
// Commenting is best-effort: any failure prints a warning annotation and exits
// 0 so the job's pass/fail decision is owned solely by the threshold step.
import { readFileSync } from 'node:fs';
import { PR_COMMENT_MARKER, renderComment } from './lib.mjs';

const PR_EVENTS = new Set(['pull_request', 'pull_request_target']);

function note(message) {
  console.log(message);
}

async function safeText(response) {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

async function findMarkerComment({ apiUrl, owner, repo, issueNumber, headers }) {
  const perPage = 100;
  const maxPages = 10; // bounded: up to 1000 comments scanned for the marker
  for (let page = 1; page <= maxPages; page += 1) {
    const url = `${apiUrl}/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=${perPage}&page=${page}`;
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`list comments failed: ${response.status} ${await safeText(response)}`);
    }
    const comments = await response.json();
    if (!Array.isArray(comments) || comments.length === 0) return undefined;
    const found = comments.find(
      (comment) => typeof comment?.body === 'string' && comment.body.includes(PR_COMMENT_MARKER),
    );
    if (found) return found;
    if (comments.length < perPage) return undefined;
  }
  return undefined;
}

async function main() {
  const eventName = process.env.GITHUB_EVENT_NAME ?? '';
  if (!PR_EVENTS.has(eventName)) {
    note(
      `::notice title=agents-md-xray::comment requested but the event is "${eventName || 'unknown'}", ` +
        'not a pull request. Skipping PR comment.',
    );
    return;
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    note('::warning title=agents-md-xray::comment requested but no github-token was provided. Skipping PR comment.');
    return;
  }

  const resultsPath = process.env.RESULTS_JSON;
  if (!resultsPath) {
    note('::warning title=agents-md-xray::missing results file path. Skipping PR comment.');
    return;
  }
  const result = JSON.parse(readFileSync(resultsPath, 'utf8'));

  const eventPath = process.env.GITHUB_EVENT_PATH;
  let issueNumber;
  if (eventPath) {
    const event = JSON.parse(readFileSync(eventPath, 'utf8'));
    issueNumber = event?.pull_request?.number ?? event?.number;
  }
  if (!issueNumber) {
    note('::warning title=agents-md-xray::could not determine the pull request number. Skipping PR comment.');
    return;
  }

  const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? '').split('/');
  if (!owner || !repo) {
    note('::warning title=agents-md-xray::GITHUB_REPOSITORY is not set. Skipping PR comment.');
    return;
  }

  const apiUrl = process.env.GITHUB_API_URL || 'https://api.github.com';
  const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com';
  const runId = process.env.GITHUB_RUN_ID;
  const detailsUrl = runId ? `${serverUrl}/${owner}/${repo}/actions/runs/${runId}` : undefined;

  const body = renderComment(result, { detailsUrl });
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'agents-md-xray-action',
    'Content-Type': 'application/json',
  };

  const existing = await findMarkerComment({ apiUrl, owner, repo, issueNumber, headers });

  if (existing) {
    const response = await fetch(`${apiUrl}/repos/${owner}/${repo}/issues/comments/${existing.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ body }),
    });
    if (!response.ok) {
      throw new Error(`update comment failed: ${response.status} ${await safeText(response)}`);
    }
    note(`agents-md-xray: updated existing PR comment (#${existing.id}).`);
  } else {
    const response = await fetch(`${apiUrl}/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ body }),
    });
    if (!response.ok) {
      throw new Error(`create comment failed: ${response.status} ${await safeText(response)}`);
    }
    note('agents-md-xray: created PR comment.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    // Best-effort: never fail the job solely because commenting failed.
    note(`::warning title=agents-md-xray::failed to post PR comment: ${error?.message ?? error}`);
    process.exit(0);
  });
