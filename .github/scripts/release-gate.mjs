#!/usr/bin/env node
/* eslint-disable no-console -- CI/Actions 로그 출력이 이 ops 스크립트의 인터페이스다 */
// release-gate: dev.story-arc.org QA 사인오프(Slack ✅ 반응) + CI 통과를 게이트로
// dev → main(프로덕션) 승격을 자동화한다.
//
// 흐름(매 실행마다 stateless하게 재평가):
//   1. dev가 main보다 앞서 있나? 아니면 종료.
//   2. 열린 dev→main PR이 있나?
//        없으면 → PR 생성(= CI 트리거) + Slack 승인 메시지 게시 + PR 본문에 slack ts 각인 → 종료.
//        있으면 → PR 본문에서 slack ts 복원, PR 생성시각으로 경과시간 계산.
//   3. Slack 메시지의 ✅ 반응을 읽어 명단 중 승인자 수를 센다.
//   4. PR의 CI 체크가 전부 초록인지 확인.
//   5. 판정:
//        (과반  OR  48h 경과 & 지정 승인자 2인 둘 다 ✅)  AND  CI 초록 → 자동 머지 + "배포 완료" 스레드.
//        24h 경과 & 미충족 & 리마인드 전 → 리마인드 스레드(미반응자 멘션) 1회.
//        그 외 → 대기.
//
// 상태 저장은 GitHub Actions가 stateless라, "열린 dev→main PR" 자체를 단일 상태원으로 쓴다.
//   - slack 메시지 ts: PR 본문의 <!-- slack-ts: ... --> 마커
//   - 24h 리마인드 발송 여부: PR 본문의 <!-- reminded-24h --> 마커
//   - 백스톱 경과시간: PR createdAt

import { execFileSync } from 'node:child_process';

// ── 설정 ──────────────────────────────────────────────────────────────────
// 팀 식별정보(채널 id·명단 실명·override 대상)는 공개 리포에 넣지 않는다.
// RELEASE_GATE_CONFIG 시크릿(JSON)으로 주입한다. 형태:
//   {
//     "channel": "C…",                      // #release-approvals 채널 id
//     "quorum": 3,                          // 과반 승인 수(기본 3)
//     "overrideIds": ["U…", "U…"],          // 48h 백스톱: 둘 다 ✅면 통과
//     "roster": { "U…": "이름", ... },       // Slack id → 표시 이름
//     "stagingUrl": "https://…"             // QA 대상 staging(선택)
//   }
const CONFIG = JSON.parse(process.env.RELEASE_GATE_CONFIG || '{}');
const CHANNEL = CONFIG.channel;
const ROSTER = CONFIG.roster || {};
const OVERRIDE_IDS = CONFIG.overrideIds || [];
const OVERRIDE_NAMES = OVERRIDE_IDS.map((id) => ROSTER[id] || id).join('·'); // 표시용(config에서 파생)
const QUORUM = CONFIG.quorum ?? 3; // 명단 과반
const STAGING_URL = CONFIG.stagingUrl || 'https://dev.story-arc.org';
const EMOJI = 'white_check_mark'; // ✅
const REMIND_AFTER_H = 24;
const OVERRIDE_AFTER_H = 48;

const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN;
const REPO = process.env.GH_REPO || 'story-arc-project/arc-frontend';
const DRY_RUN = process.env.DRY_RUN === '1'; // 판정만 하고 게시/머지는 하지 않음

if (!SLACK_TOKEN) fail('SLACK_BOT_TOKEN(=ARC_SLACK_BOT_TOKEN) 시크릿이 없습니다.');
if (!CHANNEL || !Object.keys(ROSTER).length) fail('RELEASE_GATE_CONFIG(channel·roster) 시크릿이 없습니다.');

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

// ── 1. dev가 main보다 앞섰나 ───────────────────────────────────────────────
const ahead = Number(git(['rev-list', '--count', 'origin/main..origin/dev']));
if (!ahead) { log('✅ dev가 main보다 앞선 커밋 없음 — 배포할 것 없음. 종료.'); process.exit(0); }
log(`dev가 main보다 ${ahead}커밋 앞섬.`);

// ── 2. 열린 dev→main PR 찾기 ───────────────────────────────────────────────
const prs = JSON.parse(
  gh(['pr', 'list', '--repo', REPO, '--base', 'main', '--head', 'dev',
    '--state', 'open', '--json', 'number,body,createdAt'])
);

if (prs.length === 0) {
  // ── PR 생성 + Slack 메시지 게시 ──
  log('열린 dev→main PR 없음 → 생성 + Slack 게시.');
  const compare = `https://github.com/${REPO}/compare/main...dev`;
  const merges = git(['log', 'origin/main..origin/dev', '--merges', '--pretty=%s'])
    .split('\n').filter(Boolean);
  const items = merges.slice(0, 10).map((s) => {
    const m = s.match(/#(\d+) from [^/]+\/(.+)$/);
    return m ? `• #${m[1]} — ${m[2]}` : `• ${s}`;
  }).join('\n');
  const more = merges.length > 10 ? `\n…외 ${merges.length - 10}건` : '';

  const title = `🚀 릴리스: dev → main (${merges.length}개 기능)`;
  if (DRY_RUN) { log('[DRY_RUN] PR 생성/게시 생략'); process.exit(0); }

  gh(['pr', 'create', '--repo', REPO, '--base', 'main', '--head', 'dev',
    '--title', title, '--body', '<!-- release-gate -->\n자동 생성된 릴리스 PR입니다. 승인은 #release-approvals 에서 진행됩니다.']);
  const number = gh(['pr', 'list', '--repo', REPO, '--base', 'main', '--head', 'dev',
    '--state', 'open', '--json', 'number', '-q', '.[0].number']);

  const text =
    `:rocket: *dev → main 배포 검토* — ${merges.length}개 기능\n\n` +
    `dev를 프로덕션(main)으로 올릴 준비가 됐어요.\n` +
    `:point_right: <${STAGING_URL}|dev.story-arc.org> 에서 확인한 뒤, *이 메시지에 :white_check_mark: 를 눌러주세요.*\n\n` +
    `*이번 배치*\n${items}${more}\n\n` +
    `*승인 규칙* — ${Object.keys(ROSTER).length}명 중 ${QUORUM}명 :white_check_mark: (또는 48시간 경과 시 ${OVERRIDE_NAMES} 승인) + CI 통과 → 자동 배포\n` +
    `<${compare}|전체 변경 보기>  ·  <https://github.com/${REPO}/pull/${number}|PR #${number}>`;

  const posted = await slack('chat.postMessage', { channel: CHANNEL, text, unfurl_links: false }, true);
  gh(['pr', 'edit', number, '--repo', REPO, '--body',
    `<!-- release-gate -->\n<!-- slack-ts: ${posted.ts} -->\n\n자동 생성된 릴리스 PR입니다. 승인은 <#${CHANNEL}> 에서 진행됩니다.\n\n[전체 변경](${compare})`]);
  log(`PR #${number} 생성 + Slack 게시(ts=${posted.ts}). 다음 실행에서 반응·CI 평가.`);
  process.exit(0);
}

// ── PR 존재: 상태 복원 ─────────────────────────────────────────────────────
const pr = prs[0];
const number = String(pr.number);
const body = pr.body || '';
const tsMatch = body.match(/<!--\s*slack-ts:\s*([\d.]+)\s*-->/);
if (!tsMatch) fail(`PR #${number} 본문에 slack-ts 마커가 없습니다. 수동 확인 필요.`);
const ts = tsMatch[1];
const remindedBefore = /<!--\s*reminded-24h\s*-->/.test(body);
const ageH = (Date.now() - new Date(pr.createdAt).getTime()) / 3_600_000;
log(`PR #${number}, slack ts=${ts}, 경과 ${ageH.toFixed(1)}h, 24h리마인드=${remindedBefore}`);

// ── 3. ✅ 반응 카운트 ──────────────────────────────────────────────────────
const reac = await slack('reactions.get', { channel: CHANNEL, timestamp: ts, full: 'true' });
const reactions = reac.message?.reactions || [];
const checkUsers = new Set((reactions.find((r) => r.name === EMOJI)?.users) || []);
const approvers = Object.keys(ROSTER).filter((id) => checkUsers.has(id));
const pending = Object.keys(ROSTER).filter((id) => !checkUsers.has(id));
log(`승인 ${approvers.length}/${Object.keys(ROSTER).length}: [${approvers.map((i) => ROSTER[i]).join(', ')}]`);

// ── 4. CI 상태 ─────────────────────────────────────────────────────────────
function ciStatus() {
  let checks;
  try {
    checks = JSON.parse(gh(['pr', 'checks', number, '--repo', REPO, '--json', 'bucket,name,state']));
  } catch {
    return 'pending'; // 체크가 아직 안 붙음
  }
  if (!checks.length) return 'pending';
  const buckets = checks.map((c) => c.bucket);
  if (buckets.some((b) => b === 'fail' || b === 'cancel')) return 'fail';
  if (buckets.some((b) => b === 'pending')) return 'pending';
  return 'green'; // pass/skipping만 남음
}

// ── 5. 판정 ────────────────────────────────────────────────────────────────
const quorumMet = approvers.length >= QUORUM;
const overrideMet = ageH >= OVERRIDE_AFTER_H && OVERRIDE_IDS.every((id) => checkUsers.has(id));
const approved = quorumMet || overrideMet;

if (approved) {
  const ci = ciStatus();
  const reason = quorumMet
    ? `과반 ${approvers.length}/${Object.keys(ROSTER).length}`
    : `48h override(${OVERRIDE_NAMES})`;
  if (ci !== 'green') { log(`승인됨(${reason})이나 CI=${ci} — 대기.`); process.exit(0); }
  if (DRY_RUN) { log(`[DRY_RUN] 머지 조건 충족(${reason}, CI green) — 실제 머지 생략.`); process.exit(0); }
  gh(['pr', 'merge', number, '--repo', REPO, '--merge']);
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
