import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { FullPageMessage } from "@/components/ui";

export default function NotFound() {
  return (
    <FullPageMessage
      icon={<FileQuestion size={22} aria-hidden="true" />}
      title="페이지를 찾을 수 없어요"
      description="요청하신 페이지가 없거나 이동되었어요."
    >
      <Link
        href="/dashboard"
        className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-brand text-text-on-brand text-label hover:bg-brand-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        홈으로 가기
      </Link>
    </FullPageMessage>
  );
}
