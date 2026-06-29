# 《第一份工作风险预演》多版本配置化开发文档 V1.3

## 0. 文档目的

本项目开发一个面向应届生的手机 H5 职业风险测试工具。

第一期只上线：

```ts
audience_type = "student"
```

但系统架构必须支持未来扩展到：

```ts
audience_type = "career"
audience_type = "career_under_35"
audience_type = "career_over_35"
audience_type = "career_change"
audience_type = "manager"
```

未来扩展有工作经验人群版本时，不应重做系统，只需要新增对应配置文件。

---

# 1. 产品边界

## 1.1 产品名称

第一份工作风险预演

## 1.2 副标题

秋招前，先看看你想选的工作会不会把你坑住。

## 1.3 第一版产品目标

通过公众号 H5 测试工具，吸引应届生关注公众号，并沉淀秋招、求职方向焦虑人群。

用户完成测试后，应获得：

* 职业风险代入感
* 情绪共鸣
* 一点刺痛
* 愿意转发给同学、室友、秋招群的动机

## 1.4 第一版不做

* 不做小程序
* 不做支付
* 不做 9.9 复测
* 不接微信公众号 openid
* 不强制手机号
* 不做用户中心
* 不做真实后台
* 不做宿舍 / 班级匿名风险地图
* 不做排行榜
* 不做 PK
* 不做语音播报
* 不做完整动画视频
* 不在答题过程中动态插入风险场景题

## 1.5 第一版必须做

* 手机 H5
* 题库答题
* 配置化评分
* 风险卡触发
* 动画 + 音乐结果页
* 服务展示
* 同路径分享卡
* 高刺痛分享文案
* 本地测试记录
* 本地 CSV 导出
* 配置校验
* 风险逻辑测试用例

---

# 2. 技术栈固定

为避免 Codex 发散，第一版固定技术栈：

```txt
React + Vite + TypeScript
```

产品形态：

```txt
移动端 H5
```

数据保存：

```txt
localStorage
```

第一版身份标识：

```ts
anonymousUserId
```

第一版不实现：

```txt
微信公众号网页授权 / openid 获取
```

---

# 3. 用户身份规则

## 3.1 anonymousUserId

首次进入时生成：

```ts
anonymousUserId = "anon_" + timestamp + "_" + randomString
```

要求：

* 保存到 localStorage
* 后续测试复用
* TestSession 中必须记录
* openid 字段保留，但第一版不实现

## 3.2 openid 边界

第一版不接公众号网页授权。

```ts
openid?: string;
```

字段可以存在，但不实现真实授权流程。

---

# 4. localStorage 运营边界

## 4.1 localStorage 第一版用途

localStorage 只用于：

* 本地开发调试
* 单用户本机保存测试结果
* 验证完整交互流程
* 本地 CSV 导出

## 4.2 localStorage 不能实现

只使用 localStorage，运营者无法集中看到：

* 总测试人数
* 所有用户测试结果
* 哪些风险卡触发最多
* 哪些分享文案被复制最多
* 哪些路径最受欢迎
* 公众号投放转化效果

## 4.3 正式投放前的数据建议

如果正式投放公众号，建议另起 V1 数据上报：

可选方案：

* Supabase
* 飞书多维表格 webhook
* Serverless API + 数据库
* 自建轻量后端

V1 可新增：

```txt
POST /api/test-sessions
POST /api/events
```

本 V1.3 文档只要求 V0 localStorage，不要求集中数据后台。

---

# 5. 路由结构

第一版只保留三个路由：

```txt
/                         首页
/test                     答题页
/result/:testSessionId    结果页
```

不要同时设置 `/result/loading` 和 `/result/:testSessionId`。

结果页内部保留 5 屏：

1. 结果生成动画屏
2. 选择路径复述屏
3. 最大风险场景屏
4. 五项风险指数屏
5. 服务展示 + 病毒循环分享屏

---

# 6. 多版本配置化原则

## 6.1 禁止写死

以下内容禁止写死在页面组件、评分函数、结果页组件中：

* 题目
* 选项
* 题组顺序
* 展示条件
* 每个选项计分规则
* 隐藏维度
* 五项最终风险
* 评分公式
* 风险阈值
* 风险卡
* 风险卡触发条件
* 结果页文案
* 服务卡文案
* 分享文案
* 动画映射
* 音乐映射
* 中文标签

## 6.2 audience_type

第一版默认：

```ts
const audienceType = query.audience_type || "student";
```

未来可通过 URL 切换：

```txt
/test?audience_type=student
/test?audience_type=career
/test?audience_type=career_over_35
```

如果未传入 `audience_type`，默认进入 `student`。

---

# 7. 配置目录结构

项目必须按以下结构组织：

```txt
/src/config/audiences/student/
  questions.json
  scoring.json
  risk_cards.json
  result_copy.json
  viral_copy.json
  animation_map.json
  service_cards.json
  labels.json
  test_cases.json
```

未来扩展职业人群版本时新增：

```txt
/src/config/audiences/career/
  questions.json
  scoring.json
  risk_cards.json
  result_copy.json
  viral_copy.json
  animation_map.json
  service_cards.json
  labels.json
  test_cases.json
```

---

# 8. questions.json 规范

## 8.1 作用

`questions.json` 必须包含完整题库。

不能只写：

```txt
按题库 V1.0 实现
```

Codex 需要直接从该文件读取题目、选项、分值、展示条件和排序。

## 8.2 Question 类型

```ts
type Question = {
  id: string;
  group: string;
  order: number;
  text: string;
  type: "single_choice";
  required: boolean;
  showWhen?: ShowWhenRule[];
  options: QuestionOption[];
};
```

## 8.3 QuestionOption 类型

```ts
type QuestionOption = {
  id: string;
  text: string;
  scores?: {
    dimensions?: Record<string, number>;
    directR?: Record<string, number>;
  };
  flags?: Record<string, boolean | string>;
};
```

## 8.4 ShowWhenRule 类型

```ts
type ShowWhenRule = {
  field: string;
  operator: "eq" | "neq" | "in" | "not_in";
  value: string | string[];
};
```

## 8.5 选项计分规则

每个选项的分值必须配置在 `scores` 内。

示例：

```json
{
  "id": "low_feedback_reaction",
  "group": "common_reaction",
  "order": 21,
  "text": "如果你连续努力一个月，但结果不明显，也没人表扬你，你会怎么反应？",
  "type": "single_choice",
  "required": true,
  "options": [
    {
      "id": "A",
      "text": "继续做，只要方向没错就能坚持",
      "scores": {
        "dimensions": {},
        "directR": {}
      }
    },
    {
      "id": "B",
      "text": "会复盘方法，看看哪里可以调整",
      "scores": {
        "dimensions": {},
        "directR": {}
      }
    },
    {
      "id": "C",
      "text": "会开始怀疑自己是不是不适合",
      "scores": {
        "dimensions": {
          "V5_feedback_sensitivity": 10
        },
        "directR": {
          "R2_reality_gap_risk": 5
        }
      }
    },
    {
      "id": "D",
      "text": "很容易失去动力",
      "scores": {
        "dimensions": {
          "V5_feedback_sensitivity": 15,
          "V6_execution_gap": 10
        },
        "directR": {
          "R4_quit_6_18_month_risk": 5
        }
      }
    }
  ]
}
```

---

# 9. directR 命名统一

## 9.1 统一规则

所有 directR 分数统一使用 finalRisks 的原始 key。

正确：

```json
"directR": {
  "R2_reality_gap_risk": 5
}
```

错误：

```json
"directR": {
  "direct_R2_reality_gap_risk": 5
}
```

## 9.2 scoring.json 中不使用 direct_R 前缀

scoring.json 中使用：

```json
"R2_reality_gap_risk": {
  "directRWeight": 0.3,
  "dimensionWeights": {
    "V8_job_action_misunderstanding": 0.25
  }
}
```

不要写：

```json
"direct_R2_reality_gap_risk": 0.3
```

---

# 10. scoring.json 规范

## 10.1 文件作用

`scoring.json` 定义：

* 隐藏维度
* 最终风险
* 风险公式
* 风险等级阈值

## 10.2 完整结构

```json
{
  "dimensions": [
    "V1_social_exhaustion",
    "V2_rejection_conflict_exhaustion",
    "V3_rule_process_pressure",
    "V4_uncertainty_anxiety",
    "V5_feedback_sensitivity",
    "V6_execution_gap",
    "V7_low_initiative",
    "V8_job_action_misunderstanding",
    "V9_learning_transfer_pressure",
    "V10_peer_platform_anxiety",
    "V11_education_filter_pressure",
    "V12_exam_delay_risk",
    "V13_market_bias_risk"
  ],
  "finalRisks": [
    "R1_adaptation_risk",
    "R2_reality_gap_risk",
    "R3_direction_misjudgment_risk",
    "R4_quit_6_18_month_risk",
    "R5_three_year_flexibility_risk"
  ],
  "riskFormulas": {
    "R1_adaptation_risk": {
      "directRWeight": 0.3,
      "dimensionWeights": {
        "V4_uncertainty_anxiety": 0.2,
        "V7_low_initiative": 0.2,
        "V8_job_action_misunderstanding": 0.15,
        "V6_execution_gap": 0.1,
        "V9_learning_transfer_pressure": 0.05
      }
    },
    "R2_reality_gap_risk": {
      "directRWeight": 0.3,
      "dimensionWeights": {
        "V8_job_action_misunderstanding": 0.25,
        "V6_execution_gap": 0.2,
        "V10_peer_platform_anxiety": 0.1,
        "V3_rule_process_pressure": 0.1,
        "V5_feedback_sensitivity": 0.05
      }
    },
    "R3_direction_misjudgment_risk": {
      "directRWeight": 0.3,
      "dimensionWeights": {
        "V12_exam_delay_risk": 0.2,
        "V8_job_action_misunderstanding": 0.2,
        "V10_peer_platform_anxiety": 0.15,
        "V11_education_filter_pressure": 0.1,
        "V4_uncertainty_anxiety": 0.05
      }
    },
    "R4_quit_6_18_month_risk": {
      "directRWeight": 0.3,
      "dimensionWeights": {
        "V5_feedback_sensitivity": 0.15,
        "V2_rejection_conflict_exhaustion": 0.15,
        "V1_social_exhaustion": 0.1,
        "V3_rule_process_pressure": 0.1,
        "V4_uncertainty_anxiety": 0.1,
        "V10_peer_platform_anxiety": 0.1
      }
    },
    "R5_three_year_flexibility_risk": {
      "directRWeight": 0.3,
      "dimensionWeights": {
        "V11_education_filter_pressure": 0.15,
        "V8_job_action_misunderstanding": 0.15,
        "V12_exam_delay_risk": 0.15,
        "V9_learning_transfer_pressure": 0.1,
        "V7_low_initiative": 0.1,
        "V4_uncertainty_anxiety": 0.05
      }
    }
  },
  "thresholds": {
    "low": [0, 34],
    "medium": [35, 64],
    "high": [65, 100]
  }
}
```

---

# 11. maxScore 与归一化

## 11.1 不手写 maxScore

不要求每个选项手写 maxScore。

系统自动计算每道已展示题目在每个维度和每个 directR 上的最高可能得分。

## 11.2 单题 maxScore

例如某题对 `V5_feedback_sensitivity` 的分值为：

```txt
A = 0
B = 0
C = 10
D = 15
```

该题对 `V5_feedback_sensitivity` 的 maxScore 为：

```txt
15
```

## 11.3 维度归一化

```ts
normalizedScore = actualScore / maxPossibleScore * 100
```

如果某个维度 `maxPossibleScore = 0`，则该维度不参与最终风险公式。

---

# 12. finalRisk 计算规则

## 12.1 可用权重重归一化

由于不同用户答题路径不同，某些维度可能没有题目来源。

finalRisk 计算时，只使用本次有 maxScore 来源的 directR 和 dimension。

公式：

```ts
finalRisk =
  sum(availableSourceScore * sourceWeight)
  / sum(availableSourceWeight)
```

## 12.2 availableSource 判断

directR 可用条件：

```ts
maxScores.directR[riskKey] > 0
```

dimension 可用条件：

```ts
maxScores.dimensions[dimensionKey] > 0
```

## 12.3 缺失项处理

缺失项不按 0 分计算。

缺失项直接排除，并对剩余权重重新归一化。

## 12.4 没有任何可用来源

如果某个 finalRisk 没有任何可用 source：

```ts
finalRisk = 0
riskLevel = "low"
```

但正常配置下不应出现这种情况，配置校验应尽量避免。

---

# 13. 风险等级

风险等级阈值：

```txt
0-34    low
35-64   medium
65-100  high
```

前端展示：

```txt
低风险
中风险
高风险
```

不展示具体分数。

---

# 14. risk_cards.json 规范

## 14.1 RiskCard 类型

```ts
type RiskCard = {
  id: string;
  title: string;
  mainText: string;
  subText: string;
  stingText: string;
  priority: "high" | "medium" | "low";
  baseTriggerScore: number;
  relatedRisks: string[];
  strongMatch?: {
    companyType?: string[];
    workType?: string[];
  };
  conditions: TriggerCondition[];
  protectRules?: ProtectRule[];
  animationType: string;
  musicType: string;
};
```

## 14.2 TriggerCondition 类型

```ts
type TriggerCondition = {
  type: "answer" | "dimension" | "finalRisk" | "flag" | "field";
  field: string;
  operator: "eq" | "neq" | "in" | "not_in" | "gte" | "lte";
  value: string | string[] | number | boolean;
  score: number;
};
```

## 14.3 ProtectRule 类型

保护规则不强制要求 score。

```ts
type ProtectRule = Omit<TriggerCondition, "score"> & {
  score?: number;
};
```

## 14.4 protectRules 处理规则

如果任意一条 protectRule 命中，则该风险卡不触发。

```ts
if (riskCard.protectRules?.some(rule => matchCondition(rule))) {
  return {
    triggered: false,
    reason: "protected"
  };
}
```

不是全部 protectRules 命中才保护。

只要命中任意一条保护规则，就跳过该风险卡。

---

# 15. strongMatch 映射规则

## 15.1 strongMatch 只做准入

strongMatch 只用于判断风险卡是否有资格触发。

strongMatch 不加分。

## 15.2 字段映射必须固定

```ts
strongMatch.companyType 对应 answers.company_type
strongMatch.workType 对应 answers.work_type
```

不得读取：

```ts
answers.companyType
answers.workType
```

因为用户答案字段统一使用 snake_case：

```ts
company_type
work_type
```

## 15.3 strongMatch 示例

```json
"strongMatch": {
  "companyType": ["SOE"],
  "workType": ["FUNCTION"]
}
```

表示：

```ts
answers.company_type === "SOE"
answers.work_type === "FUNCTION"
```

---

# 16. 风险卡触发规则

## 16.1 防止路径自动触发

风险卡不能只因为用户选择某个公司类型或工作类型就触发。

例如：

* 不能只因 `work_type = GROWTH` 就触发商业增长外耗
* 不能只因 `company_type = SOE` 就触发国企流程压抑

## 16.2 strongMatch 不加分

如果配置了 strongMatch，它只做准入。

## 16.3 field 条件不作为主触发依据

`field` 类型条件只能作为辅助条件，不作为主要风险信号。

第一版建议避免给路径类 field 条件高分。

## 16.4 primaryRiskSignal

风险卡必须至少命中一个 primaryRiskSignal。

primaryRiskSignal 包括：

```txt
answer
dimension
finalRisk
```

不包括：

```txt
field
flag
```

原因：

flag 只是辅助信号，例如 `innovation_drive = true`，不能单独触发风险卡。

## 16.5 flag 只能作为辅助信号

flag 可以加分，但不能单独触发风险卡。

如果某张卡只命中了 flag，没有命中 answer / dimension / finalRisk，则不能触发。

## 16.6 风险卡触发条件

风险卡进入 `topRiskCards` 必须同时满足：

```txt
cardScore >= 60
```

并且：

```txt
matchedPrimaryRiskSignalCount >= 1
```

也可以补充使用：

```txt
matchedNonFieldConditionScore >= 20
```

但核心要求是：

至少命中一个 answer / dimension / finalRisk。

## 16.7 cardScore 计算公式

```ts
cardScore =
  baseTriggerScore
  + sum(matchedNonFieldCondition.score)
  + priorityBonus
  + relatedFinalRiskBonus
```

其中：

```ts
matchedNonFieldCondition = condition.type !== "field"
```

但最终触发必须满足：

```ts
matchedPrimaryRiskSignalCount >= 1
```

## 16.8 priorityBonus

```ts
high = 20
medium = 15
low = 5
```

## 16.9 relatedFinalRiskBonus

如果该风险卡任一 `relatedRisks` 对应最终风险等级为 `high`：

```ts
relatedFinalRiskBonus = 15
```

否则：

```ts
relatedFinalRiskBonus = 0
```

---

# 17. 风险卡触发伪代码

```ts
function evaluateRiskCard(card, context) {
  // 1. protectRules：任意命中即跳过
  if (card.protectRules?.some(rule => matchCondition(rule, context))) {
    return { triggered: false, score: 0, reason: "protected" };
  }

  // 2. strongMatch：只做准入，不加分
  if (!matchStrongMatch(card.strongMatch, context)) {
    return { triggered: false, score: 0, reason: "strong_match_failed" };
  }

  // 3. 匹配 conditions
  const matchedConditions = card.conditions.filter(condition =>
    matchCondition(condition, context)
  );

  const matchedNonFieldConditions = matchedConditions.filter(condition =>
    condition.type !== "field"
  );

  const matchedPrimaryRiskSignals = matchedConditions.filter(condition =>
    ["answer", "dimension", "finalRisk"].includes(condition.type)
  );

  const matchedNonFieldConditionScore = matchedNonFieldConditions.reduce(
    (sum, condition) => sum + condition.score,
    0
  );

  const priorityBonus = getPriorityBonus(card.priority);

  const relatedFinalRiskBonus = hasHighRelatedRisk(card.relatedRisks, context)
    ? 15
    : 0;

  const cardScore =
    card.baseTriggerScore +
    matchedNonFieldConditionScore +
    priorityBonus +
    relatedFinalRiskBonus;

  const triggered =
    cardScore >= 60 &&
    matchedPrimaryRiskSignals.length >= 1;

  return {
    triggered,
    score: cardScore,
    matchedPrimaryRiskSignalCount: matchedPrimaryRiskSignals.length,
    matchedNonFieldConditionScore
  };
}
```

---

# 18. 风险卡配置示例

## 18.1 H3 商业增长外耗

```json
{
  "id": "H3_GROWTH_EXHAUSTION",
  "title": "商业增长不是聊天，是长期面对拒绝。",
  "mainText": "你可能低估了商业增长岗位里的陌生沟通、跟进和结果压力。",
  "subText": "这类工作真实的日常，往往是找客户、发消息、跟进、被拒绝、记录转化。",
  "stingText": "你不是不能做业务，但你要先确认自己能不能承受持续被拒绝。",
  "priority": "high",
  "baseTriggerScore": 30,
  "relatedRisks": ["R4_quit_6_18_month_risk"],
  "strongMatch": {
    "workType": ["GROWTH"]
  },
  "conditions": [
    {
      "type": "answer",
      "field": "growth_stranger_contact",
      "operator": "in",
      "value": ["C", "D"],
      "score": 20
    },
    {
      "type": "answer",
      "field": "growth_rejection_reaction",
      "operator": "in",
      "value": ["C", "D"],
      "score": 20
    },
    {
      "type": "dimension",
      "field": "V1_social_exhaustion",
      "operator": "gte",
      "value": 60,
      "score": 20
    },
    {
      "type": "dimension",
      "field": "V2_rejection_conflict_exhaustion",
      "operator": "gte",
      "value": 60,
      "score": 20
    }
  ],
  "animationType": "growth_exhaustion",
  "musicType": "high_risk"
}
```

## 18.2 H5 国企流程压抑

```json
{
  "id": "H5_SOE_PROCESS_PRESSURE",
  "title": "稳定背后，也有流程和慢反馈。",
  "mainText": "你选择的可能不只是稳定，也是一套流程、层级和等待。",
  "subText": "在国企 / 央企里，很多事情不是想清楚就能马上推动。",
  "stingText": "你想要稳定，但稳定也可能意味着：你要学会等。",
  "priority": "high",
  "baseTriggerScore": 30,
  "relatedRisks": [
    "R2_reality_gap_risk",
    "R4_quit_6_18_month_risk"
  ],
  "strongMatch": {
    "companyType": ["SOE"]
  },
  "conditions": [
    {
      "type": "answer",
      "field": "soe_approval_waiting",
      "operator": "in",
      "value": ["C", "D"],
      "score": 20
    },
    {
      "type": "answer",
      "field": "soe_idea_cannot_push",
      "operator": "in",
      "value": ["C", "D"],
      "score": 20
    },
    {
      "type": "dimension",
      "field": "V3_rule_process_pressure",
      "operator": "gte",
      "value": 60,
      "score": 20
    },
    {
      "type": "flag",
      "field": "innovation_drive",
      "operator": "eq",
      "value": true,
      "score": 10
    }
  ],
  "animationType": "soe_process_pressure",
  "musicType": "high_risk"
}
```

## 18.3 H16 考研延后问题风险

```json
{
  "id": "H16_EXAM_DELAY_PROBLEM",
  "title": "考研不一定能解决你现在的问题。",
  "mainText": "如果你只是因为害怕就业、害怕选错方向而考研，它可能只是把问题往后推。",
  "subText": "真正需要解决的，可能不是学历，而是你对工作方向、岗位动作和未来风险的判断。",
  "stingText": "如果方向没想清楚，读研后这个问题还会回来。",
  "priority": "high",
  "baseTriggerScore": 30,
  "relatedRisks": [
    "R2_reality_gap_risk",
    "R3_direction_misjudgment_risk",
    "R5_three_year_flexibility_risk"
  ],
  "conditions": [
    {
      "type": "answer",
      "field": "postgraduate_exam",
      "operator": "in",
      "value": ["both_exam_and_job", "avoid_job_pressure"],
      "score": 30
    },
    {
      "type": "answer",
      "field": "choice_reason",
      "operator": "eq",
      "value": "uncertain_try",
      "score": 20
    },
    {
      "type": "dimension",
      "field": "V12_exam_delay_risk",
      "operator": "gte",
      "value": 50,
      "score": 20
    },
    {
      "type": "dimension",
      "field": "V8_job_action_misunderstanding",
      "operator": "gte",
      "value": 50,
      "score": 15
    },
    {
      "type": "finalRisk",
      "field": "R3_direction_misjudgment_risk",
      "operator": "gte",
      "value": 60,
      "score": 15
    }
  ],
  "protectRules": [
    {
      "type": "field",
      "field": "work_type",
      "operator": "eq",
      "value": "TECH"
    },
    {
      "type": "answer",
      "field": "postgraduate_exam",
      "operator": "eq",
      "value": "decided"
    }
  ],
  "animationType": "exam_delay_problem",
  "musicType": "high_risk"
}
```

---

# 19. labels.json 规范

## 19.1 作用

避免中文 label 写死在组件中。

## 19.2 文件路径

```txt
/src/config/audiences/{audience_type}/labels.json
```

## 19.3 示例

```json
{
  "companyTypeLabels": {
    "SOE": "国企 / 央企 / 体制型组织",
    "MNC": "外企 / 规范型组织",
    "PLATFORM": "大型民企 / 平台型公司",
    "PRIVATE_SME": "传统中小民企",
    "STARTUP": "创业公司 / 新业务团队"
  },
  "workTypeLabels": {
    "GROWTH": "商业增长型",
    "CONTENT": "内容影响型",
    "PRODUCT_OPS": "产品运营型",
    "FUNCTION": "专业职能型",
    "TECH": "技术研发型"
  },
  "riskLabels": {
    "R1_adaptation_risk": "第一份工作适应风险",
    "R2_reality_gap_risk": "现实落差风险",
    "R3_direction_misjudgment_risk": "方向误判风险",
    "R4_quit_6_18_month_risk": "6-18个月想离职风险",
    "R5_three_year_flexibility_risk": "3年后职业弹性风险"
  },
  "riskLevelLabels": {
    "low": "低风险",
    "medium": "中风险",
    "high": "高风险"
  }
}
```

---

# 20. result_copy.json 规范

## 20.1 作用

配置结果页全部文案。

包括：

* 结果生成屏文案
* 路径复述屏文案
* 风险指数页文案
* 每个风险低 / 中 / 高解释文案
* 结果页收口文案

## 20.2 示例结构

```json
{
  "loadingScreen": {
    "title": "你的第一份工作风险预演正在生成。",
    "steps": [
      "正在识别你的目标公司类型……",
      "正在分析你的工作选择……",
      "正在匹配真实职场风险……",
      "正在生成你的第一份工作风险报告……"
    ],
    "completeText": "预演完成。"
  },
  "pathScreen": {
    "title": "你刚刚预演的是：",
    "subText": "这不是在判断你适不适合，而是先让你看看：这条路进入真实职场后，可能会怎样考验你。",
    "closingText": "很多第一份工作的问题，不是入职前看不出来，而是入职后才慢慢显出来。"
  },
  "riskIndexScreen": {
    "title": "你的第一份工作风险指数",
    "subText": "以下结果不是结论，而是提醒你：这条路可能在哪些地方消耗你。"
  },
  "riskLevelTexts": {
    "R1_adaptation_risk": {
      "low": "你对第一份工作的基础执行、学习和适应有一定准备。",
      "medium": "你可能需要一段时间适应真实职场。",
      "high": "你对第一份工作的真实节奏可能准备不足。"
    }
  }
}
```

---

# 21. viral_copy.json 规范

## 21.1 同路径分享卡

```json
{
  "pathShareCard": {
    "title": "如果你也想选这条路，先看看它会怎么考验你。",
    "companyWarnings": {
      "SOE": "稳定背后，也有流程、层级和慢反馈。",
      "MNC": "规范背后，也需要清晰表达和主动争取机会。",
      "PLATFORM": "平台背后，是节奏、数据和结果压力。",
      "PRIVATE_SME": "机会背后，也可能是边界不清和资源有限。",
      "STARTUP": "自由背后，也可能是不确定和混乱。"
    },
    "workWarnings": {
      "GROWTH": "真正考验人的，不是会不会聊天，而是能不能长期面对拒绝和转化压力。",
      "CONTENT": "内容不是只表达自己，它会持续被数据验证。",
      "PRODUCT_OPS": "想清楚只是第一步，推得动才是工作。",
      "FUNCTION": "职能不是躺平，而是长期保证系统不出错。",
      "TECH": "技术不是学会一次，而是要一直追。"
    },
    "footer": "秋招前，做一次第一份工作风险预演。"
  }
}
```

## 21.2 高刺痛分享文案

```json
{
  "viralCopies": {
    "H16_EXAM_DELAY_PROBLEM": {
      "targetText": "发给那个说“实在不行我就考研”的同学。",
      "copyText": "如果你也在纠结考研还是就业，可以测一下。这个测试有句话挺扎心：如果只是为了躲开就业，考研可能只是把方向问题往后推。"
    },
    "H5_SOE_PROCESS_PRESSURE": {
      "targetText": "发给那个一心想进国企的同学。",
      "copyText": "如果你也想进国企，建议测一下。稳定是真的，但稳定背后也有流程、层级、等待和慢反馈。"
    },
    "H3_GROWTH_EXHAUSTION": {
      "targetText": "发给那个觉得销售、商务、增长就是会聊天的同学。",
      "copyText": "想做销售、商务、增长、客户成功的可以测一下。这类工作真正考验的不是聊天，而是长期面对拒绝、跟进和转化压力。"
    }
  }
}
```

---

# 22. 分享卡 P0 / P1 边界

## 22.1 P0

第一版只做：

* 页面内生成分享卡样式
* 复制测试链接
* 复制高刺痛分享文案
* 记录复制事件

## 22.2 P0 不做

* 保存分享卡为图片
* html2canvas
* canvas 海报生成
* 长按保存图片
* 微信图片分享优化

## 22.3 P1

下一版再做：

* 保存图片
* 海报生成
* 长按保存

---

# 23. animation_map.json 规范

## 23.1 第一版降级规则

如果没有 Lottie 或音乐素材：

* 动画全部用 CSS / SVG 占位
* 音乐模块保留 AudioToggle 组件
* 无音频文件时默认静音
* 不因为音乐素材缺失阻塞主流程
* 不因为动画素材缺失阻塞主流程

## 23.2 示例

```json
{
  "screenAnimations": {
    "loading": "css_scan_card",
    "path": "css_path_choice",
    "riskIndex": "css_risk_bars",
    "service": "css_service_cards"
  },
  "riskCardAnimations": {
    "H3_GROWTH_EXHAUSTION": "css_message_rejection",
    "H5_SOE_PROCESS_PRESSURE": "css_approval_layers",
    "H6_STARTUP_CHAOS": "css_task_chaos",
    "H16_EXAM_DELAY_PROBLEM": "css_exam_timeline"
  },
  "fallbackRiskCardAnimation": "css_generic_risk_card",
  "musicMap": {
    "loading": "",
    "high_risk": "",
    "medium_risk": "",
    "low_risk": "",
    "service": ""
  }
}
```

---

# 24. service_cards.json 规范

```json
{
  "intro": {
    "title": "测试到这里，先停一下。",
    "text": "这份结果不会替你决定人生，但它已经提示了一个问题：你不能只看工作名字，还要看它背后的真实日常。"
  },
  "cards": [
    {
      "id": "diagnosis_599",
      "title": "如果你想判断：这条路到底能不能走",
      "serviceName": "599猎头诊断",
      "items": [
        "这个方向能不能去",
        "简历有没有机会过筛",
        "第一份工作应该优先看什么",
        "你现在最大的问题是方向、材料，还是表达",
        "秋招应该怎么准备下一步"
      ],
      "boundary": "测试只能展示风险。诊断才会判断路径。"
    },
    {
      "id": "graduate_training",
      "title": "如果你已经决定冲秋招",
      "serviceName": "秋招训练营",
      "items": [
        "简历修改",
        "自我介绍",
        "面试表达",
        "岗位判断",
        "投递策略",
        "群面 / 单面准备",
        "第一份工作选择避坑"
      ],
      "boundary": "知道风险还不够。真正要拿offer，需要训练动作。"
    },
    {
      "id": "follow_official_account",
      "title": "如果你还没想清楚",
      "serviceName": "继续关注公众号",
      "items": [
        "应届生秋招避坑",
        "第一份工作怎么选",
        "国企、外企、民企真实差异",
        "面试和简历准备",
        "考研和就业怎么判断"
      ],
      "boundary": "方向不清，不要急着乱投。先把真实工作看明白。"
    }
  ]
}
```

---

# 25. test_cases.json 规范

## 25.1 文件路径

```txt
/src/config/audiences/student/test_cases.json
```

## 25.2 作用

用于测试风险逻辑是否跑偏。

不是页面测试，而是评分和风险卡触发测试。

新增命令：

```bash
npm run test-risk-logic
```

## 25.3 示例

```json
[
  {
    "id": "case_soe_function_process_pressure",
    "name": "国企 + 职能，流程压抑",
    "answers": {
      "company_type": "SOE",
      "work_type": "FUNCTION",
      "postgraduate_exam": "no_exam",
      "soe_approval_waiting": "D",
      "soe_idea_cannot_push": "C",
      "function_detail_process": "C"
    },
    "expected": {
      "mustTrigger": ["H5_SOE_PROCESS_PRESSURE"],
      "mayTrigger": ["H7_FUNCTION_BACKSTAGE"],
      "riskLevels": {
        "R2_reality_gap_risk": ["medium", "high"],
        "R4_quit_6_18_month_risk": ["medium", "high"]
      }
    }
  },
  {
    "id": "case_startup_product_ops_uncertainty",
    "name": "创业公司 + 产品运营，不确定性焦虑高",
    "answers": {
      "company_type": "STARTUP",
      "work_type": "PRODUCT_OPS",
      "postgraduate_exam": "no_exam",
      "startup_direction_change": "D",
      "startup_multi_role": "C",
      "product_middle_layer": "C",
      "product_solution_changed": "C"
    },
    "expected": {
      "mustTrigger": ["H6_STARTUP_CHAOS"],
      "mayTrigger": ["H8_PRODUCT_OPS_MIDDLE_LAYER"],
      "riskLevels": {
        "R1_adaptation_risk": ["medium", "high"],
        "R4_quit_6_18_month_risk": ["medium", "high"],
        "R5_three_year_flexibility_risk": ["medium", "high"]
      }
    }
  },
  {
    "id": "case_exam_delay_unclear_direction",
    "name": "考研逃避 + 方向不确定",
    "answers": {
      "postgraduate_exam": "avoid_job_pressure",
      "choice_reason": "uncertain_try",
      "main_concern": "wrong_first_job",
      "reality_gap_reaction": "D",
      "job_action_understanding": "C"
    },
    "expected": {
      "mustTrigger": ["H16_EXAM_DELAY_PROBLEM"],
      "riskLevels": {
        "R3_direction_misjudgment_risk": ["high"],
        "R5_three_year_flexibility_risk": ["medium", "high"]
      },
      "viralCopy": {
        "targetText": "发给那个说“实在不行我就考研”的同学。"
      }
    }
  }
]
```

---

# 26. 数据结构

## 26.1 TestSession

```ts
type TestSession = {
  id: string;
  anonymousUserId: string;
  openid?: string;

  audienceType: string;

  answers: Record<string, string>;
  flags: Record<string, boolean | string>;

  actualScores: {
    dimensions: Record<string, number>;
    directR: Record<string, number>;
  };

  maxScores: {
    dimensions: Record<string, number>;
    directR: Record<string, number>;
  };

  normalizedScores: {
    dimensions: Record<string, number>;
    directR: Record<string, number>;
  };

  finalRisks: Record<string, number>;
  riskLevels: Record<string, "low" | "medium" | "high">;

  triggeredRiskCards: string[];
  topRiskCards: string[];

  pathShareCard?: {
    title: string;
    pathLabel: string;
    warningText: string;
  };

  viralCopy?: {
    targetText: string;
    copyText: string;
  };

  events: EventLog[];

  createdAt: string;
  completedAt?: string;
};
```

## 26.2 EventLog

```ts
type EventLog = {
  id: string;
  eventName:
    | "start_test"
    | "answer_question"
    | "complete_test"
    | "view_result"
    | "generate_path_share_card"
    | "copy_viral_text"
    | "copy_test_link"
    | "export_csv";
  payload?: Record<string, unknown>;
  createdAt: string;
};
```

---

# 27. 核心函数

## 27.1 读取配置

```ts
function loadAudienceConfig(audienceType: string): AudienceConfig;
```

```ts
type AudienceConfig = {
  questions: Question[];
  scoring: ScoringConfig;
  riskCards: RiskCard[];
  resultCopy: ResultCopyConfig;
  viralCopy: ViralCopyConfig;
  animationMap: AnimationMapConfig;
  serviceCards: ServiceCardsConfig;
  labels: LabelsConfig;
  testCases: TestCase[];
};
```

## 27.2 获取可见题目

```ts
function getVisibleQuestions(
  allQuestions: Question[],
  answers: Record<string, string>
): Question[];
```

## 27.3 计算分数

```ts
function calculateScores(
  questions: Question[],
  answers: Record<string, string>,
  scoringConfig: ScoringConfig
): ScoreResult;
```

必须完成：

1. 遍历实际展示过的题目
2. 根据用户答案累加 actualScores
3. 根据所有选项计算 maxScores
4. 归一化 actualScores
5. 按可用权重重归一化计算 finalRisks
6. 根据 thresholds 生成 riskLevels

## 27.4 触发风险卡

```ts
function triggerRiskCards(
  riskCards: RiskCard[],
  answers: Record<string, string>,
  flags: Record<string, boolean | string>,
  normalizedScores: ScoreResult["normalizedScores"],
  finalRisks: Record<string, number>,
  riskLevels: Record<string, string>
): RiskCardTriggerResult;
```

## 27.5 生成同路径分享卡

```ts
function generatePathShareCard(
  viralCopyConfig: ViralCopyConfig,
  labels: LabelsConfig,
  companyType: string,
  workType: string
): PathShareCard;
```

## 27.6 生成高刺痛分享文案

```ts
function generateViralCopy(
  viralCopyConfig: ViralCopyConfig,
  topRiskCardId: string
): ViralCopy;
```

---

# 28. 配置校验

## 28.1 必须实现命令

```bash
npm run validate-config
```

## 28.2 校验失败规则

如果发现 error：

```txt
npm run validate-config 必须以非 0 状态码退出。
```

开发环境中，开发者可以手动继续运行：

```bash
npm run dev
```

但正式部署前，必须先通过：

```bash
npm run validate-config
```

## 28.3 校验范围

至少检查：

1. 所有 question id 唯一。
2. 同一 question 内 option id 唯一。
3. showWhen.field 必须存在于题目 id 或基础字段中。
4. scores.dimensions 必须存在于 scoring.dimensions。
5. scores.directR 必须存在于 scoring.finalRisks。
6. risk card conditions 引用的 field 必须存在于 question id、基础字段、flags、dimensions 或 finalRisks 中。
7. risk card relatedRisks 必须存在于 scoring.finalRisks。
8. risk card animationType 必须有 fallback。
9. risk card musicType 必须有 fallback。
10. viral_copy.json 必须为每个可能进入 topRiskCards 的风险卡提供兜底文案。
11. scoring riskFormulas 中的 dimensionWeights 必须引用合法 dimension。
12. scoring riskFormulas 中的 directRWeight 对应 riskKey 必须存在于 finalRisks。
13. labels.json 必须包含所有 company_type、work_type、risk、riskLevel 的中文 label。
14. service_cards.json 至少包含一个服务卡。
15. test_cases.json 中 mustTrigger 的风险卡必须存在。
16. test_cases.json 中 riskLevels 的风险 key 必须存在于 scoring.finalRisks。
17. strongMatch.companyType 只能映射 answers.company_type。
18. strongMatch.workType 只能映射 answers.work_type。

---

# 29. 风险逻辑测试

## 29.1 必须实现命令

```bash
npm run test-risk-logic
```

## 29.2 测试内容

读取：

```txt
/src/config/audiences/student/test_cases.json
```

对每组测试：

1. 输入固定 answers。
2. 执行 calculateScores。
3. 执行 triggerRiskCards。
4. 检查 expected.mustTrigger 是否全部触发。
5. 检查 expected.riskLevels 是否符合预期。
6. 检查 expected.viralCopy 是否符合预期。

## 29.3 失败处理

如果风险逻辑测试失败：

```txt
npm run test-risk-logic 必须以非 0 状态码退出。
```

---

# 30. Codex 启动前置流程

## 30.1 禁止直接完整开发

Codex 读取文档后，不得直接开始写完整业务代码。

第一阶段只做：

```txt
一次文档检查 + 四个文档输出
```

## 30.2 必须输出的四个文档

### 1. docs/IMPLEMENTATION_PLAN.md

包括：

* 技术栈
* 路由结构
* 组件结构
* 配置文件结构
* 核心函数
* 开发顺序

### 2. docs/CONFIG_SCHEMA.md

包括：

* questions.json schema
* scoring.json schema
* risk_cards.json schema
* result_copy.json schema
* viral_copy.json schema
* animation_map.json schema
* service_cards.json schema
* labels.json schema
* test_cases.json schema

### 3. docs/MISSING_REQUIREMENTS.md

包括：

* 当前还缺哪些配置
* 哪些字段需要补齐
* 哪些素材缺失
* 哪些文案暂时可用 fallback
* 哪些地方不能自行猜测

### 4. docs/RISK_LOGIC_CHECK.md

包括：

* directR 命名是否一致
* risk_cards 是否可能过度触发
* protectRules 是否处理正确
* flag 是否只作为辅助信号
* finalRisk 是否做可用权重重归一化
* labels 是否完整
* validate-config 是否覆盖关键引用关系
* test-risk-logic 是否覆盖验收样例

---

# 31. Codex 第一条指令建议

请先阅读本项目开发文档，不要直接开始写业务代码。

第一阶段只做：

```txt
一次文档检查 + 四个文档输出
```

具体任务：

1. 检查开发文档是否存在字段命名冲突、配置冲突、逻辑冲突。
2. 输出 `docs/IMPLEMENTATION_PLAN.md`。
3. 输出 `docs/CONFIG_SCHEMA.md`。
4. 输出 `docs/MISSING_REQUIREMENTS.md`。
5. 输出 `docs/RISK_LOGIC_CHECK.md`。

在这些文档完成前，不要开始实现完整业务代码。

特别注意：

* directR 命名必须统一。
* scoring.json 中不得使用 `direct_R*` 前缀。
* risk card 不得只因用户选择某个公司 / 岗位路径就触发。
* strongMatch 只做准入，不加分。
* strongMatch.companyType 对应 answers.company_type。
* strongMatch.workType 对应 answers.work_type。
* flag 只能作为辅助信号，不能单独触发风险卡。
* 风险卡至少要命中一个 answer / dimension / finalRisk 才能触发。
* protectRules 使用 ProtectRule 类型，不强制要求 score。
* protectRules 任意命中即跳过该风险卡。
* finalRisk 计算必须对可用权重重归一化。
* 第一版不接 openid。
* 第一版 localStorage 只用于本地体验，不作为真实运营后台。
* P0 分享卡只做页面展示和复制，不做保存图片。
* 必须实现 `npm run validate-config`。
* 必须实现 `npm run test-risk-logic`。
* 所有文案、题库、评分、风险卡、标签、分享文案都必须从 audience_type 对应配置读取。
