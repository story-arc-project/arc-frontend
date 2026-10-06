import { notFound } from "next/navigation";
import { FakeDoorPreview } from "./preview";

/** Local opt-in only. Production builds always return 404, even if the flag is set. */
export default function FakeDoorPreviewPage() {
  if (process.env.NODE_ENV !== "development" || process.env.FRT138_PREVIEW !== "true") notFound();
  return <FakeDoorPreview />;
}
