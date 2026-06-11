import { readFile } from "fs/promises";
import { join } from "path";
import type { Metadata } from "next";
import { LegalDocument } from "@/components/features/legal/LegalDocument";

export const metadata: Metadata = {
  title: "이용약관 | ARC",
  description: "ARC 서비스 이용약관",
};

export default async function TermsPage() {
  const markdown = await readFile(
    join(process.cwd(), "docs/legal/terms-of-service.draft.md"),
    "utf8",
  );
  return <LegalDocument markdown={markdown} />;
}
