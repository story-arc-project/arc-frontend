# ARC UI Guidelines

> Editorial Minimal 스타일 기반의 ARC 디자인 시스템 문서.
> 모든 컴포넌트와 페이지는 이 가이드라인을 따른다.

---

## 목차

1. [디자인 철학](#1-디자인-철학)
2. [색상](#2-색상)
3. [타이포그래피](#3-타이포그래피)
4. [적응형 · 모바일](#4-적응형--모바일)
5. [간격 · 레이아웃](#5-간격--레이아웃)
6. [Border Radius](#6-border-radius)
7. [Shadow](#7-shadow)
8. [컴포넌트](#8-컴포넌트)
9. [애니메이션](#9-애니메이션)
10. [아이콘](#10-아이콘)
11. [해야 할 것 · 하지 말아야 할 것](#11-해야-할-것--하지-말아야-할-것)

---

## 1. 디자인 철학

ARC의 UI는 **Editorial Minimal** 스타일을 기반으로 한다.

| 원칙 | 설명 |
|------|------|
| **명료함 우선** | 불필요한 장식보다 정보 전달이 먼저다 |
| **여백으로 말한다** | 빽빽하게 채우지 않는다. 여백이 구조를 만든다 |
| **타이포그래피가 계층을 만든다** | 색보다 크기·굵기로 위계를 표현한다 |
| **인터랙션은 절제한다** | 애니메이션은 맥락을 돕는 수준에서 멈춘다 |
| **입력 허들을 낮춘다** | UX 판단의 최우선 기준은 기록 편의성이다 |

---

## 2. 색상

### 브랜드 컬러

```css
--color-brand:       #fb8408;  /* 메인 브랜드 — amber orange */
--color-brand-light: #fff3e6;  /* 브랜드 배경, 뱃지 배경 */
--color-brand-dark:  #d46a00;  /* 호버, 눌림 상태 */
--gradient-brand: linear-gradient(to right, #fb8408 0%, #ffc940e8 100%); /* 주요 CTA 그라디언트 */
```

Tailwind 클래스: `bg-brand`, `text-brand`, `border-brand`, `bg-brand-light`, `bg-brand-dark`

그라디언트 사용: `style={{ backgroundImage: "var(--gradient-brand)" }}`
→ 랜딩 페이지 히어로 텍스트 하이라이트, 주요 CTA 버튼에 적용

---

### 그레이 스케일

| 토큰 | 헥스 | Tailwind 클래스 | 주 용도 |
|------|------|-----------------|---------|
| `gray-950` | `#191f28` | `text-gray-950` | 최고 강도 텍스트, 다크 섹션 배경 |
| `gray-800` | `#333d4b` | `text-gray-800` | 강조 텍스트 |
| `gray-700` | `#4e5968` | `text-gray-700` | 서브 텍스트 |
| `gray-500` | `#6b7684` | `text-gray-500` | Secondary 텍스트 |
| `gray-400` | `#8b95a1` | `text-gray-400` | Placeholder |
| `gray-300` | `#b0b8c1` | `text-gray-300` | Disabled, tertiary |
| `gray-200` | `#d1d6db` | `bg-gray-200` | Strong border |
| `gray-100` | `#e5e8eb` | `border-gray-100` | Default border |
| `gray-50`  | `#f2f4f6` | `bg-gray-50` | Tertiary surface |
| `gray-25`  | `#f9fafb` | `bg-gray-25` | Secondary surface |

---

### 시맨틱 컬러

직접 헥스를 쓰지 않는다. **반드시 시맨틱 토큰을 사용한다.**

> **예외 — 외부 소셜 로그인 브랜드 컬러**
> Kakao(`#FEE500`), Naver(`#03C75A`), Apple(흑/백), Google(흰 배경) 등 외부 서비스의 공식 브랜드 컬러는
> 해당 제공자의 아이덴티티 가이드라인을 따르므로 인라인 스타일·하드코딩 hex를 허용한다.
> 단, 앱 내부 컴포넌트의 컬러에는 절대 적용하지 않는다.

#### 텍스트

| 토큰 | Tailwind | 사용처 |
|------|----------|--------|
| `text-primary` | `text-text-primary` | 본문, 헤딩 — 기본값 |
| `text-secondary` | `text-text-secondary` | 설명, 서브 레이블 |
| `text-tertiary` | `text-text-tertiary` | Placeholder, 힌트 |
| `text-disabled` | `text-text-disabled` | 비활성 상태 |
| `text-on-brand` | `text-text-on-brand` | 브랜드 배경 위 텍스트 (흰색) |

#### 서피스

| 토큰 | Tailwind | 사용처 |
|------|----------|--------|
| `surface` | `bg-surface` | 기본 흰색 배경, 카드 |
| `surface-secondary` | `bg-surface-secondary` | 페이지 배경, 섹션 구분 |
| `surface-tertiary` | `bg-surface-tertiary` | 입력 비활성, 뱃지 배경 |
| `surface-brand` | `bg-surface-brand` | 브랜드 색조 배경 (매우 연한) |

#### 보더

| 토큰 | Tailwind | 사용처 |
|------|----------|--------|
| `border` | `border-border` | 기본 구분선 |
| `border-strong` | `border-border-strong` | 강조 구분선, 선택된 상태 |

#### 상태 색상

| 토큰 | 헥스 | Tailwind | 사용처 |
|------|------|----------|--------|
| `error` | `#f04452` | `text-error`, `bg-error` | 오류, 경고 메시지 |
| `success` | `#03b26c` | `text-success` | 완료, 체크 |
| `warning` | `#fe9800` | `text-warning` | 주의 사항 |
| `info` | `#3182f6` | `text-info` | 안내 메시지 (브랜드 컬러와 별도 유지) |

---

### 사용 원칙

```tsx
// ✅ 올바른 사용
<p className="text-text-secondary">설명 텍스트</p>
<div className="bg-surface border border-border rounded-lg">...</div>

// ❌ 잘못된 사용 — 하드코딩 금지
<p className="text-[#6b7684]">설명 텍스트</p>
<div className="bg-white border border-[#e5e8eb]">...</div>
```

---

## 3. 타이포그래피

### 폰트

**Apple SD Gothic Neo** (Apple 기기 시스템 폰트) + **Pretendard** (비 Apple 기기 fallback)

```
font-family: "Apple SD Gothic Neo", "Pretendard", -apple-system, BlinkMacSystemFont, "Malgun Gothic", sans-serif
```

Pretendard는 jsDelivr CDN dynamic subset으로 로드 (app/layout.tsx `<link>`).
Noto Sans KR 의존성은 제거됨.

```
400 Regular   — 본문, 설명
500 Medium    — 레이블, 강조 본문
600 Semibold  — 서브 헤딩, 버튼
700 Bold      — 헤딩, 디스플레이
```

---

### 스케일

`globals.css`에 정의된 유틸리티 클래스를 사용한다.

| 클래스 | 크기 | 웨이트 | 자간 | 용도 |
|--------|------|--------|------|------|
| `.text-display` | 48px | 700 | -0.02em | 랜딩 히어로 |
| `.text-heading-1` | 36px | 700 | -0.015em | 섹션 대제목 |
| `.text-heading-2` | 28px | 700 | -0.01em | 페이지 제목 |
| `.text-heading-3` | 22px | 600 | — | 카드 제목, 모달 제목 |
| `.text-title` | 18px | 600 | — | 리스트 항목 제목 |
| `.text-body-lg` | 17px | 400 | — | 중요 본문, 서브헤드 |
| `.text-body` | 15px | 400 | — | 기본 본문 **← 기본값** |
| `.text-body-sm` | 13px | 400 | — | 보조 설명 |
| `.text-label` | 13px | 500 | — | 폼 레이블, 탭 |
| `.text-caption` | 12px | 400 | — | 타임스탬프, 메타 정보 |

```tsx
// ✅ 유틸리티 클래스 사용
<h1 className="text-heading-1 text-text-primary">제목</h1>
<p className="text-body text-text-secondary">설명</p>

// ❌ 임의 사이즈 금지 (디자인 시스템 외 크기)
<h1 className="text-[40px] font-bold">제목</h1>
```

> **예외**: 랜딩 페이지 히어로처럼 임팩트가 필요한 경우에는 `text-[52px]` 등 임의 크기를 허용한다.
> 단, 앱 내부(대시보드, 폼 등) 에서는 반드시 스케일을 따른다.

---

## 4. 적응형 · 모바일

ARC는 **적응형 웹(Adaptive Web)** 을 기준으로 한다.
레이아웃이 유동적으로 변하는 반응형(Responsive)과 달리, 각 브레이크포인트에서 미리 정의된 고정 레이아웃으로 **스냅**된다.

### 브레이크포인트

| 접두사 | 기준 너비 | 대상 기기 |
|--------|-----------|-----------|
| (없음) | 0px~ | 모바일 |
| `sm:` | 640px~ | 태블릿·소형 |
| `md:` | 768px~ | 태블릿 가로 |
| `lg:` | 1024px~ | 데스크톱 |
| `xl:` | 1280px~ | 와이드 |

### 모바일 카드 처리

모바일에서 **카드 컨테이너(border, rounded, shadow)는 제거**한다. 콘텐츠만 전체 너비로 표시되며, 데스크톱에서 카드 형태로 전환된다.

```tsx
// ✅ 적응형 카드 — 모바일: 플랫 / 데스크톱: 카드
<div className="w-full max-w-lg">
  <div className="sm:bg-surface sm:border sm:border-border sm:rounded-xl sm:shadow-sm px-0 py-0 sm:px-10 sm:py-10">
    ...
  </div>
</div>
```

### 콘텐츠 너비

```tsx
// ✅ 모바일·데스크톱 모두 최대 너비 제한 + 가운데 정렬
<div className="w-full max-w-lg">
```

유동적인 `%` 너비 대신 `max-w-*` 고정 상한을 사용한다.

### 그리드

그리드 열 수는 브레이크포인트마다 고정값으로 지정한다. 열 수가 유동적으로 변하지 않도록 한다.

```tsx
// ✅ 적응형 — 각 breakpoint에서 고정 열 수
<div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4">
```

### 텍스트 적응

버튼 안 텍스트가 모바일에서 두 줄로 깨질 경우, **그리드 구조는 유지**하고 브레이크포인트별 텍스트를 분리한다.

```tsx
// ✅ 모바일: 짧은 텍스트 / 데스크톱: 전체 텍스트
<span className="sm:hidden">Google</span>
<span className="hidden sm:inline">Google로 계속하기</span>
```

### 터치 타겟

모바일에서 탭 가능한 요소의 최소 높이는 **48px** (`h-12`). 버튼, 입력, 선택 요소 모두 이 기준을 따른다.

---

## 5. 간격 · 레이아웃

### 콘텐츠 최대 너비

```tsx
<div className="max-w-5xl mx-auto px-6">  {/* 1024px — 기본 페이지 */}
<div className="max-w-3xl mx-auto px-6">  {/* 768px — 좁은 폼, 글 */}
<div className="max-w-2xl mx-auto px-6">  {/* 672px — 모달, CTA */}
```

### 섹션 패딩

```tsx
// 페이지 섹션 간격
<section className="py-24 px-6">   {/* 일반 섹션 */}
<section className="py-20 px-6">   {/* 조금 좁은 섹션 */}
<section className="py-32 px-6">   {/* CTA 등 강조 섹션 */}
```

### 컴포넌트 내부 간격

| 용도 | 값 | Tailwind |
|------|----|----------|
| 카드 패딩 (기본) | 20px | `p-5` |
| 카드 패딩 (넓은) | 24px | `p-6` |
| 리스트 아이템 | 12px 수직 | `py-3` |
| 인라인 요소 간격 | 8–12px | `gap-2`, `gap-3` |
| 폼 필드 간격 | 16–24px | `gap-4`, `gap-6` |

---

## 5. Border Radius

| 토큰 | 값 | Tailwind | 사용처 |
|------|-----|----------|--------|
| `xs` | 4px | `rounded-xs` | 뱃지(소형), 코드 블록 |
| `sm` | 8px | `rounded-sm` | 버튼(small), 태그 |
| `md` | 12px | `rounded-md` | 버튼(기본), 입력, 드롭다운 |
| `lg` | 16px | `rounded-lg` | 카드, 패널 **← 카드 기본값** |
| `xl` | 20px | `rounded-xl` | 버튼(large), 모달 |
| `2xl` | 24px | `rounded-2xl` | 큰 카드, 시트 |
| `full` | 9999px | `rounded-full` | 알약형 뱃지, 아바타 |

---

## 6. Shadow

그림자는 **절제해서** 사용한다. 평면 카드에는 `border`를 우선 사용하고, 떠있는 요소(드롭다운, 모달, 호버 상태)에만 shadow를 적용한다.

| 토큰 | 값 | Tailwind | 사용처 |
|------|-----|----------|--------|
| `xs` | `0 1px 2px rgba(0,0,0,0.04)` | `shadow-xs` | 입력 포커스 링 보조 |
| `sm` | `0 2px 6px rgba(0,0,0,0.06)` | `shadow-sm` | 기본 카드 elevation |
| `md` | `0 4px 12px rgba(0,0,0,0.08)` | `shadow-md` | 호버된 카드, 드롭다운 |
| `lg` | `0 8px 24px rgba(0,0,0,0.10)` | `shadow-lg` | 모달, 팝오버 |
| `xl` | `0 16px 48px rgba(0,0,0,0.12)` | `shadow-xl` | 풀스크린 오버레이 |

```tsx
// ✅ 기본 카드 — border 사용
<div className="bg-surface border border-border rounded-lg p-5">

// ✅ 호버 시 shadow 전환
<motion.div
  className="bg-surface border border-border rounded-lg"
  whileHover={{ y: -4, boxShadow: "0 12px 32px rgba(0,0,0,0.10)" }}
/>

// ❌ 모든 카드에 shadow 남용 금지
<div className="shadow-lg rounded-lg">
```

---

## 7. 컴포넌트

### Button

`components/ui/button.tsx`

```tsx
import { Button } from "@/components/ui/button";

// Variants
<Button variant="primary">Primary</Button>       // 브랜드 배경
<Button variant="secondary">Secondary</Button>   // 회색 배경
<Button variant="ghost">Ghost</Button>           // 투명 배경
<Button variant="destructive">삭제</Button>      // 빨간 배경

// Sizes
<Button size="sm">Small</Button>    // h-9, 13px
<Button size="md">Medium</Button>   // h-11, 15px ← 기본값
<Button size="lg">Large</Button>    // h-14, 17px

// Full width
<Button fullWidth>전체 너비</Button>
```

#### 사용 원칙

- 한 화면에 **Primary 버튼은 1개**만. 여러 개 필요하면 나머지는 `secondary` 또는 `ghost`.
- 폼 제출, 주요 CTA → `primary`
- 취소, 보조 액션 → `secondary` 또는 `ghost`
- 삭제, 되돌릴 수 없는 액션 → `destructive`

---

### Card

`components/ui/card.tsx`

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";

// Variants
<Card variant="default">   // 흰 배경 + 기본 border ← 기본값
<Card variant="bordered">  // 흰 배경 + 강한 border
<Card variant="elevated">  // 흰 배경 + shadow-md
<Card variant="filled">    // surface-secondary 배경

// Padding
<Card padding="none">   // 패딩 없음 (이미지 카드 등)
<Card padding="sm">     // p-4
<Card padding="md">     // p-5 ← 기본값
<Card padding="lg">     // p-6
```

#### 서브컴포넌트

```tsx
<Card>
  <CardHeader>
    <CardTitle>제목</CardTitle>
    <CardDescription>설명</CardDescription>
  </CardHeader>
  <p className="text-body text-text-secondary">본문</p>
  <CardFooter className="justify-between">
    <Badge>태그</Badge>
    <Button size="sm">액션</Button>
  </CardFooter>
</Card>
```

---

### Input

`components/ui/input.tsx`

```tsx
import { Input } from "@/components/ui/input";

// 기본
<Input label="이메일" placeholder="example@email.com" />

// 힌트
<Input label="비밀번호" hint="8자 이상 입력하세요" type="password" />

// 에러
<Input label="이름" error="이름을 입력해주세요" />

// 비활성
<Input label="아이디" disabled />
```

- 항상 `label`을 제공한다. 공간이 없으면 `aria-label`을 사용한다.
- 에러 메시지는 간결하게 — 무엇이 잘못됐는지 한 문장으로.

---

### Textarea

`components/ui/textarea.tsx`

```tsx
import { Textarea } from "@/components/ui/textarea";

// 기본
<Textarea label="활동 설명" placeholder="내용을 입력하세요" />

// 힌트
<Textarea
  label="배운 점"
  placeholder="이 활동을 통해 무엇을 배웠나요?"
  hint="구체적으로 작성할수록 AI 분석 품질이 높아집니다."
/>

// 에러
<Textarea label="자기소개" error="내용을 입력해주세요." />

// 비활성
<Textarea label="비고" disabled />

// 높이 조정 (className으로 min-h 오버라이드)
<Textarea label="상세 설명" className="min-h-[200px]" />
```

- 입력 내용에 따라 **자동으로 높이가 늘어난다** (auto-resize). 수동 리사이즈는 비활성화.
- 초기 높이는 한 줄(`min-h-[48px]`), `defaultValue`가 있으면 마운트 시 맞춰 확장된다.
- Input과 동일한 레이블·힌트·에러 구조를 따른다.
- 초기 높이를 더 크게 시작하고 싶으면 `className="min-h-[120px]"` 으로 오버라이드한다.

---

### Badge

`components/ui/badge.tsx`

```tsx
import { Badge } from "@/components/ui/badge";

<Badge variant="default">기본</Badge>    // 회색 배경
<Badge variant="brand">브랜드</Badge>   // 브랜드 연한 배경
<Badge variant="success">완료</Badge>
<Badge variant="warning">검토 중</Badge>
<Badge variant="error">오류</Badge>
<Badge variant="outline">아웃라인</Badge>
```

- 활동 유형, 상태 표시 등에 사용한다.
- 텍스트는 **2–6자** 이내로 짧게 유지한다.

---

## 8. 애니메이션

### 원칙

- **입장 애니메이션만** 사용한다. 사라지는 애니메이션은 최소화.
- `once: true` — 한 번 나타난 요소는 다시 숨기지 않는다.
- 지연(delay)은 **연속된 요소**에만 사용하고, 최대 `0.4s`를 넘지 않는다.
- 모션이 불편한 사용자를 위해 추후 `prefers-reduced-motion` 대응을 추가한다.

### Reveal 컴포넌트 (스크롤 진입 애니메이션)

```tsx
// 스크롤 진입 시 fade + slide-up
<Reveal delay={0}>
  <h2>섹션 제목</h2>
</Reveal>

// 연속 요소에 stagger
{items.map((item, i) => (
  <Reveal key={item.id} delay={i * 0.1}>
    <Card>...</Card>
  </Reveal>
))}
```

### 호버 인터랙션

```tsx
// 카드 호버 — y:-4 + shadow 강화
<motion.div
  whileHover={{ y: -4, boxShadow: "0 12px 32px rgba(0,0,0,0.10)" }}
  transition={{ duration: 0.2 }}
>

// 버튼 — CSS transition만 사용 (framer 불필요)
className="hover:bg-brand-dark transition-colors"
```

### Easing

```tsx
// 표준 easing — 자연스러운 감속
ease: [0.22, 1, 0.36, 1] as [number, number, number, number]
// duration: 0.5–0.7s

// 빠른 피드백 (hover, 버튼)
// CSS: transition-colors duration-150
```

### 사용 금지

- ❌ 페이지 전환 시 무거운 애니메이션
- ❌ 반복(loop) 애니메이션
- ❌ 텍스트 자체에 직접 애니메이션
- ❌ `duration > 0.8s`

---

## 9. 아이콘

> 현재 아이콘 라이브러리 미결정. 추후 `lucide-react` 또는 커스텀 SVG로 확정 예정.

임시 방편으로 이모지를 사용하는 경우:
- 유저 대면 UI에서는 **의미 전달**이 명확한 경우만
- 장식용 이모지는 지양한다

---

## 10. 해야 할 것 · 하지 말아야 할 것

### ✅ 해야 할 것

```tsx
// 시맨틱 색상 토큰 사용
className="text-text-primary bg-surface border-border"

// 정의된 타이포그래피 클래스 사용
className="text-heading-2 text-text-primary"

// 컴포넌트 재사용
import { Button, Card, Input, Badge } from "@/components/ui"

// 여백을 충분히
className="py-24 px-6"

// 반응형 고려
className="grid grid-cols-1 sm:grid-cols-2"
```

### ❌ 하지 말아야 할 것

```tsx
// 하드코딩된 색상
className="text-[#333]"
style={{ color: "#6b7684" }}

// 임의 크기 남용 (앱 내부)
className="text-[14px] text-[16px]"

// 과도한 그림자
className="shadow-2xl shadow-blue-500/50"

// 과도한 그라디언트
background: "linear-gradient(135deg, #ff6b6b, #ffd93d, #6bcb77)"

// Primary 버튼 여러 개
<Button variant="primary">저장</Button>
<Button variant="primary">공유</Button>  // ❌ 하나만

// 직접 margin으로 간격 조정
className="mt-[13px]"  // Tailwind 기본 스케일 사용
```

---

## 브랜드 컬러 교체 방법

테마 컬러가 확정되면 `app/globals.css`의 `:root` 세 줄만 교체하면 전체에 반영된다.

```css
/* app/globals.css */
:root {
  --color-brand:       #XXXXXX;  /* 메인 */
  --color-brand-light: #XXXXXX;  /* 연한 배경용 (메인의 10% 투명도 느낌) */
  --color-brand-dark:  #XXXXXX;  /* 호버용 (메인보다 10–15% 어둡게) */
}
```

---

*최종 수정: 2025-03-21*
