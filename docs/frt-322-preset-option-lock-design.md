# FRT-322 — 템플릿 드롭다운의 옵션 편집을 막고, '기타'에 직접 입력을 연다

> 설계 확정본. 2026-08-18 · Linear [FRT-322](https://linear.app/story-arc/issue/FRT-322)

## 왜 하는가

경험 입력 폼의 **모든** 드롭다운(`single-select`) 밑에 "옵션 편집" 토글이 붙어 있다
(`components/features/archive/blocks/SingleSelectBlock.tsx`). 열면 프리셋 항목을 이름
바꾸기·삭제·추가할 수 있다 — 기획 확정본이 정한 36개 템플릿 필드(공개 설정, 성적, 자격증
분야 …)까지 사용자가 마음대로 고칠 수 있는 상태다.

회의에서 이 기능은 템플릿 기본 필드에 필요 없다고 결정됐다. 노션 피드백의 문장이 처방까지
같이 적어 뒀다: *"혹시 모든 드롭다운 선택지 하단에 편집 기능이 있는 건가요? 이거 그냥 기타
옵션 선택하면 텍스트로 고를 수 있게 해주는 게 가장 일관성 있을 것 같습니다잉"*

**끝난 뒤 사용자가 겪는 것** — 템플릿 드롭다운에는 편집 UI가 없다. 대신 프리셋에 '기타'가
있는 필드에서 '기타'를 고르면 그 자리에서 직접 입력할 수 있다. 자기가 만든 커스텀 블록의
드롭다운은 지금과 똑같이 옵션을 고칠 수 있다.

## 조사에서 드러난 사실 (설계를 바꾼 것들)

1. **템플릿에 순수 체크리스트 필드는 없다.** `createChecklistField` 사용처 0개 — 템플릿의
   체크리스트형 필드 12개는 전부 `createMoodTagField`(`variant: 'mood-tag'`)다. `MoodTagBlock`은
   이미 옵션 추가·삭제 UI가 없고, `allowCustomTag` 필드별 opt-in 자유 추가까지 있다(FRT-177·320).
   → 체크리스트 쪽은 **폴백 경로만** 손대면 된다.
2. **'기타' 선택지는 이미 15개 필드에 있다.** 진짜 결함은 '기타'가 없는 게 아니라 **'기타'를
   눌러도 아무 일이 안 일어나는 것**이었다.
3. **"커스텀 블록인가"는 이미 코드가 안다.** `BlockList`의 `editEnabled`(`allowEdit ?? allowAdd`)가
   그 판정이다. 템플릿 카드는 꺼져 있고(연필도 안 뜬다), 사용자 섹션·레거시 '기타' 섹션은 켜져
   있다. 새 휴리스틱(`block.key` 유무 추정 등)을 만들 필요가 없다.

## 설계

### 1) 옵션 편집 차단 — 기존 구분을 그대로 전파한다

`BlockList`의 `editEnabled` → `BlockRenderer` → `SingleSelectBlock`·`ChecklistBlock`으로
`allowOptionEdit` prop을 내린다. **기본값은 닫힘**(prop 미지정 = 편집 불가) — 새 소비처가
실수로 여는 쪽이 아니라 실수로 닫는 쪽이 안전하다.

- 템플릿 카드 → 인라인 "옵션 편집" 토글 자체가 사라진다.
- 사용자 섹션·레거시 '기타' 섹션의 커스텀 블록 → 지금 그대로(인라인 편집 + 연필 모달).
- `readOnly`(상세 뷰)는 무관 — 애초에 편집 UI를 안 그린다.

`BlockRenderer`는 블록 컴포넌트들의 **유일한 프로덕션 진입점**이므로(FRT-200 주석) 전파
지점은 이 한 곳뿐이다.

### 2) 저장된 값은 숨지 않는다 — 표시 목록을 합집합으로

편집을 막으면 **이미 프리셋을 고쳐 저장한 사람이 되돌릴 수단을 잃는다.** 지금 코드는

```ts
const options = val.options.length > 0 ? val.options : (block.options ?? [])
```

저장 옵션이 하나라도 있으면 템플릿 프리셋을 **통째로 덮는다**. 과거에 옵션을 지운 사용자는
그 필드가 영구히 반쪽인 채 굳고, 프리셋이 개편돼 `selected`만 고아가 된 값은 드롭다운에서
사라진다(값은 저장돼 있는데 화면에서 안 보인다).

표시 목록을 **`block.options`(템플릿 프리셋) ∪ `val.options`(저장 옵션) ∪ `{val.selected}`**
합집합으로 바꾼다. 순서는 프리셋 우선, 그 뒤에 저장에만 있던 값. `MoodTagBlock.moodTagOptions()`가
쓰는 "checked에만 남은 값도 뒤에 붙인다" 규약과 같은 처방이며, 저장 shape은 건드리지 않는다.

⚠️ 이 보정은 **표시 전용**이다. `onChange`가 나갈 때 `options`를 합집합으로 굳혀 쓰지 않는다 —
굳히면 다음 템플릿 개편이 그 필드에 닿지 못한다.

### 3) '기타' → 직접 입력 (필드별 opt-in)

`Block.allowOther?: boolean`을 추가한다. `variant`·`allowCustomTag`·`quickPick`과 **같은
규약**: 템플릿 정의에만 살고 value(JSONB)에는 직렬화되지 않으며, 로드 시 레지스트리에서
재공급된다. 끈 블록에는 키를 남기지 않는다(템플릿 스냅샷 `toEqual` 잡음 방지).

동작:

- 켜진 필드에서 `'기타'`를 고르면 드롭다운 아래 텍스트 입력이 열린다.
- 입력한 값은 **`selected`에 원문 그대로** 저장된다 — `"기타"`가 아니라 `"5학점"`.
  새 값 필드를 만들지 않으므로 `build-portfolio.ts`의 `"공개 설정"` 문자열 조회, 백엔드 분석,
  레쥬메·포트폴리오 소비처가 전부 무변경이다(FRT-178 교훈: 저장은 id가 아니라 이름).
- 다시 열 때 `selected`가 프리셋에 없는 값이면 자동으로 '기타' 모드로 복원한다
  (드롭다운은 '기타' 선택 표시, 텍스트칸에 원문). 이 경우 §2의 "뒤에 붙이기"는 하지 않는다 —
  같은 값이 목록과 텍스트칸에 두 번 나오면 어느 쪽이 진짜인지 알 수 없다.
- 텍스트칸을 비우면 `selected`는 `""`(미선택)이 된다. required 필드는 기존 검증이 그대로 잡는다.
- 옵션 목록에 `'기타'`가 없는데 플래그만 켜져 있으면 **아무 일도 하지 않는다**(폴백) —
  모르는 상태에서 UI가 열려 값을 덮는 일이 없어야 한다.

`'기타'` 라벨은 상수 하나(`OTHER_OPTION_LABEL`)로 모은다. 라벨 문자열로 동작을 파생시키지
않고 플래그로 명시 opt-in 하는 것은 FRT-320 교훈("공유 조립기 확장은 파생 규칙 말고 명시
opt-in")을 따른 것이다.

### 4) 켤 필드 — 이미 '기타'가 있는 15개

확정본(기획 산출물) 옵션 목록은 **건드리지 않는다.** '기타'가 없는 21개 필드(공개 설정·성적·
학기·개인/팀·별점·난이도·목표 수준·학위 과정·서비스 운영 상태·근무 형태·활동 규모·수업 분류 등)는
그대로 둔다. 추가가 필요하다고 판단되면 기획 확정 후 후속 이슈에서 넣는다.

| 유형 | 필드 |
|---|---|
| 수업 | 학점 |
| 대외활동 | 활동 유형 |
| 동아리 | 단체 유형, 소속 단위 |
| 수상경력 | 대회 유형 |
| 자격증 | 자격증 분야 |
| 어학 | 언어 |
| 연구논문 | 유형, 역할 / 기여도 |
| 프로젝트 | 프로젝트 유형 |
| 봉사 | 봉사 분야 |
| 해외경험 | 경험 유형 |
| 창작물 | 유형 / 매체 |
| 독서 | 장르 / 분야 |
| 목표 | 목표 유형 |

## 건드리는 파일

- `types/archive.ts` — `Block.allowOther` 추가(주석에 opt-in 규약 명시)
- `lib/utils/block-utils.ts` — `createSelectField` opts에 `allowOther` 통과(`withQuickPick`과 같은 꼴)
- `components/features/archive/blocks/SingleSelectBlock.tsx` — `allowOptionEdit` prop, 합집합
  표시 목록, '기타' 직접 입력
- `components/features/archive/blocks/ChecklistBlock.tsx` — `allowOptionEdit` prop
- `components/features/archive/blocks/BlockRenderer.tsx` · `BlockList.tsx` — prop 전파
- `lib/constants/templates-v2.ts` — 15개 필드에 `allowOther: true`

## 검증

`docs/frontend-testing.md`의 전략 매트릭스를 따른다. 표시 목록 합집합·'기타' 판정은 순수
로직이므로 **TDD 의무** 구간이다.

**유닛/컴포넌트 (Vitest)**

- 템플릿 블록(`allowOptionEdit` 미지정)에는 "옵션 편집" 버튼이 **없다**
- 커스텀 블록(`allowOptionEdit`)에는 지금과 똑같이 편집·추가·삭제가 된다 — 기존
  `SingleSelectBlock.test.tsx`의 편집 케이스를 이쪽으로 옮긴다
- 저장 옵션이 프리셋의 부분집합이어도 프리셋 전체가 다시 보인다(과거에 지운 값 복원)
- `selected`가 프리셋 밖인데 `allowOther`가 꺼져 있으면 목록 끝에 붙어 보인다
- `allowOther` + '기타' 선택 → 텍스트 입력이 열리고, 입력값이 `selected`에 **원문**으로 나간다
- `allowOther`인데 저장값이 프리셋 밖 → '기타' 모드로 복원되고 텍스트칸에 원문이 들어 있다
- `allowOther`인데 옵션에 '기타'가 없으면 UI가 열리지 않는다
- `ChecklistBlock`도 같은 두 상태
- 템플릿 스냅샷: `allowOther`를 끈 블록에 키가 남지 않는다

**Storybook** — `SingleSelectBlock` 열림/닫힘, '기타' 입력 상태 스토리

**Playwright/수동** — 경험 입력 폼에서 자격증 '자격증 분야' → '기타' → 직접 입력 → 저장 →
상세 뷰에서 입력한 원문이 보이는지 왕복 확인. UI 갤러리(`ui-preview`)로 전/후 발행.

**4게이트** — `validate` 스킬(lint → typecheck → test:unit → build).

## 범위 밖

- '기타'가 없는 필드에 '기타' 선택지를 **새로 추가**하는 것 (기획 확정 필요 → 후속 이슈)
- 노션 코멘트가 함께 던진 *"지금 당장 공개 설정이 어디에 활용되는지"* — 공개 설정 필드의
  존치 여부는 별개 결정이다. (참고: `lib/portfolio/build-portfolio.ts:75`가 이 값이 정확히
  `"공개"`일 때만 포트폴리오에 싣는다 — 죽은 필드는 아니다.)
- `RepeatableCellBlock` 셀 안의 `single-select`·`checklist` 열 — 애초에 옵션 편집 UI가 없다
