import type { CapabilityMap, PlanItem, Source } from "@/lib/types";

export type ResearchEvent =
  | { type: "parsing.started" }
  | {
      type: "parsing.complete";
      title: string;
      topic_count: number;
    }
  | { type: "planner.started"; index: number }
  | { type: "planner.complete"; index: number; plan: PlanItem[] }
  | { type: "planner.error"; index: number; message: string }
  | {
      type: "researcher.started";
      topic_index: number;
      r_index: number;
      query: string;
      source: PlanItem["source"];
    }
  | {
      type: "researcher.complete";
      topic_index: number;
      r_index: number;
      summary_chars: number;
      sources: Source[];
      tool_calls: number;
      salvaged: boolean;
    }
  | {
      type: "researcher.error";
      topic_index: number;
      r_index: number;
      message: string;
    }
  | {
      type: "architect.started";
      index: number;
      research_count: number;
    }
  | {
      type: "architect.complete";
      index: number;
      capability_map: CapabilityMap;
      duration_ms: number;
    }
  | { type: "architect.error"; index: number; message: string }
  | { type: "topic.complete"; index: number; duration_ms: number };

export type DraftEvent =
  | { type: "drafter.started"; index: number; feature_count: number }
  | {
      type: "drafter.complete";
      index: number;
      content: string;
      sources: Source[];
      duration_ms: number;
    }
  | { type: "drafter.error"; index: number; message: string }
  | { type: "editor.started"; topic_count: number }
  | { type: "editor.complete"; duration_ms: number }
  | { type: "editor.skipped"; reason: string };
