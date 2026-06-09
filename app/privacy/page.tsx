import { readFile } from "fs/promises";
import { join } from "path";
import type { Metadata } from "next";
import { LegalDocument } from "@/components/features/legal/LegalDocument";

export const metadata: Metadata = {
  title: "개인정보 처리방침 | ARC",
  description: "ARC 개인정보 처리방침",
};

export default async function PrivacyPage() {
  const markdown = await readFile(
    join(process.cwd(), "docs/legal/privacy-policy.draft.md"),
    "utf8",
  );
  return <LegalDocument markdown={markdown} />;
}
