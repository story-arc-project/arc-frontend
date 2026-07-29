# Review Rules — ARC

> **정본은 루트 `CLAUDE.md` → `arc-dev-workflow` 스킬의 "8. Review" 섹션이다.**
> 이 문서는 요약 포인터다. 충돌 시 스킬이 우선한다.

## 역할
- Claude: 구현 · 리뷰 지적 반영 · 재검증
- 리뷰: `/code-review medium --fix` — **사용자가 트리거한다.** Claude가 임의로 실행하지 않는다.

## 사용
| 명령 | 시점 |
|------|------|
| `/code-review medium --fix` | 필수 — 구현·validate 4게이트 통과 후 |
| `/codex:rescue` | 동일 문제 2회 반복 / 원인 불명 버그 (리뷰가 아니라 구현 구조 요청) |

## 폐지 — Codex 리뷰 (2026-07-29)
`/codex:review` · `/codex:adversarial-review`는 더 이상 돌리지 않는다.
리뷰 창구를 `/code-review medium --fix` 하나로 통일한다.
