export type SceneMood = "hopeful" | "cautious" | "pressure" | "confused";

export type PathFitBand = "A" | "B" | "C" | "D";

export type RiskPreviewLevel = "较低" | "中等" | "偏高" | "中高" | "较高";

export type ResultExperienceInput = {
  riskCardId: string;
  isFallback: boolean;
  companyTypeId?: string;
  workTypeId?: string;
  companyTypeLabel: string;
  workTypeLabel: string;
  primaryRiskName: string;
  primaryRiskPrompt: string;
  primaryRiskSummary: string;
};

export type ResultExperiencePresentation = {
  companyTypeLabel: string;
  workTypeLabel: string;
  pathFitBand: PathFitBand;
  pathFitPercent: number;
  pathFitLabel: string;
  verdictTitle: string;
  verdictBody: string;
  sixMonthExitRiskLevel: RiskPreviewLevel;
  sixMonthExitRiskIndex: number;
  sixMonthExitRiskCopy: string;
  age30AnxietyRiskLevel: RiskPreviewLevel;
  age30AnxietyRiskIndex: number;
  age30AnxietyRiskCopy: string;
  adaptationCostCopy: string;
  sceneMood: SceneMood;
  sceneTitle: string;
  sceneSubtitle: string;
  sceneNarrative: string;
  companyExpectation: string[];
  workExpectation: string[];
  animationPreset: string;
  musicMoodKey: string;
  musicMoodLabel: string;
};

const FALLBACK_COMPANY_LABEL = "暂未明确的公司类型";
const FALLBACK_WORK_LABEL = "暂未明确的岗位类型";

const COMPANY_EXPECTATIONS: Record<string, string[]> = {
  SOE: ["理解流程和边界", "稳定完成交付", "耐心适应组织节奏"],
  MNC: ["遵守规范和标准", "清楚表达协作信息", "适应跨团队沟通"],
  PLATFORM: ["快速学习业务", "在变化中保持执行", "用数据和结果说话"],
  PRIVATE_SME: ["主动补位", "适应资源有限的环境", "把事情推进到底"],
  STARTUP: ["承受不确定性", "快速试错", "在模糊任务里找方向"]
};

const WORK_EXPECTATIONS: Record<string, string[]> = {
  GROWTH: ["持续面对目标压力", "主动沟通和跟进", "能从拒绝里复盘"],
  CONTENT: ["稳定输出内容", "理解用户反馈", "在创意和结果之间平衡"],
  PRODUCT_OPS: ["拆解用户和流程问题", "推动活动或平台动作", "用反馈优化方案"],
  FUNCTION: ["细心处理规则和细节", "支持多人协作", "保持稳定可靠的交付"],
  TECH: ["持续学习技术细节", "耐心定位问题", "把复杂任务拆小完成"]
};

const DEFAULT_EXPECTATION = ["看清真实工作方式", "确认新人支持机制", "判断自己是否能持续适应"];

const C_BAND_CARD_IDS = new Set([
  "H2_REALITY_GAP_RISK",
  "H3_GROWTH_EXHAUSTION",
  "H5_SOE_PROCESS_PRESSURE",
  "H8_SOCIAL_COLLABORATION_EXHAUSTION_RISK",
  "H15_LOW_TOLERANCE_ROLE_PRESSURE_RISK",
  "H16_EXAM_DELAY_PROBLEM"
]);

const D_BAND_CARD_IDS = new Set([
  "H4_DIRECTION_MISJUDGMENT_RISK",
  "H12_STABILITY_PREFERENCE_MISMATCH_RISK",
  "H13_MAJOR_PATH_SWING_RISK"
]);

const BAND_COPY: Record<
  PathFitBand,
  {
    pathFitPercent: number;
    pathFitLabel: string;
    verdictTitle: string;
    verdictBody: string;
    sixMonthExitRiskLevel: RiskPreviewLevel;
    sixMonthExitRiskIndex: number;
    age30AnxietyRiskLevel: RiskPreviewLevel;
    age30AnxietyRiskIndex: number;
    sceneMood: SceneMood;
    sceneTitle: string;
    sceneSubtitle: string;
    sceneNarrative: string;
    animationPreset: string;
    musicMoodKey: string;
    musicMoodLabel: string;
  }
> = {
  A: {
    pathFitPercent: 88,
    pathFitLabel: "路径适应度较高",
    verdictTitle: "恭喜你，这条路和你比较匹配",
    verdictBody:
      "从这次答题看，你选择的公司类型和岗位类型，和你的性格倾向、工作预期是顺向的。这类岗位要求的工作方式，和你更容易发挥的状态比较接近。只要简历和面试能过关，这条路值得你大胆尝试，它也可能让你未来更有稳定感、成就感和职业幸福感。",
    sixMonthExitRiskLevel: "较低",
    sixMonthExitRiskIndex: 18,
    age30AnxietyRiskLevel: "较低",
    age30AnxietyRiskIndex: 22,
    sceneMood: "hopeful",
    sceneTitle: "门口的灯已经亮了",
    sceneSubtitle: "这条路可以先往前走几步，再用真实信息校准判断。",
    sceneNarrative:
      "你可以把这条路想象成站在一家公司门口，手里拿着第一份 offer。公司和岗位本身没有绝对好坏，真正要看的，是它每天要求你的工作方式，是否和你当前的性格、预期、承压方式相互支持。",
    animationPreset: "hopeful-rise",
    musicMoodKey: "warm-upward",
    musicMoodLabel: "温暖上升"
  },
  B: {
    pathFitPercent: 76,
    pathFitLabel: "路径适应度中等偏上",
    verdictTitle: "这条路可以走，但不要只看表面",
    verdictBody:
      "这类公司和岗位整体不算明显错配，但它仍然会考验你对真实工作日常的接受程度。如果你选择它，是因为你真的理解它每天要做什么，这条路可以尝试。如果你只是被公司名、岗位名、稳定感或热门程度吸引，入职后可能会出现落差。",
    sixMonthExitRiskLevel: "中等",
    sixMonthExitRiskIndex: 38,
    age30AnxietyRiskLevel: "中等",
    age30AnxietyRiskIndex: 42,
    sceneMood: "cautious",
    sceneTitle: "先把路灯打开",
    sceneSubtitle: "不是要停下，而是先看清这条路每天会要求你怎样工作。",
    sceneNarrative:
      "你可以把这条路想象成一段刚下雨的街道。它能通向机会，但路面有些地方会滑，先确认压力来自哪里，再决定怎么走。",
    animationPreset: "cautious-branch",
    musicMoodKey: "thoughtful-light",
    musicMoodLabel: "轻微思考感"
  },
  C: {
    pathFitPercent: 58,
    pathFitLabel: "路径适应度偏低",
    verdictTitle: "这个岗位未必适合你现在的性格和工作预期",
    verdictBody:
      "不是说你不能做，而是这类岗位要求的工作方式，和你当前更舒服、更容易发挥的环境之间存在差距。如果你能在入职后的 3 到 6 个月内调整自己，接受这种差距，并适应它的节奏，这条路仍然可以走。但如果调整不好，6 个月内离职风险会增加。",
    sixMonthExitRiskLevel: "偏高",
    sixMonthExitRiskIndex: 68,
    age30AnxietyRiskLevel: "中高",
    age30AnxietyRiskIndex: 60,
    sceneMood: "pressure",
    sceneTitle: "别急着冲进人群",
    sceneSubtitle: "这条路可能有机会，也可能提前消耗你的适应力。",
    sceneNarrative:
      "你可以把这条路想象成一座很忙的办公楼。门开着，但里面的节奏、反馈和要求需要先看清，不必只凭热闹程度做决定。",
    animationPreset: "pressure-wave",
    musicMoodKey: "slow-pressure",
    musicMoodLabel: "低频压力感"
  },
  D: {
    pathFitPercent: 42,
    pathFitLabel: "路径适应度较低",
    verdictTitle: "这条路对你当前阶段不太友好",
    verdictBody:
      "这不是在否定你的能力，而是在提醒你：你选择的公司类型和岗位类型，可能会持续放大你当前最敏感的压力点。如果强行进入，短期可能影响试用期适应；中期可能让你一年后怀疑自己是不是选错了方向；更长期看，可能增加你在 30 岁前后的职场焦虑。这条路不是绝对不能走，但你需要非常清楚自己要承担的适应成本。",
    sixMonthExitRiskLevel: "较高",
    sixMonthExitRiskIndex: 66,
    age30AnxietyRiskLevel: "较高",
    age30AnxietyRiskIndex: 84,
    sceneMood: "confused",
    sceneTitle: "先确认自己要去哪里",
    sceneSubtitle: "方向感比立刻做选择更重要。",
    sceneNarrative:
      "你可以把这条路想象成一个岔路口。每条路都有人在走，但你需要先分清自己是想靠近机会，还是只是想暂时离开焦虑。",
    animationPreset: "foggy-crossroad",
    musicMoodKey: "low-uncertain",
    musicMoodLabel: "低频不确定感"
  }
};

function pickPathFitBand(riskCardId: string, isFallback: boolean): PathFitBand {
  if (isFallback || riskCardId === "H0_GENERAL_REMINDER") return "A";
  if (D_BAND_CARD_IDS.has(riskCardId)) return "D";
  if (C_BAND_CARD_IDS.has(riskCardId)) return "C";
  return "B";
}

export function buildResultExperiencePresentation(input: ResultExperienceInput): ResultExperiencePresentation {
  const pathFitBand = pickPathFitBand(input.riskCardId, input.isFallback);
  const bandCopy = BAND_COPY[pathFitBand];

  return {
    companyTypeLabel: input.companyTypeLabel || FALLBACK_COMPANY_LABEL,
    workTypeLabel: input.workTypeLabel || FALLBACK_WORK_LABEL,
    pathFitBand,
    pathFitPercent: bandCopy.pathFitPercent,
    pathFitLabel: bandCopy.pathFitLabel,
    verdictTitle: bandCopy.verdictTitle,
    verdictBody: bandCopy.verdictBody,
    sixMonthExitRiskLevel: bandCopy.sixMonthExitRiskLevel,
    sixMonthExitRiskIndex: bandCopy.sixMonthExitRiskIndex,
    sixMonthExitRiskCopy:
      "这个风险主要来自你的性格、承压方式和岗位日常要求之间的摩擦。如果入职后长期处在不舒服的工作方式里，短期离职风险会被放大。",
    age30AnxietyRiskLevel: bandCopy.age30AnxietyRiskLevel,
    age30AnxietyRiskIndex: bandCopy.age30AnxietyRiskIndex,
    age30AnxietyRiskCopy:
      "这个风险主要来自你对公司名、岗位名、稳定感、热门程度的想象，和真实工作日常之间的落差。如果长期在一条并不适合自己的路径里积累经验，未来可能影响你在 30 岁前后形成清晰、稳定的职业能力标签。",
    adaptationCostCopy:
      "这次结果只提示路径适配风险，不直接告诉你应该换到哪条路。你需要重点看清：如果继续选择这条路，自己要承担多大的适应成本。",
    sceneMood: bandCopy.sceneMood,
    sceneTitle: bandCopy.sceneTitle,
    sceneSubtitle: bandCopy.sceneSubtitle,
    sceneNarrative: bandCopy.sceneNarrative,
    companyExpectation: input.companyTypeId ? COMPANY_EXPECTATIONS[input.companyTypeId] ?? DEFAULT_EXPECTATION : DEFAULT_EXPECTATION,
    workExpectation: input.workTypeId ? WORK_EXPECTATIONS[input.workTypeId] ?? DEFAULT_EXPECTATION : DEFAULT_EXPECTATION,
    animationPreset: bandCopy.animationPreset,
    musicMoodKey: bandCopy.musicMoodKey,
    musicMoodLabel: bandCopy.musicMoodLabel
  };
}
