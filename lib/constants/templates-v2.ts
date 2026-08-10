import type { TemplateV2, TemplateSection, ExperienceTypeInfo, ExperienceTypeId, SectionCategory } from '@/types/archive'
import {
  createTextField,
  createTextareaField,
  createDateField,
  createPeriodField,
  createSelectField,
  createChecklistField,
  createMoodTagField,
  createTagsField,
  createLinkField,
  createFileField,
  createRepeatableCell,
  createOutcomeList,
  createRoleHistory,
} from '@/lib/utils/block-utils'

// ─── Experience Type Registry ───────────────────────────────────

export const EXPERIENCE_TYPES: ExperienceTypeInfo[] = [
  // Academic
  { id: 'education', label: '전공 및 수강 수업', icon: 'GraduationCap', category: 'academic' },
  { id: 'academic-society', label: '학회', icon: 'BookOpen', category: 'academic' },
  { id: 'club', label: '동아리/교내 단체', icon: 'Users', category: 'academic' },
  { id: 'research', label: '연구 경험/논문', icon: 'FlaskConical', category: 'academic' },
  // Career
  { id: 'career', label: '인턴 및 업무 경력', icon: 'Briefcase', category: 'career' },
  { id: 'extracurricular', label: '대외활동', icon: 'Megaphone', category: 'career' },
  { id: 'award', label: '수상 경력', icon: 'Trophy', category: 'career' },
  { id: 'certification', label: '보유 자격증', icon: 'BadgeCheck', category: 'career' },
  { id: 'language', label: '어학 능력', icon: 'Languages', category: 'career' },
  // Project
  { id: 'personal-project', label: '개인 프로젝트', icon: 'Rocket', category: 'project' },
  { id: 'team-project', label: '팀 프로젝트', icon: 'UsersRound', category: 'project' },
  { id: 'creative-work', label: '창작물/작업물', icon: 'Palette', category: 'project' },
  // Personal
  { id: 'volunteer', label: '봉사활동', icon: 'Heart', category: 'personal' },
  { id: 'overseas', label: '해외 경험', icon: 'Globe', category: 'personal' },
  { id: 'sports', label: '운동 및 신체 역량', icon: 'Dumbbell', category: 'personal' },
  { id: 'reading', label: '독서', icon: 'BookMarked', category: 'personal' },
  { id: 'journal', label: '기록 (일지/회고)', icon: 'NotebookPen', category: 'personal' },
  { id: 'goal', label: '목표/계획', icon: 'Target', category: 'personal' },
]

export const EXPERIENCE_TYPE_MAP: Record<ExperienceTypeId, ExperienceTypeInfo> =
  Object.fromEntries(EXPERIENCE_TYPES.map(t => [t.id, t])) as Record<ExperienceTypeId, ExperienceTypeInfo>

export const TYPE_CATEGORIES = [
  { key: 'academic', label: '학업' },
  { key: 'career', label: '커리어' },
  { key: 'project', label: '프로젝트' },
  { key: 'personal', label: '개인성장' },
] as const

// ─── Common Core (shared by all templates) ──────────────────────

/**
 * 유형별 core 필드 제외 목록 — 프로토타입 확정본(2026-07).
 * commonCore 는 모든 유형에 기간·역할/기여도·핵심 성과·증빙 자료를 공통 주입하고, 유형 섹션에
 * 동의어 필드가 있으면 form-cards 가 자동 dedup 한다. 하지만 동의어 앵커가 없는 유형은 그 core
 * 필드가 그대로 노출되어 "간소화" 의도를 해친다. 강좌 단위 수업(기간=이수시기·증빙=성적증빙으로
 * 대체)과 대외활동은 아래 필드를 core 에서 제거한다.
 * (대외활동 '핵심 성과': FRT-177 이후 ② '주요 성과' 개조식과 ③ 표의 '핵심 성과' 컬럼이 같은
 * 질문을 이미 받는다 — core textarea 를 함께 두면 성과를 세 번 묻게 된다.)
 * ⚠️ '경험명'·'한 줄 요약'은 헤더 소유라 절대 제외하지 않는다.
 */
const CORE_EXCLUDE: Partial<Record<ExperienceTypeId, string[]>> = {
  club: ['핵심 성과'],
  education: ['기간', '내 역할/기여도', '핵심 성과', '증빙 자료'],
  extracurricular: ['핵심 성과'],
  // 자격증 확정본은 취득일 하나로 시점을 받는다 — required 인 '기간'을 함께 두면 시작·종료를
  // 억지로 묻게 된다. 역할·성과도 확정본에 없다(② 취득 배경이 대신 묻는다).
  certification: ['기간', '내 역할/기여도', '핵심 성과'],
  // 수상경력도 같은 이유로 '수상일' 하나로 시점을 받는다. 역할·성과도 확정본에 없다 —
  // ① '수상 내용 / 배경'·'지원 동기'가 흡수했고, 팀에서의 역할은 조건부 필드가 따로 받는다.
  award: ['기간', '내 역할/기여도', '핵심 성과'],
  // 어학 확정본에는 전체 기간이 없다 — 언어 능력은 시작·종료가 뚜렷하지 않아 required 로 물으면
  // 억지 입력이 되고 진행도까지 막힌다. 시점은 ③ 각 경험의 '기간'과 ④ '취득일'이 받는다.
  // 역할·성과도 확정본에 없다(② 어학 경험과 ③ 경험 상세 기록이 그 질문을 흡수했다).
  // '증빙 자료'를 빼는 이유는 다르다 — 어학의 증빙은 ④ '성적표 첨부'이고, 그건 시험명·점수·
  // 취득일과 **한 카드**여야 의미가 산다(교육의 '성적 증빙'과 같은 처리). core 를 남기면
  // 같은 카드에 파일 입력칸이 두 벌 생긴다.
  language: ['기간', '내 역할/기여도', '핵심 성과', '증빙 자료'],
  // 독서 확정본은 ① '독서 기간'으로 시점을 받는다. 역할·성과는 아예 성립하지 않는 질문이다
  // (책을 읽는 데 '내 역할'과 '핵심 성과'가 없다). 다만 **'증빙 자료'는 빼지 않는다** —
  // 어학은 자체 '성적표 첨부'가 있어서 뺄 수 있었던 것이고, 독서 확정본에는 증빙 필드가
  // 하나도 없어 core 까지 빼면 첨부 수단이 통째로 사라진다.
  reading: ['기간', '내 역할/기여도', '핵심 성과'],
  // 봉사 확정본은 ① 이 네 칸을 모두 자기 필드로 받는다 — '활동 기간'·'역할'(한 줄)·
  // '봉사 확인서 첨부'(증빙 유형 드롭다운 포함). core 를 남기면 같은 질문을 두 번 하게 되고,
  // 특히 '증빙 자료'는 evidence 카드를 따로 만들어 파일 입력칸이 두 벌이 된다(어학의 '성적표
  // 첨부'와 같은 처리). '핵심 성과'는 확정본에 아예 없다 — ② 회고 네 질문이 그 자리를 대신한다.
  volunteer: ['기간', '내 역할/기여도', '핵심 성과', '증빙 자료'],
  // 해외경험 확정본 ① 도 '기간'을 자기 필드로 갖는다. "코어가 그 자리를 채우니 빼지 말자"던 초안은
  // 틀렸다(FRT-249, Codex P1) — 구 `overseas-info` 에도 '기간' 앵커가 있어 `computeFormCards` 의
  // dedup 이 **비어 있는 코어 '기간' 블록을 화면에서 지웠고**(form-cards.ts, keepCoreOrExtended),
  // 그래서 기존 레코드의 기간 값은 `core.기간` 이 아니라 `overseas-info.기간` 에 들어 있다.
  // 코어를 남기면 화면에 뜨는 건 값이 없는 required 칸이라, 완료된 레코드를 다시 열면 기간이 비어
  // 저장조차 막힌다. 선행 5유형과 같이 코어를 빼고 ① 이 자기 '기간'을 정의한다
  // (값은 RENAMED_FIELD_KEYS 로 이관, 발행 시점은 TYPE_PERIOD_KEY 로 조회).
  // 역할·성과는 확정본에 없고 — ② '주요 활동'과 '이 경험이 나에게 준 것'이 그 질문을 흡수했다 —
  // '증빙 자료'는 확정본이 ① 안에 두었으므로 core 를 남기면 파일 입력칸이 두 벌이 된다.
  overseas: ['기간', '내 역할/기여도', '핵심 성과', '증빙 자료'],
  // 창작물 확정본(FRT-267) — **필드마다 따로 물어 선행 5종과 결론이 갈렸다.** 판정식은 FRT-249
  // Codex P1 그대로: "구 템플릿 섹션에 동명(또는 SEMANTIC_GROUPS 동의어) 앵커가 있었나".
  //  · '기간' — 구 `cw-info` 에 '제작 기간'(SEMANTIC_GROUPS.period 등재)이 있었다 → dedup 이 빈
  //    코어를 화면에서 지워 왔으므로 값은 `core.기간` 이 아니라 `cw-info.제작 기간` 에 있다. 빼도
  //    안전하고, 남기면 값 없는 required 칸이 떠 완료 저장이 막힌다.
  //  · '핵심 성과' — 구 `cw-process` 에 '반응/성과'(SEMANTIC_GROUPS.achievement 등재)가 있었다. 같은 판정.
  //  · '증빙 자료' — 확정본이 ① 안에 '작품 링크 / 파일'을 두었으므로 코어를 남기면 evidence 카드가
  //    따로 생겨 3카드가 되고 첨부칸이 두 벌이 된다(봉사·어학과 같은 처리).
  //  · ⚠️ '내 역할/기여도'는 **빼지 않는다.** 구 창작물 템플릿에는 role 동의어 앵커가 하나도 없어
  //    이 코어 칸이 실제로 렌더됐고 값이 들어 있을 수 있다 — 빼면 그 값이 '기타'로 밀린다. 대신
  //    확정본의 '역할'이 새 앵커가 되므로 dedup 이 빈 것만 숨긴다(충실성과 값 보존이 동시에 성립).
  'creative-work': ['기간', '핵심 성과', '증빙 자료'],
}

/**
 * core '증빙 자료'의 증빙 유형 선택지 (FRT-179). FileBlockValue 가 파일과 함께 담는
 * `evidenceType` 은 기본적으로 자유 입력인데, 확정본이 선택지를 정한 유형만 드롭다운으로 좁힌다.
 * 무엇이 증빙이 되는지는 유형마다 다르므로 공통 상수가 아니라 유형별 맵이다.
 */
const CORE_EVIDENCE_OPTIONS: Partial<Record<ExperienceTypeId, string[]>> = {
  certification: ['합격증/자격증 사본', '성적표/점수 확인서', '발급 확인서', '기타'],
  award: ['상장 원본/사본', '트로피·상패 사진', '관련 기사', '공식 발표 페이지 캡처', '기타'],
}

function buildCommonCore(typeId?: ExperienceTypeId): TemplateSection {
  const exclude = new Set(typeId ? CORE_EXCLUDE[typeId] ?? [] : [])
  const evidenceOptions = typeId ? CORE_EVIDENCE_OPTIONS[typeId] : undefined
  const blocks = [
    createTextField('경험명', { required: true, placeholder: '경험의 이름을 입력하세요' }),
    { ...createPeriodField('기간', { required: true }), category: 'basic' as SectionCategory },
    createTextField('한 줄 요약', { placeholder: '이 경험을 한 줄로 요약해주세요' }),
    { ...createTextareaField('내 역할/기여도', { placeholder: '내가 맡은 역할과 기여한 부분을 작성해주세요' }), category: 'detail' as SectionCategory },
    { ...createTextareaField('핵심 성과', { placeholder: '주요 성과나 결과를 작성해주세요' }), category: 'detail' as SectionCategory },
    { ...createFileField('증빙 자료', { options: evidenceOptions }), category: 'evidence' as SectionCategory },
  ].filter(b => !exclude.has(b.label))
  return {
    id: 'core',
    label: '기본 정보',
    category: 'basic',
    blocks,
  }
}

// ─── Extended Input (optional, shared) ──────────────────────────

function buildExtendedSection(): TemplateSection {
  return {
    id: 'extended',
    label: '확장 입력 (선택)',
    category: 'detail',
    collapsed: true,
    blocks: [
      createTextareaField('배경/목표', { placeholder: '이 경험의 배경이나 목표를 설명해주세요' }),
      createTextareaField('내가 한 행동', { placeholder: '구체적으로 어떤 행동을 했는지 작성해주세요' }),
      createTextareaField('결과/성과', { placeholder: '어떤 결과를 얻었는지 작성해주세요' }),
      createTextareaField('배운 점', { placeholder: '이 경험에서 배운 점을 작성해주세요' }),
      createTagsField('사용한 스킬'),
      createTextField('협업/팀', { placeholder: '함께한 팀이나 협업 방식을 설명해주세요' }),
      createSelectField('난이도', ['상', '중', '하']),
      createSelectField('공개 설정', ['공개', '비공개', '일부 공개']),
    ],
  }
}

// ─── Settings Section (유형이 자기 detail 섹션을 가질 때 대체 주입) ──
//
// 자기 detail 섹션을 정의한 유형은 범용 buildExtendedSection() 대신 이 섹션만 받는다.
// '공개 설정'은 포트폴리오 발행(lib/portfolio/build-portfolio.ts)이 label 로 조회하므로
// 반드시 존재해야 한다. id='extended' 를 유지해 안정키 'extended.공개 설정' 를 보존한다.
function buildSettingsSection(): TemplateSection {
  return {
    id: 'extended',
    label: '설정',
    category: 'detail',
    collapsed: true,
    blocks: [
      createSelectField('공개 설정', ['공개', '비공개', '일부 공개']),
    ],
  }
}

// ─── Template Builders (per type) ───────────────────────────────

/** 이수 연도 선택지의 가장 오래된 해. 문서 확정본 기준. */
const COURSE_YEAR_OLDEST = 2000
/**
 * 이수 연도 선택지 — 문서 확정본은 "2026년 ~ 2000년 최근 순".
 * 상한을 2026 으로 고정하면 해가 바뀌는 순간 현재 연도를 고를 수 없게 되므로(이수 연도는 필수라
 * 진행도까지 막힌다) 현재 연도와 문서 기준연도 중 큰 쪽을 상한으로 쓴다.
 * 호출마다 새 배열을 만든다 — emptyValue 가 이 배열을 복사 없이 value.options 로 대입하기 때문에,
 * 모듈 전역 배열을 재사용하면 모든 수업 레코드가 같은 인스턴스를 공유하게 된다.
 */
function courseYearOptions(): string[] {
  const newest = Math.max(2026, new Date().getFullYear())
  return Array.from({ length: newest - COURSE_YEAR_OLDEST + 1 }, (_, i) => `${newest - i}년`)
}

// 수업 — 프로토타입 확정본(2026-07). 기록 단위는 '강좌'.
// FRT-135: 이수 시기를 '학년'에서 연도+학기로 교체하고 학과/학부·학위 과정·수업 분류·
// 강의계획서를 문서대로 되살렸다. 문서에 없는 '공식 URL'은 제거.
function educationExtensions(): TemplateSection[] {
  return [
    {
      id: 'edu-info',
      category: 'basic',
      label: '강좌 정보',
      blocks: [
        createTextField('강좌명', {
          required: true,
          guide: '수강한 강좌의 정확한 이름을 적어주세요.',
          placeholder: '예: 마케팅원론, 데이터구조와 알고리즘',
        }),
        createTextField('교수 / 강사', {
          guide: '강좌를 진행한 교수님이나 강사님의 이름을 적어주세요.',
          placeholder: '예: OOO 교수',
        }),
        createTextField('학교 / 기관', {
          required: true,
          guide: '이 강좌를 수강한 학교나 교육 기관을 적어주세요.',
          placeholder: '예: OO대학교',
        }),
        createTextField('학과 / 학부', {
          guide: '이 강좌가 개설된 학과나 학부를 적어주세요.',
          placeholder: '예: 경영학과',
        }),
        // 이수 시기 = 연도 + 학기. 문서가 폐기한 '학년'은 제거했고, 기존 레코드의 값은
        // orphanFieldsToBlocks 안전망이 custom 블록으로 보존한다.
        createSelectField('이수 연도', courseYearOptions(), {
          required: true,
          guide: '이 강좌를 수강한 연도를 선택해주세요.',
        }),
        createSelectField('학기', ['1학기', '여름 계절학기', '2학기', '겨울 계절학기'], {
          required: true,
          guide: '이 강좌를 수강한 학기를 선택해주세요.',
        }),
        createSelectField('학위 과정', ['학사', '학·석사 통합', '석사', '석·박사 통합', '박사'], {
          guide: '이 강좌를 수강한 시점의 학위 과정을 선택해주세요.',
        }),
        createSelectField(
          '수업 분류',
          ['공통', '교양', '교직', '일반선택 (일선)', '전공선택 (전선)', '전공필수 (전필)', '대학원', '논문'],
          { guide: '이 강좌의 이수 구분을 선택해주세요.' },
        ),
        // 문서는 학점·성적·성적 증빙을 '학점 / 성적' 한 필드(2단 배치)로 묶고 가이드도 하나만 뒀다.
        // 2단 배치는 FRT-144 라 지금은 형제 블록으로 펼쳐지므로, 한 문장을 첫 칸에만 남기면
        // 학점 칸이 성적·증빙까지 받는 것처럼 읽힌다. 문구를 각 칸이 받는 값으로 좁힌다.
        createSelectField('학점', ['1학점', '2학점', '3학점', '4학점', '기타'], {
          guide: '이수 학점을 선택해주세요.',
        }),
        createSelectField(
          '성적',
          ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'F', 'P (Pass)', 'NP (Non-Pass)'],
          { guide: '취득 성적을 선택해주세요.' },
        ),
        createFileField('성적 증빙', { guide: '성적표 등 성적을 증빙할 수 있는 파일을 첨부해주세요.' }),
        // 강의계획서 — "AI 가 분석해 강좌 내용을 파악한다"는 아직 확정 전이라 안내에 넣지 않는다.
        createFileField('강의계획서 첨부', {
          guide: '강의계획서(실라버스)를 첨부해주세요. PDF, 이미지, 문서 파일 모두 괜찮아요.',
        }),
      ],
    },
    {
      id: 'edu-detail',
      category: 'detail',
      label: '수업 상세',
      blocks: [
        createTextareaField('수강 동기', {
          guide: '이 강좌를 수강한 이유가 무엇인가요? 필수라서 들었더라도, 기대했던 점이 있었다면 함께 적어주세요.',
          placeholder:
            '예: 데이터 분석 직무를 준비하며 통계 기초를 다지고 싶었고, 교수님의 실습 중심 수업 방식이 잘 맞을 것 같아 신청했습니다',
        }),
        createTextareaField('수업 요약', {
          guide: '이 강좌가 어떤 수업이었는지 자유롭게 요약해주세요. 다룬 주제, 수업 방식, 전체적인 흐름 등 무엇이든 좋아요.',
          placeholder:
            '예: 마케팅의 기본 개념부터 소비자 행동, 시장 세분화, 브랜드 포지셔닝까지 다뤘습니다. 매주 이론 강의와 함께 실제 기업 케이스를 분석하는 방식으로 진행됐습니다',
        }),
        // 가장 중요했던 내용 — 소제목+설명 블록 반복. ③ 연결(블록반복 링크)은 FRT-131.
        // 소제목은 required 로 두지 않는다 — 이 블록은 optional 인 '수업 상세'(detail) 카드 안이라
        // required 컬럼이 있으면 카드 전체가 필수로 판정돼(isRequiredBlock) 수강 동기·수업 요약만
        // 채워도 진행도가 미완료로 오판된다.
        createRepeatableCell(
          '가장 중요했던 내용',
          [
            {
              key: 'title',
              label: '소제목',
              blockType: 'text',
              placeholder: '예: 마케팅 4P 프레임의 실전 적용',
            },
            {
              key: 'detail',
              label: '설명',
              blockType: 'textarea',
              placeholder: '이 내용이 왜 중요했는지, 어떤 맥락에서 배웠는지 자유롭게 적어주세요',
            },
          ],
          {
            guide:
              '이 강좌에서 나에게 가장 깊게 남은 개념, 이론, 관점을 단위별로 기록해주세요. 하나씩 소제목과 설명을 나눠 정리할 수 있어요.',
          },
        ),
      ],
    },
    {
      id: 'edu-projects',
      category: 'repeat',
      label: '프로젝트 / 과제 / 제작물 기록',
      blocks: [
        createRepeatableCell(
          '프로젝트 / 과제 / 제작물',
          [
            {
              key: 'name',
              label: '프로젝트명',
              blockType: 'text',
              required: true,
              guide: '이 과제나 프로젝트의 이름을 적어주세요.',
              placeholder: '예: 학기말 팀 프로젝트 — 로컬 브랜드 마케팅 전략 제안',
            },
            {
              key: 'type',
              label: '유형',
              blockType: 'single-select',
              guide: '과제/프로젝트 유형을 선택해주세요.',
              options: [
                '개인 과제',
                '개인 프로젝트',
                '팀 과제',
                '팀 프로젝트',
                '학기말 프로젝트',
                '중간 과제',
                '기말 과제',
                '기타',
              ],
            },
            {
              key: 'description',
              label: '간단한 설명',
              blockType: 'textarea',
              guide: '이 프로젝트가 무엇이었는지 한두 문장으로 설명해주세요.',
              placeholder:
                '예: 지역 소상공인 브랜드를 골라 SNS 마케팅 전략을 제안한 팀 프로젝트. A+ 성적으로 마무리했습니다.',
            },
            {
              key: 'work',
              label: '내가 한 일',
              blockType: 'textarea',
              guide:
                '이 프로젝트에서 내가 직접 맡은 부분은 무엇이었나요? 팀 과제라면 팀원 간 역할 분담도 함께 떠올려보세요.',
              placeholder: '예: 인터뷰 설계와 소비자 조사를 담당했고, 팀원 4명과 역할을 나눠 3주간 진행했습니다',
            },
            {
              key: 'output',
              label: '결과물',
              blockType: 'link',
              guide: '이 프로젝트의 결과물을 첨부하거나 링크로 남겨주세요.',
            },
          ],
          {
            guide:
              '이 강좌에서 수행한 과제, 팀 프로젝트, 개인 제작물 등을 단위별로 기록해주세요.',
            // FRT-145: 각 프로젝트 행에 그 프로젝트에만 필요한 항목을 직접 추가할 수 있다.
            allowRowExtras: true,
          },
        ),
      ],
    },
  ]
}

/** 대외활동 ② '활동 성격' 이모티콘 태그 — 확정본 12종 고정 프리셋(FRT-177). */
const EXTRACURRICULAR_MOOD_TAGS = [
  '🎨 창의적 표현',
  '🤝 팀 협업',
  '🏃 실행 중심',
  '🧠 학습 중심',
  '📣 홍보 / 콘텐츠',
  '🌍 사회 기여',
  '💼 실무 연계',
  '🚩 리더십',
  '🎯 목표 달성',
  '🌐 네트워킹',
  '🔥 도전적',
  '💡 아이디어 발산',
]

// 대외활동 — 프로토타입 확정본(2026-07), FRT-177 에서 문서 4섹션에 1:1 정렬.
// 학회(FRT-90)·인턴/수업(FRT-129·135)과 같은 3섹션 구조(basic/detail/repeat) + 코어 증빙(evidence).
// ② 는 개조식 2종(주요 미션/프로젝트·주요 성과) + 이모티콘 태그로, 이전의 '가장 중요했던 경험'
// (소제목+설명 반복)을 대체한다 — 구 레코드 값은 orphanFieldsToBlocks 가 '기타' 카드로 보존한다.
function extracurricularExtensions(): TemplateSection[] {
  return [
    {
      id: 'extra-info',
      category: 'basic',
      label: '활동 정보',
      blocks: [
        createTextField('활동명', {
          required: true,
          guide: '참여한 대외활동의 정확한 이름을 적어주세요.',
          placeholder: '예: OO 대학생 서포터즈, OO 청년기자단',
        }),
        createSelectField(
          '활동 유형',
          [
            '서포터즈',
            '앰버서더',
            '공모전 / 경진대회',
            '기자단 / 에디터',
            '챌린지',
            '스터디 / 학습 모임',
            '리더십 프로그램',
            '봉사활동',
            '학회 / 커뮤니티',
            '해외 프로그램 / 교환',
            '기타',
          ],
          { required: true, guide: '이 활동의 유형을 선택해주세요.' },
        ),
        createTextField('기수 / 차수', {
          guide: '이 활동의 기수나 차수가 있다면 적어주세요.',
          placeholder: '예: 12기, 2024 시즌 2, 6차',
        }),
        createTextField('주최', {
          required: true,
          guide: '이 활동을 주최한 기관이나 단체의 이름을 적어주세요.',
          placeholder: '예: OO그룹, OO재단',
        }),
        createTextField('주관 / 후원', {
          guide: '주최와 별도로 주관 또는 후원한 곳이 있다면 적어주세요.',
          placeholder: '예: OO정부부처 후원, OO미디어 주관',
        }),
        createTextField('참여 역할 / 포지션', {
          guide: '이 활동에서 맡은 역할이나 포지션을 적어주세요.',
          placeholder: '예: 홍보 서포터즈, 콘텐츠 팀장, 정회원',
        }),
        createPeriodField('활동 기간', {
          required: true,
          guide: '활동을 시작하고 종료한 시점을 선택해주세요.',
        }),
        createSelectField(
          '활동 규모',
          ['10명 미만', '10~30명', '30~100명', '100~300명', '300명 이상', '잘 모름'],
          {
            guide:
              '이 활동에 함께 참여한 인원 규모를 알려주세요. 규모가 있는 활동일수록 맥락 이해에 도움돼요.',
          },
        ),
        createLinkField('공식 URL', {
          guide: '활동 소개 페이지, SNS 계정 등을 남겨주세요.',
        }),
      ],
    },
    {
      id: 'extra-detail',
      category: 'detail',
      label: '활동 상세',
      blocks: [
        createTextareaField('지원 동기', {
          guide: '이 활동에 지원하게 된 계기나 기대했던 점이 있다면 적어주세요.',
          placeholder:
            '예: 실제 브랜드와 함께 콘텐츠를 만들어보고 싶었고, 다양한 학교의 동기들과 네트워킹할 수 있는 점에 끌려 지원했습니다',
        }),
        createTextareaField('활동 내용 요약', {
          guide:
            '이 활동이 어떤 프로그램이었는지 자유롭게 요약해주세요. 진행 방식, 주요 미션, 전체적인 흐름 등 무엇이든 좋아요.',
          placeholder:
            '예: OO그룹이 주최한 대학생 브랜드 서포터즈 프로그램으로, 6개월간 월 1회 오프라인 미션과 매주 SNS 콘텐츠 제작 미션을 수행했습니다. 총 60명 규모로 6개 팀으로 나뉘어 활동했고, 마지막 달에는 팀별 최종 캠페인 기획을 발표했습니다.',
        }),
        // 문서 ②의 '+ 프로젝트로 기록' 버튼 = FRT-76 링크 기능. 행 텍스트가 ③ 표의 'name'
        // 컬럼으로 복사되며 연결된다.
        createOutcomeList('주요 미션 / 프로젝트', {
          itemLabel: '미션 / 프로젝트',
          guide:
            "이 활동에서 수행한 주요 미션이나 프로젝트를 리스트업해주세요. 각 항목 옆 '프로젝트로 기록' 버튼으로 아래에서 상세히 기록할 수 있어요.",
          placeholder: '예: 8월 오프라인 캠페인 — 지역 상권 홍보 콘텐츠 제작',
          link: { targetSectionId: 'extra-missions', titleColumnKey: 'name', label: '프로젝트로 기록' },
        }),
        createOutcomeList('주요 성과', {
          itemLabel: '성과',
          guide: '이 활동에서 이룬 성과를 리스트업해주세요. 수상, 우수활동자 선정, 완주, 결과물 등 무엇이든 좋아요.',
          placeholder: '예: 최종 우수 서포터즈 선정 / 팀 프로젝트 대상 수상',
        }),
        createMoodTagField('활동 성격', EXTRACURRICULAR_MOOD_TAGS, {
          guide: '이 활동이 어떤 성격이었는지 태그로 표현해보세요. 여러 개 선택할 수 있어요.',
        }),
      ],
    },
    {
      id: 'extra-missions',
      category: 'repeat',
      label: '미션 / 프로젝트 기록',
      blocks: [
        createRepeatableCell(
          '미션 / 프로젝트',
          [
            {
              key: 'name',
              label: '프로젝트명',
              blockType: 'text',
              required: true,
              guide: '이 미션이나 프로젝트의 이름을 적어주세요.',
              placeholder: '예: 8월 오프라인 캠페인 — 지역 상권 홍보 콘텐츠 제작',
            },
            {
              key: 'type',
              label: '유형',
              blockType: 'single-select',
              required: true,
              guide: '미션/프로젝트의 유형을 선택해주세요.',
              options: [
                '개인 미션',
                '팀 미션',
                '정기 미션',
                '이벤트 · 오프라인 활동',
                '콘텐츠 제작',
                '공모전 · 발표',
                '봉사 · 실행',
                '최종 프로젝트',
                '기타',
              ],
            },
            {
              key: 'description',
              label: '간단한 설명',
              blockType: 'textarea',
              guide: '이 미션/프로젝트가 무엇이었는지 한두 문장으로 설명해주세요.',
              placeholder: '예: 지역 상권을 소개하는 인스타그램 릴스 3편을 팀원 4명과 함께 제작한 미션입니다.',
            },
            {
              key: 'work',
              label: '내가 한 일',
              blockType: 'textarea',
              guide: '이 미션/프로젝트에서 내가 직접 맡은 역할과 구체적인 활동을 적어주세요.',
              placeholder:
                '예: 팀 내에서 촬영과 편집을 담당했고, 매장 섭외 및 인터뷰 진행도 맡았습니다. 팀원들과 매주 2회 미팅을 통해 콘텐츠 방향을 조율했습니다.',
            },
            {
              key: 'result',
              label: '핵심 성과',
              blockType: 'textarea',
              guide: '이 미션/프로젝트에서 얻은 성과가 있나요? 수치, 반응, 피드백 등 무엇이든 좋아요.',
              placeholder: '예: 조회수 총 5만 회 달성 / 우수 팀 선정 / 매장 사장님들로부터 재방문 문의 증가 피드백',
            },
            {
              key: 'difficulty',
              label: '어려움 / 문제 해결',
              blockType: 'textarea',
              guide: '진행하면서 막혔던 순간이 있었나요? 어떻게 넘겼는지 생각나는 대로 적어주세요.',
              placeholder:
                '예: 초반에 매장 섭외가 계속 거절되어 방향을 바꿔야 했고, 팀원들과 함께 근처 상권 대표 회의를 찾아가 협력 관계부터 만들었습니다.',
            },
            {
              // 문서는 파일+URL+설명의 '반복' 입력이지만 반복 블록 안의 반복은 중첩 1겹 제한에
              // 걸려 아직 못 만든다. 학회와 같이 링크 한 칸으로 근사하고 정식 구현은 FRT-143.
              key: 'output',
              label: '결과물',
              blockType: 'link',
              guide: '이 미션/프로젝트의 결과물을 첨부하거나 링크로 남겨주세요.',
            },
          ],
          // 블록 자체 guide 는 두지 않는다 — 문서 ③의 안내 문구는 섹션(카드) 몫이고
          // (SECTION_DESCRIPTION_OVERRIDES), 여기 또 실으면 같은 문장이 두 줄 연달아 나온다.
          // FRT-145: 각 프로젝트 행에 그 프로젝트에만 필요한 항목을 직접 추가할 수 있다.
          { allowRowExtras: true },
        ),
      ],
    },
  ]
}

function academicSocietyExtensions(): TemplateSection[] {
  return [
    {
      id: 'society-info',
      category: 'basic',
      label: '학회 정보',
      blocks: [
        createTextField('학회명', {
          required: true,
          guide: '정식 명칭으로 적어주세요. 약칭이 더 잘 알려져 있다면 괄호로 함께 적어도 좋아요.',
          placeholder: '예: OO대학교 경영전략학회',
        }),
        createTextareaField('학회 소개', {
          guide: '어떤 분야의 학회인지, 규모와 성격을 한두 줄로 적어주세요. 외부에 잘 알려지지 않은 곳이라면 더 친절히요.',
          placeholder:
            '예: 경영·전략 이론을 실제 기업 케이스에 적용하는 학술 학회로, 학기당 케이스 스터디 발표와 기업 탐방을 진행합니다 (OO대 OO명 규모)',
        }),
        createLinkField('공식 URL/웹사이트', {
          guide: '학회 홈페이지나 소개 페이지가 있다면 붙여주세요. 없으면 비워둬도 괜찮아요.',
        }),
        createPeriodField('기간', { required: true }),
        // 증빙은 문서 ④ '활동 증빙' 한 곳에만 둔다. commonCore 의 '증빙 자료'(file)가
        // form-cards 의 isEvidenceBlock 로 항상 evidence 카드에 렌더되고, FileBlock 이
        // 파일 + 파일 설명 + 증빙 유형을 이미 지원해 문서 ④와 그대로 맞는다.
        // (여기 '활동 인증서'를 함께 두면 기본 정보·활동 증빙 두 곳에 증빙이 중복 노출된다.)
        createTextField('역할/직책', {
          required: true,
          guide: '학회 안에서 맡았던 포지션을 적어주세요. 기수·부서·팀이 있다면 함께 적으면 좋아요.',
          placeholder: '예: 케이스팀 팀장, 홍보국장, 일반 부원',
        }),
      ],
    },
    {
      id: 'society-detail',
      category: 'detail',
      label: '경험 상세',
      blocks: [
        createTextareaField('참여 동기', {
          guide: '지원한 동기가 무엇인가요? 참여하기로 결심한 이유가 있었나요?',
          placeholder:
            '예: 경영 이론을 실전 케이스로 분석하는 훈련을 쌓고 싶었고, 전략 컨설팅 직무에 관심이 있어 지원했습니다',
        }),
        createOutcomeList('단체 활동 / 성과', {
          placeholder: '예: 전국 케이스 경진대회 은상 수상',
          guide: '팀·학회가 함께 이뤄낸 것들을 떠올려보세요. 수상, 발간, 대회 참가 등 무엇이든 괜찮아요.',
          // FRT-76: 활동 행 → 아래 '프로젝트 기록'(society-projects) 프로젝트 행으로 연결.
          link: { targetSectionId: 'society-projects', titleColumnKey: 'name', label: '프로젝트로 연결' },
        }),
        createOutcomeList('개인 활동 / 성과', {
          placeholder: '예: 우수 부원 선정',
          guide: '내가 개인적으로 달성하거나 인정받은 것들을 적어주세요.',
          link: { targetSectionId: 'society-projects', titleColumnKey: 'name', label: '프로젝트로 연결' },
        }),
        createOutcomeList('성장 / 변화', {
          itemLabel: '항목',
          placeholder: '예: 문제를 프레임으로 나눠 구조화하는 습관이 생겼습니다',
          guide: '이 경험을 통해 개선되거나 나아진 부분이 있나요? 역량이든, 사고방식이든, 습관이든 구체적일수록 좋아요',
        }),
        createTagsField('사용한 스킬 / 툴 / 기술', {
          guide: '이 활동에서 실제로 배우거나 사용한 기술, 툴, 언어 등을 태그로 추가해주세요',
        }),
        createTextareaField('협업 / 팀원', {
          guide: '함께 활동한 팀원 구성이나 협업 방식을 간략히 설명해주세요',
          placeholder:
            '예: 총 24명, 케이스팀·홍보팀·운영팀으로 구성 / 격주 전체 세션 + 팀별 주 1회 스터디 운영',
        }),
      ],
    },
    {
      id: 'society-projects',
      category: 'repeat',
      label: '프로젝트/연구활동 기록',
      blocks: [
        // 컬럼 순서·필수 여부·구성은 문서 확정본 ③ 그대로.
        // 문서에 없는 '발표/포스터/세미나 여부'·'피드백/질문과 대응'은 제거했다.
        // ⚠️ 이 두 컬럼의 셀 값은 orphanFieldsToBlocks 가 지켜주지 **않는다** — 그 안전망은 fields
        // 키 단위로 돌고 'society-projects.프로젝트/연구활동' 키는 여전히 consumedKeys 다.
        // 지금 값이 남는 이유는 injectValue 가 저장된 columns 를 통째로 복원하기 때문뿐이다.
        // FRT-133 에서 '템플릿 컬럼 우선'으로 정규화할 때 이 셀들을 반드시 함께 이관할 것.
        createRepeatableCell(
          '프로젝트/연구활동',
          [
            {
              key: 'name',
              label: '프로젝트/연구활동명',
              blockType: 'text',
              required: true,
              guide: '이 프로젝트 또는 연구활동의 이름을 적어주세요',
              placeholder: '예: 2024 전국 대학생 전략 케이스 경진대회',
            },
            {
              key: 'role',
              label: '직책/역할',
              blockType: 'text',
              required: true,
              guide: '이 프로젝트에서 맡은 포지션을 적어주세요.',
              placeholder: '예: 케이스 분석 리드, 발표자',
            },
            {
              key: 'period',
              label: '세부 기간',
              blockType: 'text',
              required: true,
              guide: '이 프로젝트가 진행된 기간을 선택해주세요.',
            },
            {
              key: 'goal',
              label: '프로젝트 목표',
              blockType: 'textarea',
              guide: '이 프로젝트를 시작할 때 팀이 풀려고 했던 문제가 뭐였나요?',
              placeholder: '예: 국내 유통 대기업의 신사업 진출 전략을 분석하고 대안 전략 제시',
            },
            {
              key: 'work',
              label: '내가 한 일',
              blockType: 'textarea',
              required: true,
              guide: '이 프로젝트에서 내가 직접 맡은 부분은 어디였나요? 다른 팀원과 어떻게 나눴는지도 떠올려보세요',
              placeholder: '예: 산업 조사와 경쟁사 분석을 담당했고, 팀원 4명과 역할을 나눠 주 2회 미팅으로 진행했습니다',
            },
            {
              key: 'result',
              label: '핵심 성과',
              blockType: 'textarea',
              required: true,
              guide: '이 프로젝트가 끝났을 때 남은 게 있다면요? 결과물, 수치, 피드백 등 무엇이든 적어주세요.',
              placeholder: '예: 대회 본선 진출 및 은상 수상 / 심사위원으로부터 전략 논리 구조에 긍정 피드백',
            },
            {
              key: 'difficulty',
              label: '어려움 / 문제 해결',
              blockType: 'textarea',
              guide: '진행하면서 막혔던 순간이 있었나요? 어떻게 넘겼는지 생각나는 대로 적어주세요',
              placeholder:
                '예: 팀원 간 분석 방향 이견으로 2주간 진척이 없었고, 외부 자료 추가 조사로 합의점을 찾았습니다',
            },
            {
              // 문서는 파일+URL+설명의 '반복' 입력이지만 반복 블록 안의 반복은 중첩 1겹 제한에
              // 걸려 아직 못 만든다. 지금은 링크 한 칸으로 근사하고 정식 구현은 FRT-143.
              key: 'output',
              label: '결과물',
              blockType: 'link',
              guide:
                '이 프로젝트를 하면서 만든 것들을 링크로 남겨주세요. 발표 자료, 기획서, 보고서, 영상 등 무엇이든 괜찮아요.',
            },
          ],
          {
            guide: '학회 안에서 진행한 프로젝트나 연구활동을 단위별로 기록해주세요.',
            // FRT-145: 각 프로젝트 행에 그 프로젝트에만 필요한 항목을 직접 추가할 수 있다.
            allowRowExtras: true,
          },
        ),
      ],
    },
  ]
}

/** 동아리 ② '활동 성격' 이모티콘 태그 — 확정본 12종 고정 프리셋(FRT-178, 아이덴티티 축).
 *  대외활동(EXTRACURRICULAR_MOOD_TAGS)과 목록이 다르다 — 그쪽은 '활동이 어떤 성격이었나',
 *  이쪽은 '이 단체가 어떤 단체인가'를 묻는다. 공유하면 둘 다 어긋난다. */
const CLUB_MOOD_TAGS = [
  '🎨 창작 / 예술',
  '🎤 공연 / 발표',
  '🏃 운동 / 체육',
  '🎮 게임 / 취미',
  '🎬 영상 / 사진',
  '📝 학술 / 스터디',
  '🌍 봉사 / 사회공헌',
  '💼 창업 / 실무',
  '⛪ 종교 / 신앙',
  '🗣️ 언어 / 교류',
  '🏛️ 자치 / 대표',
  '🌐 연합 / 교류',
]

// 동아리 / 교내 단체 — 프로토타입 확정본(2026-07), FRT-178 에서 문서 4섹션에 1:1 정렬.
// 대외활동(FRT-177)과 ②·③ 구조가 동형이고, 여기에만 있는 축이 '역할'이다:
// ① '역할 이력'에 등록한 역할명이 ② 각 행과 ③ 첫 컬럼의 태그 선택지로 파생된다(RoleHistoryContext).
// 구 정의(7필드·detail 섹션 없음)의 값은 안정키가 바뀌므로 orphanFieldsToBlocks 가 '기타' 카드로
// 보존한다. ③ 표는 저장된 columns 가 우선이라(injectValue) 구 레코드의 5컬럼은 그대로 유지된다.
function clubExtensions(): TemplateSection[] {
  return [
    {
      id: 'club-info',
      category: 'basic',
      label: '동아리/단체 정보',
      blocks: [
        createTextField('동아리 / 단체명', {
          required: true,
          guide: '활동한 동아리 또는 교내 단체의 정확한 이름을 적어주세요.',
          placeholder: '예: OO대학교 밴드 동아리 OO, 총학생회, 과학생회',
        }),
        createSelectField(
          '단체 유형',
          [
            '학술 / 스터디',
            '취미 / 문화',
            '공연 / 예술 (밴드·연극·댄스 등)',
            '체육 / 스포츠',
            '봉사 / 사회공헌',
            '자치회 / 학생회',
            '종교',
            '창업 / 실무 프로젝트',
            '연합 동아리',
            '기타',
          ],
          { required: true, guide: '이 단체의 성격을 선택해주세요.' },
        ),
        createTextField('소속 학교', {
          guide:
            '이 동아리가 소속된 학교를 적어주세요. 연합 동아리라면 비워두거나 여러 학교를 함께 적어도 좋아요.',
          placeholder: '예: OO대학교',
        }),
        createTextField('학과 / 학부', {
          guide: '과 동아리라면 소속 학과나 학부를 적어주세요.',
          placeholder: '예: 경영학과',
        }),
        createSelectField(
          '소속 단위',
          ['중앙 동아리', '단과대 동아리', '학과 (과 동아리)', '연합 동아리', '학생회', '기타'],
          { guide: '중앙 동아리인지, 학과·단과대 소속인지, 연합 동아리인지 알려주세요.' },
        ),
        createPeriodField('활동 기간', {
          required: true,
          guide:
            '활동을 시작하고 종료한 시점을 선택해주세요. 여러 학기에 걸쳐 활동했다면 전체 기간을 적어주세요.',
        }),
        createTextField('역할 / 직책', {
          guide:
            '이 단체에서 맡은 역할을 적어주세요. 여러 학기에 걸쳐 역할이 바뀌었다면 아래에서 이력을 상세히 기록할 수 있어요.',
          placeholder: '예: 회장, 부회장, 총무, 공연팀장, 일반 부원',
        }),
        // 바로 위 '역할 / 직책'에 딸린 확장 패널. 여기 등록한 역할명이 ②·③ 태그의 선택지가 된다.
        createRoleHistory('역할 이력', {
          guide:
            '시간에 따라 역할이 어떻게 변화했는지 시기별로 기록해주세요. 성장 서사를 보여주기 좋아요.',
        }),
        createSelectField(
          '활동 규모',
          ['10명 미만', '10~30명', '30~50명', '50~100명', '100명 이상', '잘 모름'],
          { guide: '이 단체의 전체 부원 규모를 알려주세요.' },
        ),
        createLinkField('공식 URL', {
          guide: '동아리 홈페이지, SNS 계정 등을 남겨주세요.',
        }),
      ],
    },
    {
      id: 'club-detail',
      category: 'detail',
      label: '활동 상세',
      blocks: [
        createTextareaField('가입 동기', {
          guide: '이 동아리에 가입한 계기나 기대했던 점이 있다면 적어주세요.',
          placeholder:
            '예: 대학 생활 중에 밴드를 해보고 싶었고, 정기 공연을 통해 무대 경험을 쌓을 수 있는 점이 매력적이었습니다.',
        }),
        createTextareaField('동아리 소개', {
          guide: '이 동아리가 어떤 단체인지 자유롭게 소개해주세요. 성격, 활동 주기, 문화 등 무엇이든 좋아요.',
          placeholder:
            '예: 30년 역사의 교내 중앙 밴드 동아리로, 매 학기 정기 공연을 개최하고 주 2회 정기 합주를 진행합니다. 세션별로 소그룹을 이루며, 신입 부원은 선배와 1:1 멘토링으로 기초를 다집니다.',
        }),
        // 문서 ②의 '+ 프로젝트로 기록' 버튼 = FRT-76 링크 기능. 행 텍스트가 ③ 표의 'name'
        // 컬럼으로 복사되며 연결된다. 역할 태그(FRT-178)는 그 옆에 별도 칩으로 붙는다.
        createOutcomeList('주요 활동 / 이벤트', {
          itemLabel: '활동 / 이벤트',
          guide:
            "동아리에서 참여하거나 주도한 활동, 정기 이벤트를 리스트업해주세요. 각 항목 옆 '프로젝트로 기록' 버튼으로 아래에서 상세히 기록할 수 있어요.",
          placeholder: '예: 2024 봄 정기 공연 / 신입 부원 모집 캠페인 기획',
          link: { targetSectionId: 'club-activities', titleColumnKey: 'name', label: '프로젝트로 기록' },
          roleTags: true,
        }),
        createOutcomeList('주요 성과', {
          itemLabel: '성과',
          guide: '이 활동에서 이룬 성과를 리스트업해주세요. 수상, 우수활동자 선정, 완주, 결과물 등 무엇이든 좋아요.',
          placeholder: '예: 회장으로서 신입 부원 30명 모집 / 정기 공연 관객 500명 유치 / 교내 동아리 축제 대상',
          roleTags: true,
        }),
        createMoodTagField('활동 성격', CLUB_MOOD_TAGS, {
          guide:
            '이 동아리의 정체성을 가장 잘 나타내는 성격을 태그로 선택해주세요. 여러 개 선택할 수 있어요.',
        }),
      ],
    },
    {
      id: 'club-activities',
      category: 'repeat',
      label: '활동 / 이벤트 기록',
      blocks: [
        createRepeatableCell(
          '활동 / 이벤트',
          [
            // 문서상 이 블록의 **첫** 필드가 역할이다(다른 유형의 반복 블록에는 없는 형태).
            // 옵션은 ① '역할 이력'에서 파생되므로 여기에 options 를 두지 않는다.
            {
              key: 'role',
              label: '이 활동 때의 역할',
              blockType: 'checklist',
              variant: 'role-chip',
              guide:
                "이 활동을 어떤 역할 시기에 수행했는지 태그해주세요. 위 '역할 이력'에 등록된 역할이 노출돼요.",
            },
            {
              key: 'name',
              label: '프로젝트명',
              blockType: 'text',
              required: true,
              guide: '이 활동이나 이벤트의 이름을 적어주세요.',
              placeholder: '예: 2024 봄 정기 공연, 신입생 환영회 기획',
            },
            {
              key: 'type',
              label: '유형',
              blockType: 'single-select',
              required: true,
              guide: '활동/이벤트의 유형을 선택해주세요.',
              options: [
                '정기 공연 / 발표회',
                '축제 부스 / 참여',
                'MT / 워크숍',
                '봉사활동',
                '대회 / 공모전 출전',
                '정기 모임 / 스터디',
                '임원 활동 / 기획',
                '신입 부원 모집',
                '기타',
              ],
            },
            {
              // 구 정의의 '활동내용 상세'와 같은 key 를 유지한다 — 확정본 라벨은 '간단한 설명'이지만
              // key 를 바꾸면 사용자가 열 관리로 살려둔 구 컬럼과 나란히 빈 칸이 하나 더 생긴다.
              key: 'detail',
              label: '간단한 설명',
              blockType: 'textarea',
              guide: '이 활동/이벤트가 무엇이었는지 한두 문장으로 설명해주세요.',
              placeholder:
                '예: 학기말 정기 공연으로, 부원 20명이 참여해 6개 팀이 무대에 올라 총 관객 500명을 유치했습니다.',
            },
            {
              key: 'work',
              label: '내가 한 일',
              blockType: 'textarea',
              guide: '이 활동에서 내가 맡은 역할과 구체적으로 한 일을 적어주세요.',
              placeholder:
                '예: 공연팀장으로서 전체 세트리스트 구성, 리허설 일정 관리, 무대 셋업을 총괄했습니다. 부원 20명과 주 2회 합주를 진행하며 완성도를 높였습니다.',
            },
            {
              key: 'result',
              label: '핵심 성과',
              blockType: 'textarea',
              guide: '이 활동에서 얻은 성과가 있나요? 반응, 수치, 결과 등 무엇이든 좋아요.',
              placeholder:
                '예: 관객 500명 유치 (전년 대비 40% 증가) / 교내 신문 인터뷰 기사 게재 / 신입 부원 지원율 상승',
            },
            {
              key: 'difficulty',
              label: '어려움 / 문제 해결',
              blockType: 'textarea',
              guide: '진행하면서 막혔던 순간이 있었나요? 어떻게 해결했는지 적어주세요.',
              placeholder:
                '예: 공연장 대관이 취소되어 3주 만에 대체 장소를 찾아야 했고, 학교 시설과 협의해 강당을 확보한 뒤 팀별 리허설 스케줄을 재편성했습니다.',
            },
            {
              // 문서는 파일+URL+설명의 '반복' 입력이지만 반복 블록 안의 반복은 중첩 1겹 제한에
              // 걸린다. 대외활동과 같이 링크 한 칸으로 근사하고 정식 구현은 FRT-143.
              key: 'output',
              label: '결과물',
              blockType: 'link',
              guide:
                '이 활동/이벤트의 결과물을 첨부하거나 링크로 남겨주세요. 공연 영상, 포스터, 사진, 후기 등 무엇이든 좋아요.',
            },
          ],
          // 블록 자체 guide 는 두지 않는다 — 문서 ③의 안내 문구는 섹션(카드) 몫이다
          // (SECTION_DESCRIPTION_OVERRIDES). 여기 또 실으면 같은 문장이 두 줄 연달아 나온다.
          // FRT-145: 각 활동 행에 그 활동에만 필요한 항목을 직접 추가할 수 있다.
          { allowRowExtras: true },
        ),
      ],
    },
  ]
}

// 인턴 — 프로토타입 확정본(2026-07). 학회(FRT-90)와 동일한 3섹션 구조(basic/detail/repeat).
// 산업/직무 '＋빠른 선택' 그룹 픽커는 후속 이슈(FRT-130) — 이번엔 태그·텍스트로 근사한다.
// 그래서 문서의 "아래에서 선택해주세요" 류 안내는 싣지 않는다(없는 UI를 가리키게 된다).
// 지원 동기 예시문장 삽입·성장/변화 회고 카드·프로젝트 감정 태깅은 FRT-132.
function careerExtensions(): TemplateSection[] {
  return [
    {
      id: 'career-info',
      category: 'basic',
      label: '근무 정보',
      blocks: [
        createTextField('회사명', {
          required: true,
          guide: '인턴으로 근무한 회사의 이름을 적어주세요.',
          placeholder: '예: OO주식회사',
        }),
        // 산업/회사 종류 — 문서상 6카테고리 그룹 픽커. 이번엔 자유 태그로 근사(픽커는 FRT-130).
        createTagsField('산업 / 회사 종류', {
          guide: '이 회사가 속한 산업이나 종류를 자유롭게 입력해주세요. 여러 개 가능해요.',
        }),
        createTextField('부서 / 팀', {
          guide: '소속된 부서와 팀 이름을 적어주세요.',
          placeholder: '예: 마케팅본부 브랜드전략팀',
        }),
        // 직무/포지션 — 문서상 단일선택 픽커(15종). 픽커는 FRT-130, 지금은 자유 입력 텍스트.
        createTextField('직무 / 포지션', {
          required: true,
          guide: '담당한 직무나 포지션을 적어주세요.',
          placeholder: '예: 브랜드 마케팅 인턴',
        }),
        createPeriodField('근무 기간', {
          required: true,
          guide: '인턴 근무를 시작하고 종료한 시점을 선택해주세요.',
        }),
        createSelectField('근무 형태', ['풀타임', '파트타임', '원격', '하이브리드'], {
          guide: '근무 형태를 선택해주세요.',
        }),
        createTextareaField('회사 소개', {
          guide: '회사가 어떤 사업을 하는지, 규모나 특징을 간략히 설명해주세요.',
          placeholder:
            '예: B2C 뷰티 브랜드를 운영하는 스타트업으로, 국내외 온라인 유통을 중심으로 사업을 확장하고 있습니다 (임직원 OO명 규모)',
        }),
        createLinkField('공식 URL'),
      ],
    },
    {
      id: 'career-detail',
      category: 'detail',
      label: '경험 상세',
      blocks: [
        createTextareaField('지원 동기', {
          guide: '이 회사에 지원한 이유가 무엇인가요? 이 직무를 선택하게 된 계기가 있었나요?',
          placeholder:
            '예: 브랜드가 성장하는 과정을 실무에서 경험하고 싶어 지원했습니다',
        }),
        createOutcomeList('팀이 진행한 프로젝트 / 업무', {
          itemLabel: '프로젝트 / 업무',
          placeholder: '예: 상반기 신제품 런칭 캠페인 / 브랜드 리뉴얼 프로젝트',
          guide:
            '내가 속한 팀이 근무 기간 동안 진행한 프로젝트나 주요 업무를 적어주세요. 내가 직접 담당하지 않았더라도 팀이 함께 움직인 일이면 좋아요.',
        }),
        createOutcomeList('나의 담당 업무 / 주요 성과', {
          itemLabel: '담당 업무 / 성과',
          placeholder: '예: 신제품 런칭 SNS 캠페인 운영',
          guide:
            '내가 담당했던 업무나 개인적으로 이룬 성과를 적어주세요. 각 항목은 아래에서 프로젝트 단위로 자세히 기록할 수 있어요.',
          // FRT-76: 활동 행 → 아래 '프로젝트/담당 업무 기록'(career-tasks) 프로젝트 행으로 연결.
          link: { targetSectionId: 'career-tasks', titleColumnKey: 'project', label: '프로젝트로 기록' },
        }),
        createTextareaField('성장 / 변화', {
          guide: '이 인턴 경험을 통해 개선되거나 나아진 부분이 있나요?',
          placeholder: '예: 회의 내용을 문서로 정리하는 습관이 생겼습니다',
        }),
        createTagsField('사용한 스킬 / 툴 / 기술', {
          guide: '인턴 기간 동안 실제로 배우거나 사용한 툴, 언어, 기술을 태그로 추가해주세요.',
        }),
        // 문서 확정본은 여러 줄 텍스트. text→textarea 로 바뀌지만 값 모양이 {type,text} 로 같아
        // experience-mapper 의 injectValue 텍스트 계열 호환이 구 레코드 값을 그대로 실어준다.
        createTextareaField('협업 / 팀원', {
          guide:
            '함께 일한 팀 구성이나 협업 방식을 간략히 설명해주세요. 사수, 매니저, 다른 부서와의 협업 등이 있어요.',
          placeholder:
            '예: 팀장 1명, 시니어 1명, 인턴 2명 구성. 주 1회 위클리 미팅 + 디자인·개발 부서와 격주 협업',
        }),
      ],
    },
    {
      id: 'career-tasks',
      category: 'repeat',
      label: '프로젝트/담당 업무 기록',
      blocks: [
        createRepeatableCell('프로젝트/담당 업무', [
          {
            key: 'project',
            label: '프로젝트명',
            blockType: 'text',
            required: true,
            guide: '이 프로젝트 또는 담당 업무의 이름을 적어주세요.',
            placeholder: '예: 2025 상반기 신제품 런칭 SNS 캠페인',
          },
          {
            key: 'role',
            label: '직책 / 역할',
            blockType: 'text',
            guide: '이 프로젝트에서 맡은 포지션을 적어주세요.',
            placeholder: '예: 콘텐츠 기획, 카피 작성',
          },
          {
            key: 'period',
            label: '세부 기간',
            blockType: 'text',
            guide: '이 프로젝트가 진행된 기간을 선택해주세요.',
          },
          {
            key: 'goal',
            label: '프로젝트 목표',
            blockType: 'textarea',
            guide:
              '이 프로젝트/업무의 목표가 무엇이었나요? 어떤 문제를 해결하거나 어떤 지표를 달성하려 했나요?',
            placeholder: '예: 신제품 인지도를 확보하고 초기 판매량 목표 달성',
          },
          {
            key: 'work',
            label: '내가 한 일',
            blockType: 'textarea',
            guide:
              '이 프로젝트/업무에서 내가 직접 맡은 일은 무엇이었나요? 사수나 다른 팀원과 어떻게 역할을 나눴는지도 떠올려보세요.',
            placeholder:
              '예: 인스타그램·틱톡 콘텐츠 기획 3주치를 담당했고, 사수와 주 2회 리뷰를 진행하며 방향을 조정했습니다',
          },
          {
            key: 'result',
            label: '핵심 성과',
            blockType: 'textarea',
            guide:
              '이 프로젝트/업무가 끝났을 때 남은 성과가 있나요? 수치, 결과물, 피드백 등 무엇이든 적어주세요.',
            placeholder:
              '예: 캠페인 도달 12만 명 달성 / 초기 판매 목표 대비 118% 달성 / 팀장으로부터 콘텐츠 톤앤매너 기여 긍정 피드백',
          },
          {
            key: 'difficulty',
            label: '어려움 / 문제 해결',
            blockType: 'textarea',
            guide: '진행하면서 막혔던 순간이 있었나요? 어떻게 넘겼는지 생각나는 대로 적어주세요.',
            placeholder:
              '예: 광고 소재 심사 반려가 반복돼 일정이 밀렸고, 심사 가이드를 다시 분석해 표현을 수정하는 프로세스를 만들어 해결했습니다',
          },
          {
            key: 'output',
            label: '결과물',
            blockType: 'link',
            guide:
              '이 프로젝트/업무를 하면서 만든 산출물을 첨부하거나 링크로 남겨주세요. 기획서, 보고서, 콘텐츠, 대시보드 등 무엇이든 괜찮아요.',
          },
        // FRT-145: 각 프로젝트 행에 그 프로젝트에만 필요한 항목을 직접 추가할 수 있다.
        ], { allowRowExtras: true }),
      ],
    },
  ]
}

/** 수상경력 ① '대회 유형' 6종 — 확정본 표기 그대로(FRT-211). */
const AWARD_TYPE_OPTIONS = [
  '공모전/경진대회',
  '학술상/논문상',
  '장학상',
  '성적 우수상(학기별 우수 등)',
  '대외 활동 시상',
  '기타',
] as const

/** 수상경력 ① '개인 / 팀' 3종. '팀 수상' 접두어가 조건부 노출의 트리거다. */
const AWARD_PARTICIPATION_OPTIONS = ['개인 수상', '팀 수상 (2~5명)', '팀 수상 (6명 이상)'] as const

/** '팀에서 내가 맡은 역할'의 트리거 안정키 — `withSectionKeys` 가 만들 키를 미리 적은 것이다. */
const AWARD_PARTICIPATION_KEY = 'award-info.개인 / 팀'

// 수상경력 확정본(2026-08) — ① 수상 정보 · ② 수상 과정과 배움 · ③ 상장 / 증빙 (FRT-211).
// 자격증(FRT-179)과 같은 이유로 '수상일' 하나로 시점을 받는다(CORE_EXCLUDE.award) — 시작·종료를
// 억지로 묻지 않는다. core '내 역할/기여도'·'핵심 성과'도 확정본에 없다: ① '수상 내용 / 배경'과
// '지원 동기'가 그 질문을 흡수했고, 팀에서의 역할은 아래 조건부 필드가 따로 받는다.
//
// ⚠️ 구 '수상명'(required)은 core '경험명'이 대신한다 — 확정본 ①은 대회명으로 시작하고 상의
// 이름은 '수상 훈격'이 받는다. 구 '수상 구분'(드롭다운)→'수상 훈격'(자유 텍스트)은 타입까지 바뀌어
// injectValue 의 타입 가드에 걸리므로 값이 자동 이관되지 않는다. 사라진 키의 값은 모두
// orphanFieldsToBlocks 가 '기타' 카드로 보존한다(자격증과 동일 경로).
//
// ③ 은 '관련 링크'만 블록이다 — 파일·파일 설명·증빙 유형은 core '증빙 자료' FileBlock 하나가
// 이미 함께 담는다(FileBlockValue.description/evidenceType). 블록 3개로 쪼개면 입력칸이 두 벌
// 생긴다(FRT-179 최대 교훈). 선택지는 CORE_EVIDENCE_OPTIONS.award 가 공급한다.
function awardExtensions(): TemplateSection[] {
  return [
    {
      id: 'award-info',
      category: 'basic',
      label: '수상 정보',
      blocks: [
        createTextField('대회 / 프로그램명', {
          required: true,
          guide: '이 상을 받은 대회나 프로그램의 이름을 적어주세요.',
          placeholder: '예: 2024 전국 대학생 창업 경진대회',
        }),
        createSelectField('대회 유형', [...AWARD_TYPE_OPTIONS], {
          required: true,
          guide: '이 상의 성격을 선택해주세요.',
        }),
        createTextField('수상 훈격', {
          required: true,
          guide: '받은 상의 등급이나 이름을 적어주세요.',
          placeholder: '예: 대상, 우수상, 최우수 논문상',
        }),
        createTextField('주최 기관', {
          required: true,
          guide: '이 상을 수여한 기관이나 단체를 적어주세요.',
          placeholder: '예: OO부, OO협회, OO대학교',
        }),
        createDateField('수상일', {
          required: true,
          guide: '수상한 날짜를 선택해주세요.',
        }),
        createTextField('참가 규모 / 경쟁률', {
          guide:
            '총 참가자 수, 본선 진출 팀 수, 내가 받은 등수까지 함께 적으면 상의 무게가 명확히 전달돼요.',
          placeholder: '예: 총 300팀 참가 중 1위, 경쟁률 30:1',
        }),
        createSelectField('개인 / 팀', [...AWARD_PARTICIPATION_OPTIONS], {
          guide: '개인 수상인지 팀 수상인지 선택해주세요.',
        }),
        {
          ...createTextField('팀에서 내가 맡은 역할', {
            guide: '팀에서 내가 맡은 역할을 짧게 적어주세요.',
            placeholder: '예: 팀장, 기획·발표 담당, 데이터 분석 담당',
          }),
          // 확정본 §7 — 값이 '팀 수상'으로 시작할 때만 노출. 선택지가 인원수로 갈리므로 접두어 판정이다.
          visibleWhen: { key: AWARD_PARTICIPATION_KEY, startsWith: ['팀 수상'] },
        },
        createTextareaField('지원 동기', {
          guide: '이 대회나 프로그램에 지원한 이유가 있었나요?',
          placeholder:
            '예: 창업 아이디어를 실제로 검증받아보고 싶었고, 심사위원 피드백을 통해 사업 모델을 다듬을 기회로 삼고자 지원했습니다.',
        }),
        createTextareaField('수상 내용 / 배경', {
          guide: '어떤 프로젝트나 활동으로 수상했는지, 무엇이 인정받았는지 적어주세요.',
          placeholder:
            '예: 지역 소상공인 대상 AI 챗봇 서비스 아이디어로 수상. 심사위원으로부터 실용화 가능성과 시장 이해도에 대한 긍정 피드백을 받았습니다.',
        }),
        createTextField('상금 / 부상', {
          guide: '상금이나 부상이 있었다면 적어주세요.',
          placeholder: '예: 상금 500만원, 해외 연수 기회',
        }),
      ],
    },
    {
      // 확정본이 "회고 서술 부담 최소화를 위해 필드 2개만 배치"라고 설계 의도를 명시했다 — 늘리지 말 것.
      id: 'award-process',
      category: 'detail',
      label: '수상 과정과 배움',
      blocks: [
        createTextareaField('준비 과정', {
          guide: '얼마나, 어떻게 준비했는지 짧게 적어주세요.',
          placeholder: '예: 3개월간 팀원 4명과 매주 화요일 저녁 회의로 아이디어를 다듬었어요.',
        }),
        createTextareaField('기억에 남는 순간 / 배운 점', {
          guide: '고비의 순간이든 뿌듯했던 순간이든, 이 경험에서 남은 게 있다면 짧게 적어주세요.',
          placeholder:
            '예: 본선 발표 이틀 전 데이터 수치 오류를 발견해 밤새 수정했어요. 위기 대응 감각이 확 늘었어요.',
        }),
      ],
    },
    {
      id: 'award-evidence',
      category: 'evidence',
      label: '상장 / 증빙',
      blocks: [
        createLinkField('관련 링크', {
          guide: '상장 원본이 없다면 이 수상과 관련된 기사나 공식 발표 페이지 링크를 남겨주세요.',
          placeholder: '관련 링크 (기사, 공식 발표 페이지 등)',
        }),
      ],
    },
  ]
}

/** 자격증 분야 20종 — 확정본 표기 그대로. 대표 자격증을 괄호로 병기한 항목이 있다. */
const CERTIFICATION_FIELD_OPTIONS = [
  'IT/개발',
  '데이터/AI',
  '정보보안/네트워크',
  '금융/투자(CFA 등)',
  '회계/세무(CPA 등)',
  '경영/마케팅',
  '디자인/크리에이티브(GTQ 등)',
  '법률/노무',
  '부동산/공인중개',
  '무역/물류',
  '기계/전기/전자',
  '건축/토목/안전',
  '화학/환경',
  '의료/보건',
  '교육/상담',
  '무도/체육',
  '서비스/조리/미용',
  '운전/중장비',
  '공무원/국가고시',
  '기타',
] as const

// 자격증 확정본(2026-07) — ① 자격증 정보 · ② 취득 배경 · ③ 자격증 증빙.
// ⚠️ 다른 유형과 달리 **반복 기록 섹션이 없다.** 구 'cert-applied'(실무 적용 사례 표 + 자격증
// 증빙 파일)를 통째로 없앤 결과이며, 그 값은 orphanFieldsToBlocks 가 '기타' 카드로 보존한다
// (lib/utils/experience-mapper.test.ts '폐기 섹션 값 보존' 참고).
// ③ 자격증 증빙은 별도 섹션을 만들지 않는다 — core '증빙 자료' FileBlock 이 파일·설명·증빙
// 유형을 이미 함께 담으므로, 확정본의 세 항목이 그 한 블록으로 충족된다(CORE_EVIDENCE_OPTIONS).
function certificationExtensions(): TemplateSection[] {
  return [
    {
      id: 'cert-info',
      category: 'basic',
      label: '자격증 정보',
      blocks: [
        createTextField('자격증명', {
          required: true,
          guide: '취득한 자격증의 정확한 이름을 적어주세요.',
          placeholder: '예: 정보처리기사, ADsP, CFA Level 1',
        }),
        createSelectField('자격증 분야', [...CERTIFICATION_FIELD_OPTIONS], {
          required: true,
          guide:
            '이 자격증이 속한 분야를 선택해주세요. 여러 분야에 걸쳐 있다면 가장 대표되는 분야 기준으로 선택해주세요.',
        }),
        createTextField('등급/급수', {
          guide: '등급, 급수, 레벨 등이 있다면 적어주세요.',
          placeholder: '예: 1급, 필기 합격, Level 1',
        }),
        createTextField('발급 기관', {
          required: true,
          guide: '이 자격증을 발급한 기관을 적어주세요.',
          placeholder: '예: 한국산업인력공단, 한국데이터산업진흥원',
        }),
        createDateField('취득일', {
          required: true,
          guide: '자격증을 취득한 날짜를 선택해주세요.',
        }),
        createDateField('유효기간', {
          guide: '유효기간이 있는 자격증이라면 만료일을 적어주세요.',
        }),
      ],
    },
    {
      id: 'cert-background',
      category: 'detail',
      label: '취득 배경',
      blocks: [
        createTextareaField('취득 동기', {
          guide: '이 자격증을 취득하게 된 이유나 배경을 적어주세요.',
          placeholder:
            '예: 데이터 분석 직무 전환을 준비하면서 관련 지식의 체계화가 필요하다고 판단해 취득했습니다.',
        }),
        createTextareaField('준비 기간/방법', {
          guide: '얼마나 준비했고 어떻게 공부했는지 간단히 적어주세요.',
          placeholder:
            '예: 3개월간 실무 병행하며 준비, 퇴근 후 매일 2시간씩 기출 위주로 학습 — 특히 OO 과목이 약해 반복 회독으로 보완.',
        }),
        createTextareaField('활용 계획', {
          guide: '이 자격증을 앞으로 어떻게 활용할 계획인가요?',
          placeholder:
            '예: 데이터 분석 직무 지원 시 실무 역량 증빙으로 활용하고, 추후 ADP 상위 자격증 취득으로 이어갈 계획입니다.',
        }),
      ],
    },
  ]
}

/** 어학 ① '언어' 12종 — 확정본 표기·순서 그대로. 마지막 '기타'가 조건부 노출의 트리거다. */
const LANGUAGE_OPTIONS = [
  '영어',
  '중국어',
  '일본어',
  '스페인어',
  '독일어',
  '프랑스어',
  '러시아어',
  '베트남어',
  '아랍어',
  '이탈리아어',
  '포르투갈어',
  '기타',
] as const

/** 어학 ① '전반적 수준' 6종 — 괄호 안 예시까지 확정본 표기 그대로다(선택 기준이 거기 있다). */
const LANGUAGE_LEVEL_OPTIONS = [
  '입문(인사·기초 표현)',
  '초급(간단한 일상 대화)',
  '중급(일상 회화·기본 업무 소통)',
  '중상급(실무 소통·문서 이해)',
  '고급(자유로운 업무 수행)',
  '원어민 수준',
] as const

/**
 * 어학 활용 영역 태그 9종. ① '가능한 활용 영역'과 ③ '어떤 언어 활동을 했나요?'가 **같은 선택지**를
 * 쓴다(확정본 명시) — ①은 언어 전체의 가능 범위, ③은 그 경험에서 실제로 한 활동이라 질문은
 * 다르지만 고르는 항목은 같다. 한 상수를 양쪽이 공유해 선택지가 갈라지지 않게 한다.
 */
const LANGUAGE_ACTIVITY_TAGS = [
  '💬 일상 회화',
  '💼 비즈니스 회화',
  '📖 문서 독해',
  '✍️ 문서 작성',
  '🎓 학술 논문 독해',
  '📝 학술 논문 작성',
  '🎤 발표 / 프레젠테이션',
  '🗣️ 통역 / 번역',
  '🌍 원어민과 자유로운 소통',
] as const

/** 어학 ④ '성적표 첨부'의 증빙 유형 4종. 성적표가 맨 앞이다 — 어학 증빙의 대부분이 이것이다. */
const LANGUAGE_EVIDENCE_OPTIONS = [
  '성적표/점수 확인서',
  '합격증/자격증 사본',
  '발급 확인서',
  '기타',
] as const

/** '언어 직접 입력'의 트리거 안정키 — `withSectionKeys` 가 만들 키를 미리 적은 것이다. */
const LANGUAGE_KEY = 'lang-overview.언어'

// 어학능력 확정본(2026-07) — ① 언어 개요 · ② 어학 경험 · ③ 경험 상세 기록 · ④ 어학 자격증.
// 확정본의 방향은 "점수표가 아니라 경험"이다: 언어와 실전 활용 수준을 먼저 고르고, 이 언어를 쓴
// 경험을 리스트업한 뒤, 그중 눈에 띄는 것만 ③에서 자세히 적고, 공인 성적은 ④에 붙인다.
//
// ⚠️ **섹션 id 를 구 `lang-info`/`lang-usage` 에서 전부 갈아치웠다.** 구 '언어'(text)가 확정본에선
// 드롭다운이고 구 '유효기간'(text)은 date 인데, 섹션 id 를 유지하면 안정키가 그대로라 같은 키에
// 타입만 다른 값이 남는다. 그러면 injectValue 는 타입 불일치로 값을 안 싣고(text↔textarea 만
// 변환), 그 키는 consumedKeys 에 잡혀 orphanFieldsToBlocks 도 건너뛴다 — 값이 '기타' 카드에도
// 없이 조용히 사라진다. id 를 바꾸면 구 키가 전부 orphan 안전망으로 흘러 보존된다(FRT-179 경로).
// 같은 이유로 구 `lang-usage.활용 사례` 표(4컬럼)가 ③의 새 5컬럼 정의를 덮어쓰는 사고도 막힌다.
function languageExtensions(): TemplateSection[] {
  return [
    {
      id: 'lang-overview',
      category: 'basic',
      label: '언어 개요',
      blocks: [
        createSelectField('언어', [...LANGUAGE_OPTIONS], {
          required: true,
          guide: '이 경험과 관련된 언어를 선택해주세요.',
        }),
        {
          ...createTextField('언어 직접 입력', {
            placeholder: '언어명을 직접 입력해주세요 (예: 태국어, 힌디어, 튀르키예어)',
          }),
          // 확정본 ① — '기타'를 골랐을 때만 노출. 선택지가 정확히 '기타' 하나라 equals 판정이다.
          visibleWhen: { key: LANGUAGE_KEY, equals: ['기타'] },
        },
        createSelectField('전반적 수준', [...LANGUAGE_LEVEL_OPTIONS], {
          required: true,
          guide:
            '이 언어의 전반적인 사용 수준을 선택해주세요. 공인 시험 점수와 별개로, 스스로 체감하는 실전 활용 수준을 기준으로 골라주세요.',
        }),
        createMoodTagField('가능한 활용 영역', [...LANGUAGE_ACTIVITY_TAGS], {
          guide: '이 언어로 실제 할 수 있는 활동을 태그로 선택해주세요. 여러 개 가능해요.',
        }),
      ],
    },
    {
      id: 'lang-experience',
      category: 'detail',
      label: '어학 경험',
      blocks: [
        createTextareaField('어학 학습 / 습득 동기', {
          guide: '이 언어를 왜 학습하게 됐나요? 계기가 있다면 적어주세요.',
          placeholder:
            '예: 해외 커리어를 목표로 삼으면서 영어 실무 능력이 필수라고 판단했고, 대학교 2학년부터 본격적으로 학습을 시작했습니다.',
        }),
        createOutcomeList('주요 경험', {
          guide:
            '이 언어를 실제로 사용한 경험을 리스트업해주세요. 외국계 인턴, 통역, 해외 프로그램, 논문 작성, 원서 스터디 등 무엇이든.',
          placeholder: '예: OO대학교 교환학생 6개월 / OO 외국계 인턴 3개월 / 학회 통역 3회',
          itemLabel: '경험',
          // 확정본 ② — 각 행의 '상세 기록'이 ③에 블록을 만들고 경험명을 채운 뒤 그리로 스크롤한다.
          // titleColumnKey 는 반드시 명시한다(columns[0] 의존은 FRT-178 에서 깨진 전제).
          link: { targetSectionId: 'lang-records', titleColumnKey: 'name', label: '상세 기록' },
        }),
        createTextareaField('학습 방법 / 노력', {
          guide: '이 언어를 어떻게 학습했고, 어떤 노력을 기울였는지 적어주세요.',
          placeholder:
            '예: 1년간 원어민 튜터와 주 2회 화상 스피킹 진행 / 매일 영어 뉴스 요약 습관 / 대학 원서 강독 스터디 참여',
        }),
      ],
    },
    {
      // 확정본이 "프로젝트/연구식 회고 프레임(STAR)이 아닌 슬림한 5필드"라고 설계 의도를 명시했다 —
      // 부담을 줄여 실제 입력률을 높이는 것이 목적이므로 컬럼을 늘리지 말 것.
      id: 'lang-records',
      category: 'repeat',
      label: '경험 상세 기록',
      blocks: [
        createRepeatableCell(
          '경험 상세 기록',
          [
            {
              key: 'name',
              label: '경험명',
              blockType: 'text',
              required: true,
              guide: '이 경험이 어떤 것이었는지 짧게 적어주세요.',
              placeholder: '예: OO대학교 교환학생, OO 외국계 인턴, 국제학회 통역 자원봉사',
            },
            {
              key: 'period',
              label: '기간',
              blockType: 'period',
              guide: '이 경험이 진행된 기간을 선택해주세요.',
            },
            {
              key: 'activities',
              label: '어떤 언어 활동을 했나요?',
              blockType: 'checklist',
              options: [...LANGUAGE_ACTIVITY_TAGS],
              guide: '이 경험에서 이 언어를 어떻게 사용했나요? 여러 개 가능해요.',
            },
            {
              key: 'summary',
              label: '어떤 경험이었는지 간단히',
              blockType: 'textarea',
              guide: '부담 없이 자유롭게 적어주세요. 기억나는 만큼만 적어도 괜찮아요.',
              placeholder:
                '예: 미국 시애틀에서 6개월간 교환학생으로 지내며 현지 학생들과 조별 과제를 진행했고, 학기말 팀 발표를 영어로 담당했어요.',
            },
            {
              key: 'moment',
              label: '인상 깊었던 순간',
              blockType: 'textarea',
              guide:
                '이 경험에서 특별히 기억에 남는 장면이 있다면 적어주세요. 자랑스러웠던 순간도, 아찔했던 순간도 좋아요.',
              placeholder: "예: 발표 후 현지 교수님이 '너가 유학생인 걸 몰랐다'고 하셔서 뿌듯했어요.",
            },
          ],
          { allowRowExtras: true },
        ),
      ],
    },
    {
      // 확정본 ④는 가이드라인이 전부 '—'다(무엇을 적는지 placeholder 로 충분한 항목들) —
      // 없는 문구를 지어내지 않고 확정본 그대로 둔다. '성적표 첨부'만 안내가 있다.
      id: 'lang-certificate',
      category: 'evidence',
      label: '어학 자격증',
      blocks: [
        createTextField('시험 / 자격증명', { placeholder: '예: TOEIC, TOEFL iBT, OPIc, HSK, JLPT' }),
        createTextField('점수 / 등급', { placeholder: '예: 900점, IH, HSK 5급' }),
        createDateField('취득일'),
        createDateField('유효기간'),
        createFileField('성적표 첨부', {
          guide: '성적표, 점수 확인서, 자격증 사본 등',
          options: [...LANGUAGE_EVIDENCE_OPTIONS],
        }),
      ],
    },
  ]
}

function researchExtensions(): TemplateSection[] {
  return [
    {
      id: 'research-info',
      category: 'basic',
      label: '연구 정보',
      blocks: [
        createTextField('연구 주제/논문 제목', { required: true }),
        createTextField('소속/기관/랩'),
        createPeriodField('기간', { required: true }),
        createSelectField('역할', ['주저자', '공저', '연구원', 'RA', '기타']),
        createTextareaField('연구 질문/가설'),
        createTextareaField('방법/설계'),
        createTextField('데이터/자료 출처'),
        createTextareaField('내가 맡은 파트', { required: true }),
        createTextareaField('결과 요약'),
        createTagsField('성과'),
        createLinkField('재현/공유 자료'),
        createTextareaField('참고문헌/관련 읽을거리'),
        createFileField('산출물'),
      ],
    },
  ]
}

function personalProjectExtensions(): TemplateSection[] {
  return [
    {
      id: 'pp-info',
      category: 'basic',
      label: '프로젝트 정보',
      blocks: [
        createTextField('프로젝트명', { required: true }),
        createPeriodField('기간', { required: true }),
        createTextField('한 줄 설명', { required: true }),
        createTextareaField('목표/만들고 싶었던 이유'),
        createTextareaField('대상 사용자/사용 상황'),
        createChecklistField('주요 기능', []),
        createTagsField('기술/도구'),
      ],
    },
    {
      id: 'pp-decisions',
      category: 'repeat',
      label: '설계/결정 기록',
      collapsed: true,
      blocks: [
        createRepeatableCell('설계/결정', [
          { key: 'topic', label: '결정 주제', blockType: 'text', required: true },
          { key: 'alternatives', label: '대안 비교', blockType: 'textarea' },
          { key: 'reason', label: '선택 이유', blockType: 'textarea' },
          { key: 'result', label: '결과/배운 점', blockType: 'textarea' },
        ]),
        createTextareaField('성과'),
        createLinkField('데모/배포 링크'),
        createLinkField('저장소 링크'),
        createFileField('스크린샷/영상'),
        createTextareaField('다음 개선 계획'),
      ],
    },
  ]
}

function teamProjectExtensions(): TemplateSection[] {
  return [
    {
      id: 'tp-info',
      category: 'basic',
      label: '프로젝트 정보',
      blocks: [
        createTextField('프로젝트명', { required: true }),
        createPeriodField('기간', { required: true }),
        createTextareaField('팀 구성'),
        createTextareaField('내 역할', { required: true }),
        createTextareaField('목표/문제 정의'),
        createTextareaField('협업 방식'),
        createTextareaField('역할 분담표'),
      ],
    },
    {
      id: 'tp-tasks',
      category: 'repeat',
      label: '작업 기록',
      blocks: [
        createRepeatableCell('작업 기록', [
          { key: 'task', label: '작업/이슈명', blockType: 'text', required: true },
          { key: 'period', label: '기간', blockType: 'text' },
          { key: 'work', label: '내가 한 일', blockType: 'textarea', required: true },
          { key: 'result', label: '결과', blockType: 'textarea' },
        ]),
        createTextareaField('갈등/의견 차이와 조율'),
        createLinkField('결과물 링크'),
        createTextareaField('회고 (잘된 점/아쉬운 점/다음엔)'),
      ],
    },
  ]
}

const VOLUNTEER_FIELD_OPTIONS = [
  '교육/학습 지원',
  '아동/청소년',
  '노인/어르신',
  '장애인',
  '다문화/이주민',
  '의료/보건',
  '환경/동물',
  '재난/재해 구호',
  '지역사회/캠페인',
  '해외 봉사',
  '기타',
] as const

const VOLUNTEER_PARTICIPATION_OPTIONS = [
  '정기 봉사(주기적)',
  '단기/일회성',
  '캠프/단기 집중',
  '온라인/재택 봉사',
  '해외 봉사',
] as const

const VOLUNTEER_EVIDENCE_OPTIONS = [
  '봉사시간 인증서(1365 등)',
  '봉사 확인서/수료증',
  '활동 사진',
  '기타',
] as const

// 봉사 — 확정본(봉사_final). 구 `vol-info` 1섹션을 `volunteer-*` 2섹션으로 **전면 교체**한다.
// 섹션 id 를 가는 것이 이 작업의 안전 장치다(FRT-210·FRT-236 과 같은 이유): 구 '내 역할'(textarea)이
// 확정본에선 한 줄 '역할'(text)이고 '기간'→'활동 기간' 처럼 라벨도 함께 갈리는데, id 를 유지하면
// 라벨이 같은 칸의 안정키가 그대로라 injectValue 가 값을 못 싣고도 그 키가 consumedKeys 에 잡혀
// orphan 안전망까지 건너뛴다 — 값이 '기타' 카드에도 없이 사라진다.
//
// 확정본 2섹션이 화면에서도 2카드다: 파일 첨부를 ① 안에 두고(확정본 배치) core '증빙 자료'를
// CORE_EXCLUDE 로 빼, evidence 버킷이 비어 카드가 생기지 않는다. 확정본 §7 도 "사이드 네비:
// 섹션 2개 앵커"로 못 박았다.
function volunteerExtensions(): TemplateSection[] {
  return [
    {
      id: 'volunteer-info',
      category: 'basic',
      label: '봉사 정보',
      blocks: [
        // 확정본 ① 에서 *(선택)* 표기가 없는 넷만 필수다.
        createTextField('봉사 활동명', {
          required: true,
          guide: '참여한 봉사 활동의 이름을 적어주세요.',
          placeholder: '예: OO아동복지센터 학습 멘토링, 지역 노인복지관 급식 봉사',
        }),
        createSelectField('봉사 분야', [...VOLUNTEER_FIELD_OPTIONS], {
          required: true,
          guide:
            '이 봉사의 분야를 선택해주세요. 여러 분야에 걸쳐 있다면 가장 대표되는 분야 기준으로 선택해주세요.',
        }),
        createTextField('봉사 기관', {
          required: true,
          guide: '봉사 활동을 진행한 기관이나 단체를 적어주세요.',
          placeholder: '예: OO구청, OO복지관, 대한적십자사',
        }),
        createPeriodField('활동 기간', {
          required: true,
          guide: '봉사 활동 기간을 선택해주세요.',
        }),
        createTextField('총 봉사시간', {
          guide: '1365 등에 등록된 인증 시간이나 실제 봉사 시간을 적어주세요.',
          placeholder: '예: 48시간',
        }),
        // 확정본이 가이드라인을 '—' 로 비운 칸 — 없는 문구를 지어내지 않는다.
        createSelectField('참여 형태', [...VOLUNTEER_PARTICIPATION_OPTIONS]),
        // 확정본은 한 줄 텍스트다(예: 학습 멘토, 팀장). 구 '내 역할' textarea 로 되돌리지 말 것 —
        // core '내 역할/기여도' 를 뺀 자리를 이 칸이 대신한다.
        createTextField('역할', {
          guide: '봉사에서 맡은 역할이나 담당을 적어주세요.',
          placeholder: '예: 학습 멘토, 팀장, 배식 담당',
        }),
        createFileField('봉사 확인서 첨부', {
          guide: '봉사시간 인증서 등',
          options: [...VOLUNTEER_EVIDENCE_OPTIONS],
        }),
      ],
    },
    {
      // 확정본 설계 노트: 계기(왜 시작했나) → 내용(무엇을 했나) → 순간(어떤 장면이 남았나) →
      // 배운 점(무엇을 얻었나). 시간 흐름과 회고 서사를 따르는 순서라 임의로 바꾸지 말 것.
      // "섹션 전체 선택"이므로 required 를 하나도 두지 않는다.
      id: 'volunteer-reflection',
      category: 'detail',
      label: '봉사 회고',
      blocks: [
        createTextareaField('시작하게 된 계기', {
          guide: '이 봉사를 시작하게 된 계기나 이유가 있다면 적어주세요.',
          placeholder:
            '예: 교육 격차 문제에 관심이 있었고, 직접 도움을 줄 수 있는 활동을 찾다가 지역 학습 멘토링에 지원하게 됐습니다.',
        }),
        createTextareaField('봉사 내용', {
          guide: '어떤 봉사를 어떻게 진행했는지 자유롭게 적어주세요.',
          placeholder:
            '예: 매주 토요일 2시간씩 초등학생 5명을 대상으로 수학·영어 학습을 도왔습니다. 특히 학습 부진 아동을 위한 개별 진도표를 만들어 관리했습니다.',
        }),
        createTextareaField('기억에 남는 순간', {
          guide: '봉사 중 인상 깊었던 순간이나 만남을 적어주세요.',
          placeholder:
            '예: 처음에는 수업을 거부하던 아이가 3개월 후 스스로 문제를 풀어보겠다고 나서던 순간이 가장 기억에 남습니다.',
        }),
        createTextareaField('배운 점', {
          guide: '이 봉사를 통해 얻은 관점, 태도, 배움을 적어주세요.',
          placeholder:
            '예: 도움을 주는 것보다 상대의 속도에 맞추는 것이 중요함을 배웠고, 이후 팀 프로젝트에서도 서두르지 않고 파트너의 페이스를 존중하게 됐습니다.',
        }),
      ],
    },
  ]
}

/** 해외경험 확정본 ① '경험 유형' 9종. 구 5종(교환학생/연수/여행/해외 인턴/기타)과 도메인이 다르다. */
const OVERSEAS_KIND_OPTIONS = [
  '교환학생',
  '어학연수',
  '해외 인턴/취업',
  '해외 봉사',
  '단기 프로그램/캠프',
  '여행/자유 탐방',
  '워킹홀리데이',
  '학회/컨퍼런스 참가',
  '기타',
] as const

/** 해외경험 확정본 ① '참여 형태' 4종 — 누구와 갔는가를 묻는다(봉사의 '참여 형태'와 질문이 다르다). */
const OVERSEAS_COMPANION_OPTIONS = ['혼자', '친구/지인과 함께', '가족과 함께', '단체/팀 프로그램'] as const

/** 해외경험 확정본 ② '이 경험이 나에게 준 것' 10종 (이모지 알약 태그, 다중 선택). */
const OVERSEAS_GAIN_TAGS = [
  '🗣️ 언어 능력 향상',
  '🌍 다양성 이해',
  '🤝 이문화 소통',
  '💪 독립성/자립심',
  '🎓 학문적 시야 확장',
  '💼 커리어 방향 확립',
  '🧭 새로운 관점',
  '🌐 글로벌 네트워크',
  '🔥 도전 정신',
  '💡 문제 해결력',
] as const

// 해외경험 — 프로토타입 확정본(2026-08, FRT-249). 섹션 id 를 `overseas-info`/`overseas-challenges`
// 에서 전면 교체했다. 특히 '경험 유형'은 라벨도 타입도 그대로인 채 **선택지 도메인만 9종으로
// 바뀌어**, 키를 유지하면 구 '연수'·'여행'·'해외 인턴' 이 새 드롭다운에 없는 값으로 박힌다
// (FRT-247 봉사 '대상'·'활동 형태'와 같은 함정). 구 키를 orphan 안전망으로 흘려보내는 것이 답이다.
function overseasExtensions(): TemplateSection[] {
  return [
    {
      // 확정본 ① 의 '경험명'·'한 줄 요약' 은 헤더 코어가 갖는다. '기간' 만은 여기서 정의한다 —
      // 코어를 남기면 dedup 탓에 값 없는 required 칸이 뜬다(CORE_EXCLUDE 의 overseas 주석 참조).
      // 블록 순서는 확정본 ① 표 그대로다: 경험 유형 → 국가 / 도시 → 주최 / 소속 기관 → 기간 →
      // 사용 언어 → 참여 형태 → 증빙 자료. 코어 블록은 `computeFormCards` 가 뒤에 붙이므로,
      // 확정본 순서를 지키려면 시점 필드를 코어에 맡기지 말고 이렇게 섹션이 소유해야 한다.
      id: 'overseas-program',
      category: 'basic',
      label: '해외경험 정보',
      blocks: [
        createSelectField('경험 유형', [...OVERSEAS_KIND_OPTIONS], {
          required: true,
          guide:
            '해외 경험의 유형을 선택해주세요. 여러 개 해당된다면 가장 대표되는 유형 기준으로 선택해주세요.',
        }),
        createTextField('국가 / 도시', {
          required: true,
          guide: '방문한 국가와 도시를 적어주세요.',
          placeholder: '예: 미국 샌프란시스코, 독일 베를린',
        }),
        createTextField('주최 / 소속 기관', {
          guide: '프로그램을 주최한 기관이나 현지에서 소속된 곳을 적어주세요.',
          placeholder: '예: OO대학교, OO재단, OO 회사',
        }),
        // 확정본이 가이드라인을 '—' 로 비운 칸. month~month 는 코어 '기간' 과 같은 period 위젯이라
        // 구 `overseas-info.기간` 값을 그대로 실을 수 있다(RENAMED_FIELD_KEYS).
        createPeriodField('기간', { required: true }),
        createTextField('사용 언어', {
          guide:
            '현지에서 주로 사용한 언어를 적어주세요. 이미 등록한 어학능력이 있다면 같은 언어명으로 적어주시면 좋아요.',
          placeholder: '예: 영어, 독일어, 영어+한국어',
        }),
        // 확정본이 가이드라인을 '—' 로 비운 칸 — 없는 문구를 지어내지 않는다.
        createSelectField('참여 형태', [...OVERSEAS_COMPANION_OPTIONS]),
        createFileField('증빙 자료', {
          guide: '수료증, 참가 확인서, 활동 사진 등 이 경험을 증명할 자료를 첨부해주세요.',
          options: ['수료증/참가 확인서', '활동 사진', '기타'],
        }),
      ],
    },
    {
      id: 'overseas-reflection',
      category: 'detail',
      label: '경험 상세',
      blocks: [
        createOutcomeList('주요 활동', {
          guide:
            "현지에서 수행한 주요 활동이나 프로젝트를 리스트업해주세요. 특정 활동을 더 자세히 풀어 쓰고 싶다면 '상세 설명'을 눌러 아래 '활동별 상세 설명'에서 개별로 적을 수 있어요.",
          placeholder: '예: 국제 마케팅 팀 프로젝트 참여',
          itemLabel: '활동',
          // 확정본 §7 의 '↻ 활동 동기화'(섹션 상단 일괄 버튼)를 새로 만들지 않고 독서(FRT-236)가
          // 쓴 행별 링크를 재사용한다. 일괄 동기화는 활동을 지웠을 때 그 상세를 어떻게 할지
          // 확정본이 명세하지 않아, 재동기화 때 상세가 조용히 사라질 수 있다.
          // titleColumnKey 는 반드시 명시한다(columns[0] 의존은 FRT-178 에서 깨진 전제).
          link: { targetSectionId: 'overseas-activities', titleColumnKey: 'activity', label: '상세 설명' },
        }),
        createMoodTagField('이 경험이 나에게 준 것', [...OVERSEAS_GAIN_TAGS], {
          guide: '해외 경험을 통해 얻은 관점, 배움, 변화를 태그로 표현해주세요.',
        }),
        createTextareaField('기억에 남는 순간', {
          guide: '가장 인상 깊었던 경험, 만남, 문화적 충격 등을 적어주세요.',
          placeholder:
            '예: 팀 프로젝트에서 독일 학생이 정확한 데이터 근거 없이는 어떤 주장도 하지 않는 태도를 보고, 이후 저도 근거 중심으로 논리를 세우는 습관이 생겼습니다.',
        }),
      ],
    },
    {
      // 확정본은 이 카드를 ② 안의 동기화 카드로 그렸지만(§8 "섹션 2개 앵커"), 우리 구조에서는
      // 반드시 별도 섹션이어야 한다 — `ExperienceFormV2.findProjectBlock` 이 대상 섹션의 **첫
      // repeatable-cell** 을 집는데 OutcomeList 자체가 repeatable-cell 이라, 한 섹션에 두면
      // '주요 활동' 이 자기 자신을 대상으로 삼는다. 독서 `book-info` → `book-quotes` 와 같은 구성.
      id: 'overseas-activities',
      category: 'repeat',
      label: '활동별 상세 설명',
      blocks: [
        createRepeatableCell('활동별 상세 설명', [
          {
            // ⚠️ required 금지. `isRequiredBlock` 은 컬럼 하나라도 required 면 표 블록 전체를
            // 필수로 보고, 그러면 활동을 안 적은 사용자는 이 카드를 영영 완료할 수 없는 데다
            // `canHideBlock` 이 숨기지도 못한다(FRT-236 '문장별 감상'과 같은 자리).
            key: 'activity',
            label: '활동',
            blockType: 'text',
            guide: "위 '주요 활동'에서 기록한 항목이 여기에 채워져요.",
          },
          {
            key: 'detail',
            label: '상세 설명',
            blockType: 'textarea',
            guide: '이 활동에 대해 더 자세히 설명하고 싶다면 적어주세요.',
          },
        ], {
          guide:
            "위 '주요 활동'에서 항목을 추가한 뒤 '상세 설명'을 누르면 여기에 행이 생겨요. 굳이 모두 채울 필요는 없어요.",
        }),
      ],
    },
  ]
}

/** 창작물 확정본 ① '유형 / 매체' 13종. 구 '분야' 7종(디자인/글/영상/음악/사진/일러스트/기타)과 도메인이 다르다. */
const CREATIVE_MEDIUM_OPTIONS = [
  '그래픽/디자인',
  '브랜딩/아이덴티티',
  '웹/앱 UI',
  '영상/모션',
  '사진',
  '일러스트/그림',
  '글/문학',
  '음악/사운드',
  '개발/프로젝트',
  '제품/프로덕트',
  '공간/건축',
  '공연/퍼포먼스',
  '기타',
] as const

/** 창작물 확정본 ① '개인 / 팀' 4종. '개인 작업' 외를 고르면 '역할' 칸이 나타난다. */
const CREATIVE_COLLAB_OPTIONS = ['개인 작업', '팀 작업(2~5명)', '팀 작업(6명 이상)', '공동 프로젝트'] as const

const CREATIVE_COLLAB_KEY = 'creative-info.개인 / 팀'

/** 창작물 확정본 ② '작품 성격' 12종 (이모지 알약 태그, 다중 선택). */
const CREATIVE_MOOD_TAGS = [
  '🎨 실험적',
  '💼 상업적',
  '📖 서사적',
  '🔍 리서치 기반',
  '💡 컨셉 중심',
  '🛠️ 기술 중심',
  '🤝 협업 기반',
  '🧪 프로토타입/실험작',
  '🎯 특정 타겟 대상',
  '🏆 공모전 출품작',
  '📚 학술/졸업 작품',
  '🌍 사회적 메시지',
] as const

// 창작물 — 확정본(창작물_final, FRT-267). 구 `cw-info`/`cw-process` 를 `creative-*` 로 **전면 교체**한다.
// 섹션 id 를 가는 것이 이 작업의 안전 장치다(FRT-210 이후 공통): 구 '분야'(7종)는 확정본에서
// '유형 / 매체'(13종)로 **선택지 도메인이 통째로 바뀌고**, 구 '제작 과정'(표)은 확정본에서 같은
// 라벨의 textarea 다. id 를 유지하면 앞은 새 목록에 없는 값이 드롭다운에 박히고, 뒤는 injectValue 가
// 값을 못 싣고도 키가 consumedKeys 에 잡혀 orphan 안전망까지 건너뛴다.
//
// 확정본 2섹션이 화면에서도 2카드다: 결과물 첨부를 ① 안에 두고(확정본 배치) core '증빙 자료'를
// CORE_EXCLUDE 로 빼, evidence 버킷이 비어 카드가 생기지 않는다. 확정본 §7 도 "사이드 네비:
// 섹션 2개 앵커"로 못 박았다.
function creativeWorkExtensions(): TemplateSection[] {
  return [
    {
      // 블록 순서는 확정본 ① 표 그대로다: 작품명 → 유형/매체 → 개인/팀 → ↳역할 → 작업 기간 →
      // 공개/전시 이력 → 사용 툴/기술 → 작품 링크/파일. 코어 블록은 `computeFormCards` 가 뒤에
      // 붙이므로, 확정본 순서를 지키려면 시점 필드를 코어에 맡기지 말고 이렇게 섹션이 소유해야 한다.
      id: 'creative-info',
      category: 'basic',
      label: '작품 정보',
      blocks: [
        createTextField('작품명 / 작업물명', {
          required: true,
          guide: '이 창작물이나 작업물의 이름을 적어주세요.',
          placeholder: '예: 브랜드 리뉴얼 프로젝트, 단편 소설 〈OO〉, 개인 웹사이트',
        }),
        createSelectField('유형 / 매체', [...CREATIVE_MEDIUM_OPTIONS], {
          required: true,
          guide:
            '이 작품의 유형을 선택해주세요. 여러 매체가 결합된 작업이라면 가장 대표되는 유형 기준으로 선택해주세요.',
        }),
        // 확정본이 가이드라인을 '—' 로 비운 칸 — 없는 문구를 지어내지 않는다.
        createSelectField('개인 / 팀', [...CREATIVE_COLLAB_OPTIONS]),
        {
          ...createTextField('역할', {
            guide: '이 작업에서 내가 맡은 역할을 적어주세요.',
            placeholder: '예: 아트디렉터, 개발, 카피라이터',
          }),
          // 확정본 §7 — "'개인 작업' 외 선택 시 노출". `VisibilityCondition` 에 부정이 없어 양성
          // 값을 열거한다. ⚠️ CREATIVE_COLLAB_OPTIONS 가 늘면 여기도 함께 늘려야 한다 — 빠뜨리면
          // 그 값을 고른 사용자에게 이 칸이 영영 안 뜬다(파생으로 두어 어긋날 수 없게 했다).
          visibleWhen: {
            key: CREATIVE_COLLAB_KEY,
            equals: CREATIVE_COLLAB_OPTIONS.filter(o => o !== '개인 작업'),
          },
          // ⚠️ required 금지 — 조건부 노출이라 '개인 작업'을 고르면 화면에 없는 칸이 완료 저장을
          // 막는다(수상경력 '팀에서 내가 맡은 역할'과 같은 처리, FRT-211).
          //
          // ⚠️ 라벨 '역할'은 `SEMANTIC_GROUPS.role` 동의어다 — 수상경력이 '팀에서 내가 맡은 역할'로
          // 그룹 밖에 있는 것과 **반대**이고, 그 차이가 화면을 가른다. `computeFormCards` 는
          // `visibleWhen` 을 보지 않고 이 라벨을 앵커로 삼으므로 **빈 코어 '내 역할/기여도'가 항상
          // dedup 된다** → '개인 작업'에서는 역할 칸이 하나도 남지 않는다. 확정본 §7 이 "'개인 작업'
          // 외 선택 시 노출"로 정한 그대로이므로 의도된 결과지만, 값이 든 코어는 `keepCoreOrExtended`
          // 가 남기므로 구 레코드는 잃지 않는다. 넷 다 form-cards.test.ts 가 고정한다 —
          // 라벨을 role 그룹 밖으로 옮기면 팀 작업에서 역할 칸이 두 벌이 된다.
        },
        // 확정본이 가이드라인을 '—' 로 비운 칸. month~month 는 코어 '기간' 과 같은 period 위젯이라
        // 구 `cw-info.제작 기간` 값을 그대로 실을 수 있다(RENAMED_FIELD_KEYS).
        createPeriodField('작업 기간', { required: true }),
        createOutcomeList('공개 / 전시 이력', {
          guide: '이 작품이 전시되거나 공개된 곳이 있다면 채널별로 리스트업해주세요.',
          placeholder: '예: 2024 학과 졸업전시',
          itemLabel: '공개 / 전시',
        }),
        createTagsField('사용 툴 / 기술', {
          guide: '사용한 도구, 소프트웨어, 기술을 태그로 추가해주세요.',
        }),
        // 확정본 '결과물 블록(artifact-blocks) — 다중 등록 가능'. FRT-213 이 셀 컬럼에 file·link 를
        // 열어 둔 덕에(SUPPORTED_CELL_TYPES) 신규 위젯 없이 표로 받는다.
        // ⚠️ 컬럼에 required 금지 — `isRequiredBlock` 은 컬럼 하나라도 required 면 표 전체를 필수로
        // 보고 `canHideBlock` 이 숨기지도 못한다. 공개 링크가 없는 작업은 영영 완료 불가가 된다(FRT-236).
        createRepeatableCell(
          '작품 링크 / 파일',
          [
            { key: 'link', label: '링크', blockType: 'link', placeholder: 'Behance, Vimeo, GitHub, Notion 등' },
            { key: 'file', label: '파일', blockType: 'file' },
            {
              key: 'desc',
              label: '설명',
              blockType: 'text',
              placeholder: '설명 (예: 최종 결과물, 프로세스 스케치, 발표 자료)',
            },
          ],
          {
            guide:
              '작품을 볼 수 있는 링크나 파일을 채널별로 첨부해주세요. 최종 결과물, 프로세스 문서, 발표 자료 등 여러 개 등록 가능해요.',
          },
        ),
      ],
    },
    {
      // "섹션 전체 선택"이므로 required 를 하나도 두지 않는다.
      id: 'creative-detail',
      category: 'detail',
      label: '작업 상세',
      blocks: [
        createTextareaField('작업 배경 / 컨셉', {
          guide: '이 작품을 만든 배경, 컨셉, 의도를 자유롭게 설명해주세요.',
          placeholder:
            '예: 지방 소도시의 사라져가는 골목 문화를 기록하고 싶어서 시작한 프로젝트로, 사진과 인터뷰를 결합한 잡지 형식으로 구성했습니다.',
        }),
        // 구 `cw-process.제작 과정` 은 단계별 4컬럼 표였다. 확정본은 서술형 한 칸이고 라벨이 같아
        // v1 라벨 매칭이 닿는 자리인데, repeatable-cell → textarea 는 `isInjectableInto` 가 막아
        // 표 값이 '기타' 로 보존된다(FRT-210 Codex P1 의 방어선이 v1 에서도 유일하게 작동하는 경로).
        createTextareaField('제작 과정', {
          guide: '어떤 단계로 진행됐고, 내가 어떤 결정을 내렸는지 적어주세요.',
          placeholder:
            '예: 3주 리서치 → 2주 컨셉 스케치 → 4주 촬영·인터뷰 → 3주 편집·디자인. 초반 방향이 너무 감성적이라 판단되어 중반부터 다큐멘터리 톤으로 재조정했습니다.',
        }),
        createTextareaField('반응 / 피드백', {
          guide:
            '조회수·관람객 반응·피드백뿐 아니라, 실제 배포·서비스 반영·클라이언트 채택·재사용된 사례도 함께 적어주세요.',
          placeholder:
            '예: Behance 조회수 5,000회 / 학과 졸업전시 우수작 선정 / 지역 소상공인 3곳이 실제 리뉴얼 시안으로 채택하여 사용 중',
        }),
        createTextareaField('이 작업이 나에게 남긴 것', {
          guide: '새로 익힌 기술이나 방법, 관점의 변화, 다음 작업에 이어갈 방향 — 무엇이든 좋아요.',
          placeholder:
            '예: 촬영보다 편집 단계에서 톤을 결정하는 감각을 처음 익혔고, 이후 작업할 때 촬영 전 편집 흐름을 먼저 스케치하는 습관이 생겼습니다.',
        }),
        // 확정본 설계 노트: 구 🌱 개인 프로젝트 태그는 ① '개인/팀' 과 중복이라 삭제됐다 — 되살리지 말 것.
        createMoodTagField('작품 성격', [...CREATIVE_MOOD_TAGS], {
          guide: '이 작품의 성격을 태그로 표현해주세요.',
        }),
      ],
    },
  ]
}

function sportsExtensions(): TemplateSection[] {
  return [
    {
      id: 'sports-info',
      category: 'basic',
      label: '운동 정보',
      blocks: [
        createTextField('종목', { required: true }),
        createPeriodField('기간', { required: true }),
        createTextareaField('목표'),
        createTextField('현재 수준'),
        createTextField('훈련 계획'),
      ],
    },
    {
      id: 'sports-log',
      category: 'repeat',
      label: '기록 로그',
      collapsed: true,
      blocks: [
        createRepeatableCell('기록 로그', [
          { key: 'date', label: '날짜', blockType: 'date', required: true },
          { key: 'content', label: '훈련 내용', blockType: 'textarea', required: true },
          { key: 'record', label: '기록', blockType: 'text' },
          { key: 'memo', label: '컨디션/메모', blockType: 'textarea' },
        ]),
        createTextareaField('대회/인증'),
        createTextareaField('변화/성과'),
        createFileField('꾸준함 증거'),
      ],
    },
  ]
}

const READING_GENRE_OPTIONS = [
  '인문/철학',
  '역사',
  '사회/정치',
  '경제/경영',
  '자기계발',
  '과학/기술',
  '심리/뇌과학',
  '예술/문화',
  '소설/문학',
  '에세이/시',
  '전공/학술',
  '기타',
] as const

/** 확정본 ③ 은 별점을 이모지+괄호 표기 그대로 적었다 — 표기를 바꾸면 저장된 선택값이 어긋난다. */
const READING_RATING_OPTIONS = [
  '⭐⭐⭐⭐⭐ (강력 추천)',
  '⭐⭐⭐⭐ (추천)',
  '⭐⭐⭐ (괜찮았음)',
  '⭐⭐ (아쉬웠음)',
  '⭐ (별로)',
] as const

// 독서 — 확정본(독서_final). 구 `reading-info`/`reading-apply` 를 `book-*` 로 **전면 교체**한다.
// 섹션 id 를 가는 것이 이 작업의 안전 장치다(FRT-210 과 같은 이유): 구 '읽은 기간/완독일'(text)이
// 확정본에선 period, 구 '인상 깊은 문장'(textarea)은 개조식 리스트라, id 를 유지하면 안정키가
// 같아져 injectValue 는 값을 안 싣고 그 키는 consumedKeys 에 잡혀 orphan 안전망까지 건너뛴다 —
// 값이 '기타' 카드에도 없이 사라진다.
//
// 확정본 3섹션이 화면에선 4카드가 된다: 폼은 고정 4카테고리로 접히고 core '증빙 자료'가 항상
// evidence 버킷에 들어간다. 확정본 ③ '평가'를 evidence 에 두지 않는 이유는 그 때문이다 —
// '평가' 라는 이름의 카드에 파일 첨부칸이 딸려온다. detail 에 합치고 라벨만 바꾼다.
function readingExtensions(): TemplateSection[] {
  return [
    {
      id: 'book-info',
      category: 'basic',
      label: '도서 정보',
      blocks: [
        createTextField('도서명', {
          required: true,
          guide: '읽은 책의 정확한 제목을 적어주세요.',
          placeholder: '예: 사피엔스',
        }),
        // 확정본 ① 에서 '선택' 표기가 없는 셋(도서명·저자·독서 기간)만 필수다.
        createTextField('저자', {
          required: true,
          guide: '저자의 이름을 적어주세요.',
          placeholder: '예: 유발 하라리',
        }),
        createSelectField('장르 / 분야', [...READING_GENRE_OPTIONS], {
          guide:
            '이 책이 속한 분야를 선택해주세요. 여러 분야에 걸쳐 있다면 가장 대표되는 분야 기준으로 선택해주세요.',
        }),
        // 확정본이 가이드라인을 '—' 로 비운 칸 — 없는 문구를 지어내지 않는다.
        createTextField('페이지 수', { placeholder: '예: 512쪽' }),
        createPeriodField('독서 기간', {
          required: true,
          guide: '이 책을 읽기 시작하고 끝낸 시기를 선택해주세요.',
        }),
        createTextareaField('독서 이유', {
          guide: '이 책을 읽게 된 계기가 있다면 적어주세요.',
          placeholder:
            '예: 교양 수업에서 추천 도서로 언급되어 관심이 생겼고, 인류사를 새로운 관점에서 이해하고 싶어 읽기 시작했습니다.',
        }),
        createTextField('한 줄 감상', {
          guide: '이 책을 한 줄로 정리한다면?',
          placeholder: '예: 인류의 역사를 새로운 시각으로 바라보게 해준 책',
        }),
        createTextareaField('요약', {
          guide: '책의 전체 내용을 자유롭게 요약해주세요.',
          placeholder:
            '예: 인류 진화의 큰 흐름을 인지혁명·농업혁명·과학혁명이라는 세 가지 축으로 재구성한 책',
        }),
        createOutcomeList('인상 깊었던 문장', {
          // 확정본 원문은 "아래 감상 세부기록에서" 라고 코드에 없는 섹션명을 가리킨다 —
          // 안내가 화면에 없는 것을 가리키면 그게 더 큰 혼선이라 실제 카드명으로 맞췄다(FRT-177).
          guide:
            "기억하고 싶은 문장이나 구절을 항목별로 정리해주세요. 아래 '문장별 감상'에서 문장마다 생각을 남길 수 있어요.",
          placeholder: '예: 우리가 사는 세계는 대부분 상상의 산물이다',
          itemLabel: '문장',
          // 확정본의 '↻ 문장 동기화'(섹션 상단 일괄 버튼)를 새로 만들지 않고 어학능력(FRT-210)의
          // '상세 기록' 링크를 재사용한다. 행마다 버튼이 붙는 대신, 확정본이 명세하지 않은 지점
          // (문장을 지웠을 때 그 감상을 어떻게 하는가)에서 감상이 조용히 사라지지 않는다.
          // titleColumnKey 는 반드시 명시한다(columns[0] 의존은 FRT-178 에서 깨진 전제).
          link: { targetSectionId: 'book-quotes', titleColumnKey: 'quote', label: '감상 남기기' },
        }),
      ],
    },
    {
      id: 'book-reflection',
      category: 'detail',
      label: '감상과 평가',
      blocks: [
        // 확정본 설계 노트: 기존 '배운 점'·'생각의 변화' 2필드를 하나로 통합했다. 대학생이 둘을
        // 명확히 구분해 쓰기 어려워 결국 하나만 채우던 문제를 없애는 것이 목적이므로 다시 쪼개지 말 것.
        createTextareaField('이 책이 나에게 남긴 것', {
          guide: '새롭게 알게 된 지식, 관점의 변화, 앞으로 남길 습관 — 무엇이든 좋아요.',
          placeholder:
            "예: 화폐가 물리적 실체가 아닌 사회적 합의로 유지된다는 관점을 처음 이해했고, 이후 '왜 사람들이 이것을 믿는가'를 먼저 묻는 습관이 생겼습니다.",
        }),
        // 확정본 ③ 은 이 칸의 가이드라인 자리에 선택지 목록만 적었다 — guide 를 지어내지 않는다.
        createSelectField('별점', [...READING_RATING_OPTIONS]),
      ],
    },
    {
      // 확정본은 이 카드의 컬럼을 명세하지 않았다. "굳이 모두 채울 필요는 없어요" 라고 못 박은
      // 만큼 입력 부담 최소화가 설계 의도이므로 2컬럼을 넘기지 말 것.
      id: 'book-quotes',
      category: 'repeat',
      label: '문장별 감상',
      blocks: [
        createRepeatableCell('문장별 감상', [
          {
            // ⚠️ required 를 붙이지 말 것. `isRequiredBlock` 은 **컬럼 하나라도 required 면
            // 표 블록 전체를 필수로** 보고, 그러면 문장을 하나도 안 적은 사용자는 이 카드를
            // 영영 완료할 수 없는 데다(빈 표는 `isCardComplete` 를 못 채운다) 필수 블록은
            // `canHideBlock` 이 숨기지도 못하게 해 치울 방법조차 없다. 확정본 ②는 "섹션 전체
            // 선택"이고 카드 안내도 "굳이 모두 채울 필요는 없어요"다 — 진행도가 그 반대를
            // 요구하면 안내가 거짓말이 된다.
            key: 'quote',
            label: '문장',
            blockType: 'text',
            guide: '위에서 기록한 문장이 여기에 채워져요.',
          },
          {
            key: 'impression',
            label: '이 문장에 대한 생각',
            blockType: 'textarea',
            guide: '이 문장이 왜 마음에 남았는지, 어떤 생각이 들었는지 적어주세요.',
          },
        ]),
      ],
    },
  ]
}

function journalExtensions(): TemplateSection[] {
  return [
    {
      id: 'journal-info',
      category: 'basic',
      label: '기록 정보',
      blocks: [
        createTextField('기록 주제', { required: true, placeholder: '주간 회고, 학습 일지, 감정 기록 등' }),
        createDateField('기록 날짜'),
        createSelectField('기록 빈도', ['매일', '주1회', '월1회', '비정기']),
        createTextareaField('기록 트리거'),
        createTextareaField('오늘/이번 주에 한 일', { required: true }),
        createTextareaField('잘한 점 1개'),
        createTextareaField('아쉬운 점 1개'),
        createTextareaField('배운 점 1개'),
        createTextareaField('다음 행동 1개'),
      ],
    },
    {
      id: 'journal-insights',
      category: 'repeat',
      label: '인사이트/패턴',
      collapsed: true,
      blocks: [
        createRepeatableCell('인사이트/패턴', [
          { key: 'pattern', label: '발견한 패턴', blockType: 'text', required: true },
          { key: 'evidence', label: '근거', blockType: 'text' },
          { key: 'change', label: '바꿀 행동', blockType: 'textarea' },
        ]),
        createFileField('첨부'),
      ],
    },
  ]
}

function goalExtensions(): TemplateSection[] {
  return [
    {
      id: 'goal-info',
      category: 'basic',
      label: '목표 정보',
      blocks: [
        createTextField('목표명', { required: true }),
        createPeriodField('기간', { required: true }),
        createSelectField('목표 유형', ['학습', '커리어', '건강', '프로젝트', '기타']),
        createSelectField('목표 수준', ['상', '중', '하']),
        createTextareaField('성공 기준', { required: true, placeholder: '어떻게 되면 성공인가?' }),
      ],
    },
    {
      id: 'goal-plan',
      category: 'repeat',
      label: '세부 계획',
      blocks: [
        createRepeatableCell('세부 계획', [
          { key: 'task', label: '할 일', blockType: 'text', required: true },
          { key: 'deadline', label: '마감일', blockType: 'date' },
          { key: 'estimate', label: '예상 소요', blockType: 'text' },
          { key: 'priority', label: '우선순위', blockType: 'text' },
          { key: 'checkpoint', label: '체크포인트/측정 지표', blockType: 'textarea' },
        ]),
      ],
    },
    {
      id: 'goal-progress',
      category: 'repeat',
      label: '진행 기록',
      collapsed: true,
      blocks: [
        createRepeatableCell('진행 기록', [
          { key: 'date', label: '날짜', blockType: 'date', required: true },
          { key: 'content', label: '진행 내용', blockType: 'textarea', required: true },
          { key: 'blocker', label: '막힌 점/리스크', blockType: 'textarea' },
          { key: 'next', label: '다음 액션', blockType: 'textarea' },
        ]),
        createFileField('증빙'),
      ],
    },
  ]
}

// ─── Template assembly ──────────────────────────────────────────

const extensionMap: Record<ExperienceTypeId, () => TemplateSection[]> = {
  'education': educationExtensions,
  'extracurricular': extracurricularExtensions,
  'academic-society': academicSocietyExtensions,
  'club': clubExtensions,
  'career': careerExtensions,
  'award': awardExtensions,
  'certification': certificationExtensions,
  'language': languageExtensions,
  'research': researchExtensions,
  'personal-project': personalProjectExtensions,
  'team-project': teamProjectExtensions,
  'volunteer': volunteerExtensions,
  'overseas': overseasExtensions,
  'creative-work': creativeWorkExtensions,
  'sports': sportsExtensions,
  'reading': readingExtensions,
  'journal': journalExtensions,
  'goal': goalExtensions,
}

/**
 * 템플릿 스키마 버전. content.template_version 으로 저장되어 향후 필드 셋 변경 추적에 쓰인다.
 * (안정키 기반 additive 변경은 마이그레이션 불필요 — 키가 곧 정체성)
 *
 * 2 — 어학능력 확정본 정렬(FRT-210). 섹션 id 를 `lang-info`/`lang-usage` 에서 4개로 갈아치워
 *     안정키가 통째로 바뀌었다. 아래 `withSectionKeys` 규약이 요구하는 bump 다.
 * 3 — 독서 확정본 정렬(FRT-236). 같은 이유 — `reading-info`/`reading-apply` 를 `book-*` 3개로
 *     갈아치웠다. 규약이 유형별 예외를 두지 않으므로 어학과 같은 대우를 한다.
 * 4 — 봉사 확정본 정렬(FRT-247). 같은 이유 — `vol-info` 를 `volunteer-info`/`volunteer-reflection`
 *     으로 갈아치웠다.
 * 5 — 해외경험 확정본 정렬(FRT-249). 같은 이유 — `overseas-info`/`overseas-challenges` 를
 *     `overseas-program`/`overseas-reflection`/`overseas-activities` 로 갈아치웠다.
 * 6 — 창작물 확정본 정렬(FRT-267). 같은 이유 — `cw-info`/`cw-process` 를 `creative-info`/
 *     `creative-detail` 로 갈아치웠다.
 *
 * ⚠️ 이 카운터는 **전역 하나**인데 라벨 변경은 유형별로 따로 들어온다. 그래서 `1` 은 단일 레이아웃을
 * 가리키지 않는다 — 자격증·대외활동·동아리·수상경력 확정본 정렬(FRT-177/178/179/211)이 모두 `1`
 * 아래에서 라벨을 바꿨다. 버전으로 "이 레코드가 어느 필드 셋인가"를 판정하지 말 것. 값 보존의 실제
 * 방어선은 키 층위다 — `RENAMED_FIELD_KEYS`(순수 개명 이관) + `orphanFieldsToBlocks`(나머지 보존).
 */
export const TEMPLATE_VERSION = 6

/**
 * 섹션 블록에 안정 시맨틱 키(`${sectionId}.${label}`)를 부여한다.
 * sectionId 는 타입별로 고정·고유하고, 섹션 내 라벨도 고유하므로 레코드 내 충돌이 없다.
 *
 * ⚠️ 키가 라벨에서 파생되므로 **라벨 = 영속 정체성의 일부**다. 따라서 라벨 변경은
 * "단순 표기 수정"이 아니라 **breaking change** 다. 라벨을 바꾸려면 반드시 `TEMPLATE_VERSION`
 * 을 올리고 v(N-1)→vN content 마이그레이션(구 key→신 key 재매핑)을 동반해야 한다.
 * 그렇지 않으면 기존 레코드 값이 구 key 에 남아 폼/상세에서 사라진다.
 * (라벨과 완전 분리된 명시적 field id 도입은 FRT-70 레지스트리 단일화 후속 과제.)
 */
function withSectionKeys(section: TemplateSection): TemplateSection {
  return {
    ...section,
    blocks: section.blocks.map(b => ({ ...b, key: `${section.id}.${b.label}` })),
  }
}

function buildTemplate(typeId: ExperienceTypeId): TemplateV2 {
  const info = EXPERIENCE_TYPE_MAP[typeId]
  const typeExtensions = extensionMap[typeId]()
  // 유형이 자기 '경험 상세'(category: 'detail') 섹션을 정의하면 범용 확장 섹션을 건너뛰고
  // 설정 섹션(공개 설정)만 유지한다 — 경험 상세 UI 를 유형별로 온전히 소유하게 한다.
  const hasCustomDetail = typeExtensions.some(s => s.category === 'detail')
  const sharedExtended = hasCustomDetail ? buildSettingsSection() : buildExtendedSection()
  return {
    id: `sys-${typeId}`,
    typeId,
    label: info.label,
    icon: info.icon,
    commonCore: withSectionKeys(buildCommonCore(typeId)),
    extensions: [sharedExtended, ...typeExtensions].map(withSectionKeys),
    isSystem: true,
  }
}

export const SYSTEM_TEMPLATES_V2: TemplateV2[] = EXPERIENCE_TYPES.map(t => buildTemplate(t.id))

export const TEMPLATE_MAP: Record<ExperienceTypeId, TemplateV2> =
  Object.fromEntries(SYSTEM_TEMPLATES_V2.map(t => [t.typeId, t])) as Record<ExperienceTypeId, TemplateV2>

/** Get a fresh template instance (with new block IDs) for a given type */
export function getTemplateForType(typeId: ExperienceTypeId): TemplateV2 {
  return buildTemplate(typeId)
}
