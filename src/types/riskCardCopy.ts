export type RiskCardCopyStatus = "ENGINEERING_PLACEHOLDER" | "FORMAL";

export type RiskCardCopy = {
  cardId: string;
  displayName: string;
  oneLineRiskPrompt: string;
  typicalScenes: string[];
  notSaying: string;
  riskReductionActions: string[];
  preChoiceValidationChecklist: string[];
  whoToAsk: string;
  jiGeCanHelpWith: string;
  resultShortCopy: string;
  shareShortCopy: string;
  status: RiskCardCopyStatus;
};

export type RiskCardCopyConfig = {
  _todo?: string;
  riskCardCopies: Record<string, RiskCardCopy>;
};
