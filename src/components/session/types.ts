/**
 * Client-side view of the canonical session model. Re-exported from the
 * provider layer so components and adapters cannot drift apart.
 */
export type {
  AgentEvent,
  CheckpointFile,
  CostBreakdown,
  CostLine,
  CostSummary,
  HealthGrade,
  HealthSignal,
  HealthSignalId,
  LogFile,
  ModelCost,
  PriceEntry,
  ProviderId,
  ProviderInfo,
  RawMetaDoc,
  SessionHealth,
  SessionMeta,
  SessionOutcome,
  SessionStats,
  TokenAnalysis,
  TokenHint,
} from "@/lib/providers/types";

import type {
  AgentEvent,
  CheckpointFile,
  CostSummary,
  RawMetaDoc,
  SessionMeta,
  SessionStats,
  TokenAnalysis,
} from "@/lib/providers/types";

export interface SessionData {
  meta: SessionMeta;
  events: AgentEvent[];
  files: string[];
  checkpoints: CheckpointFile[];
  research: string[];
  rawMeta: RawMetaDoc;
  storagePath?: string;
  revealable?: boolean;
  stats: SessionStats;
  tokenAnalysis: TokenAnalysis;
  cost: CostSummary;
}

export interface EventFocusRequest {
  nonce: number;
  categories?: string[];
  subKeys?: string[];
  search?: string;
  /** Only failed tool results. */
  failures?: boolean;
}
