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
// quorum 오설정 방어: 0·음수면 승인 0명으로 자동 머지, roster 초과·비숫자면 게이트가 영영 안 열림.
if (!Number.isInteger(QUORUM) || QUORUM < 1 || QUORUM > ROSTER_N) {
  fail(`RELEASE_GATE_CONFIG.quorum(${JSON.stringify(CONFIG.quorum)})가 유효하지 않습니다 — 1..${ROSTER_N} 정수여야 합니다.`);
}

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

// 주간 루틴이 PR 본문에 <!-- slack-summary … --> 로 남긴 Slack 문구를 꺼낸다.
// 사람이 읽을 문구는 루틴(Claude)이 쓰고 게이트는 전달만 한다 — 여기서 요약을 다시 짓지 않는다.
function extractSlackSummary(prBody) {
  return (prBody || '').match(/<!--\s*slack-summary\s*([\s\S]*?)-->/)?.[1]?.trim() || null;
}

// 노트 작성 시점(a) 이후 dev에 붙은 커밋 목록. squash 병합이면 --no-merges가 비므로 폴백한다.
// a가 force-push 등으로 사라졌으면 git이 throw → 빈 문자열(섹션 생략).
function commitsBetween(a, b) {
  try {
    return git(['log', '--no-merges', '--oneline', `${a}..${b}`]) || git(['log', '--oneline', `${a}..${b}`]);
  } catch { return ''; }
}

// 승인 요청을 게시하고 PR 본문의 상태 마커를 갱신한다.
// 첫 게시  = 루틴이 써둔 slack-summary를 그대로 전달.
// 재QA(dev head 변경) = 그 문구는 이미 스테일이므로 쓰지 않고, 짧은 기계적 재요청만 보낸다.
// 호출 경로: 마커 부재(루틴이 연 새 PR·게시 실패 복구) · dev head 변경 재QA · 승인 메시지 소실 복구.
async function postAndRecord(number, devSha, prevBody, oldTs) {
  if (oldTs) {
    try {
      await slack('chat.update', {
        channel: CHANNEL, ts: oldTs,
        text: ':warning: 새 커밋이 추가되어 이 배포 승인 요청은 만료됐어요. 아래 새 메시지에서 다시 승인해주세요.',
      }, true);
    } catch (e) { log(`이전 메시지 만료 처리 실패(무시): ${e.message}`); }
  }

  const summary = extractSlackSummary(prevBody);
  const text = (!oldTs && summary) ? summary : (
    `:rocket: *dev → main 배포 검토*${oldTs ? ' (재요청)' : ''}\n<!channel>\n\n` +
    (oldTs ? 'dev에 새 커밋이 반영돼 다시 확인이 필요해요.\n' : '') +
    `<${STAGING_URL}|dev.story-arc.org> 확인 후 *이 메시지에* :white_check_mark: 부탁드려요.\n\n` +
    `*승인 규칙* — ${ROSTER_N}명 중 ${QUORUM}명 :white_check_mark:` +
    (OVERRIDE_IDS.length ? ` (또는 48시간 경과 시 ${OVERRIDE_NAMES} 승인)` : '') +
    ` + CI 통과 → 자동 배포\n` +
    `변경 내용은 <https://github.com/${REPO}/pull/${number}|PR #${number}>를 확인해주세요`
  );

  const posted = await slack('chat.postMessage', { channel: CHANNEL, text, unfurl_links: false, link_names: true }, true);
  const postedAt = new Date().toISOString();

  // 노트가 커버하는 dev SHA. 한 번 각인하면 그대로 물려준다 —
  // 직전 dev-sha를 기준으로 잡으면 A→B→C로 두 번 밀릴 때 A..B 구간이 섹션에서 사라진다.
  // 1순위는 주간 루틴이 PR 생성 시 남기는 notes-dev-sha: 루틴이 dev@A에서 노트를 쓴 뒤
  // 게이트 첫 실행 전에 B가 붙으면, 마커가 없는 한 A..B를 알아낼 방법이 없다(기준이 B로 잡힘).
  const notesBaseMarker = prevBody.match(/<!--\s*notes-dev-sha:\s*([0-9a-f]+)\s*-->/)?.[1]
    || prevBody.match(/<!--\s*dev-sha:\s*([0-9a-f]+)\s*-->/)?.[1];
  if (!notesBaseMarker) {
    log(`⚠️ notes-dev-sha 마커 없음 — 노트 기준을 현재 head(${devSha.slice(0, 7)})로 가정한다. `
      + '루틴이 PR 생성 시 <!-- notes-dev-sha: SHA -->를 남기면 노트 작성~첫 게시 사이 커밋도 표면화된다.');
  }
  const notesBase = notesBaseMarker || devSha;

  // 마커만 교체하고 본문(상세 노트)은 그대로 둔다 — 통째로 덮어쓰면 릴리스 노트가 날아간다.
  let notes = (prevBody || '')
    .replace(/<!--\s*(?:release-gate|slack-ts:.*?|notes-dev-sha:.*?|dev-sha:.*?|posted-at:.*?|reminded-24h|merge-error)\s*-->\n?/g, '')
    .replace(/<!--\s*gate:added-commits\s*-->[\s\S]*?<!--\s*\/gate:added-commits\s*-->\n?/g, '') // 이전 회차 섹션 제거 후 재생성
    .trim();

  // 노트 작성 이후 dev에 커밋이 붙었다면 그 사실을 본문에 남긴다. 게이트는 노트를 쓸 수 없지만
  // (사람 글은 루틴 담당), 승인자와 Release 아카이브가 "노트에 없는 커밋"을 모르는 채로
  // 넘어가는 건 막아야 한다 — 이 본문이 그대로 GitHub Release가 된다.
  const added = notesBase !== devSha ? commitsBetween(notesBase, devSha) : '';
  if (added) {
    notes += `\n\n<!-- gate:added-commits -->\n---\n\n### ⚠️ 아래 커밋은 위 릴리스 노트에 반영되지 않았습니다\n`
      + `노트 작성(\`${notesBase.slice(0, 7)}\`) 이후 dev에 추가된 커밋입니다 — 게이트가 자동 기록.\n\n`
      + `\`\`\`\n${added}\n\`\`\`\n<!-- /gate:added-commits -->`;
  }

  gh(['pr', 'edit', number, '--repo', REPO, '--body',
    `<!-- release-gate -->\n<!-- slack-ts: ${posted.ts} -->\n<!-- dev-sha: ${devSha} -->\n`
    + `<!-- notes-dev-sha: ${notesBase} -->\n<!-- posted-at: ${postedAt} -->\n\n${notes}`]);
  log(`Slack 승인 요청 게시(ts=${posted.ts}, dev=${devSha.slice(0, 7)}, 문구=${(!oldTs && summary) ? '루틴 작성' : '기본 템플릿'}${added ? ', 노트 미반영 커밋 기록됨' : ''}). 다음 실행에서 반응·CI 평가.`);
  return posted.ts;
}

// 머지된 릴리스 노트를 GitHub Release로 영구 아카이브한다. PR body에서 상태 마커와 승인 안내만
// 걷어내고 그대로 재사용 — 노트는 주간 루틴이 한 번만 쓴다.
// 호출 시점엔 머지가 이미 끝났다 → 어떤 실패도 치명적이지 않으므로 로그만 남기고 삼킨다.
function publishRelease(prBody, mergeSha) {
  try {
    const notes = prBody
      .replace(/<!--[\s\S]*?-->/g, '') // 상태 마커
      .replace(/^.*dev\.story-arc\.org에서 QA 후.*$/m, '') // 승인 요청 안내(배포 후엔 무의미)
      .replace(/^\*\*승인 규칙\*\*.*$/m, '')
      .trim();
    const day = new Date().toISOString().slice(0, 10);
    let tag = `release-${day}`;
    let exists = false;
    try { gh(['release', 'view', tag, '--repo', REPO]); exists = true; } catch { /* 없으면 그대로 사용 */ }
    if (exists) {
      // 같은 날 두 번 배포되면 태그가 충돌한다 — 머지 커밋으로 구분.
      if (!mergeSha) { log(`Release 태그 ${tag} 존재 + 머지 커밋 미확인 — 발행 생략.`); return; }
      tag = `${tag}-${mergeSha.slice(0, 7)}`;
    }
    const args = ['release', 'create', tag, '--repo', REPO, '--title', `🚀 릴리스 ${day}`, '--notes', notes];
    if (mergeSha) args.push('--target', mergeSha);
    gh(args);
    log(`GitHub Release 발행: ${tag}`);
  } catch (e) {
    log(`Release 발행 실패(무시 — 머지는 완료됨): ${e.message}`);
  }
}

// ── 1. dev가 main보다 앞섰나 ───────────────────────────────────────────────
const ahead = Number(git(['rev-list', '--count', 'origin/main..origin/dev']));
if (!ahead) { log('✅ dev가 main보다 앞선 커밋 없음 — 배포할 것 없음. 종료.'); process.exit(0); }
const currentDevSha = git(['rev-parse', 'origin/dev']);
log(`dev가 main보다 ${ahead}커밋 앞섬 (dev=${currentDevSha.slice(0, 7)}).`);

// ── 2. 열린 dev→main PR 찾기 ───────────────────────────────────────────────
const OWNER = REPO.split('/')[0];
// --head dev는 브랜치명만 매칭해 포크의 동명 브랜치(fork:dev)에서 연 PR도 잡힐 수 있다(공개 리포).
// 업스트림 same-repo PR만 남긴다 — 아니면 남의 PR 본문을 편집하거나 head SHA 불일치로 영구 대기하게 된다.
const prs = JSON.parse(
  gh(['pr', 'list', '--repo', REPO, '--base', 'main', '--head', 'dev',
    '--state', 'open', '--json', 'number,body,createdAt,isCrossRepository,headRepositoryOwner'])
).filter((p) => !p.isCrossRepository && (p.headRepositoryOwner?.login ?? OWNER) === OWNER);

// 릴리스 PR은 주간 Claude 루틴(월 10시)이 상세 노트와 함께 만든다 — 이 게이트는 만들지 않는다.
// 여기서 PR을 만들면 매시 배포를 재촉하는 꼴이 되고, 사람이 읽을 요약도 못 쓴다.
if (prs.length === 0) {
  log('열린 dev→main PR 없음 — 주간 루틴이 생성할 때까지 대기. 종료.');
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

// 마커 부재(주간 루틴이 막 연 PR · 이전 게시 실패 복구) 또는
// dev head 변경(승인 후 새 커밋 → 재QA 필요) 시 승인 요청을 게시한다.
if (!ts || !devShaMarker || devShaMarker !== currentDevSha) {
  const why = !ts ? '상태 마커 없음(신규 PR 게시 또는 복구)' : `dev head 변경(${(devShaMarker || '?').slice(0, 7)}→${currentDevSha.slice(0, 7)}, 재QA 필요)`;
  if (DRY_RUN) { log(`[DRY_RUN] 승인 요청 게시 필요: ${why}`); process.exit(0); }
  log(`승인 요청 게시: ${why}`);
  await postAndRecord(number, currentDevSha, body, ts);
  process.exit(0);
}

const postedAt = postedAtMarker ? new Date(postedAtMarker) : new Date(pr.createdAt); // 구버전 PR 폴백
const ageH = (Date.now() - postedAt.getTime()) / 3_600_000;
log(`PR #${number}, slack ts=${ts}, 경과 ${ageH.toFixed(1)}h, 24h리마인드=${remindedBefore}`);

// ── 3. ✅ 반응 카운트 ──────────────────────────────────────────────────────
let reac;
try {
  reac = await slack('reactions.get', { channel: CHANNEL, timestamp: ts, full: 'true' });
} catch (e) {
  // 승인 메시지가 삭제/채널 보존기간 만료로 사라지면 reactions.get가 message_not_found로 throw.
  // 마커만 믿고 매 실행 같은 지점에서 멈추지 않도록, 메시지가 사라졌을 때만 새로 게시하고 종료.
  if (/message_not_found/.test(e.message)) {
    log('승인 메시지가 사라짐(message_not_found) → 승인 요청 재게시.');
    if (!DRY_RUN) await postAndRecord(number, currentDevSha, body);
    process.exit(0);
  }
  throw e; // 그 외(전송 오류 등)는 표면화 — 중복 메시지 스팸 대신 다음 실행에서 재시도.
}
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
    const out = ((e.stdout ? e.stdout.toString() : '') + (e.stderr ? e.stderr.toString() : '')).trim();
    // 실패 원인 구분: head가 승인 SHA와 달라졌으면 양성 경쟁(새 커밋 유입) → 다음 실행이 dev-sha 변경으로 재QA.
    let headNow = '';
    try { headNow = gh(['pr', 'view', number, '--repo', REPO, '--json', 'headRefOid', '-q', '.headRefOid']); } catch { /* 조회 실패는 아래서 실제 오류로 처리 */ }
    if (headNow && headNow !== currentDevSha) {
      log(`머지 보류 — head가 승인 SHA(${currentDevSha.slice(0, 7)})→${headNow.slice(0, 7)}로 바뀜(새 커밋 유입). 다음 실행에서 재QA. ${out}`);
      process.exit(0);
    }
    // head는 그대로인데 머지가 거부됨 — 권한·머지 설정·브랜치 규칙 등 실제 오류.
    // 조용한 무한 재시도 대신 Slack 1회 경보(마커로 중복 차단) + 비정상 종료로 표면화.
    if (!/<!--\s*merge-error\s*-->/.test(body)) {
      try {
        await slack('chat.postMessage', {
          channel: CHANNEL, thread_ts: ts,
          text: `:x: *자동 배포 실패* — 승인·CI는 통과했지만 dev → main 머지가 거부됐어요. 권한·머지 설정·브랜치 규칙을 확인해주세요.\n\`\`\`${out.slice(0, 500)}\`\`\``,
        }, true);
      } catch (se) { log(`Slack 실패 경보 게시 실패(무시): ${se.message}`); }
      try { gh(['pr', 'edit', number, '--repo', REPO, '--body', `${body}\n<!-- merge-error -->`]); } catch { /* 마커 기록 실패는 무시 */ }
    }
    fail(`자동 머지 실패(head 불변, 실제 오류): ${out}`);
  }
  // gh pr merge 반환 == 머지 완료가 아니다 — main이 merge queue를 쓰면 큐 등록에 그친다. 실제 머지 상태 확인.
  let mergedState = null;
  try {
    // gh pr view는 boolean `merged` 필드가 없다(Unknown JSON field로 throw) — state·mergedAt로 판정.
    mergedState = JSON.parse(gh(['pr', 'view', number, '--repo', REPO, '--json', 'state,mergedAt,mergeCommit']));
  } catch { /* 확인 실패 시 큐 등록(미확정)으로 보수 처리 */ }
  const isMerged = mergedState?.state === 'MERGED' || Boolean(mergedState?.mergedAt);

  // 머지된 경우에만 릴리스 노트를 GitHub Release로 영구 아카이브(Slack=가볍게 / PR body=상세 / Release=아카이브).
  // 본문은 PR body 재사용 — 노트를 두 번 쓰지 않는다. 실패해도 머지는 이미 끝났으므로 경고만 남기고 성공 처리.
  // Slack 알림보다 먼저 — 알림이 throw하면 이 실행이 죽고, 다음 실행은 main..dev=0으로 조기 종료해
  // Release를 영영 못 남긴다(아카이브가 Slack 가용성에 매달리면 안 된다).
  if (isMerged) publishRelease(body, mergedState?.mergeCommit?.oid);

  try {
    await slack('chat.postMessage', {
      channel: CHANNEL, thread_ts: ts,
      text: isMerged
        ? `:tada: *배포 완료* — dev → main 머지됨 (${reason}, CI 통과). 프로덕션 반영이 진행됩니다.`
        : `:inbox_tray: *배포 예약* — dev → main 머지가 대기열에 등록됐어요 (${reason}, CI 통과). 큐 통과 후 반영됩니다.`,
    }, true);
  } catch (e) {
    // 머지·아카이브는 이미 끝났다 — 알림 실패로 실행을 죽이면 다음 실행이 재시도할 여지도 없다.
    log(`배포 완료 알림 게시 실패(무시 — 머지·Release는 완료됨): ${e.message}`);
  }
  log(isMerged ? `머지 완료(${reason}).` : `머지 큐 등록(${reason}).`);
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
