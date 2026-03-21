import { HTMLAttributes, forwardRef } from "react";

type CardVariant = "default" | "bordered" | "elevated" | "filled";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: "none" | "sm" | "md" | "lg";
}

const variantClasses: Record<CardVariant, string> = {
  default:  "bg-surface border border-border rounded-lg",
  bordered: "bg-surface border border-border-strong rounded-lg",
  elevated: "bg-surface rounded-lg shadow-md",
  filled:   "bg-surface-secondary rounded-lg",
};

const paddingClasses = {
  none: "",
  sm:   "p-4",
  md:   "p-5",
  lg:   "p-6",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "default", padding = "md", className = "", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={[variantClasses[variant], paddingClasses[padding], className]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

/* ── Subcomponents ────────────────────────────────────────── */

export function CardHeader({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`mb-4 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className = "", children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={`text-title text-text-primary ${className}`} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ className = "", children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={`text-body text-text-secondary mt-1 ${className}`} {...props}>
      {children}
    </p>
  );
}

export function CardFooter({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`mt-4 flex items-center ${className}`} {...props}>
      {children}
    </div>
  );
}
