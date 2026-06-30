# RISK_CARDS_INTERNAL_RULES_DRAFT_NOTES

## 1. 本阶段已落地内容

本阶段已将 H1-H16 共 16 张风险卡的内部触发规则落入 `src/config/audiences/student/risk_cards.json`。

已保留现有工程示例 cardId：

- `H3_GROWTH_EXHAUSTION`
- `H5_SOE_PROCESS_PRESSURE`
- `H16_EXAM_DELAY_PROBLEM`

新增内部规则 draft cardId：

- `H1_ADAPTATION_BREAK_RISK`
- `H2_REALITY_GAP_RISK`
- `H4_DIRECTION_MISJUDGMENT_RISK`
- `H6_LOW_INITIATIVE_RISK`
- `H7_EXECUTION_GAP_RISK`
- `H8_SOCIAL_COLLABORATION_EXHAUSTION_RISK`
- `H9_FEEDBACK_SENSITIVITY_SELF_DOUBT_RISK`
- `H10_PEER_PLATFORM_ANXIETY_RISK`
- `H11_EDUCATION_FILTER_PRESSURE_RISK`
- `H12_STABILITY_PREFERENCE_MISMATCH_RISK`
- `H13_MAJOR_PATH_SWING_RISK`
- `H14_GROWTH_SPEED_MISJUDGMENT_RISK`
- `H15_LOW_TOLERANCE_ROLE_PRESSURE_RISK`

`H0_GENERAL_REMINDER` 未进入 `risk_cards.json`，仍只作为 fallback copy 存在。

## 2. 当前规则状态

当前 16 张卡均为内部规则 draft：

- 不是正式上线判断。
- 不包含正式评分分值。
- 不包含正式用户展示文案。
- 不代表正式职业诊断。

每张卡均至少包含一个 `answer`、`dimension` 或 `finalRisk` 主风险信号。

flag 只作为辅助信号，不单独触发风险卡。

strongMatch 只用于准入：

- H3 使用 `workType = GROWTH`。
- H5 使用 `companyType = SOE`，这是基于当前 `questions.json` 的真实 option.id。
- 其他卡默认不设置 strongMatch。

## 3. 当前配置中缺少的产品信号

产品文档中的部分表达无法完全映射到当前配置字段，未在本阶段发明新字段。

缺口包括：

- 真实实习、兼职、项目、作品、交付物经历强度。
- 新人带教、反馈机制、任务边界、直属领导风格。
- 具体岗位 JD、团队环境、公司实际流程长度。
- 投递数量、面试反馈、简历关键词、内推路径。
- 是否有真实销售、推广、商务、运营转化经验。
- 是否有复核系统、清单习惯、错误管理记录。
- 是否有考试路径的具体时间线、退出条件和周动作计划。

这些信号后续如需进入规则，应先补 question 或配置字段，再更新校验和 test_cases。

## 4. risk_card_copy 当前状态

`risk_card_copy.json` 已为 H0 和 H1-H16 提供 `ENGINEERING_PLACEHOLDER` 占位 copy。

原因：

- 本阶段只落内部规则，不迁移正式用户展示文案。
- `validate-config` 要求每个 risk card id 都能找到对应 copy。
- 正式用户展示文案应后续从 `RISK_CARD_USER_DISPLAY_COPY_DRAFT.md` 经产品方确认后迁移。

当前 copy 不代表正式职业判断。

## 5. 后续需要补充的 test_cases

本阶段保留原有 3 个工程测试样例，不要求覆盖全部 16 张卡。

后续建议补充：

- 每张 H1-H16 至少一个 `expected.mustTrigger` 样例。
- 每张有 protectRules 的卡至少一个保护命中样例。
- strongMatch 不命中时不得触发样例。
- flag-only 不得触发样例。
- H0 fallback 样例。
- H1/H2/H4/H6/H7/H8/H9/H10/H11/H12/H13/H14/H15 的非触发保护样例。

## 6. 后续产品方需确认

1. H1-H16 的最终 cardId 是否保留当前 draft 命名。
2. H5 是否只绑定 `SOE`，还是需要扩展到 `MNC` / `PLATFORM` 等大组织选项。
3. 每张卡的正式 priority 和 trigger score 标准。
4. 每张卡的正式 protectRules。
5. 哪些产品信号需要新增题目或新增配置字段。
6. 何时将 `risk_card_copy.json` 从 `ENGINEERING_PLACEHOLDER` 迁移为正式 copy。
