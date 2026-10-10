import { MissionUnavailableError } from "./store";
import type { MissionAdapter } from "./types";

// BAC-77/78/79 have no HTTP contract yet. Never infer an endpoint or grant locally.
const unavailable = async (): Promise<never> => { throw new MissionUnavailableError("Mission service is not available"); };
export const unavailableAdapter: MissionAdapter = {
  load: unavailable,
  submit: unavailable,
  claim: unavailable,
};
