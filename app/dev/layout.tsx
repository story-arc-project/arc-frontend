import CreditsProvider from "@/contexts/CreditsContext";

/** Match the credit context used by main routes when previewing embedded dialogs. */
export default function DevelopmentLayout({ children }: { children: React.ReactNode }) {
  return <CreditsProvider>{children}</CreditsProvider>;
}
