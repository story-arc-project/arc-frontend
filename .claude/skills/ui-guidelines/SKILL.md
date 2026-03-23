---
name: ui-guidelines
description: ARC UI 디자인 시스템 규칙. 컴포넌트 작성, 스타일링, 색상 토큰, 타이포그래피, 간격, 애니메이션 작업 시 자동 로드. "버튼 만들어줘", "카드 스타일", "색상 적용", "레이아웃 잡아줘" 등 UI 관련 작업이면 항상 참고한다.
user-invocable: false
---

UI 작업 전 반드시 `UI-GUIDELINES.md`를 읽는다.
아래는 가장 자주 위반되는 규칙 요약이다. 상세 내용은 파일을 직접 참조할 것.

## 절대 금지

```tsx
// ❌ 하드코딩 색상
className="text-[#333]"
style={{ color: "#6b7684" }}

// ❌ 앱 내부 임의 폰트 크기
className="text-[14px]"

// ❌ 임의 마진
className="mt-[13px]"

// ❌ 과도한 그림자
className="shadow-2xl shadow-blue-500/50"

// ❌ Primary 버튼 두 개 이상
<Button variant="primary">저장</Button>
<Button variant="primary">공유</Button>
```

## 항상 사용

```tsx
// ✅ 시맨틱 색상 토큰
text-text-primary / text-text-secondary / text-text-tertiary
bg-surface / bg-surface-secondary / bg-surface-brand
border-border / border-border-strong
bg-brand / text-brand / bg-brand-dark

// ✅ 타이포그래피 클래스
text-display / text-heading-1 / text-heading-2 / text-heading-3
text-title / text-body-lg / text-body / text-body-sm
text-label / text-caption

// ✅ 기본 카드 — shadow 대신 border
<div className="bg-surface border border-border rounded-lg p-5">

// ✅ 공통 컴포넌트 재사용
import { Button, Card, Input, Badge, Textarea } from "@/components/ui"
```

## 상세 규칙 위치 (UI-GUIDELINES.md)

| 궁금한 것 | 섹션 |
|-----------|------|
| 색상 토큰 전체 | `## 2. 색상` |
| 타이포그래피 스케일 | `## 3. 타이포그래피` |
| 간격·레이아웃 | `## 4. 간격 · 레이아웃` |
| Border Radius | `## 5. Border Radius` |
| Shadow | `## 6. Shadow` |
| 컴포넌트 API | `## 7. 컴포넌트` |
| 애니메이션 | `## 8. 애니메이션` |