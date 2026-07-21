import Link from "next/link";

interface UnsupportedSchemaNoticeProps {
  /** 데모/로컬 basePath (없으면 ""). 목록 링크 앞에 그대로 붙는다. */
  basePath: string;
  /**
   * 분석 유형별 목록 경로("/analysis/individual" 등). basePath 가 있으면 앞에 붙어
   * `${basePath}${fallbackHref}` 로 조합된다 — 데모 모드에서도 유형 맥락을 잃지 않는다.
   */
  fallbackHref: string;
}

/**
 * 모르는 schema_version 을 만났을 때 조용한 빈 화면 대신 보여주는 안내(계약 §3.5).
 * 결과 구조가 프런트가 아는 버전보다 새로워 렌더할 수 없는 상태다.
 */
export default function UnsupportedSchemaNotice({
  basePath,
  fallbackHref,
}: UnsupportedSchemaNoticeProps) {
  return (
    <main className="px-4 py-8 sm:px-8">
      <div
        className="max-w-4xl mx-auto flex flex-col items-center justify-center py-16 text-center"
        role="alert"
      >
        <p className="text-body text-text-secondary mb-1">
          이 분석 결과는 표시할 수 없습니다.
        </p>
        <p className="text-body-sm text-text-tertiary mb-3">
          앱을 최신 버전으로 업데이트하면 볼 수 있어요.
        </p>
        <Link
          href={`${basePath}${fallbackHref}`}
          className="px-4 py-2 rounded-md bg-brand text-white text-label hover:bg-brand-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          목록으로 돌아가기
        </Link>
      </div>
    </main>
  );
}
