export type SceneMood = "hopeful" | "cautious" | "pressure" | "confused" | "stable";

export type VerdictLevel = "bold_try" | "try_carefully" | "avoid_blind_choice" | "recheck_direction";

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
  verdictLevel: VerdictLevel;
  verdictTitle: string;
  verdictBody: string;
  sceneMood: SceneMood;
  sceneTitle: string;
  sceneSubtitle: string;
  sceneNarrative: string;
  companyExpectation: string[];
  workExpectation: string[];
  longTermImpactCopy: string[];
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

const DEFAULT_EXPECTATION = ["先看清真实工作方式", "确认新人支持机制", "判断自己是否能持续适应"];

const VERDICT_BY_CARD_ID: Record<string, VerdictLevel> = {
  H0_GENERAL_REMINDER: "bold_try",
  H1_ADAPTATION_BREAK_RISK: "avoid_blind_choice",
  H2_REALITY_GAP_RISK: "try_carefully",
  H3_GROWTH_EXHAUSTION: "try_carefully",
  H4_DIRECTION_MISJUDGMENT_RISK: "recheck_direction",
  H5_SOE_PROCESS_PRESSURE: "try_carefully",
  H6_LOW_INITIATIVE_RISK: "try_carefully",
  H7_EXECUTION_GAP_RISK: "try_carefully",
  H8_SOCIAL_COLLABORATION_EXHAUSTION_RISK: "try_carefully",
  H9_FEEDBACK_SENSITIVITY_SELF_DOUBT_RISK: "try_carefully",
  H10_PEER_PLATFORM_ANXIETY_RISK: "try_carefully",
  H11_EDUCATION_FILTER_PRESSURE_RISK: "avoid_blind_choice",
  H12_STABILITY_PREFERENCE_MISMATCH_RISK: "try_carefully",
  H13_MAJOR_PATH_SWING_RISK: "recheck_direction",
  H14_GROWTH_SPEED_MISJUDGMENT_RISK: "try_carefully",
  H15_LOW_TOLERANCE_ROLE_PRESSURE_RISK: "avoid_blind_choice",
  H16_EXAM_DELAY_PROBLEM: "recheck_direction"
};

const VERDICT_COPY: Record<VerdictLevel, { title: string; body: string; mood: SceneMood }> = {
  bold_try: {
    title: "可以大胆尝试",
    body: "这条路目前没有露出特别强的拦路信号。你可以继续往前看，但仍建议在面试和实习信息里确认真实工作方式。",
    mood: "hopeful"
  },
  try_carefully: {
    title: "可以尝试，但不要盲选",
    body: "这条路不是不能走，关键是先确认它会不会放大你当前最敏感的压力点。看清楚之后再决定，会比只看岗位名字更稳。",
    mood: "cautious"
  },
  avoid_blind_choice: {
    title: "不建议盲目硬选",
    body: "这条路可能会在试用期或前半年放大适应压力。你可以继续了解，但最好先把新人支持、任务节奏和反馈方式问清楚。",
    mood: "pressure"
  },
  recheck_direction: {
    title: "建议先重新看一眼方向",
    body: "这次结果提示，你可能还需要先分清这是主动选择，还是被外部压力推着走。方向看清后，再判断岗位会更可靠。",
    mood: "confused"
  }
};

const SCENE_BY_MOOD: Record<SceneMood, { title: string; subtitle: string; narrative: string }> = {
  hopeful: {
    title: "门口的灯已经亮了",
    subtitle: "这条路可以先往前走几步，再用真实信息校准判断。",
    narrative:
      "你可以把这条路想象成站在一家公司门口，手里拿着第一份 offer。它没有绝对好坏，关键是你能不能在真实工作节奏里持续成长。"
  },
  cautious: {
    title: "先把路灯打开",
    subtitle: "不是要停下，而是先看清这条路每天会要求你怎样工作。",
    narrative:
      "你可以把这条路想象成一段刚下雨的街道。它能通向机会，但路面有些地方会滑，先确认压力来自哪里，再决定怎么走。"
  },
  pressure: {
    title: "别急着冲进人群",
    subtitle: "这条路可能有机会，也可能提前消耗你的适应力。",
    narrative:
      "你可以把这条路想象成一座很忙的办公楼。门开着，但里面的节奏、反馈和要求需要先看清，不必只凭热闹程度做决定。"
  },
  confused: {
    title: "先确认自己要去哪里",
    subtitle: "方向感比立刻做选择更重要。",
    narrative:
      "你可以把这条路想象成一个岔路口。每条路都有人在走，但你需要先分清自己是想靠近机会，还是只是想暂时离开焦虑。"
  },
  stable: {
    title: "慢一点也可以走稳",
    subtitle: "先确认规则、支持和成长空间，再决定投入多少期待。",
    narrative:
      "你可以把这条路想象成一条安静的走廊。它看起来稳定，但真正重要的是里面有没有适合新人练习和被看见的位置。"
  }
};

function pickVerdictLevel(riskCardId: string, isFallback: boolean): VerdictLevel {
  if (isFallback) return "bold_try";
  return VERDICT_BY_CARD_ID[riskCardId] ?? "try_carefully";
}

function pickSceneMood(verdictLevel: VerdictLevel, companyTypeId?: string): SceneMood {
  if (companyTypeId === "SOE" && verdictLevel === "try_carefully") return "stable";
  return VERDICT_COPY[verdictLevel].mood;
}

export function buildResultExperiencePresentation(input: ResultExperienceInput): ResultExperiencePresentation {
  const verdictLevel = pickVerdictLevel(input.riskCardId, input.isFallback);
  const verdictCopy = VERDICT_COPY[verdictLevel];
  const sceneMood = pickSceneMood(verdictLevel, input.companyTypeId);
  const sceneCopy = SCENE_BY_MOOD[sceneMood];

  return {
    companyTypeLabel: input.companyTypeLabel || FALLBACK_COMPANY_LABEL,
    workTypeLabel: input.workTypeLabel || FALLBACK_WORK_LABEL,
    verdictLevel,
    verdictTitle: verdictCopy.title,
    verdictBody: verdictCopy.body,
    sceneMood,
    sceneTitle: sceneCopy.title,
    sceneSubtitle: sceneCopy.subtitle,
    sceneNarrative: sceneCopy.narrative,
    companyExpectation: input.companyTypeId ? COMPANY_EXPECTATIONS[input.companyTypeId] ?? DEFAULT_EXPECTATION : DEFAULT_EXPECTATION,
    workExpectation: input.workTypeId ? WORK_EXPECTATIONS[input.workTypeId] ?? DEFAULT_EXPECTATION : DEFAULT_EXPECTATION,
    longTermImpactCopy: [
      "短期可能影响你进入试用期后的适应速度。",
      "中期可能让你在一年后重新怀疑这条路是不是选得太快。",
      "长期可能影响你在 30 岁前后形成清晰的职业能力标签。"
    ]
  };
}
