# Workflow — ARC

## Feature Implementation Pipeline

### 1. Plan
- 요구사항 정리
- 변경 파일 식별
- 기존 코드 재사용

### 2. Implement
- 최소 동작 구현
- 모바일 기준 UI
- 상태는 local/searchParams

### 3. Validate
- eslint
- build

### 4. Adversarial Review
조건:
- 다수 파일 변경
- UX 흐름 변경
- 상태/API 구조 변경

```bash
/codex:adversarial-review --base main
```

### 5. UI Quality Check (조건부)

UI/프론트엔드 변경 시 아래 스킬로 검증:

```bash
/expect          # 브라우저 테스트 — 변경사항이 정상 동작하는지 확인
/audit           # 접근성·성능·반응형·안티패턴 점검 (P0~P3 리포트)
/critique        # UX 관점 평가 — 시각 계층, 인지 부하, 정보 구조
/polish          # 최종 품질 패스 — 정렬, 간격, 일관성 미세 조정
/normalize       # 디자인 시스템 토큰·패턴 정합성 확인
```

상황별 선택:
- 새 컴포넌트/페이지 → `/audit` + `/critique`
- 레이아웃·스타일 수정 → `/expect` + `/polish`
- 디자인 시스템 정합성 의심 → `/normalize`

### 6. Final Review
```bash
/codex:review --base main
```

### 7. Output
- 변경 내용
- 이유
- 파일
- 검증
- 리스크
