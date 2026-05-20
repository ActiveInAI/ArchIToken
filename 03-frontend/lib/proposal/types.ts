import type { CreateFormState, Proposal } from "@/lib/insome/types";

export interface ProposalGenerator {
  /** Phase 2 scripted-version 一次性返回 3 个；Phase 4 LLM 若流式再扩接口 */
  generate(form: CreateFormState): Promise<ReadonlyArray<Proposal>>;
  cancel?(): void;
  reset?(): void;
}
