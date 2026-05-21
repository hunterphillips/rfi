export type JudgeScore = {
  scores: Record<string, number>;
  notes: string;
};

export type EvalCase<TInput, TExpected> = {
  id: string;
  description?: string;
  input: TInput;
  expected: TExpected;
};

export type EvalResult<TOutput> = {
  caseId: string;
  output: TOutput | null;
  error?: string;
  judge?: JudgeScore;
  durationMs: number;
};

export type EvalAggregates = {
  passCount: number;
  failCount: number;
  averages: Record<string, number>;
};

export type EvalSummary<TOutput> = {
  stage: string;
  results: EvalResult<TOutput>[];
  aggregates: EvalAggregates;
};

export const EVAL_PASS_THRESHOLD = 2;
