"use client";

import { SiGoogle } from "react-icons/si";

interface SocialLoginButtonsProps {
  onLogin: (provider: "google") => void;
  /** Text appended after provider name. e.g. "계속하기" → "Google로 계속하기" */
  action?: string;
}

export function SocialLoginButtons({ onLogin, action }: SocialLoginButtonsProps) {
  return (
    <button
      type="button"
      onClick={() => onLogin("google")}
      className="w-full h-12 rounded-md inline-flex items-center justify-center gap-2
                 bg-surface border border-border text-text-primary hover:bg-surface-secondary
                 text-body font-medium transition-opacity duration-150 cursor-pointer"
    >
      <SiGoogle size={17} />
      <span className="sm:hidden">Google</span>
      <span className="hidden sm:inline">{action ? `Google로 ${action}` : "Google"}</span>
    </button>
  );
}
