# 评分配置填写模板

本文件是评分配置填写模板。请勿在本文件中填写正式分值后直接视为上线配置；正式配置仍需进入 `questions.json` 和 `scoring.json` 并通过校验。

## 1. directR 字段补充规则

填写目标：

- 每个 option 的 `scores.directR` 只能引用 `scoring.finalRisks` 中存在的 key。
- 禁止出现 `direct_R*` 前缀。
- 缺失评分不能被默认为 0 分参与计算。

填写模板：

```json
"scores": {
  "directR": {
    "R1_adaptation_risk": "待填写数字",
    "R2_reality_gap_risk": "待填写数字"
  }
}
```

产品方需确认：

- 哪些题目参与 directR。
- 哪些选项不参与 directR。
- 分值范围和上限。
- 同一题多个 option 的相对强弱。

## 2. 每道题 option 的 directR 分值填写格式

| questionId | optionId | finalRisk key | directR 分值 | 是否正式确认 | 备注 |
| --- | --- | --- | --- | --- | --- |
| 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 |

注意事项：

- 同一道题的 maxScore 会基于该题已配置选项计算。
- 未回答题不参与 actualScore 和 maxScore。
- 被分流隐藏且未进入 session 的题不参与计算。

## 3. dimensionScores 维度设计模板

当前工程维度 key：

- `V1_social_exhaustion`
- `V2_rejection_conflict_exhaustion`
- `V3_rule_process_pressure`
- `V4_uncertainty_anxiety`
- `V5_feedback_sensitivity`
- `V6_execution_gap`
- `V7_low_initiative`
- `V8_job_action_misunderstanding`
- `V9_learning_transfer_pressure`
- `V10_peer_platform_anxiety`
- `V11_education_filter_pressure`
- `V12_exam_delay_risk`
- `V13_market_bias_risk`

| dimension key | 中文名称 | 定义 | 参与题目 | 高分含义 | 低分含义 | 是否正式确认 |
| --- | --- | --- | --- | --- | --- | --- |
| 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 |

## 4. finalRiskScores 权重配置模板

当前工程 finalRisk key：

- `R1_adaptation_risk`
- `R2_reality_gap_risk`
- `R3_direction_misjudgment_risk`
- `R4_quit_6_18_month_risk`
- `R5_three_year_flexibility_risk`

填写模板：

```json
"riskFormulas": {
  "R1_adaptation_risk": {
    "directRWeight": "待填写数字",
    "dimensionWeights": {
      "V1_social_exhaustion": "待填写数字"
    }
  }
}
```

| finalRisk key | directRWeight | dimension key | dimension weight | 是否正式确认 | 备注 |
| --- | --- | --- | --- | --- | --- |
| 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 |

## 5. 权重归一化注意事项

当前引擎规则：

- 只使用有可用分数来源的权重。
- 缺失来源会跳过。
- 可用来源会重新归一化。
- 完全没有可用来源时，该 finalRisk 输出 `null` 并记录 warning。

产品方需确认：

- 缺失 directR 时是否允许仅用 dimensions。
- 缺失 dimensions 时是否允许仅用 directR。
- 是否需要最低答题覆盖率后才展示某个 finalRisk。

## 6. 哪些题不应参与评分

当前完全没有评分字段的题目：

- `gender`
- `company_type`
- `work_type`
- `mbti_known`

产品方需确认：

- 这些字段是否只用于分流和保护规则。
- `gender` 是否只用于合规或保护逻辑，不用于风险打分。
- `company_type` / `work_type` 是否只用于路径和 strongMatch。
- `mbti_known` 是否只用于 MBTI 路径选择。

## 7. 保护性答案如何处理

| questionId | optionId | 保护含义 | 是否降低风险 | 是否进入 protectRules | 备注 |
| --- | --- | --- | --- | --- | --- |
| 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 |

注意：

- 保护性答案不应随意写成负分。
- 更推荐进入 risk card 的 `protectRules`。
- 任何 protectRule 命中都应跳过对应风险卡。

## 8. test_cases 应如何更新

正式配置补齐后需要更新：

- 覆盖每个 finalRisk 的高 / 中 / 低样例。
- 覆盖每张 H1-H16 风险卡 mustTrigger 样例。
- 覆盖 strongMatch 不命中时不得触发。
- 覆盖 flag-only 不得触发。
- 覆盖 protectRules 命中时跳过。
- 覆盖 topRiskCards 为空时 H0 fallback。

| testCase id | answers 类型 | 预期 finalRisk | 预期 risk card | 保护规则 | 是否正式确认 |
| --- | --- | --- | --- | --- | --- |
| 待填写 | 完整/局部 | 待填写 | 待填写 | 待填写 | 待填写 |
