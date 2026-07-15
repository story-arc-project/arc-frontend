#!/usr/bin/env node
/* eslint-disable no-console -- CI/Actions 로그 출력이 이 ops 스크립트의 인터페이스다 */
// release-gate: dev.story-arc.org QA 사인오프(Slack ✅ 반응) + CI 통과를 게이트로
// dev → main(프로덕션) 승격을 자동화한다.
//
// 흐름(매 실행마다 stateless하게 재평가):
//   1. dev가 main보다 앞서 있나? 아니면 종료.
//   2. 열린 dev→main PR이 있나?
//        없으면 → PR 생성(= CI 트리거) + Slack 승인 메시지 게시 + PR 본문에 상태 각인.
//        있으면 → PR 본문에서 상태 복원. 단, dev head가 승인 요청 이후 바뀌었거나(=재QA 필요)
//                 상태 마커가 없으면(=이전 게시 실패 복구) 승인 요청을 다시 게시하고 종료.
//   3. Slack 메시지의 ✅ 반응을 읽어 명단 중 승인자 수를 센다.
//   4. PR의 CI 체크가 전부 초록인지 확인.
//   5. 판정:
//        (과반  OR  48h 경과 & 지정 승인자 전원 ✅)  AND  CI 초록 → 자동 머지 + "배포 완료" 스레드.
//        24h 경과 & 미충족 & 리마인드 전 → 리마인드 스레드(미반응자 멘션) 1회.
//        그 외 → 대기.
//
// 상태 저장은 GitHub Actions가 stateless라, "열린 dev→main PR" 자체를 단일 상태원으로 쓴다(PR 본문 마커):
//   <!-- slack-ts: … -->    승인 요청 Slack 메시지 ts(반응을 읽는 대상)
//   <!-- dev-sha: … -->     승인 요청이 대상으로 삼은 dev head SHA(이후 바뀌면 재QA 필요)
//   <!-- posted-at: … -->   승인 요청 게시 시각(백스톱 24h/48h 기준)
//   <!-- reminded-24h -->   24h 리마인드 발송 여부

import { execFileSync } from 'node:child_process';

// ── 설정 ──────────────────────────────────────────────────────────────────
// 팀 식별정보(채널 id·명단 실명·override 대상)는 공개 리포에 넣지 않는다.
// RELEASE_GATE_CONFIG 시크릿(JSON)으로 주입한다. 형태:
//   {
//     "channel": "C…",                      // #release-approvals 채널 id
//     "quorum": 3,                          // 과반 승인 수(기본 3)
//     "overrideIds": ["U…", "U…"],          // 48h 백스톱: 전원 ✅면 통과(비면 백스톱 비활성)
//     "roster": { "U…": "이름", ... },       // Slack id → 표시 이름
//     "stagingUrl": "https://…"             // QA 대상 staging(선택)
//   }
const CONFIG = JSON.parse(process.env.RELEASE_GATE_CONFIG || '{}');
const CHANNEL = CONFIG.channel;
const ROSTER = CONFIG.roster || {};
const ROSTER_IDS = Object.keys(ROSTER);
const ROSTER_N = ROSTER_IDS.length;
const OVERRIDE_IDS = CONFIG.overrideIds || [];
const OVERRIDE_NAMES = OVERRIDE_IDS.map((id) => ROSTER[id] || id).join('·'); // Slack 메시지 표시용(로그엔 쓰지 않음)
const QUORUM = CONFIG.quorum ?? (Math.floor(ROSTER_N / 2) + 1); // 기본값 = 명단 과반(미지정 시 roster 크기에서 계산)
const REQUIRED_CHECKS = CONFIG.requiredChecks || ['ci', 'e2e', 'storybook-test']; // green 판정에 반드시 존재+통과해야 하는 체크
const STAGING_URL = CONFIG.stagingUrl || 'https://dev.story-arc.org';
const EMOJI = 'white_check_mark'; // ✅
const REMIND_AFTER_H = 24;
const OVERRIDE_AFTER_H = 48;

const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN;
const REPO = process.env.GH_REPO || 'story-arc-project/arc-frontend';
const DRY_RUN = process.env.DRY_RUN === '1'; // 판정만 하고 게시/머지는 하지 않음

if (!SLACK_TOKEN) fail('SLACK_BOT_TOKEN(=ARC_SLACK_BOT_TOKEN) 시크릿이 없습니다.');
if (!CHANNEL || !ROSTER_N) fail('RELEASE_GATE_CONFIG(channel·roster) 시크릿이 없습니다.');

// ── 유틸 ──────────────────────────────────────────────────────────────────
function log(...a) { console.log(...a); }
function fail(msg) { console.error('❌', msg); process.exit(1); }

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}
function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', env: process.env }).trim();
}

async function slack(method, params, post = false) {
  const url = `https://slack.com/api/${method}`;
  const opts = {
    method: post ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${SLACK_TOKEN}` },
  };
  let target = url;
  if (post) {
    opts.headers['Content-Type'] = 'application/json; charset=utf-8';
    opts.body = JSON.stringify(params);
  } else {
    target += '?' + new URLSearchParams(params).toString();
  }
  const res = await fetch(target, opts);
  const data = await res.json();
  if (!data.ok) throw new Error(`slack ${method} 실패: ${data.error}`);
  return data;
}

// 승인 요청 Slack 메시지를 (재)게시하고 PR 본문에 상태 마커를 기록한다.
// oldTs가 있으면 이전 메시지를 "만료됨"으로 갱신해 스테일 승인을 막는다.
// 최초 생성 · 마커 부재 복구 · dev head 변경 재QA — 세 경로가 공유한다.
async function postAndRecord(number, devSha, oldTs) {
  const compare = `https://github.com/${REPO}/compare/main...dev`;
  const merges = git(['log', 'origin/main..origin/dev', '--merges', '--pretty=%s'])
    .split('\n').filter(Boolean);
  const items = merges.slice(0, 10).map((s) => {
    const m = s.match(/#(\d+) from [^/]+\/(.+)$/);
    return m ? `• #${m[1]} — ${m[2]}` : `• ${s}`;
  }).join('\n');
  const more = merges.length > 10 ? `\n…외 ${merges.length - 10}건` : '';

  if (oldTs) {
    try {
      await slack('chat.update', {
        channel: CHANNEL, ts: oldTs,
        text: ':warning: 새 커밋이 추가되어 이 배포 승인 요청은 만료됐어요. 아래 새 메시지에서 다시 승인해주세요.',
      }, true);
    } catch (e) { log(`이전 메시지 만료 처리 실패(무시): ${e.message}`); }
  }

  const text =
    `:rocket: *dev → main 배포 검토* — ${merges.length}개 기능\n\n` +
    `dev를 프로덕션(main)으로 올릴 준비가 됐어요.\n` +
    `:point_right: <${STAGING_URL}|dev.story-arc.org> 에서 확인한 뒤, *이 메시지에 :white_check_mark: 를 눌러주세요.*\n\n` +
    `*이번 배치*\n${items}${more}\n\n` +
    `*승인 규칙* — ${ROSTER_N}명 중 ${QUORUM}명 :white_check_mark:` +
    (OVERRIDE_IDS.length ? ` (또는 48시간 경과 시 ${OVERRIDE_NAMES} 승인)` : '') +
    ` + CI 통과 → 자동 배포\n` +
    `<${compare}|전체 변경 보기>  ·  <https://github.com/${REPO}/pull/${number}|PR #${number}>`;

  const posted = await slack('chat.postMessage', { channel: CHANNEL, text, unfurl_links: false }, true);
  const postedAt = new Date().toISOString();
  gh(['pr', 'edit', number, '--repo', REPO, '--body',
    `<!-- release-gate -->\n<!-- slack-ts: ${posted.ts} -->\n<!-- dev-sha: ${devSha} -->\n<!-- posted-at: ${postedAt} -->\n\n` +
    `자동 생성된 릴리스 PR입니다. 승인은 <#${CHANNEL}> 에서 진행됩니다.\n\n[전체 변경](${compare})`]);
  log(`Slack 승인 요청 게시(ts=${posted.ts}, dev=${devSha.slice(0, 7)}). 다음 실행에서 반응·CI 평가.`);
  return posted.ts;
}

// ── 1. dev가 main보다 앞섰나 ───────────────────────────────────────────────
const ahead = Number(git(['rev-list', '--count', 'origin/main..origin/dev']));
if (!ahead) { log('✅ dev가 main보다 앞선 커밋 없음 — 배포할 것 없음. 종료.'); process.exit(0); }
const currentDevSha = git(['rev-parse', 'origin/dev']);
log(`dev가 main보다 ${ahead}커밋 앞섬 (dev=${currentDevSha.slice(0, 7)}).`);

// ── 2. 열린 dev→main PR 찾기 ───────────────────────────────────────────────
const prs = JSON.parse(
  gh(['pr', 'list', '--repo', REPO, '--base', 'main', '--head', 'dev',
    '--state', 'open', '--json', 'number,body,createdAt'])
);

if (prs.length === 0) {
  if (DRY_RUN) { log('[DRY_RUN] PR 생성/게시 생략'); process.exit(0); }
  log('열린 dev→main PR 없음 → 생성 + Slack 게시.');
  gh(['pr', 'create', '--repo', REPO, '--base', 'main', '--head', 'dev',
    '--title', '🚀 릴리스: dev → main', '--body', '<!-- release-gate -->\n승인 대기 중…']);
  const number = gh(['pr', 'list', '--repo', REPO, '--base', 'main', '--head', 'dev',
    '--state', 'open', '--json', 'number', '-q', '.[0].number']);
  await postAndRecord(number, currentDevSha);
  process.exit(0);
}

// ── PR 존재: 상태 복원 ─────────────────────────────────────────────────────
const pr = prs[0];
const number = String(pr.number);
const body = pr.body || '';
const ts = body.match(/<!--\s*slack-ts:\s*([\d.]+)\s*-->/)?.[1];
const devShaMarker = body.match(/<!--\s*dev-sha:\s*([0-9a-f]+)\s*-->/)?.[1];
const postedAtMarker = body.match(/<!--\s*posted-at:\s*(\S+)\s*-->/)?.[1];
const remindedBefore = /<!--\s*reminded-24h\s*-->/.test(body);

// 마커 부재(이전 게시 실패 복구) 또는 dev head 변경(승인 후 새 커밋 → 재QA 필요) 시 승인 요청 재게시.
if (!ts || !devShaMarker || devShaMarker !== currentDevSha) {
  const why = !ts ? '상태 마커 없음(게시 복구)' : `dev head 변경(${(devShaMarker || '?').slice(0, 7)}→${currentDevSha.slice(0, 7)}, 재QA 필요)`;
  if (DRY_RUN) { log(`[DRY_RUN] 승인 요청 재게시 필요: ${why}`); process.exit(0); }
  log(`승인 요청 재게시: ${why}`);
  await postAndRecord(number, currentDevSha, ts);
  process.exit(0);
}

const postedAt = postedAtMarker ? new Date(postedAtMarker) : new Date(pr.createdAt); // 구버전 PR 폴백
const ageH = (Date.now() - postedAt.getTime()) / 3_600_000;
log(`PR #${number}, slack ts=${ts}, 경과 ${ageH.toFixed(1)}h, 24h리마인드=${remindedBefore}`);

// ── 3. ✅ 반응 카운트 ──────────────────────────────────────────────────────
const reac = await slack('reactions.get', { channel: CHANNEL, timestamp: ts, full: 'true' });
const reactions = reac.message?.reactions || [];
const checkUsers = new Set((reactions.find((r) => r.name === EMOJI)?.users) || []);
const approvers = ROSTER_IDS.filter((id) => checkUsers.has(id));
const pending = ROSTER_IDS.filter((id) => !checkUsers.has(id));
// 공개 Actions 로그에 실명을 남기지 않는다 — 카운트와 Slack id만.
log(`승인 ${approvers.length}/${ROSTER_N} (ids: ${approvers.join(', ') || '없음'})`);

// ── 4. CI 상태 ─────────────────────────────────────────────────────────────
function ciStatus() {
  let out = '';
  try {
    out = gh(['pr', 'checks', number, '--repo', REPO, '--json', 'bucket,name,state']);
  } catch (e) {
    // gh pr checks는 실패=1·대기=8로 non-zero exit이라 throw된다. JSON은 stdout에 실려 오므로 그대로 파싱.
    out = (e.stdout ? e.stdout.toString() : '').trim();
    if (!out) return 'pending'; // 체크가 아직 안 붙음
  }
  let checks;
  try { checks = JSON.parse(out); } catch { return 'pending'; }
  // 필수 워크플로(ci·e2e·storybook)만으로 판정한다 — 아무 체크나 통과했다고 green으로 보지 않는다.
  const required = checks.filter((c) => REQUIRED_CHECKS.includes(c.name));
  if (required.some((c) => c.bucket === 'fail' || c.bucket === 'cancel')) return 'fail';
  const present = new Set(required.map((c) => c.name));
  if (REQUIRED_CHECKS.some((n) => !present.has(n))) return 'pending'; // 필수 체크가 아직 안 붙음
  if (required.some((c) => c.bucket === 'pending')) return 'pending';
  return 'green'; // 필수 체크 전부 pass/skipping
}

// ── 5. 판정 ────────────────────────────────────────────────────────────────
const quorumMet = approvers.length >= QUORUM;
// override는 대상이 지정돼 있을 때만(빈 배열이면 [].every()=true로 0명 승인 통과하는 함정 차단).
const overrideMet = OVERRIDE_IDS.length > 0
  && ageH >= OVERRIDE_AFTER_H
  && OVERRIDE_IDS.every((id) => checkUsers.has(id));
const approved = quorumMet || overrideMet;

if (approved) {
  const reason = quorumMet ? `과반 ${approvers.length}/${ROSTER_N}` : `48h override(지정 ${OVERRIDE_IDS.length}인)`;
  const ci = ciStatus();
  if (ci === 'fail') { log(`승인됨(${reason})이나 CI 실패 — 배포 보류. PR 체크 확인 필요.`); process.exit(0); }
  if (ci !== 'green') { log(`승인됨(${reason})이나 CI=${ci} — 대기.`); process.exit(0); }
  if (DRY_RUN) { log(`[DRY_RUN] 머지 조건 충족(${reason}, CI green) — 실제 머지 생략.`); process.exit(0); }
  // 승인·CI 확인 이후 머지 직전 사이 dev에 새 커밋이 붙는 경쟁을 차단 —
  // PR head가 승인된 SHA와 다르면 머지 실패, 다음 실행이 dev-sha 변경으로 재QA를 건다.
  try {
    gh(['pr', 'merge', number, '--repo', REPO, '--merge', '--match-head-commit', currentDevSha]);
  } catch (e) {
    const out = (e.stdout ? e.stdout.toString() : '') + (e.stderr ? e.stderr.toString() : '');
    log(`머지 보류 — head가 승인 SHA(${currentDevSha.slice(0, 7)})와 불일치(새 커밋 유입 추정). 다음 실행에서 재평가. ${out.trim()}`);
    process.exit(0);
  }
  await slack('chat.postMessage', {
    channel: CHANNEL, thread_ts: ts,
    text: `:tada: *배포 완료* — dev → main 머지됨 (${reason}, CI 통과). 프로덕션 반영이 진행됩니다.`,
  }, true);
  log(`머지 완료(${reason}).`);
  process.exit(0);
}

// 미충족: 24h 리마인드
if (ageH >= REMIND_AFTER_H && !remindedBefore) {
  if (DRY_RUN) { log('[DRY_RUN] 24h 리마인드 대상이나 게시 생략.'); process.exit(0); }
  const mentions = pending.map((id) => `<@${id}>`).join(' ');
  await slack('chat.postMessage', {
    channel: CHANNEL, thread_ts: ts,
    text: `:hourglass_flowing_sand: 배포 검토가 24시간째 대기 중이에요. ${mentions} — <${STAGING_URL}|dev.story-arc.org> 확인 후 :white_check_mark: 부탁드려요. (현재 ${approvers.length}/${QUORUM})`,
  }, true);
  gh(['pr', 'edit', number, '--repo', REPO, '--body', `${body}\n<!-- reminded-24h -->`]);
  log('24h 리마인드 게시.');
  process.exit(0);
}

log(`대기 중: 승인 ${approvers.length}/${QUORUM}, 경과 ${ageH.toFixed(1)}h.`);
