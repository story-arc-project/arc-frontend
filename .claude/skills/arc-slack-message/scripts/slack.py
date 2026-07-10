#!/usr/bin/env python3
"""ARC Slack 봇 발송 헬퍼 (Option A: Bot Token + Web API).

claude.ai Slack 커넥터(계정당 워크스페이스 1개 제약)를 우회해, ARC 워크스페이스에
만든 봇 토큰(xoxb-...)으로 Slack Web API를 직접 호출한다.

토큰 우선순위:
  1) 환경변수 ARC_NOTIFIER_SLACK_BOT_TOKEN
  2) 파일 ~/.arc/slack-bot-token  (리포 밖. 커밋 금지)

사용법:
  slack.py send   --channel C0BG9D34FFV --text-file /path/to/msg.md [--thread-ts 123.456]
  slack.py send   --channel C0BG9D34FFV --text "한 줄 메시지"
  slack.py lookup --query 기민          # 이름/표시명/실명으로 멤버 ID(U...) 검색
  slack.py whoami                       # 연결된 봇/팀(워크스페이스) 확인
"""
import argparse
import json
import os
import sys
import urllib.request
import urllib.error
import urllib.parse

API = "https://slack.com/api/"


def get_token() -> str:
    tok = os.environ.get("ARC_NOTIFIER_SLACK_BOT_TOKEN", "").strip()
    if not tok:
        path = os.path.expanduser("~/.arc/slack-bot-token")
        if os.path.exists(path):
            with open(path, encoding="utf-8") as f:
                tok = f.read().strip()
    if not tok:
        sys.exit(
            "ARC_NOTIFIER_SLACK_BOT_TOKEN 이 없습니다. 환경변수로 지정하거나 ~/.arc/slack-bot-token 에 저장하세요.\n"
            "  export ARC_NOTIFIER_SLACK_BOT_TOKEN=xoxb-...\n"
            "  # 또는  mkdir -p ~/.arc && printf %s 'xoxb-...' > ~/.arc/slack-bot-token && chmod 600 ~/.arc/slack-bot-token"
        )
    if not tok.startswith("xoxb-"):
        sys.stderr.write("경고: 봇 토큰(xoxb-)이 아닌 것 같습니다. 발송이 실패할 수 있습니다.\n")
    return tok


def call(method: str, token: str, payload: dict) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        API + method,
        data=data,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json; charset=utf-8",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return {"ok": False, "error": f"http_{e.code}", "detail": e.read().decode("utf-8", "replace")}
    except urllib.error.URLError as e:
        return {"ok": False, "error": "network", "detail": str(e.reason)}


def call_get(method: str, token: str, params: dict) -> dict:
    qs = urllib.parse.urlencode(params)
    req = urllib.request.Request(
        API + method + "?" + qs,
        headers={"Authorization": f"Bearer {token}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return {"ok": False, "error": f"http_{e.code}"}
    except urllib.error.URLError as e:
        return {"ok": False, "error": "network", "detail": str(e.reason)}


HINTS = {
    "not_in_channel": "봇을 채널에 초대하세요: 채널에서 `/invite @봇이름`",
    "channel_not_found": "채널 ID가 이 워크스페이스에 없습니다. 봇 토큰이 맞는 워크스페이스 것인지 확인하세요.",
    "invalid_auth": "토큰이 유효하지 않습니다(오타/폐기). 재발급하세요.",
    "missing_scope": "필요한 OAuth Scope 누락. chat:write(및 users:read) 추가 후 Reinstall 하세요.",
    "not_authed": "토큰이 없습니다.",
}


def die_if_error(res: dict):
    if not res.get("ok"):
        err = res.get("error", "unknown")
        msg = f"Slack API 실패: {err}"
        if err in HINTS:
            msg += f"\n→ {HINTS[err]}"
        if res.get("detail"):
            msg += f"\n{res['detail']}"
        sys.exit(msg)


def cmd_send(args):
    token = get_token()
    if args.text_file:
        with open(args.text_file, encoding="utf-8") as f:
            text = f.read()
    elif args.text is not None:
        text = args.text
    else:
        text = sys.stdin.read()
    if not text.strip():
        sys.exit("보낼 텍스트가 비어 있습니다.")

    payload = {"channel": args.channel, "text": text}
    if args.thread_ts:
        payload["thread_ts"] = args.thread_ts
    res = call("chat.postMessage", token, payload)
    die_if_error(res)

    ts = res.get("ts")
    ch = res.get("channel", args.channel)
    link = call_get("chat.getPermalink", token, {"channel": ch, "message_ts": ts})
    permalink = link.get("permalink") if link.get("ok") else "(permalink 조회 실패)"
    print(f"✅ 발송 완료  channel={ch} ts={ts}\n{permalink}")


def cmd_lookup(args):
    token = get_token()
    q = args.query.lower()
    cursor = ""
    hits = []
    while True:
        params = {"limit": 200}
        if cursor:
            params["cursor"] = cursor
        res = call_get("users.list", token, params)
        die_if_error(res)
        for m in res.get("members", []):
            if m.get("deleted") or m.get("is_bot"):
                continue
            p = m.get("profile", {})
            hay = " ".join(
                filter(None, [m.get("name"), p.get("real_name"), p.get("display_name"), p.get("email")])
            ).lower()
            if q in hay:
                hits.append((m["id"], p.get("real_name") or m.get("name"), p.get("display_name"), p.get("email")))
        cursor = res.get("response_metadata", {}).get("next_cursor", "")
        if not cursor:
            break
    if not hits:
        print(f"'{args.query}' 로 매칭되는 멤버가 없습니다. (users:read scope 확인)")
        return
    for uid, real, disp, email in hits:
        print(f"{uid}\t{real}\t{disp or ''}\t{email or ''}\t→ 멘션: <@{uid}>")


def cmd_whoami(args):
    token = get_token()
    res = call_get("auth.test", token, {})
    die_if_error(res)
    print(f"team={res.get('team')} team_id={res.get('team_id')} url={res.get('url')}")
    print(f"bot user={res.get('user')} user_id={res.get('user_id')}")


def main():
    ap = argparse.ArgumentParser(description="ARC Slack 봇 발송 헬퍼")
    sub = ap.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("send", help="채널에 메시지 발송")
    s.add_argument("--channel", required=True, help="채널 ID (예: C0BG9D34FFV)")
    g = s.add_mutually_exclusive_group()
    g.add_argument("--text", help="인라인 텍스트")
    g.add_argument("--text-file", help="텍스트 파일 경로 (미지정 시 stdin)")
    s.add_argument("--thread-ts", help="스레드 답글 대상 ts")
    s.set_defaults(func=cmd_send)

    l = sub.add_parser("lookup", help="멤버 ID 검색(멘션용)")
    l.add_argument("--query", required=True, help="이름/표시명/실명/이메일 일부")
    l.set_defaults(func=cmd_lookup)

    w = sub.add_parser("whoami", help="연결된 봇/워크스페이스 확인")
    w.set_defaults(func=cmd_whoami)

    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
