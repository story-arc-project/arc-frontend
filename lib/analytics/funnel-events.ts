/** FRT-105: browser observations only. Server commits belong to BAC-75/77/79/89. */
export type EntryPath = "charge_page" | "insufficient_credits" | "settings" | "fake_door" | "direct" | "unknown";
export interface FunnelContext { flow_id: string; entry_path: EntryPath }
export interface OfferSnapshot { package_id: string; credits: number; price_krw: number }
export type CatalogSource = "api" | "fallback" | "adapter";
interface OfferContext extends FunnelContext, OfferSnapshot { offer_version: string; catalog_source: CatalogSource }
interface MissionContext extends FunnelContext { mission_id: string }
export interface FunnelPayloads {
  token_purchase_page_viewed: FunnelContext & { offer_version: string; packages: OfferSnapshot[]; catalog_source: CatalogSource };
  token_package_selected: OfferContext & { deliberation_count: number };
  credit_purchase_intent: OfferContext & { intent_id: string };
  fake_door_revealed: FunnelContext & { intent_id: string };
  fake_door_dismissed: FunnelContext & { intent_id: string; dismissal_type: "close" };
  mission_page_navigated_from_fakedoor: FunnelContext & { intent_id: string };
  mission_page_viewed: FunnelContext & { availability: "loading" | "available" | "unavailable" | "error" };
  mission_started: MissionContext & { participation_type: "evidence" | "external" | "invite" };
  mission_submit_clicked: MissionContext & { cycle_id?: string; is_retry: boolean };
  mission_claim_clicked: MissionContext & { reward_id?: string; is_retry: boolean };
  referral_code_shared: MissionContext & { share_channel: "clipboard" };
}
export interface FunnelMetadata {
  event_id: string;
  schema_version: 1;
  occurred_at: string;
  environment: "production";
}
export type FunnelEventProps = { [E in keyof FunnelPayloads]: FunnelPayloads[E] & FunnelMetadata };
