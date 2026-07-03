import type { CompanyType, MotivationTag, RoleType } from "./goalFitTypes";

export type EntryWeightMap<T extends string> = Record<T, Partial<Record<string, number>>>;

export type MotivationFitMap<T extends string> = Record<MotivationTag, Record<T, number>>;

export const DEFAULT_COMPANY_SCORE = 2.5;

export const DEFAULT_ROLE_SCORE = 2.5;

export const DEFAULT_PAIR_SCORE = 80;

export const SCORE_VERSION = "goal-fit-v1.3";

export const motivationTagPriority: MotivationTag[] = [
  "money",
  "stable",
  "status",
  "growth",
  "create",
  "first_job",
  "anxiety",
  "balanced"
];

export const companyEntryWeights: EntryWeightMap<CompanyType> = {
  G: { A01: 18, A02: 18, A03: 16, A04: 10, A05: 8, A06: 8, A07: 10, A08: 6, A09: 3, A10: 3 },
  F: { A01: 12, A02: 15, A03: 12, A04: 16, A05: 12, A06: 12, A07: 14, A08: 10, A09: 4, A10: 3 },
  D: { A01: 12, A02: 18, A03: 10, A04: 18, A05: 15, A06: 12, A07: 5, A08: 8, A09: 2, A10: 0 },
  V: { A01: 5, A02: 5, A03: 8, A04: 18, A05: 20, A06: 15, A07: 3, A08: 12, A09: 7, A10: 7 },
  M: { A01: 5, A02: 5, A03: 8, A04: 15, A05: 15, A06: 12, A07: 3, A08: 12, A09: 10, A10: 15 }
};

export const roleEntryWeights: EntryWeightMap<RoleType> = {
  SLS: { A01: 5, A02: 5, A03: 8, A04: 18, A05: 14, A06: 8, A07: 3, A08: 20, A09: 10, A10: 9 },
  PM: { A01: 10, A02: 12, A03: 15, A04: 15, A05: 18, A06: 12, A07: 4, A08: 10, A09: 2, A10: 2 },
  OPS: { A01: 8, A02: 10, A03: 10, A04: 18, A05: 18, A06: 12, A07: 2, A08: 12, A09: 5, A10: 5 },
  TECH: { A01: 12, A02: 10, A03: 18, A04: 12, A05: 15, A06: 18, A07: 4, A08: 5, A09: 3, A10: 3 },
  DATA: { A01: 12, A02: 12, A03: 18, A04: 12, A05: 15, A06: 18, A07: 4, A08: 6, A09: 2, A10: 1 },
  FUNC: { A01: 10, A02: 12, A03: 16, A04: 10, A05: 8, A06: 12, A07: 10, A08: 12, A09: 5, A10: 5 },
  MKT: { A01: 6, A02: 8, A03: 8, A04: 18, A05: 22, A06: 12, A07: 2, A08: 14, A09: 5, A10: 5 },
  SUP: { A01: 8, A02: 8, A03: 16, A04: 14, A05: 10, A06: 14, A07: 5, A08: 8, A09: 7, A10: 10 }
};

export const companyMotivationFit: MotivationFitMap<CompanyType> = {
  stable: { G: 5, F: 4, D: 3, V: 1, M: 3 },
  status: { G: 4, F: 5, D: 5, V: 2, M: 2 },
  growth: { G: 3, F: 5, D: 5, V: 4, M: 3 },
  create: { G: 2, F: 3, D: 4, V: 5, M: 4 },
  money: { G: 3, F: 4, D: 5, V: 4, M: 3 },
  first_job: { G: 3, F: 2, D: 2, V: 2, M: 5 },
  anxiety: { G: 3, F: 2, D: 1, V: 1, M: 3 },
  balanced: { G: 4, F: 4, D: 4, V: 4, M: 4 }
};

export const roleMotivationFit: MotivationFitMap<RoleType> = {
  stable: { SLS: 2, PM: 3, OPS: 3, TECH: 4, DATA: 4, FUNC: 5, MKT: 3, SUP: 4 },
  status: { SLS: 3, PM: 4, OPS: 4, TECH: 4, DATA: 4, FUNC: 4, MKT: 4, SUP: 3 },
  growth: { SLS: 4, PM: 5, OPS: 5, TECH: 5, DATA: 5, FUNC: 3, MKT: 5, SUP: 4 },
  create: { SLS: 4, PM: 5, OPS: 4, TECH: 4, DATA: 4, FUNC: 2, MKT: 5, SUP: 3 },
  money: { SLS: 5, PM: 4, OPS: 3, TECH: 4, DATA: 4, FUNC: 3, MKT: 4, SUP: 3 },
  first_job: { SLS: 4, PM: 2, OPS: 4, TECH: 2, DATA: 2, FUNC: 5, MKT: 3, SUP: 4 },
  anxiety: { SLS: 1, PM: 2, OPS: 2, TECH: 3, DATA: 3, FUNC: 4, MKT: 2, SUP: 3 },
  balanced: { SLS: 4, PM: 4, OPS: 4, TECH: 4, DATA: 4, FUNC: 4, MKT: 4, SUP: 4 }
};

export const companyRolePairScore: Partial<Record<`${CompanyType}_${RoleType}`, number>> = {
  G_FUNC: 90,
  F_FUNC: 88,
  F_DATA: 88,
  D_DATA: 85,
  D_PM: 84,
  V_OPS: 82,
  M_SLS: 82,
  M_SUP: 82,
  V_FUNC: 65,
  V_DATA: 70,
  V_TECH: 75,
  D_OPS: 75,
  D_SLS: 72,
  G_PM: 72,
  M_PM: 68,
  M_FUNC: 70,
  F_SLS: 78
};
