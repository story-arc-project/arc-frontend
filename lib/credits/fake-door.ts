import type { CreditPackage } from "@/lib/constants/credit-packages";

/** Frontend port only. BAC-89 HTTP paths and wire fields remain unconfirmed. */
export interface FakeDoorCatalog {
  version: string;
  packages: readonly CreditPackage[];
}
export interface FakeDoorIntent {
  accountId: string;
  flowId: string;
  intentId: string;
  entryPoint: string;
  catalogVersion: string;
  package: CreditPackage;
  clickedAt: string;
}
export interface FakeDoorIntentResult { audience: "first" | "repeat" }
export interface FakeDoorExposure {
  accountId: string;
  flowId: string;
  intentId: string;
  exposureId: string;
  shownAt: string;
}
export interface FakeDoorAdapter {
  loadCatalog(signal: AbortSignal): Promise<FakeDoorCatalog>;
  recordIntent(intent: FakeDoorIntent, signal: AbortSignal): Promise<FakeDoorIntentResult>;
  recordExposure(exposure: FakeDoorExposure, signal: AbortSignal): Promise<void>;
}
