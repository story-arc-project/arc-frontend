import type { TemplateV2, TemplateSection, ExperienceTypeInfo, ExperienceTypeId } from '@/types/archive'
import {
  createTextField,
  createTextareaField,
  createDateField,
  createPeriodField,
  createSelectField,
  createChecklistField,
  createTagsField,
  createLinkField,
  createFileField,
  createRepeatableCell,
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

function buildCommonCore(): TemplateSection {
  return {
    id: 'core',
    label: '기본 정보',
    blocks: [
      createTextField('경험명', { required: true, placeholder: '경험의 이름을 입력하세요' }),
      createPeriodField('기간', { required: true }),
      createTextField('한 줄 요약', { placeholder: '이 경험을 한 줄로 요약해주세요' }),
      createTextareaField('내 역할/기여도', { placeholder: '내가 맡은 역할과 기여한 부분을 작성해주세요' }),
      createTextareaField('핵심 성과', { placeholder: '주요 성과나 결과를 작성해주세요' }),
      createFileField('증빙 자료'),
    ],
  }
}

// ─── Extended Input (optional, shared) ──────────────────────────

function buildExtendedSection(): TemplateSection {
  return {
    id: 'extended',
    label: '확장 입력 (선택)',
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

// ─── Template Builders (per type) ───────────────────────────────

function educationExtensions(): TemplateSection[] {
  return [
    {
      id: 'edu-info',
      label: '학교 정보',
      blocks: [
        createTextField('학교명', { required: true, placeholder: '○○대학교' }),
        createTextField('전공', { placeholder: '컴퓨터공학과' }),
        createSelectField('재학/졸업 상태', ['재학중', '졸업', '휴학중', '졸업예정']),
        createDateField('입학일'),
        createDateField('졸업(예정)일'),
        createFileField('전체 학기 성적표'),
      ],
    },
    {
      id: 'edu-courses',
      label: '수업 기록',
      blocks: [
        createRepeatableCell('수업 기록', [
          { key: 'course_name', label: '수업명', blockType: 'text', required: true },
          { key: 'professor', label: '교수', blockType: 'text' },
          { key: 'department', label: '담당 전공 학과', blockType: 'text' },
          { key: 'semester', label: '수강 학기/연도', blockType: 'text', required: true },
          { key: 'grade', label: '취득 성적', blockType: 'text' },
          { key: 'summary', label: '수업 요약', blockType: 'textarea' },
          { key: 'achievement', label: '핵심 성과 기록', blockType: 'textarea' },
          { key: 'team_project', label: '팀프로젝트/과제 내용', blockType: 'textarea' },
        ]),
        createTagsField('커리어에 준 영향'),
      ],
    },
  ]
}

function extracurricularExtensions(): TemplateSection[] {
  return [
    {
      id: 'extra-info',
      label: '활동 정보',
      blocks: [
        createTextField('활동명', { required: true }),
        createTextField('주최/기관명'),
        createPeriodField('기간', { required: true }),
        createFileField('활동 인증서'),
        createTextField('직책/역할', { required: true }),
        createTextareaField('지원 동기'),
      ],
    },
    {
      id: 'extra-detail',
      label: '활동내용 상세',
      collapsed: true,
      blocks: [
        createTextareaField('담당 업무/미션'),
        createRepeatableCell('내가 한 일', [
          { key: 'action', label: '행동', blockType: 'textarea' },
        ]),
        createTextareaField('협업/커뮤니케이션 방식'),
        createRepeatableCell('결과/성과', [
          { key: 'type', label: '성과 유형', blockType: 'text' },
          { key: 'metric', label: '수치', blockType: 'text' },
          { key: 'description', label: '설명', blockType: 'textarea' },
        ]),
        createFileField('결과물/작업물'),
        createTextField('추천인/증언'),
      ],
    },
  ]
}

function academicSocietyExtensions(): TemplateSection[] {
  return [
    {
      id: 'society-info',
      label: '학회 정보',
      blocks: [
        createTextField('학회명', { required: true }),
        createTextareaField('학회 소개'),
        createLinkField('공식 URL/웹사이트'),
        createPeriodField('기간', { required: true }),
        createFileField('활동 인증서'),
        createTextareaField('지원 동기'),
        createTextField('역할/직책', { required: true }),
      ],
    },
    {
      id: 'society-projects',
      label: '프로젝트/연구활동 기록',
      blocks: [
        createRepeatableCell('프로젝트/연구활동', [
          { key: 'name', label: '프로젝트/연구활동명', blockType: 'text', required: true },
          { key: 'period', label: '세부 기간', blockType: 'text', required: true },
          { key: 'role', label: '직책/역할', blockType: 'text', required: true },
          { key: 'goal', label: '연구/프로젝트 목표', blockType: 'textarea' },
          { key: 'work', label: '내가 한 일', blockType: 'textarea' },
          { key: 'result', label: '핵심 성과', blockType: 'textarea' },
          { key: 'presentation', label: '발표/포스터/세미나 여부', blockType: 'text' },
          { key: 'feedback', label: '피드백/질문과 대응', blockType: 'textarea' },
        ]),
      ],
    },
  ]
}

function clubExtensions(): TemplateSection[] {
  return [
    {
      id: 'club-info',
      label: '동아리/단체 정보',
      blocks: [
        createTextField('동아리/단체명', { required: true }),
        createTextareaField('단체 소개'),
        createPeriodField('기간', { required: true }),
        createFileField('활동 인증서/수료 증빙'),
        createTextField('직책/역할', { required: true }),
      ],
    },
    {
      id: 'club-activities',
      label: '활동 기록',
      blocks: [
        createRepeatableCell('활동 기록', [
          { key: 'name', label: '활동명', blockType: 'text', required: true },
          { key: 'period', label: '세부 기간', blockType: 'text' },
          { key: 'role', label: '직책/역할', blockType: 'text' },
          { key: 'detail', label: '활동내용 상세', blockType: 'textarea' },
          { key: 'result', label: '행사/운영 성과', blockType: 'textarea' },
        ]),
      ],
    },
  ]
}

function careerExtensions(): TemplateSection[] {
  return [
    {
      id: 'career-info',
      label: '근무 정보',
      blocks: [
        createTextField('회사명', { required: true }),
        createPeriodField('재직기간', { required: true }),
        createSelectField('고용 형태', ['인턴', '계약직', '정규직', '프리랜서']),
        createTextField('직책/직급', { required: true }),
        createTextField('직무(업무분야)', { required: true }),
        createTextField('급여'),
        createTextareaField('지원 동기'),
        createTextField('팀/조직'),
        createSelectField('근무 형태', ['재택', '출근', '혼합']),
      ],
    },
    {
      id: 'career-tasks',
      label: '업무내용 기록',
      blocks: [
        createRepeatableCell('업무내용', [
          { key: 'project', label: '프로젝트/업무명', blockType: 'text', required: true },
          { key: 'period', label: '세부 기간', blockType: 'text' },
          { key: 'role', label: '역할', blockType: 'text', required: true },
          { key: 'detail', label: '업무내용 상세', blockType: 'textarea' },
          { key: 'tools', label: '활용 툴', blockType: 'text' },
          { key: 'collaboration', label: '협업 대상', blockType: 'text' },
          { key: 'metrics', label: '성과 지표', blockType: 'textarea' },
          { key: 'risk', label: '리스크/이슈 및 대응', blockType: 'textarea' },
        ]),
        createTextareaField('퇴사 사유'),
      ],
    },
  ]
}

function awardExtensions(): TemplateSection[] {
  return [
    {
      id: 'award-info',
      label: '수상 정보',
      blocks: [
        createTextField('수상명', { required: true }),
        createTextField('주최/기관', { required: true }),
        createDateField('수상일'),
        createTextField('대회/프로그램명'),
        createSelectField('수상 구분', ['대상', '최우수', '우수', '장려', '기타']),
        createSelectField('참가 형태', ['개인', '팀']),
        createTextField('팀명/팀원'),
        createTextareaField('평가 기준/요구사항'),
        createTextareaField('내 역할/기여', { required: true }),
        createFileField('제출물/발표 자료'),
        createFileField('수상 증빙'),
        createTextareaField('핵심 성과'),
        createTagsField('이 수상이 의미하는 역량'),
      ],
    },
  ]
}

function certificationExtensions(): TemplateSection[] {
  return [
    {
      id: 'cert-info',
      label: '자격증 정보',
      blocks: [
        createTextField('자격증명', { required: true }),
        createTextField('발급 기관', { required: true }),
        createDateField('취득일'),
        createTextField('유효기간/갱신 필요 여부'),
        createTextField('자격 번호'),
        createTextField('성적/등급'),
        createPeriodField('준비 기간'),
        createSelectField('학습 방식', ['강의', '독학', '스터디', '부트캠프']),
        createLinkField('핵심 공부 자료'),
      ],
    },
    {
      id: 'cert-applied',
      label: '실무 적용 사례',
      collapsed: true,
      blocks: [
        createRepeatableCell('실무 적용 사례', [
          { key: 'situation', label: '적용 상황/프로젝트명', blockType: 'text', required: true },
          { key: 'work', label: '내가 한 일', blockType: 'textarea' },
          { key: 'result', label: '결과/효과', blockType: 'textarea' },
        ]),
        createFileField('자격증 증빙'),
      ],
    },
  ]
}

function languageExtensions(): TemplateSection[] {
  return [
    {
      id: 'lang-info',
      label: '어학 정보',
      blocks: [
        createTextField('언어', { required: true, placeholder: '영어' }),
        createTextField('시험/인증명', { placeholder: 'TOEIC / OPIc / TOEFL 등' }),
        createTextField('점수/등급'),
        createDateField('응시일'),
        createTextField('유효기간'),
        createChecklistField('강점 영역', ['듣기', '읽기', '말하기', '쓰기']),
        createPeriodField('학습 기간'),
        createSelectField('학습 방식', ['학원', '독학', '회화', '첨삭', '스터디']),
      ],
    },
    {
      id: 'lang-usage',
      label: '실제 활용 사례',
      collapsed: true,
      blocks: [
        createRepeatableCell('활용 사례', [
          { key: 'situation', label: '상황', blockType: 'text', required: true, placeholder: '발표/회의/여행/업무 등' },
          { key: 'role', label: '내가 한 역할', blockType: 'textarea' },
          { key: 'difficulty', label: '어려웠던 점과 해결', blockType: 'textarea' },
          { key: 'result', label: '결과', blockType: 'textarea' },
        ]),
      ],
    },
  ]
}

function researchExtensions(): TemplateSection[] {
  return [
    {
      id: 'research-info',
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

function volunteerExtensions(): TemplateSection[] {
  return [
    {
      id: 'vol-info',
      label: '봉사 정보',
      blocks: [
        createTextField('봉사활동명', { required: true }),
        createTextField('기관/장소'),
        createPeriodField('기간', { required: true }),
        createTextField('총 시간'),
        createSelectField('대상', ['아동', '노인', '동물', '환경', '기타']),
        createSelectField('활동 형태', ['오프라인', '온라인', '기획', '현장']),
        createTextareaField('내 역할', { required: true }),
        createTextareaField('활동 내용'),
        createTextareaField('임팩트/변화'),
        createTextareaField('느낀 점/가치관 변화'),
        createFileField('봉사 확인서'),
      ],
    },
  ]
}

function overseasExtensions(): TemplateSection[] {
  return [
    {
      id: 'overseas-info',
      label: '해외 경험 정보',
      blocks: [
        createSelectField('경험 유형', ['교환학생', '연수', '여행', '해외 인턴', '기타']),
        createTextField('국가/도시', { required: true }),
        createPeriodField('기간', { required: true }),
        createTextareaField('목적'),
        createTextareaField('활동 요약', { required: true }),
        createTextField('언어 사용 수준'),
      ],
    },
    {
      id: 'overseas-challenges',
      label: '어려웠던 상황',
      collapsed: true,
      blocks: [
        createRepeatableCell('어려웠던 상황', [
          { key: 'situation', label: '상황', blockType: 'text', required: true },
          { key: 'response', label: '내가 한 대응', blockType: 'textarea' },
          { key: 'result', label: '결과', blockType: 'textarea' },
          { key: 'lesson', label: '배운 점', blockType: 'textarea' },
        ]),
        createTextareaField('성과/산출물'),
        createFileField('증빙'),
      ],
    },
  ]
}

function creativeWorkExtensions(): TemplateSection[] {
  return [
    {
      id: 'cw-info',
      label: '작품 정보',
      blocks: [
        createTextField('작품/작업물명', { required: true }),
        createSelectField('분야', ['디자인', '글', '영상', '음악', '사진', '일러스트', '기타']),
        createPeriodField('제작 기간'),
        createTextField('한 줄 소개', { required: true }),
        createTextareaField('의도/주제'),
        createTagsField('사용 도구'),
      ],
    },
    {
      id: 'cw-process',
      label: '제작 과정',
      collapsed: true,
      blocks: [
        createRepeatableCell('제작 과정', [
          { key: 'step', label: '단계명', blockType: 'text', required: true },
          { key: 'work', label: '한 일', blockType: 'textarea' },
          { key: 'decision', label: '고민/결정', blockType: 'textarea' },
          { key: 'result', label: '결과', blockType: 'textarea' },
        ]),
        createLinkField('공개 링크'),
        createTextareaField('반응/성과'),
        createTextField('저작권/사용 범위'),
      ],
    },
  ]
}

function sportsExtensions(): TemplateSection[] {
  return [
    {
      id: 'sports-info',
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

function readingExtensions(): TemplateSection[] {
  return [
    {
      id: 'reading-info',
      label: '독서 정보',
      blocks: [
        createTextField('도서명', { required: true }),
        createTextField('저자'),
        createTextField('읽은 기간/완독일'),
        createTextareaField('읽은 이유'),
        createTextareaField('핵심 요약 (3줄)', { required: true }),
        createTextareaField('인상 깊은 문장'),
      ],
    },
    {
      id: 'reading-apply',
      label: '적용/실험',
      collapsed: true,
      blocks: [
        createRepeatableCell('적용/실험', [
          { key: 'topic', label: '적용할 주제', blockType: 'text', required: true },
          { key: 'action', label: '내가 한 행동', blockType: 'textarea' },
          { key: 'result', label: '결과/느낀 점', blockType: 'textarea' },
        ]),
        createLinkField('관련 자료'),
        createTextField('추천 대상'),
      ],
    },
  ]
}

function journalExtensions(): TemplateSection[] {
  return [
    {
      id: 'journal-info',
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

function buildTemplate(typeId: ExperienceTypeId): TemplateV2 {
  const info = EXPERIENCE_TYPE_MAP[typeId]
  const typeExtensions = extensionMap[typeId]()
  return {
    id: `sys-${typeId}`,
    typeId,
    label: info.label,
    icon: info.icon,
    commonCore: buildCommonCore(),
    extensions: [buildExtendedSection(), ...typeExtensions],
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
