// FRT-19: 계측 레이어 공개 표면.
export {
  capture,
  identifyUser,
  isIdentified,
  markInternalUser,
  resetUser,
  type CaptureOptions,
} from "./client";
export { markFirstRecordIfUnseen } from "./first-record";
export { markSignupCompletedIfUnseen } from "./signup";
// FRT-107: 이탈·체류를 재는 훅. exit-signal 은 이 둘의 공용 내부라 공개하지 않는다.
export { useDwell, type DwellOptions } from "./use-dwell";
export { useFlowExit, type FlowExitOptions, type FlowExitResult } from "./use-flow-exit";
export {
  useArchiveEntryAnalytics,
  type ArchiveEntryAnalytics,
  type ArchiveEntryProgressProps,
} from "./use-archive-entry";
export {
  ANALYTICS_EVENTS,
  type AnalyticsEventName,
  type AnalyticsEventProps,
  type SignupMethod,
  type AnalysisKind,
  type ViewableAnalysisKind,
  type ArchiveEntryMode,
  type ExportType,
  type RecordStatus,
  type AttachmentType,
  type ResumeSaveOutcome,
  type CoverLetterSaveOutcome,
  type CoverLetterExportFormat,
} from "./events";
