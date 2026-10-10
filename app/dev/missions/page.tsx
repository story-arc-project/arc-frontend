import { notFound } from "next/navigation";
import { MissionsPreview } from "./preview";
export default function MissionsPreviewPage() {
  if (process.env.NODE_ENV !== "development" || process.env.FRT348_PREVIEW !== "true") notFound();
  return <MissionsPreview />;
}
