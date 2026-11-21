import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const digest = value => createHash('sha256').update(value).digest('hex');
const hashPattern = /^[a-f0-9]{64}$/;
const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/;
const slicePattern = /^slices\/(\d{4})\/(\d{2})\/(\d{4}-\d{2}-\d{2})\/[a-z0-9-]+\.md$/;
const postures = ['OBSERVATION', 'QUESTION', 'SPECULATION', 'CANDIDATE',
  'TESTED', 'REFUTED', 'SUPERSEDED'];

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length
    && keys.every(key => Object.hasOwn(value, key));
}

function text(value, limit) {
  return typeof value === 'string' && value.length > 0 && value.length <= limit
    && value.trim() === value && !/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(value);
}

function time(value) {
  if (typeof value !== 'string') return NaN;
  const millis = Date.parse(value);
  return Number.isFinite(millis) && new Date(millis).toISOString() === value ? millis : NaN;
}

export function preview(candidateBytes, review, { enabled = false, now = Date.now() } = {}) {
  requireValue(enabled === true, 'Daily Slice preview is disabled');
  requireValue(Buffer.isBuffer(candidateBytes) && candidateBytes.length <= 8192, 'Invalid candidate bytes');
  const candidateSha256 = digest(candidateBytes);
  requireValue(exactKeys(review, ['schema', 'candidateSha256', 'decision', 'scope',
    'reviewerRef', 'optInRef', 'rightsRef', 'reviewedAt', 'expiresAt'])
    && review.schema === 'humkin.editorial-review/v1'
    && review.candidateSha256 === candidateSha256
    && review.decision === 'APPROVED' && review.scope === 'PRIVATE_TEXT_PREVIEW'
    && [review.reviewerRef, review.optInRef, review.rightsRef].every(ref =>
      typeof ref === 'string' && idPattern.test(ref))
    && time(review.reviewedAt) <= now && now < time(review.expiresAt),
  'Current operator review for these exact bytes is required');

  const candidate = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(candidateBytes));
  requireValue(exactKeys(candidate, ['schema', 'kind', 'source', 'posture', 'credit', 'title', 'script'])
    && candidate.schema === 'static-collective.crossover-record/v1'
    && candidate.kind === 'story'
    && postures.includes(candidate.posture)
    && text(candidate.credit, 120) && text(candidate.title, 160) && text(candidate.script, 1200),
  'Invalid Daily Slice story');
  const source = candidate.source;
  const match = typeof source?.path === 'string' && source.path.match(slicePattern);
  requireValue(exactKeys(source, ['repository', 'revision', 'path', 'sha256'])
    && source.repository === 'the-static-collective/the-daily-slice'
    && typeof source.revision === 'string' && /^[a-f0-9]{40}$/.test(source.revision)
    && typeof source.sha256 === 'string' && hashPattern.test(source.sha256)
    && match && match[3].startsWith(match[1] + '-' + match[2] + '-')
    && !source.path.endsWith('/index.md'), 'Invalid source pointer');

  const sourceUrl = 'https://github.com/' + source.repository + '/blob/' + source.revision + '/' + source.path;
  const rundown = [
    'PRIVATE EDITORIAL PREVIEW | HOLD | DAILY SLICE ON HUMKIN',
    'Posture: ' + candidate.posture,
    'Credit: ' + candidate.credit,
    'Source: ' + sourceUrl,
    'Title: ' + candidate.title,
    '',
    'Host copy',
    'The Daily Slice on HUMKIN. ' + candidate.posture + '. ' + candidate.script,
    '',
  ].join('\n');
  return {
    rundown,
    receipt: {
      schema: 'humkin.crossover-receipt/v1',
      producer: 'the-static-collective/HUMKIN',
      destination: source.repository,
      disposition: 'PRIVATE_TEXT_PREVIEW',
      source,
      candidateSha256,
      rundownSha256: digest(rundown),
      broadcastAuthorized: false,
    },
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    const enabled = process.env.HUMKIN_DAILY_SLICE_PREVIEW === '1';
    requireValue(enabled, 'Daily Slice preview is disabled');
    const [candidatePath, reviewPath] = process.argv.slice(2);
    requireValue(process.argv.length === 4, 'Usage: daily-slice.mjs CANDIDATE.json REVIEW.json');
    const result = preview(readFileSync(candidatePath), JSON.parse(readFileSync(reviewPath)), { enabled });
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } catch (error) {
    // JSON parser and filesystem errors can include private payload fragments or paths.
    console.error(error.code || error instanceof SyntaxError || error instanceof TypeError
      ? 'Could not read crossover inputs' : error.message);
    process.exitCode = 1;
  }
}
