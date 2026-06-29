# CONFIG_SCHEMA

## 1. 通用约定

所有配置文件按 `audience_type` 读取：

```txt
src/config/audiences/{audience_type}/
```

第一版默认：

```txt
audience_type = student
```

建议后续实现统一定义：

```ts
BASE_FIELDS = [
  "audience_type",
  "company_type",
  "work_type",
  "postgraduate_exam"
]
```

`BASE_FIELDS` 的最终范围需要产品确认。其用途是支撑 `showWhen.field`、risk card `field` 条件、labels 校验和路径分享卡生成。

## 2. questions.json

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

type QuestionOption = {
  id: string;
  text: string;
  scores?: {
    dimensions?: Record<string, number>;
    directR?: Record<string, number>;
  };
  flags?: Record<string, boolean | string>;
};

type ShowWhenRule = {
  field: string;
  operator: "eq" | "neq" | "in" | "not_in";
  value: string | string[];
};
```

约束：

1. `id` 全局唯一。
2. 同一题目内 `option.id` 唯一。
3. `scores.dimensions` 只能引用 `scoring.dimensions`。
4. `scores.directR` 只能引用 `scoring.finalRisks`，不得出现 `direct_R*` 前缀。
5. `showWhen.field` 必须引用 question id 或 `BASE_FIELDS`。

## 3. scoring.json

```ts
type ScoringConfig = {
  dimensions: string[];
  finalRisks: string[];
  riskFormulas: Record<string, RiskFormula>;
  thresholds: {
    low: [number, number];
    medium: [number, number];
    high: [number, number];
  };
};

type RiskFormula = {
  directRWeight: number;
  dimensionWeights: Record<string, number>;
};
```

约束：

1. `riskFormulas` 的 key 必须来自 `finalRisks`。
2. `dimensionWeights` 的 key 必须来自 `dimensions`。
3. `directRWeight` 只表示当前 finalRisk 对应 directR 的权重，不允许另建 `direct_R*` key。
4. finalRisk 计算必须只使用有 `maxScore > 0` 的可用 source，并对可用权重重新归一化。
5. 没有任何可用 source 时，该 finalRisk 为 `0`，riskLevel 为 `low`。

## 4. risk_cards.json

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

type TriggerCondition = {
  type: "answer" | "dimension" | "finalRisk" | "flag" | "field";
  field: string;
  operator: "eq" | "neq" | "in" | "not_in" | "gte" | "lte";
  value: string | string[] | number | boolean;
  score: number;
};

type ProtectRule = Omit<TriggerCondition, "score"> & {
  score?: number;
};
```

约束：

1. `strongMatch.companyType` 只映射 `answers.company_type`。
2. `strongMatch.workType` 只映射 `answers.work_type`。
3. strongMatch 只做准入，不加分。
4. protectRules 任意命中即跳过该风险卡。
5. flag 和 field 只能作为辅助信号，不能单独触发风险卡。
6. 每张可触发风险卡至少需要一个 `answer`、`dimension` 或 `finalRisk` 条件。
7. 进入 `topRiskCards` 必须满足 `cardScore >= 60` 且 `matchedPrimaryRiskSignalCount >= 1`。
8. `relatedRisks` 只能引用 `scoring.finalRisks`。

## 5. result_copy.json

```ts
type ResultCopyConfig = {
  loadingScreen: {
    title: string;
    steps: string[];
    completeText: string;
  };
  pathScreen: {
    title: string;
    subText: string;
    closingText: string;
  };
  riskIndexScreen: {
    title: string;
    subText: string;
  };
  riskLevelTexts: Record<
    string,
    {
      low: string;
      medium: string;
      high: string;
    }
  >;
};
```

约束：

1. `riskLevelTexts` 应覆盖所有 `scoring.finalRisks`。
2. 不在组件中写死结果页中文文案。

## 6. viral_copy.json

```ts
type ViralCopyConfig = {
  pathShareCard: {
    title: string;
    companyWarnings: Record<string, string>;
    workWarnings: Record<string, string>;
    footer: string;
  };
  viralCopies: Record<
    string,
    {
      targetText: string;
      copyText: string;
    }
  >;
};
```

约束：

1. `companyWarnings` 覆盖 `labels.companyTypeLabels`。
2. `workWarnings` 覆盖 `labels.workTypeLabels`。
3. `viralCopies` 应覆盖可能进入 `topRiskCards` 的风险卡，或提供明确 fallback。

## 7. animation_map.json

```ts
type AnimationMapConfig = {
  screenAnimations: Record<string, string>;
  riskCardAnimations: Record<string, string>;
  fallbackRiskCardAnimation: string;
  musicMap: Record<string, string>;
};
```

约束：

1. 缺少 Lottie 或音频素材时使用 CSS / SVG 占位和静音 fallback。
2. 不因为素材缺失阻塞主流程。
3. `riskCard.animationType` 和 `musicType` 必须能被映射或 fallback。

## 8. service_cards.json

```ts
type ServiceCardsConfig = {
  intro: {
    title: string;
    text: string;
  };
  cards: ServiceCard[];
};

type ServiceCard = {
  id: string;
  title: string;
  serviceName: string;
  items: string[];
  boundary: string;
};
```

约束：

1. `cards` 至少包含一项。
2. 第一版只展示服务，不实现支付、预约、数据库或外部服务接入。

## 9. labels.json

```ts
type LabelsConfig = {
  companyTypeLabels: Record<string, string>;
  workTypeLabels: Record<string, string>;
  riskLabels: Record<string, string>;
  riskLevelLabels: {
    low: string;
    medium: string;
    high: string;
  };
};
```

约束：

1. `companyTypeLabels` 覆盖所有公司类型答案。
2. `workTypeLabels` 覆盖所有工作类型答案。
3. `riskLabels` 覆盖所有 `scoring.finalRisks`。
4. `riskLevelLabels` 覆盖 `low`、`medium`、`high`。

## 10. test_cases.json

```ts
type TestCase = {
  id: string;
  name: string;
  answers: Record<string, string>;
  expected: {
    mustTrigger?: string[];
    mayTrigger?: string[];
    riskLevels?: Record<string, Array<"low" | "medium" | "high">>;
    viralCopy?: {
      targetText?: string;
      copyText?: string;
    };
  };
};
```

约束：

1. `mustTrigger` 和 `mayTrigger` 中的风险卡 id 必须存在。
2. `riskLevels` 的 key 必须来自 `scoring.finalRisks`。
3. 建议测试用例提供完整的可见题目答案，以便准确计算 maxScores 和 finalRisks。
4. 如果允许局部答案，必须在测试 runner 中明确定义局部答案模式，不能让缺失答案被误当作低风险。
