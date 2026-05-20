export interface FaqItem {
  readonly id: string;
  readonly questionKey: string;
  readonly answerKey: string;
}

export const HELP_FAQ: ReadonlyArray<FaqItem> = [
  { id: "q1", questionKey: "studio.help.q1", answerKey: "studio.help.a1" },
  { id: "q2", questionKey: "studio.help.q2", answerKey: "studio.help.a2" },
  { id: "q3", questionKey: "studio.help.q3", answerKey: "studio.help.a3" },
];
