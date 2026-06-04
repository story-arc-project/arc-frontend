# Codex Rules — ARC

> **정본은 루트 `CLAUDE.md`의 "Development Workflow > 8. Review" 섹션이다.**
> 이 문서는 요약 포인터다. 충돌 시 CLAUDE.md가 우선한다.

## 역할
- Claude: 구현
- Codex: 리뷰 / 문제 해결 — **제안자일 뿐, 실제 수정은 Claude가 한다.**

## 사용
| 명령 | 시점 |
|------|------|
| `/codex:adversarial-review --base dev` | 조건부 — 3+파일 / UX / 상태 / API 변경 |
| `/codex:review --base dev` | 필수 — 최종 리뷰 |
| `/codex:rescue` | 동일 문제 2회 반복 / 원인 불명 버그 |
