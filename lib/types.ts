export type Source = { title: string; url: string };

export type SearchSource = "sn_docs" | "web";

export type PlanItem = {
  query: string;
  source: SearchSource;
  reason: string;
  bundle: string | null;
};

export type ResearcherTelemetry = {
  turns?: number;
  tool_calls?: number;
  salvaged?: boolean;
  max_turns?: number;
};

export type ResearchSummary = {
  query: string;
  source: SearchSource;
  summary: string;
  sources: Source[];
  telemetry: ResearcherTelemetry;
};

export type Feature = {
  name: string;
  purpose: string;
  source: string;
};

export type CapabilityMap = {
  architecture_narrative: string;
  features: Feature[];
  components: string[];
  open_questions: string[];
  sources: Source[];
};

export type FeedbackEntry = {
  ts: string;
  feedback: string;
};

export type ScopeProduct = {
  name: string;
};

export type Scope = {
  products: ScopeProduct[];
  version: string | null;
  summary: string;
};

export type TopicStatus =
  | "pending"
  | "planning"
  | "researching"
  | "researched"
  | "approved"
  | "drafting"
  | "drafted"
  | "failed";

export type DraftTopic = {
  index: number;
  text: string;
  status: TopicStatus;
  plan: PlanItem[];
  research: ResearchSummary[];
  capability_map: CapabilityMap | null;
  feedback_history: FeedbackEntry[];
  content: string | null;
  sources: Source[];
};

export type DraftStatus =
  | "parsed"
  | "researching"
  | "researched"
  | "drafting"
  | "ready"
  | "in_review"
  | "approved";

export type DraftRow = {
  id: string;
  owner_id: string;
  title: string | null;
  status: DraftStatus;
  input_text: string | null;
  topics: DraftTopic[];
  scope: Scope | null;
  attached_context: { name: string; content: string }[];
  cancel_requested: boolean;
  created_at: string;
  updated_at: string;
};
