# RISK_LOGIC_CHECK

## 1. 检查结论

开发文档 V1.3 对评分和风险卡触发规则的核心方向是清晰的：directR 命名统一、strongMatch 只做准入、flag 和 field 不单独触发、protectRules 任意命中即跳过、finalRisk 按可用权重重归一化。

已同步的最终规则：

1. `BASE_FIELDS` 已正式定义。
2. `test_cases.json` 使用局部答案。
3. `topRiskCards` 为空时展示 `H0_GENERAL_REMINDER`，但不写入 `triggeredRiskCards`。
4. viralCopy 必须支持 `defaultViralCopy`。
5. 第一版默认静音，音频缺失不得阻塞主流程。
6. validate-config 和 test-risk-logic 的实现边界需要在后续开发中保持分离。

## 2. directR 命名是否统一

结论：文档规则统一。

要求：

1. `questions.json` 的 `scores.directR` 必须直接使用 `scoring.finalRisks` 中的 key。
2. 正确示例：`R2_reality_gap_risk`。
3. 错误示例：`direct_R2_reality_gap_risk`。
4. `scoring.json` 中不得出现 `direct_R*` 前缀。

后续 validate-config 必须检查：

1. 所有 `scores.directR` key 存在于 `scoring.finalRisks`。
2. 所有配置文件中不得出现以 `direct_R` 开头的风险 key。

## 3. scoring.json 是否仍可能出现 direct_R* 前缀

结论：规格明确禁止，但需要工具强校验。

风险点：

1. 人工补配置时可能把 directR 写成 `direct_R*`。
2. 如果只校验 key 是否存在，可能漏掉字符串层面的错误。

建议：

1. validate-config 对 `questions.json` 和 `scoring.json` 做全量 key 扫描。
2. 发现任何 `direct_R` 前缀，直接 error。

## 4. risk card 是否会因为路径选择而过度触发

结论：规则已经防止过度触发，但配置必须配合。

保护规则：

1. strongMatch 只做准入，不加分。
2. field 条件不作为主触发依据。
3. flag 不能单独触发。
4. 必须至少命中一个 `answer`、`dimension` 或 `finalRisk`。

风险点：

1. 如果 `baseTriggerScore + priorityBonus + relatedFinalRiskBonus` 已经接近 60，且没有 primaryRiskSignal 检查，会发生路径自动触发。
2. 如果把 `company_type` 或 `work_type` 写成高分 field，也可能误导排序。

建议：

1. validate-config 检查每张风险卡至少配置一个 primaryRiskSignal 条件。
2. test-risk-logic 增加只有路径选择、无风险答案时不得触发对应风险卡的测试。

## 5. strongMatch 是否只做准入

结论：文档明确 strongMatch 只做准入，不加分。

实现要求：

1. strongMatch 不参与 `cardScore`。
2. strongMatch 不计入 `matchedPrimaryRiskSignalCount`。
3. strongMatch 不替代 answer / dimension / finalRisk 命中。

## 6. strongMatch.companyType 映射

结论：必须映射 `answers.company_type`。

禁止读取：

```ts
answers.companyType
```

后续 validate-config 可检查字段名写法，但真正映射正确性需要 test-risk-logic 覆盖。

## 7. strongMatch.workType 映射

结论：必须映射 `answers.work_type`。

禁止读取：

```ts
answers.workType
```

建议增加测试：

1. `answers.work_type` 命中时，strongMatch 可通过。
2. 只有 `answers.workType` 时，不应被当作有效答案。

## 8. flag 是否只作为辅助信号

结论：文档明确 flag 只能辅助，不能单独触发风险卡。

实现要求：

1. flag 可以计入 `matchedNonFieldConditionScore`。
2. flag 不计入 `matchedPrimaryRiskSignalCount`。
3. 只命中 flag 时，风险卡不得进入 `topRiskCards`。

## 9. 风险卡是否至少命中一个 answer / dimension / finalRisk

结论：这是必须条件。

触发条件应同时满足：

```txt
cardScore >= 60
matchedPrimaryRiskSignalCount >= 1
```

primaryRiskSignal 只包括：

```txt
answer
dimension
finalRisk
```

不包括：

```txt
field
flag
strongMatch
```

## 10. protectRules 是否任意命中即跳过

结论：文档明确任意 protectRule 命中即跳过该风险卡。

实现顺序建议：

1. 先判断 protectRules。
2. 再判断 strongMatch。
3. 再计算 conditions 和 cardScore。

只要 protectRules 命中，不应继续计算该风险卡分数。

## 11. finalRisk 是否对可用权重重归一化

结论：文档明确需要重归一化。

实现要求：

1. directR 可用条件：`maxScores.directR[riskKey] > 0`。
2. dimension 可用条件：`maxScores.dimensions[dimensionKey] > 0`。
3. 缺失项不按 0 分计算。
4. 对可用 source 的权重求和后重归一化。
5. 没有任何可用 source 时，finalRisk 为 `0`，riskLevel 为 `low`。

## 12. 是否需要 BASE_FIELDS 定义

结论：已确认需要，且最终范围如下：

```ts
const BASE_FIELDS = [
  "current_status",
  "education",
  "gender",
  "postgraduate_exam",
  "company_type",
  "work_type",
  "choice_reason",
  "main_concern",
  "mbti_known",
  "mbti_type",
  "audience_type"
];
```

原因：

1. showWhen.field 需要判断引用是否合法。
2. risk card field 条件需要判断引用是否合法。
3. labels 需要知道哪些路径字段必须有中文 label。
4. pathShareCard 需要稳定读取 company_type 和 work_type。

补充规则：

1. `postgraduate_exam` 属于基础字段。
2. `postgraduate_exam` 可以被 showWhen、risk card condition、test_cases 和 validate-config 引用。
3. `anonymousUserId` 不属于 `BASE_FIELDS`，它是用户身份字段，不参与题目展示、评分和风险卡触发。

## 13. topRiskCards 为空时是否需要 fallback

结论：已确认需要。

原因：

1. 用户可能整体低风险，或配置保护规则导致所有风险卡被跳过。
2. 结果页需要稳定展示最大风险场景屏和分享区域。
3. viralCopy 生成依赖 `topRiskCardId`，为空时需要明确行为。

最终规则：

1. 如果 `topRiskCards` 为空，不得报错。
2. 展示 `H0_GENERAL_REMINDER`。
3. `H0_GENERAL_REMINDER` 不进入 `triggeredRiskCards`。
4. `H0_GENERAL_REMINDER` 只作为结果页展示兜底。
5. viralCopy 使用 `defaultViralCopy`。
6. 不能临时编造风险卡来填充空位。

## 14. test_cases.json 应该使用完整答案还是局部答案

结论：已确认使用局部答案。

最终规则：

1. `test-risk-logic` 使用局部答案。
2. 测试时只对 `answers` 中出现的 question 计算 actualScores 和 maxScores。
3. 正式用户流程仍然要求完整答题后才能进入结果页。
4. 局部答案测试不得把缺失答案静默当作低风险答案。
5. 局部答案测试是风险逻辑验收模式，不代表完整用户路径。

实现注意：

1. calculateScores 在测试模式下只遍历 `answers` 中出现且能在 questions 中找到的 question。
2. maxScores 只基于这些参与测试的 question 计算。
3. finalRisk 仍然按可用权重重归一化。

## 15. viralCopy fallback 规则

结论：已确认需要 `defaultViralCopy`。

最终规则：

1. P0 要求 `viral_copy.json` 必须提供 `defaultViralCopy`。
2. 风险卡如果有专属 viral copy，优先使用专属文案。
3. 如果没有专属 viral copy，使用 `defaultViralCopy`。
4. validate-config 对缺少专属 viral copy 输出 warning，不作为 error。
5. 如果缺少 `defaultViralCopy`，输出 error。

建议 schema：

```ts
type ViralCopyConfig = {
  pathShareCard: {
    title: string;
    companyWarnings: Record<string, string>;
    workWarnings: Record<string, string>;
    footer: string;
  };
  defaultViralCopy: {
    targetText: string;
    copyText: string;
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

## 16. 音乐 fallback 规则

结论：第一版默认静音，但保留 AudioToggle 组件。

最终规则：

1. 第一版不要求真实音频文件。
2. `musicMap` 可以为空字符串。
3. 无音频文件时页面不报错。
4. 不得因为音频素材缺失阻塞主流程。

## 17. validate-config 实现边界

validate-config 应检查静态配置质量，不执行完整业务流程。

至少覆盖：

1. id 唯一性。
2. 引用合法性。
3. `direct_R*` 禁用。
4. strongMatch 映射字段规则。
5. 每张风险卡至少有一个 primaryRiskSignal 条件。
6. relatedRisks、dimensionWeights、scores.directR、labels、viralCopy、animationMap、musicMap 的覆盖关系。
7. test_cases 里的风险卡和 finalRisk 引用存在。
8. `BASE_FIELDS` 使用最终决策范围。
9. `postgraduate_exam` 作为基础字段允许引用。
10. 缺少专属 viral copy 输出 warning。
11. 缺少 `defaultViralCopy` 输出 error。
12. `musicMap` 为空字符串不报错。

## 18. test-risk-logic 实现边界

test-risk-logic 应执行真实评分和风险卡触发流程。

至少覆盖：

1. 输入固定局部 answers。
2. 只对 `answers` 中出现的 question 计算 actualScores 和 maxScores。
3. 计算 normalizedScores、finalRisks、riskLevels。
3. 执行 triggerRiskCards。
4. 检查 expected.mustTrigger。
5. 检查 expected.riskLevels。
6. 检查 expected.viralCopy。
7. 增加反例：只有路径选择、只有 flag、protectRules 命中时不得触发风险卡。
8. 增加空 `topRiskCards` fallback 测试：展示 `H0_GENERAL_REMINDER`，但不进入 `triggeredRiskCards`，viralCopy 使用 `defaultViralCopy`。
