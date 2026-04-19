"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { Badge } from "@/components/ui";

interface TrackCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  badgeText?: string;
  actionLabel?: string;
}

export function TrackCard({
  title,
  description,
  icon,
  href,
  onClick,
  disabled = false,
  badgeText,
  actionLabel,
}: TrackCardProps) {
  const body = (
    <div
      className={[
        "relative flex h-full flex-col rounded-xl border p-5 transition-all",
        disabled
          ? "border-border bg-surface-secondary cursor-not-allowed"
          : "border-border bg-surface hover:border-brand hover:shadow-sm hover:-translate-y-0.5 cursor-pointer",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className={[
            "flex h-10 w-10 items-center justify-center rounded-lg",
            disabled
              ? "bg-surface-tertiary text-text-tertiary"
              : "bg-surface-brand text-brand",
          ].join(" ")}
        >
          {icon}
        </div>
        {badgeText && (
          <Badge variant={disabled ? "default" : "brand"}>{badgeText}</Badge>
        )}
      </div>

      <h3
        className={[
          "text-title mt-4",
          disabled ? "text-text-tertiary" : "text-text-primary",
        ].join(" ")}
      >
        {title}
      </h3>
      <p
        className={[
          "text-body-sm mt-1 flex-1",
          disabled ? "text-text-tertiary" : "text-text-secondary",
        ].join(" ")}
      >
        {description}
      </p>

      {!disabled && actionLabel && (
        <span className="text-label text-brand mt-4 inline-flex items-center gap-1">
          {actionLabel} →
        </span>
      )}
    </div>
  );

  if (disabled) {
    return (
      <div aria-disabled="true" role="group">
        {body}
      </div>
    );
  }

  if (href) {
    return <Link href={href}>{body}</Link>;
  }

  return (
    <button type="button" onClick={onClick} className="text-left">
      {body}
    </button>
  );
}
