---
name: git-workflow
description: ARC Git 브랜치 전략 및 커밋 규칙. 브랜치 생성, 커밋 메세지 작성, PR 준비, 머지 작업 시 자동 로드. "커밋할게요", "브랜치 만들어", "PR 올려", "푸시" 등 Git 관련 작업이면 항상 참고한다.
user-invocable: false
---

Git 작업 전 아래 규칙을 반드시 따른다.

## 🌳 브랜치 전략 (2단계 통합)

```
feat/* · fix/* ...  ──PR──▶  dev  ──(실사용 테스트/검증 후)──▶  main
```

- **모든 개발은 `dev`에서 브랜치를 따고, `dev`로 머지한다.**
- `dev`에 모인 변경을 실사용 테스트/검증한 뒤, `dev` → `main`으로 머지한다.
- 따라서 일반 작업의 PR base는 **`main`이 아니라 `dev`**다.

```bash
# 작업 시작 (항상 dev 기준)
git checkout dev && git pull origin dev
git checkout -b feat/archive-input-form
```

## ⛔ 절대 금지

```bash
# main · dev 브랜치 직접 커밋/푸시 금지
git commit -m "..."   # main, dev에서 직접 실행 금지
git push origin main  # 직접 푸시 금지
git push origin dev   # 직접 푸시 금지 (PR로만 머지)
```

작업 시작 전 항상 현재 브랜치를 확인한다: `git branch`

---

## 브랜치 네이밍

```
feat/기능명        새 기능 개발
fix/버그명         버그 수정
docs/문서명        문서 작업
refactor/대상      코드 리팩토링
chore/작업명       설정, 의존성 등
hotfix/이슈명      긴급 수정
```

**규칙**: 영문 소문자, 하이픈 구분
```bash
# 작업 시작 (dev에서 분기)
git checkout dev && git pull origin dev
git checkout -b feat/archive-input-form
```

---

## 커밋 메세지 — Gitmoji + 한 줄 요약

형식: `<gitmoji> <동사> <무엇을>` (50자 이내)

| Gitmoji | 용도 |
|---------|------|
| ✨ | 새 기능 추가 |
| 🐛 | 버그 수정 |
| ♻️ | 리팩토링 |
| 📝 | 문서 작성/수정 |
| 🎨 | UI/스타일 개선 |
| 🔧 | 설정 파일 수정 |
| 📦 | 의존성 추가/업데이트 |
| 🚀 | 배포 관련 |
| 💄 | CSS/스타일시트 |
| 🗑️ | 코드/파일 삭제 |
| ⚡ | 성능 개선 |
| 🚑 | 긴급 수정 |

```bash
# 예시
✨ 커리어 아카이브 입력 폼 구현
🐛 대시보드 키워드 차트 렌더링 오류 수정
♻️ archive 컴포넌트 구조 리팩토링
🎨 랜딩 페이지 히어로 섹션 스타일 개선
```

**Atomic 커밋 원칙**: 하나의 커밋 = 하나의 논리적 변경
```bash
# ❌
✨ 로그인 기능 + 회원가입 버그 수정 + CSS 정리

# ✅ 세 개의 별도 커밋으로 분리
```

---

## PR 흐름

```bash
git push origin feat/archive-input-form
# GitHub에서 PR 생성 (base: dev) → 리뷰 → dev로 merge → 브랜치 삭제
# dev 실사용 검증 후 별도로 dev → main PR 진행
```

PR 본문 템플릿:
```markdown
## 📝 작업 내용

## 📷 스크린샷

<img src="" width="20%" />

## 💬 리뷰 요구사항

## 📢 메모

## ✅ PR Checklist

PR이 다음 요구 사항을 충족하는지 확인하세요.

- [ ] 커밋 메시지 컨벤션에 맞게 작성했습니다.
- [ ] `dev`에서 분기한 별도 브랜치에서 작업했고, PR base가 `dev`입니다.
- [ ] 변경 사항에 대한 테스트를 했습니다. (버그 수정 / 기능에 대한 테스트)
```