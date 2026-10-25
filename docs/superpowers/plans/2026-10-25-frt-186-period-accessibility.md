# FRT-186 PeriodPicker Accessibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 시작일·종료일 입력을 기간 맥락과 함께 구별할 수 있게 한다.

**Architecture:** PeriodPicker의 React useId로 인스턴스별 ID를 만든다. 기존 시각 라벨은 그룹 이름으로 연결하고, 숨김 시작일·종료일 텍스트와 함께 각 입력의 aria-labelledby로 참조한다. DatePicker의 공통 동작은 변경하지 않는다.

**Tech Stack:** React 19, TypeScript, Testing Library, Vitest, Storybook.

**Spec:** FRT-186 원문 및 위임 요구사항. 기술 설계 자율 승인 범위.

## Global Constraints

- 기존 배치, 기간 값, 월/일 변환 정책 보존.
- required는 기존 시각 표시만 유지.
- FRT-223의 행번호 맥락 등 인접 이슈는 제외.
- UI 및 보조기술 동작 변화이므로 해당 PR 최신 UI 사용자 승인 전 머지 금지.

## Approaches

DatePicker의 visible label을 추가하면 기존 배치가 바뀐다. aria-label만 추가하면 상위 기간 텍스트와 연결이 분리된다. 기존 라벨과 숨김 역할 텍스트를 aria-labelledby로 조합하면 배치를 유지하며 기간 맥락과 입력 역할을 연결할 수 있어 선택했다.

## Review Focus

- 같은 라벨이 반복되어도 ID와 힌트 참조가 독립적이다.
- label이 없을 때도 시작일·종료일 이름과 기본 기간 그룹이 있다.
- 월/일 입력 모두 같은 이름 연결을 유지한다.
- 현재 선택으로 종료일이 비활성화되어도 이름은 유지된다.
- required 표시는 접근성 이름에 불필요한 텍스트를 추가하거나 native required를 켜지 않는다.

### Task 1: PeriodPicker 접근성 연결

**Files:** components/ui/period-picker.tsx, components/ui/period-picker.test.tsx, components/ui/period-picker.stories.tsx.

- [x] 이름, 기본 그룹, 월/일, 현재, 힌트, required, 반복 인스턴스 회귀 테스트를 작성한다.
- [x] focused test 실행: 기존 6 통과 / 신규 6 실패 확인. 최초 실행 런타임은 Node25로 확인되어 필수 검사는 실제 nvm Node20.19.2로 재실행한다.
- [x] useId 기반 그룹·입력·힌트 연결을 구현한다.
- [x] focused test 12/12 통과 확인. Storybook play에 월/일 및 종료 비활성화 확인을 추가한다.
- [x] 실제 Node20.19.2 lint/typecheck/unit(3349/3349)/build 통과. desktop/mobile은 별도 browser 담당 결과에 기록.
- [ ] Ready PR base dev, 최신 head Codex 리뷰 요청 및 결과 기록, UI 승인 대기.
