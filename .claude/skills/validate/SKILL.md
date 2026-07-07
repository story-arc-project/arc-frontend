---
name: validate
description: 코드 변경 후 검증이 필요할 때 — 완료 주장·커밋·PR 생성 전, 또는 사용자가 /validate 를 호출할 때 사용한다. lint·typecheck·유닛 테스트·build 4게이트를 실행한다.
---

# Validate — 4게이트 검증 (서브에이전트 실행)

4게이트의 긴 출력이 메인 컨텍스트를 오염시키지 않도록 **서브에이전트가 실행하고 요약만 받는다**.

## 절차

1. Agent 도구로 general-purpose 서브에이전트를 하나 띄운다. 프롬프트 템플릿:

   ```
   <작업 디렉토리 절대경로>에서 아래 4개 명령을 순서대로 실행하라.
   실패해도 다음 게이트를 계속 실행해 전체 현황을 파악한다 (단, build는 typecheck 실패 시 생략 가능).

   1. npm run lint
   2. npm run typecheck
   3. npm run test:unit
   4. npm run build

   node_modules가 없으면 먼저 npm ci 를 실행한다.

   보고 형식 (이 형식만, 로그 전체 금지):
   - 게이트별 한 줄: `lint: PASS` 또는 `lint: FAIL`
   - FAIL 게이트는 핵심 에러만 발췌 (파일:라인 + 메시지, 게이트당 최대 20줄)
   - 유닛 테스트는 `N passed / M failed` 카운트 포함
   ```

2. 결과를 받아 **메인 대화에 게이트별 PASS/FAIL을 반드시 재진술**한다 (사용자·분류기는 도구 출력을 못 본다).
3. FAIL이 있으면 `superpowers:systematic-debugging`으로 수정 후 **실패한 게이트부터 재실행**한다.
   전부 PASS하기 전에는 완료를 주장하지 않는다 (`superpowers:verification-before-completion`).

## 주의

- 워크트리에서는 node_modules 부재가 흔하다 — 서브에이전트 프롬프트의 npm ci 조항이 이를 처리한다.
- e2e는 이 스킬 범위 밖 (필요 시 `npm run test:e2e` 별도 실행 — UI 변경 시 arc-dev-workflow 6단계 참조).
