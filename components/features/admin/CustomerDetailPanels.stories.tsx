import type { Meta, StoryObj } from "@storybook/nextjs";

import {
  CustomerDetailError,
  CustomerDetailPanels,
  CustomerDetailSkeleton,
  CustomerNotFound,
} from "./CustomerDetailPanels";
import type { AdminCustomerDetail } from "@/types/admin";

// FRT-17 UI Spec 상태 매트릭스. 백엔드(BAC-17)가 없으므로 이 스토리들이 상세 화면을 실제로
// 확인할 수 있는 유일한 경로다.
const base: AdminCustomerDetail = {
  customer: {
    id: "c1",
    email: "jiwoo.kim@example.com",
    name: "김지우",
    status: "verified",
    onboarded: true,
    createdAt: "2026-03-14T02:11:00Z",
    withdrawnAt: null,
    authProviders: ["google"],
  },
  profile: {
    school: "○○대학교",
    department: "경영학과",
    affiliation: "대학생",
    affiliationDetail: "4학년 재학",
    company: null,
    desiredRole: "프로덕트 매니저",
  },
  activity: {
    experiences: {
      total: 12,
      lastAt: "2026-07-21T04:00:00Z",
      byStatus: null,
    },
    individualAnalyses: {
      total: 8,
      lastAt: "2026-07-20T09:00:00Z",
      byStatus: { success: 7, failed: 1 },
    },
    comprehensiveAnalyses: {
      total: 2,
      lastAt: "2026-07-15T09:00:00Z",
      byStatus: { success: 2 },
    },
    keywordAnalyses: {
      total: 3,
      lastAt: "2026-07-18T09:00:00Z",
      byStatus: { success: 2, queued: 1 },
    },
    resumes: {
      total: 4,
      lastAt: "2026-07-19T09:00:00Z",
      byStatus: { success: 4 },
    },
  },
};

const meta: Meta<typeof CustomerDetailPanels> = {
  title: "Features/Admin/CustomerDetailPanels",
  component: CustomerDetailPanels,
  parameters: {
    layout: "padded",
    nextjs: { appDirectory: true },
  },
};

export default meta;

type Story = StoryObj<typeof CustomerDetailPanels>;

/** 기본 — 계정·프로필·활동이 모두 채워진 고객. */
export const Populated: Story = {
  args: { detail: base },
};

/** 온보딩 전 — 프로필 자체가 없다(있으나 비어 있는 것과 다른 안내). */
export const NoProfile: Story = {
  args: {
    detail: {
      ...base,
      customer: { ...base.customer, name: null, onboarded: false },
      profile: null,
    },
  },
};

/** 온보딩은 했으나 프로필 항목을 하나도 채우지 않은 경우. */
export const EmptyProfile: Story = {
  args: {
    detail: {
      ...base,
      profile: {
        school: null,
        department: null,
        affiliation: null,
        affiliationDetail: null,
        company: null,
        desiredRole: null,
      },
    },
  },
};

/** 가입만 하고 아무 활동이 없는 고객 — 0건은 정상이며 빈 상태가 아니다. */
export const ZeroActivity: Story = {
  args: {
    detail: {
      ...base,
      activity: {
        experiences: { total: 0, lastAt: null, byStatus: null },
        individualAnalyses: { total: 0, lastAt: null, byStatus: {} },
        comprehensiveAnalyses: { total: 0, lastAt: null, byStatus: {} },
        keywordAnalyses: { total: 0, lastAt: null, byStatus: {} },
        resumes: { total: 0, lastAt: null, byStatus: {} },
      },
    },
  },
};

/**
 * 활동 집계 미상 — 서버가 항목을 주지 않았거나 건수가 숫자가 아니었다.
 * 0건(활동 없음)과 다르게 "—"로 그려야 운영자가 집계 실패를 알아챈다.
 */
export const UnknownActivity: Story = {
  args: {
    detail: {
      ...base,
      activity: {
        experiences: { total: null, lastAt: null, byStatus: null },
        individualAnalyses: null,
        comprehensiveAnalyses: null,
        keywordAnalyses: null,
        resumes: null,
      },
    },
  },
};

/** 실패한 분석이 쌓인 고객 — 운영이 가장 먼저 찾아야 하는 화면. */
export const WithFailures: Story = {
  args: {
    detail: {
      ...base,
      activity: {
        ...base.activity,
        individualAnalyses: {
          total: 9,
          lastAt: "2026-07-22T09:00:00Z",
          byStatus: { success: 3, failed: 5, queued: 1 },
        },
      },
    },
  },
};

/** 탈퇴한 고객 — 상태 배지와 별도로 탈퇴 배지·탈퇴일이 붙는다. */
export const Withdrawn: Story = {
  args: {
    detail: {
      ...base,
      customer: {
        ...base.customer,
        withdrawnAt: "2026-07-01T00:00:00Z",
      },
    },
  },
};

/** 이메일+비밀번호 가입(소셜 계정 없음) + 이메일 미인증. */
export const PasswordAccountUnverified: Story = {
  args: {
    detail: {
      ...base,
      customer: {
        ...base.customer,
        status: "unverified",
        authProviders: [],
      },
    },
  },
};

/** 백엔드가 상태 enum 을 늘렸을 때 — 라벨을 지어내지 않고 원문을 노출한다. */
export const UnknownStatus: Story = {
  args: {
    detail: {
      ...base,
      customer: { ...base.customer, status: "pending_review" },
    },
  },
};

export const Loading: StoryObj<typeof CustomerDetailSkeleton> = {
  render: () => <CustomerDetailSkeleton />,
};

export const ErrorState: StoryObj<typeof CustomerDetailError> = {
  render: () => <CustomerDetailError onRetry={() => {}} />,
};

/** 없는 고객 — 다시 시도 버튼이 없어야 한다(재시도해도 영원히 실패한다). */
export const NotFound: StoryObj<typeof CustomerNotFound> = {
  render: () => <CustomerNotFound />,
};
