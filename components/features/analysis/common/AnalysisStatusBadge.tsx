type DisplayStatus = "pending" | "completed" | "updated";

const config: Record<DisplayStatus, { label: string; className: string }> = {
  pending: {
    label: "대기 중",
    className: "bg-surface-tertiary text-text-tertiary",
  },
  completed: {
    label: "분석 완료",
    className: "bg-surface-success text-success",
  },
  updated: {
    label: "업데이트됨",
    className: "bg-surface-brand text-brand",
  },
};

interface AnalysisStatusBadgeProps {
  status: DisplayStatus;
  className?: string;
}

export default function AnalysisStatusBadge({ status, className = "" }: AnalysisStatusBadgeProps) {
  const { label, className: badgeClass } = config[status];
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-caption font-medium leading-none",
        badgeClass,
        className,
      ].join(" ")}
    >
      {label}
    </span>
  );
}
