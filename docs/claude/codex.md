# Codex Rules

## 역할
- Claude: 구현
- Codex: 리뷰 / 문제 해결

## Rescue
```bash
/codex:rescue
```

사용:
- 반복 실패
- 원인 불명 버그

## Adversarial Review
```bash
/codex:adversarial-review --base main
```

사용:
- 구조 변경
- UX 변경
- 상태/API 변경

## Final Review
```bash
/codex:review --base main
```

## 원칙
- Codex는 제안자
- 실제 수정은 Claude
- 필요할 때만 사용
