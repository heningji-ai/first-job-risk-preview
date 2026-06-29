# DECISIONS

## 1. BASE_FIELDS 最终范围

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

已确认：

1. `postgraduate_exam` 属于基础字段。
2. `anonymousUserId` 不属于 `BASE_FIELDS`。
3. `anonymousUserId` 是用户身份字段，不参与题目展示、评分和风险卡触发。

## 2. test_cases.json 使用局部答案

已确认：

1. `test-risk-logic` 使用局部答案。
2. 测试时只对 `answers` 中出现的 question 计算 actualScores 和 maxScores。
3. 正式用户流程仍然要求完整答题后才能进入结果页。

## 3. topRiskCards 为空时的 fallback

已确认：

1. 如果 `topRiskCards` 为空，不得报错。
2. 结果页展示 `H0_GENERAL_REMINDER`。
3. `H0_GENERAL_REMINDER` 不进入 `triggeredRiskCards`。
4. `H0_GENERAL_REMINDER` 只作为结果页展示兜底。
5. viralCopy 使用 `defaultViralCopy`。

## 4. viral_copy.json 兜底规则

已确认：

1. P0 要求 `viral_copy.json` 必须提供 `defaultViralCopy`。
2. 风险卡如果有专属 viral copy，优先使用专属文案。
3. 如果没有专属 viral copy，使用 `defaultViralCopy`。
4. `validate-config` 对缺少专属 viral copy 输出 warning，不作为 error。
5. 如果缺少 `defaultViralCopy`，输出 error。

## 5. 音乐规则

已确认：

1. 第一版默认静音，但保留 AudioToggle 组件。
2. 第一版不要求真实音频文件。
3. `musicMap` 可以为空字符串。
4. 无音频文件时页面不报错。
5. 不得因为音频素材缺失阻塞主流程。

## 6. postgraduate_exam

已确认：

1. `postgraduate_exam` 属于基础字段。
2. `postgraduate_exam` 可以被 showWhen、risk card condition、test_cases 和 validate-config 引用。

## 7. Q1-Q3 编号规则

已确认：

1. `docs/SOURCE_STUDENT_QUESTIONS.md` 没有 Q1-Q2-Q3。
2. Q1-Q3 缺失不阻塞第一版。
3. 第一版以 `docs/SOURCE_STUDENT_QUESTIONS.md` 的 A/C/D/E/F/G 编号为准。
4. `questions.json` 中 `sourceCode` 保留 A1、A2、C1、G1-1 等源文档编号。
5. 工程 `id` 使用 `current_status`、`education`、`c1`、`g1_1` 等字段。

## 8. A9 / mbti_known

已确认：

1. 源文档存在 A9：是否知道 MBTI，若知道进入 B1，若不知道进入 C 组快速倾向题。
2. A9 工程字段为 `mbti_known`。
3. A9 使用产品方确认的最小工程化选项：`known` 和 `unknown`。
4. 这不是 Codex 自行补题，而是产品方确认的工程化分流字段。
5. 如果源文档没有 B1 或 16 型 MBTI 选项，当前阶段不自行补齐 `mbti_type`。
