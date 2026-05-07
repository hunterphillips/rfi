export type QuestionStatus = "pending" | "drafting" | "drafted" | "failed";

export type DraftQuestion = {
  index: number;
  text: string;
  status: QuestionStatus;
  content: string | null;
  sources: { title: string; url: string }[];
};

export type DraftStatus =
  | "parsed"
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
  questions: DraftQuestion[];
  attached_context: { name: string; content: string }[];
  created_at: string;
  updated_at: string;
};
