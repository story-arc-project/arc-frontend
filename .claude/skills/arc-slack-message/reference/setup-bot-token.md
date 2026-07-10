# Slack 봇 토큰(`xoxb-…`) 발급 — 상세

이 스킬은 ARC 워크스페이스에 만든 **봇 토큰**으로 Slack Web API를 직접 호출한다.
아래는 1회성 준비 절차다.

## 1) 앱 생성
1. https://api.slack.com/apps → **Create New App**
2. **From scratch** 선택
3. **App Name**(예: `ARC Notifier`) 입력 → **Workspace**에서 **ARC 워크스페이스** 선택 → **Create App**
   - ⚠️ 워크스페이스가 앱 설치를 관리자 승인제로 막아뒀다면 오너 승인이 필요하다.

## 2) 봇 권한(Scope) 추가
왼쪽 **OAuth & Permissions** → **Scopes → Bot Token Scopes → Add an OAuth Scope**:
- `chat:write` — **필수** (메시지 전송)
- `users:read` — **권장** (멘션용 멤버 ID 조회)
- `chat:write.customize` — 선택 (메시지별 봇 이름/아이콘 커스텀)
- `channels:read` — 선택 (채널명→ID 조회. ID를 이미 알면 불필요)

> Scope를 나중에 추가하면 **반드시 Reinstall** 해야 반영된다.

## 3) 설치 → 토큰 발급
1. 상단 **OAuth Tokens for Your Workspace → Install to Workspace**
2. 권한 검토 → **Allow**
3. **Bot User OAuth Token**(`xoxb-...`) 복사 = 봇 토큰

## 4) 채널에 봇 초대 (필수)
공개 채널이라도 봇이 멤버여야 글을 쓸 수 있다.
- 채널에서 `/invite @ARC Notifier`, 또는 채널명 → **Integrations → Add apps**

## 5) 토큰 저장 (리포 밖, 커밋 금지)
```bash
export SLACK_BOT_TOKEN=xoxb-...
# 또는 영구 보관:
mkdir -p ~/.arc && printf %s 'xoxb-...' > ~/.arc/slack-bot-token && chmod 600 ~/.arc/slack-bot-token
```

## 6) 연결 확인 & 테스트
```bash
python3 .claude/skills/arc-slack-message/scripts/slack.py whoami
python3 .claude/skills/arc-slack-message/scripts/slack.py send --channel C0BG9D34FFV --text "봇 연결 테스트 :white_check_mark:"
```
`✅ 발송 완료`와 permalink가 뜨면 성공.

## 오류
- `not_in_channel` → 4) 초대 누락
- `invalid_auth` → 토큰 오타/폐기
- `missing_scope` → 2) scope 누락 후 Reinstall
- `channel_not_found` → 토큰이 그 채널 워크스페이스 것이 아님

## 보안
- `xoxb-` 토큰은 시크릿. 유출 시 앱 설정에서 **Revoke** 후 재발급.
