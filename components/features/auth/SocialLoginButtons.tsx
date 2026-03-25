"use client";

import { SiGoogle, SiApple, SiKakao, SiNaver } from "react-icons/si";

type Provider = "google" | "apple" | "kakao" | "naver";

interface SocialLoginButtonsProps {
  onLogin: (provider: Provider) => void;
  /** Text appended after provider name. e.g. "계속하기" → "Google로 계속하기" */
  action?: string;
}

interface ProviderConfig {
  id: Provider;
  /** Short name shown when no action is provided */
  name: string;
  /** Full Korean label prefix used with action */
  labelPrefix: string;
  icon: React.ReactNode;
  className: string;
  style?: React.CSSProperties;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: "google",
    name: "Google",
    labelPrefix: "Google로",
    icon: <SiGoogle size={17} />,
    className:
      "bg-surface border border-border text-text-primary hover:bg-surface-secondary",
  },
  {
    id: "apple",
    name: "Apple",
    labelPrefix: "Apple로",
    icon: <SiApple size={17} />,
    className: "bg-gray-950 text-white hover:opacity-90",
  },
  {
    id: "kakao",
    name: "Kakao",
    labelPrefix: "카카오로",
    icon: <SiKakao size={17} color="#191919" />,
    className: "hover:opacity-90",
    style: { backgroundColor: "#FEE500", color: "#191919" },
  },
  {
    id: "naver",
    name: "Naver",
    labelPrefix: "네이버로",
    icon: <SiNaver size={17} color="#ffffff" />,
    className: "text-white hover:opacity-90",
    style: { backgroundColor: "#03C75A" },
  },
];

export function SocialLoginButtons({ onLogin, action }: SocialLoginButtonsProps) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {PROVIDERS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onLogin(p.id)}
          style={p.style}
          className={[
            "h-12 rounded-md inline-flex items-center justify-center gap-2",
            "text-body font-medium transition-opacity duration-150 cursor-pointer",
            p.className,
          ].join(" ")}
        >
          {p.icon}
          <span className="sm:hidden">{p.name}</span>
          <span className="hidden sm:inline">{action ? `${p.labelPrefix} ${action}` : p.name}</span>
        </button>
      ))}
    </div>
  );
}
