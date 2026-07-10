---
name: arc-slack-message
description: ARC Slack 워크스페이스의 특정 채널로 노션 'Slack 메세지 형식'([요청]/[공유]/[토의])에 맞춘 메시지를 보낸다. 봇 토큰(xoxb-)으로 Slack Web API를 직접 호출해 claude.ai 커넥터의 단일 워크스페이스 제약을 우회한다. "슬랙에 보내줘", "p-admin-page에 요청 보내줘", "이 내용 슬랙으로 공유해줘" 등 ARC 슬랙 발송 요청 시 사용.
user-invocable: true
---

ARC Slack 채널로 형식에 맞춘 메시지를 보낸다.

## 왜 봇 토큰(Option A)인가

claude.ai Slack 커넥터(`mcp__claude_ai_Slack__*`)는 **계정당 워크스페이스 1개만** 연결된다.
현재 그 커넥터는 개인 워크스페이스(`my-briefing`)에 물려 있어 ARC 채널로 보내면 `channel_not_found`가 난다.
그래서 이 스킬은 커넥터를 안 쓰고 **ARC 워크스페이스에 만든 봇 토큰으로 Web API를 직접 호출**한다(워크스페이스 전환 불필요).

## 사전 준비 (1회)

봇 토큰이 없으면 먼저 발급받아야 한다. 자세한 단계는 `reference/setup-bot-token.md` 참고. 요약:

1. https://api.slack.com/apps → Create New App → From scratch → **ARC 워크스페이스** 선택
2. OAuth & Permissions → Bot Token Scopes에 `chat:write`(필수), `users:read`(멘션용 권장) 추가
3. Install to Workspace → **Bot User OAuth Token(`xoxb-...`)** 복사
4. 대상 채널에 봇 초대: 채널에서 `/invite @봇이름`
5. 토큰 저장(리포 밖, 커밋 금지):
   ```bash
   export SLACK_BOT_TOKEN=xoxb-...
   # 또는 영구 보관:
   mkdir -p ~/.arc && printf %s 'xoxb-...' > ~/.arc/slack-bot-token && chmod 600 ~/.arc/slack-bot-token
   ```

## 발송 절차

`SKILL_DIR = .claude/skills/arc-slack-message` (이 파일이 있는 디렉터리) 기준.

1. **연결 확인** — 봇이 올바른 ARC 워크스페이스에 붙었는지 먼저 확인한다(엉뚱한 곳 발송 방지):
   ```bash
   python3 "$SKILL_DIR/scripts/slack.py" whoami
   ```
   `team`이 ARC 워크스페이스인지 확인. 실패하면 사전 준비를 안내하고 멈춘다.

2. **형식 선택 + 작성** — `reference/message-formats.md`의 [요청]/[공유]/[토의] 중 목적에 맞는 하나를 골라 본문을 채운다.
   - 발송 전 가능하면 `notion-arc` MCP로 정본(page id `37673d1b-7382-80a3-aeae-ee805496d521`)을 다시 읽어 최신 형식과 대조한다.
   - 관련 Notion/Linear 링크를 [자료]/[참고]에 첨부한다.

3. **멘션 해석** — `@이름`을 실제 알림 가는 멘션으로 바꾸려면 멤버 ID를 찾아 `<@U…>`로 넣는다:
   ```bash
   python3 "$SKILL_DIR/scripts/slack.py" lookup --query 기민
   ```

4. **사용자 확인** — 완성한 메시지 본문과 대상 채널을 사용자에게 보여주고 발송 승인을 받는다.
   (Slack 발송은 외부로 나가는 되돌리기 어려운 행위이므로 **명시적 확인 후** 보낸다.)

5. **발송** — 본문을 파일에 쓴 뒤 채널 ID로 보낸다(멀티라인/유니코드 안전):
   ```bash
   python3 "$SKILL_DIR/scripts/slack.py" send --channel <CHANNEL_ID> --text-file <본문파일>
   # 스레드 답글이면 --thread-ts <부모_ts> 추가
   ```
   성공 시 `✅ 발송 완료`와 메시지 permalink를 출력한다. 이 링크를 사용자에게 전달한다.

## 자주 만나는 채널

- `p-admin-page` → `C0BG9D34FFV`
- (그 외는 `notion`/Slack에서 채널 세부정보 → 채널 ID 복사)

## 오류 대응

- `not_in_channel` → 채널에 봇 미초대. `/invite @봇이름`.
- `channel_not_found` → 봇 토큰이 그 채널이 있는 워크스페이스 것이 아님. 토큰/워크스페이스 확인.
- `missing_scope` → scope 추가 후 **Reinstall** 필요.
- `invalid_auth` → 토큰 오타/폐기. 재발급.

## 보안

- `xoxb-` 토큰은 시크릿. **절대 리포에 커밋하지 않는다**(env 또는 `~/.arc/slack-bot-token`, 홈 디렉터리 = 리포 밖).
- 유출 시 Slack 앱 설정에서 Revoke 후 재발급.
