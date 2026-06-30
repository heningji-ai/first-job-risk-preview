# 正式内容配置缺口清单

本文件用于整理正式上线前的内容配置缺口。它不是正式内容补全稿，不包含正式评分、正式风险卡结论或正式用户文案。

## 1. questions.json 评分字段缺口

当前配置状态：

- 当前 student 题库共 59 题。
- 已包含 directR 字段的题目：52 题。
- 已包含 dimension 字段的题目：53 题。
- 完全没有评分字段的题目：4 题：`gender`、`company_type`、`work_type`、`mbti_known`。
- 没有 directR 字段的题目：`gender`、`company_type`、`work_type`、`mbti_known`、`c1`、`c3`、`c4`。
- 没有 dimension 字段的题目：`current_status`、`gender`、`company_type`、`work_type`、`mbti_known`、`e4`。

是否阻塞正式上线：阻塞。当前 option scores 仍是工程结构整理，尚未由产品方确认正式分值。

产品方需要确认：

- 哪些基础字段只用于分流，不参与评分。
- 每个可评分选项的 directR 分值。
- 每个可评分选项的 dimension 分值。
- 是否允许某些题目完全不参与评分。

开发方需要做：

- 在产品方确认后更新配置。
- 使用 `validate-config` 校验引用合法性。
- 使用 `test-risk-logic` 覆盖关键路径。

## 2. scoring.json placeholder

当前配置状态：

- `scoring.json` 标记为 `TODO_PLACEHOLDER`。
- `dimensions` 和 `finalRisks` 已有工程 key。
- `riskFormulas` 当前主要为 `directRWeight: 1`，`dimensionWeights` 为空。
- 阈值区间仍为工程占位。

是否阻塞正式上线：阻塞。

产品方需要确认：

- 正式维度定义。
- 正式 finalRisk 定义。
- 每个 finalRisk 的 directR 权重。
- 每个 finalRisk 的 dimension 权重。
- low / medium / high 阈值。

开发方需要做：

- 按确认结果更新 `scoring.json`。
- 保持 directR 命名为 `R*_...`，不得出现 `direct_R*`。
- 确认可用权重重归一化逻辑仍符合产品预期。

## 3. risk_cards.json 工程示例状态

当前配置状态：

- `risk_cards.json` 标记为 `ENGINEERING_SAMPLE_ONLY`。
- 当前只有 3 张工程示例卡：`H3_GROWTH_EXHAUSTION`、`H5_SOE_PROCESS_PRESSURE`、`H16_EXAM_DELAY_PROBLEM`。
- 不是完整 16 张正式风险卡。
- 卡片文案仍为 `TODO_PLACEHOLDER`。

是否阻塞正式上线：阻塞。

产品方需要确认：

- 完整 H1-H16 风险卡清单。
- 每张卡的正式名称、用户解释、触发条件、保护条件、优先级、分数规则。
- 每张卡是否需要 strongMatch。
- 每张卡的结果页文案和分享文案。

开发方需要做：

- 按模板录入完整配置。
- 校验每张卡至少有一个 `answer` / `dimension` / `finalRisk` 主风险信号。
- 校验 flag 只能作为辅助信号，不能单独触发。

## 4. result_copy.json 正式文案缺口

当前配置状态：

- 当前为 TODO 占位结构。
- 不是正式结果页文案。
- `riskLevelTexts` 为空。

是否阻塞正式上线：阻塞。

产品方需要确认：

- loading 文案。
- path / risk index / risk level 文案。
- 每个 finalRisk 的低、中、高展示文案。
- 正式结果页语气边界。

开发方需要做：

- 按确认文案更新配置。
- 避免在页面组件内硬编码正式结果文案。

## 5. viral_copy.json placeholder

当前配置状态：

- `viral_copy.json` 标记为 `ENGINEERING_SAMPLE_ONLY`。
- `defaultViralCopy` 存在，但为占位。
- 当前只有 `H16_EXAM_DELAY_PROBLEM` 的工程示例 viral copy。

是否阻塞正式上线：阻塞。

产品方需要确认：

- 默认 viral copy。
- 每张可触发风险卡的专属 viral copy。
- 分享卡标题、footer、路径提示。

开发方需要做：

- 校验 `defaultViralCopy` 必填。
- 缺少专属 viral copy 时保留 warning，不阻塞工程运行。

## 6. animation_map.json 占位状态

当前配置状态：

- 当前为 TODO 占位。
- `screenAnimations` 和 `riskCardAnimations` 为空。
- `musicMap` 为空。
- 第一版允许静音和 CSS / SVG fallback。

是否阻塞正式上线：不一定阻塞主流程，但阻塞正式体验质量。

产品方需要确认：

- 哪些页面需要动画。
- 每张风险卡是否需要专属动画。
- 是否上线真实音频素材。

开发方需要做：

- 保持素材缺失不阻塞主流程。
- 增加 fallback 显示策略。

## 7. service_cards.json 承接文案缺口

当前配置状态：

- 当前为 TODO 占位。
- `cards` 为空。
- 未接支付、预约或外部服务。

是否阻塞正式上线：如果正式结果页需要服务承接，则阻塞。

产品方需要确认：

- 服务承接卡数量。
- 每张服务卡标题、服务名称、条目、边界说明。
- 是否只是展示，还是后续接预约或支付。

开发方需要做：

- 第一版只展示服务信息，不接后端和支付。

## 8. B1 / mbti_type 缺失

当前配置状态：

- `mbti_known` 已存在。
- B1 / `mbti_type` 正式选项缺失。
- 当前 `mbti_known=known` 后仍使用快速倾向题继续。

是否阻塞正式上线：如果正式产品需要 MBTI 细分路径，则阻塞。

产品方需要确认：

- B1 是否上线。
- 是否提供 16 型 MBTI 选项。
- B1 对 C 组快速倾向题的替代或并行关系。

开发方需要做：

- 产品确认前不补 16 型。
- 若新增 B1，补充配置、showWhen、校验和测试样例。

## 9. H0 fallback 状态

当前配置状态：

- `H0_GENERAL_REMINDER` 只作为 topRiskCards 为空时的展示兜底。
- H0 不进入 `triggeredRiskCards`。
- H0 不在 `risk_cards.json` 中作为正式可触发风险卡配置。

是否阻塞正式上线：需要正式 fallback 文案后才能上线。

产品方需要确认：

- 低风险或无触发卡时的标题、说明、行动建议、分享文案。

开发方需要做：

- 保持 H0 不进入正式 triggered 列表。
- 将正式 fallback 文案放入结果文案或 viral copy 配置。

## 10. 当前 warning 对正式上线的影响

当前关键 warnings / 标记：

- `SCORING_PLACEHOLDER`
- `DIMENSION_RULES_PLACEHOLDER`
- `ENGINEERING_SAMPLE_ONLY`
- `VIRAL_COPY_PLACEHOLDER`
- `B1_MBTI_TYPE_MISSING`
- `FLAG_SOURCE_MISSING:*`
- `FINAL_RISK_NO_AVAILABLE_SOURCE:*`
- 缺少专属 viral copy 的 warning

是否阻塞正式上线：阻塞正式用户判断。

产品方需要确认：

- 正式评分、风险卡、结果文案、viral copy、MBTI 规则。

开发方需要做：

- 保留 warning 展示，直到配置正式化。
- 在正式上线前让关键 warning 清零或转为可接受提示。
