# 캠페인 피드백 API 계약 (정본)

> 대상: BAC-34(저장·POST) · BAC-35(status 조회) · FRT-91~96
> 상태: **프론트 확정안** — 백엔드 착수 전 이견이 있으면 이 문서를 고치고 알려주세요.
> 최종 갱신: 2026-07-17

## 왜 이 문서가 있나

FRT-116/117에서 프론트가 **실재하지 않는 백엔드 계약을 가정**해, 레쥬메 목록이 항상 비고 생성 성공을 실패로 오인해 중복 POST를 쏘는 사고가 났다. 원인은 "구현 후 계약 확인"이었다.

이번엔 순서를 뒤집는다. `arc-backend@dev`에는 `feedback` 관련 코드가 **한 줄도 없다**(58개 파이썬 파일 grep 0건, 2026-07-17 원격 dev 직독 확인). 백지 상태이므로 프론트가 계약을 먼저 확정해 넘기고, 양쪽이 같은 문서를 본다.

이 문서가 계약의 정본이다. BAC-34/35 이슈 본문과 어긋나면 **이 문서가 이긴다**.

## 기능 요약

분석 완료 또는 경험 3개 도달 시(**먼저 오는 것**) **1회** 노출되는 인앱 피드백 모달. 별점 5점 + 점수와 무관하게 항상 열리는 자유텍스트 한 줄. 목적지는 PostHog(흐름 분석)와 서버(영구 저장·dedup) 병행.

**범위 밖**: 분석 결과별 👍👎(BAC-39·FRT-106)는 이름만 "피드백"일 뿐 별개 도메인이고 **별도 테이블**이다. 이 문서와 무관하다.

## BAC-34/35 본문 대비 정정 3건 (중요)

이슈 본문에 적힌 계약을 그대로 구현하면 프론트가 깨진다. 아래 셋은 `arc-backend@dev`의 실제 컨벤션을 직독해 바로잡은 것이다.

### ① 응답 래핑 누락 → 전 응답 `{status, message, data}` 래핑

BAC-35 본문은 `200 { "hasSeen": boolean, "hasResponded": boolean }`로 적혀 있다. 그러나 이 백엔드의 모든 응답은 `app/src/api/models/base.py`의 `SuccessResponseWithData[T]`로 래핑된다:

```python
class SuccessResponse(BaseModel):
    status: str = "success"
    message: str

class SuccessResponseWithData(SuccessResponse, Generic[T]):
    data: T
```

프론트도 `types/api.ts`의 `ApiSuccessResponse<T> = {status, message, data}`를 전제하고 `.data`를 벗긴다. 이슈대로 구현하면 프론트가 `.data`에서 `undefined`를 만난다 — **FRT-117과 정확히 같은 실패 모드**다.

### ② 필드 표기 혼재 → snake_case 로 통일

BAC-35는 `hasSeen`(camel), BAC-34 스키마는 `trigger_source`(snake)로 섞여 있다. 이 백엔드의 실제 응답 필드는 snake다(`created_at`, `count`/`contents` — FRT-116 조사에서 확인). **API 경계는 snake로 통일**하고, 프론트가 `lib/api/feedback-api.ts`에서 camel로 매핑한다.

### ③ conflict 를 409 대신 `200 + data.created: boolean` 으로

BAC-34는 "conflict(이미 노출)면 프론트는 모달을 띄우지 않음"이라 했다. 그러나 409로 던지면:

- 프론트가 `ApiError` 예외 흐름을 타야 한다. `.claude/rules/api.md`는 "응답은 방어 파싱(throw 대신 안전 분기)"을 요구한다.
- `ErrorResponseCode`(`app/src/enums.py`)가 **닫힌 enum**이라 새 코드를 추가해야 한다.
- "이미 노출됨"은 오류가 아니라 **정상적인 정상 경로**다.

→ 항상 200, 바디의 `data.created`로 구분한다.

## 엔드포인트 계약 (확정)

라우터는 `app/src/api/feedback.py` 신설, `main.py`에 `app.include_router(feedback_router, prefix="/feedback")`. 인증은 기존 패턴 그대로 `payload: Annotated[AccessTokenPayload, Depends(check_auth)]`이며 `payload.sub`가 user id(UUID). 프론트는 쿠키(`credentials: "include"`)로 붙으므로 추가 작업이 없다.

### 1. 노출 기록 (dedup 의 핵심)

```
POST /feedback/campaigns/{campaign_id}/prompt-shown

body   { "trigger_source": "analysis_completed" | "experience_threshold" }

200    { "status": "success", "message": "...",
         "data": { "created": true } }

       created=true  → 이번에 노출 행이 생성됨 → 프론트가 모달을 띄운다
       created=false → 이미 노출된 적 있음    → 프론트는 띄우지 않는다
```

구현: `INSERT ... ON CONFLICT (user_id, campaign_id) DO NOTHING` 후 rowcount로 `created` 판정. **원자적 dedup이라 레이스에 안전**하다(SELECT 후 INSERT는 두 탭이 동시에 통과할 수 있어 쓰지 않는다).

> ⚠️ 이 코드베이스에 `ON CONFLICT DO NOTHING` 선례가 없다. SQLAlchemy에서는 `from sqlalchemy.dialects.postgresql import insert` 후 `.on_conflict_do_nothing(index_elements=["user_id","campaign_id"])`. 구현이 곤란하면 알려달라 — 계약을 조정할 수 있다.

### 2. 응답 저장

```
POST /feedback/campaigns/{campaign_id}/responses

body   { "rating": 1..5          (필수),
         "comment": string|null  (선택),
         "context": {...}|null   (선택) }

200    { "status": "success", "message": "...",
         "data": { "responded_at": "2026-07-17T06:12:00Z" } }
```

구현: `UPDATE ... SET rating, comment, responded_at=now() WHERE user_id AND campaign_id`. 정상 흐름에서는 `prompt-shown`이 먼저 불려 행이 있지만, **행이 없으면 방어적으로 upsert**한다(노출 기록이 유실돼도 응답은 잃지 않는다).

`context`에 실리는 값(프론트 화이트리스트): `analysis_id`, `analysis_type`. `analysis_type`은 `"comprehensive" | "keyword"` 둘뿐이다 — 개별(individual) 분석은 기록 저장 시 백엔드가 자동 생성해 프론트에 완료 관측 지점이 없으므로 트리거가 될 수 없다.

### 3. 상태 조회

```
GET /feedback/campaigns/{campaign_id}/status

200    { "status": "success", "message": "...",
         "data": { "has_seen": bool, "has_responded": bool } }
```

- `has_seen` = 노출 행 존재 여부. **dedup 기준은 이것**이다.
- `has_responded` = rating 이 채워졌는지. 집계·분석용 보조 신호.

**왜 응답이 아니라 노출이 기준인가**: 응답 기준이면 모달을 그냥 닫은 사용자는 서버에 기록이 없어 다음 방문에 또 뜬다. 노출을 기록해야 "닫으면 다시 안 뜬다"가 크로스 기기로 성립한다.

### 상태 전이

| 시점 | `has_seen` | `has_responded` | `rating` | `responded_at` |
|---|---|---|---|---|
| 노출 전 | false | false | — (행 없음) | — |
| `prompt-shown` 후 | true | false | NULL | NULL |
| `responses` 후 | true | true | 1~5 | 채워짐 |
| 닫기(미응답) | true | false | NULL | NULL |

마지막 행이 중요하다 — **미응답 이탈은 `has_seen=true` + `responded_at=NULL`로 식별**된다. 노출 대비 응답률을 여기서 뽑는다.

## 테이블 `feedback_responses`

BAC-34의 스키마를 유지하되 `app/src/db/models.py`의 기존 컨벤션(`AnalysisBookmark` 참고)으로 표현한다.

```python
class FeedbackResponse(SQLModel, table=True):
    __tablename__: str = "feedback_responses"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, sa_type=SAUUID)
    user_id: uuid.UUID = Field(foreign_key="users.id", sa_type=SAUUID, index=True)
    campaign_id: str = Field(nullable=False)
    trigger_source: FeedbackTriggerSource = Field(nullable=True)   # 어느 게이트로 떴는지
    shown_at: datetime = Field(sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False))
    rating: int | None = Field(default=None, nullable=True)        # 미응답이면 NULL
    comment: str | None = Field(default=None, nullable=True)       # PII 금지
    responded_at: datetime | None = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    context: dict[str, Any] | None = Field(default=None, sa_column=Column(JSONB, nullable=True))
    created_at: datetime = Field(default_factory=now, sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False))
    updated_at: datetime = Field(default_factory=now, sa_column=Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False))

    __table_args__ = (
        UniqueConstraint("user_id", "campaign_id", name="uq_feedback_user_campaign"),
        CheckConstraint("rating BETWEEN 1 AND 5", name="ck_feedback_rating_range"),
    )
```

`FeedbackTriggerSource`는 `app/src/enums.py`에 새로 추가한다(`AnalysisType`과 같은 `str, enum.Enum` 스타일):

```python
class FeedbackTriggerSource(str, enum.Enum):
    analysis_completed = "analysis_completed"
    experience_threshold = "experience_threshold"
```

주의할 점:

- **3개 테이블이 아니라 1개**다. "노출 유무"=행 존재, "노출 시점"=`shown_at`, "평점+서술"=같은 행의 nullable 컬럼.
- `UNIQUE(user_id, campaign_id)`가 dedup을 DB 레벨에서 보장한다. **기존 모델에 복합 유니크 제약 선례가 없으므로** `__table_args__` 명시가 필요하다.
- `ondelete=`는 이 코드베이스에 사용 사례가 전무하므로 기존 컨벤션대로 생략한다(`user_id` FK만).

마이그레이션은 기존 절차대로: `scripts/revision.sh "add feedback responses table"` → autogenerate → 수동 검토 → `alembic upgrade head`. 파일명은 `<hash>_add_feedback_responses_table.py`.

## PII 방어

`comment`(자유텍스트)와 `context`가 이 기능의 **유일한 PII 리스크 지점**이다. 사용자가 "제 이메일은 ...로 연락 주세요" 같은 걸 쓸 수 있다.

- `context`: 키 화이트리스트(`analysis_id`, `analysis_type`)만 허용. 그 외 키는 저장 전 버린다.
- `comment`: **최대 500자**(`FEEDBACK_COMMENT_MAX_LENGTH`, `lib/feedback/campaigns.ts`). 프론트는 입력 단계에서 막고, **서버도 같은 값을 강제한다** — 501자 요청은 거절한다.

  > 경계는 "예: 500자" 같은 예시가 아니라 **정확한 값**이어야 한다. 양쪽이 다른 한도를 구현하면 프론트가 받은 값을 서버가 거절하고, 그 불일치는 사용자가 긴 의견을 다 쓴 다음에야 드러난다. 변경 시 이 문서·프론트 상수·서버 제약을 함께 고친다.
- PostHog로는 `comment` 원문을 보내지 않는다(프론트 책임 — FRT-92). PostHog에는 rating·trigger_source 같은 비식별 메타만 싣는다. 원문은 서버에만 남는다.

## 프론트 쪽 결정 (백엔드가 알아야 할 것)

### fail-closed

`prompt-shown` 호출이 **실패하면**(네트워크 오류·타임아웃 — 서버가 "이미 봤음"이라 답한 게 아니라 답 자체를 못 받은 상태) 프론트는 **모달을 띄우지 않는다**. 같은 모달을 두 번 보여 사용자를 귀찮게 하는 것보다 한 번 놓치는 게 낫다는 판단(ARC 원칙: 압박 지양).

백엔드에 대한 함의: **`prompt-shown`은 빠르고 안정적이어야 한다.** 이 엔드포인트가 느리거나 불안정하면 피드백 수집이 조용히 0이 된다. 무거운 작업을 넣지 말 것.

### 기능 플래그

BAC-34/35가 나오기 전까지 프론트는 **플래그 off**로 머지된다(FRT-5·FRT-8 전례). 사용자에게 노출되지 않으므로, 백엔드는 프론트 일정에 쫓기지 않아도 된다. 엔드포인트가 배포되면 플래그만 켠다.

### 캠페인은 1개, 문구는 2개

`campaign_id`는 `"analysis-satisfaction"` 하나다. 게이트가 둘(분석 완료·경험 3개 도달)이지만 캠페인을 쪼개지 않고 **문구만 트리거별로 가른다** — 경험 3개로 뜬 사용자는 분석을 한 적이 없어 "방금 이 분석"을 물으면 말이 안 되기 때문. 서버 입장에서는 `unique(user_id, campaign_id)` 그대로이고, 어느 게이트였는지는 `trigger_source`로 구분된다(퍼널 비교용).

## 확인 방법 (백엔드 수용 기준)

```
1. status 조회        → data: { has_seen: false, has_responded: false }
2. prompt-shown 호출  → data: { created: true }
3. prompt-shown 재호출 → data: { created: false }   ← 행은 여전히 1개 (ON CONFLICT)
4. status 조회        → data: { has_seen: true, has_responded: false }
5. responses 호출     → data: { responded_at: "..." }
6. status 조회        → data: { has_seen: true, has_responded: true }
7. rating=0 또는 6 으로 responses → CHECK 제약 위반으로 거부
8. 미응답 행은 responded_at NULL 유지
9. comment 500자 → 통과 / 501자 → 거부   ← 경계는 정확히 일치해야 한다
10. context 에 화이트리스트 밖 키(예: email) → 저장 전 버려짐
```

## 관련

- 프론트 타입 정본: `lib/feedback/types.ts`, config: `lib/feedback/campaigns.ts` (FRT-91)
- 이슈: BAC-34, BAC-35, FRT-91~96 (Admin Page › "💬 인앱 피드백" 마일스톤)
- 별개 도메인: BAC-39 · FRT-106 (분석 결과별 👍👎 — 별도 테이블)
