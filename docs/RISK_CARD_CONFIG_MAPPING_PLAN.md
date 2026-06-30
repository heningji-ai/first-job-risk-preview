# 风险卡配置落地映射方案

本文件说明 H1-H16 风险卡产品定义如何映射到现有配置文件、校验脚本和前端结果页展示中。

本阶段只做方案说明，不修改 `risk_cards.json`、`result_copy.json`、`viral_copy.json`、`test_cases.json` 或任何 `src` 代码。本文件不补正式风险卡配置，不补评分分值，不生成正式用户结论。

## 1. 字段边界

### 1.1 只能内部使用的字段

以下字段只用于产品判断、配置、测试和调试，不应展示给用户：

- 触发边界
- 保护边界
- strongMatch
- 主风险信号
- 辅助信号
- priority
- test_cases
- matchedSignals 原始字段
- score 计算过程
- dimension key
- finalRisk key

说明：

- 触发边界和保护边界用于产品方确认风险卡是否应该命中或跳过。
- strongMatch 只做准入，不能作为用户可见解释。
- 主风险信号、辅助信号、dimension key、finalRisk key 是配置和算法语言，不适合直接给用户看。
- matchedSignals 和 score 可以用于调试、测试和灰度观察，但不应包装成正式诊断。

### 1.2 可以进入用户展示的字段

以下字段可以进入结果页、分享页或服务承接模块：

- 用户可见名称
- 一句话风险提示
- 典型场景
- 不是在说你什么
- 降低风险的做法
- 选择前验证清单
- 可以找谁验证
- 找猎头季哥可以帮你判断什么
- 结果页短文案
- 分享页短文案

说明：

- 用户展示字段应来自 `RISK_CARD_USER_DISPLAY_COPY_DRAFT.md`。
- 用户展示文案应保持克制，不写“你就是某某风险型”，不输出绝对化职业判断。
- 结果页可以解释“需要验证什么”，但不应展示触发边界、保护边界和算法字段。

## 2. 映射到配置文件

### 2.1 应进入 risk_cards.json 的字段

来源：`RISK_CARD_INTERNAL_SPEC_DRAFT.md`

建议进入 `risk_cards.json` 的字段：

- cardId：映射为 `id`。
- 用户可见名称：短期可映射为 `title`；长期建议只保留最小标题，完整展示文案放到独立 copy 配置。
- priority 建议：映射为 `priority`，需要产品方确认枚举值或排序标准。
- strongMatch：映射为 `strongMatch.companyType` / `strongMatch.workType`。
- 主风险信号：映射为 `conditions` 中的 `answer` / `dimension` / `finalRisk` 条件。
- 辅助信号：映射为 `conditions` 中的 `flag` 条件，且不能单独触发。
- 保护边界：映射为 `protectRules`。
- 相关 finalRisk：映射为 `relatedRisks`。
- trigger 分值：映射为 `baseTriggerScore` 和每个 condition 的 `score`，但分值必须由产品方确认。
- animationType / musicType：可以保留占位或后续由动画配置统一映射。

不建议进入 `risk_cards.json` 的字段：

- 一句话风险提示
- 典型场景
- 不是在说你什么
- 降低风险的做法
- 选择前验证清单
- 可以找谁验证
- 找猎头季哥可以帮你判断什么
- 结果页短文案
- 分享页短文案

原因：这些字段属于用户展示 copy，和触发规则混放会让风险判断配置变重，也会增加后续文案迭代成本。

### 2.2 应进入 result_copy.json 的字段

来源：`RISK_CARD_USER_DISPLAY_COPY_DRAFT.md`

现有 `result_copy.json` 主要承载 loading、path、risk index 和 finalRisk level 文案，不支持每张风险卡的完整展示 copy。

如果不新增文件，可以扩展 `result_copy.json`：

```json
{
  "riskCardCopies": {
    "H1_ADAPTATION_BREAK_RISK": {
      "displayName": "待填写",
      "oneLineTip": "待填写",
      "typicalScenes": ["待填写"],
      "notSaying": "待填写",
      "riskReduction": "待填写",
      "validationChecklist": ["待填写"],
      "whoToAsk": "待填写",
      "servicePrompt": "待填写",
      "resultShortCopy": "待填写"
    }
  }
}
```

更推荐新增独立 `risk_card_copy.json`，见 2.5。

### 2.3 应进入 viral_copy.json 的字段

来源：`RISK_CARD_USER_DISPLAY_COPY_DRAFT.md`

建议进入 `viral_copy.json` 的字段：

- 分享页短文案：映射到 `viralCopies[cardId].copyText`。
- 用户可见名称或分享标题：可映射到 `viralCopies[cardId].targetText`。
- H0 fallback 分享文案：应通过 `defaultViralCopy` 或专门的 fallback copy 承载。

注意：

- `defaultViralCopy` 必须保留，缺失应作为 error。
- 单张风险卡缺少专属 viral copy 可以先 warning，不作为工程阻塞。
- 分享文案不能使用触发边界、score、dimension key 或 finalRisk key。

### 2.4 应进入 test_cases.json 的字段

来源：`RISK_CARD_INTERNAL_SPEC_DRAFT.md`

建议进入 `test_cases.json` 的内容：

- 每张 H1-H16 至少一个 `expected.mustTrigger` 样例。
- 每张有 protectRules 的卡至少一个保护命中样例。
- strongMatch 不命中时不得触发的样例。
- flag-only 不得触发的样例。
- topRiskCards 为空时 H0 fallback 样例。
- cardId 重命名后的兼容测试。

注意：

- test_cases 使用局部答案仍可继续，但必须明确哪些题参与计算。
- 测试样例只用于验证配置和引擎，不应当作正式用户画像。

### 2.5 是否需要新增 risk_card_copy.json

建议新增，但不在本阶段创建。

理由：

- `risk_cards.json` 更适合承载触发规则和内部判断字段。
- `result_copy.json` 已经承担全局结果页文案，继续塞入 H1-H16 完整卡片 copy 会变得过重。
- 独立 `risk_card_copy.json` 可以让产品方独立迭代展示文案，避免误改触发规则。

建议结构：

```json
{
  "riskCardCopies": {
    "H1_ADAPTATION_BREAK_RISK": {
      "displayName": "待填写",
      "oneLineTip": "待填写",
      "typicalScenes": ["待填写"],
      "notSaying": "待填写",
      "riskReduction": "待填写",
      "validationChecklist": ["待填写"],
      "whoToAsk": "待填写",
      "servicePrompt": "待填写",
      "resultShortCopy": "待填写"
    }
  },
  "fallbackCopy": {
    "H0_GENERAL_REMINDER": {
      "displayName": "待填写",
      "oneLineTip": "待填写",
      "resultShortCopy": "待填写"
    }
  }
}
```

### 2.6 是否需要调整 types/config.ts

建议后续调整。

需要新增或调整的类型：

- `RiskCardCopyConfig`
- `RiskCardCopy`
- `RiskCardFallbackCopy`
- `RiskCard.priority` 是否继续使用 `high | medium | low`，或改为数字排序。
- `TriggerCondition.operator` 当前类型缺少 `gt` / `lt`，引擎已支持，但类型尚未覆盖。

暂不建议在落地 H1-H16 前大改：

- 不建议把展示 copy 直接合并进 `RiskCard`。
- 不建议把 matchedSignals 原始字段暴露给用户展示类型。

### 2.7 是否需要调整 ResultPage 展示结构

需要，但应放在配置 schema 和 copy 文件确定之后。

建议后续 ResultPage 结构：

- 顶部结果概览：仍保留“非诊断、非正式判断”的边界说明，直到产品方确认正式上线。
- 风险卡展示区：展示 topRiskCards 对应的用户展示 copy。
- 风险解释区：使用用户可理解的“为什么需要验证”，不展示 matchedSignals 原始字段。
- 下一步验证区：展示选择前验证清单、可以找谁验证、服务承接说明。
- 开发调试区：保留折叠，展示 score、matchedSignals、dimension key、finalRisk key，仅内部调试使用。

## 3. 当前 schema 差距

### 3.1 已支持

- 每张风险卡基础结构：`id`、`title`、`priority`、`baseTriggerScore`、`relatedRisks`。
- `conditions` 触发规则。
- `protectRules`。
- `strongMatch.companyType` / `strongMatch.workType`。
- priority 参与 topRiskCards 排序。
- `answer` / `dimension` / `finalRisk` / `flag` / `field` 条件来源。
- flag 不能单独触发风险卡。
- protectRules 任意命中即跳过。
- H0 fallback：无触发卡时 `topRiskCards` 返回 `H0_GENERAL_REMINDER`。
- `defaultViralCopy`。
- topRiskCards 展示链路。
- warnings 汇总和结果页展示。

### 3.2 不支持

- 每张风险卡完整用户展示 copy。
- 独立的 `risk_card_copy.json`。
- H0 fallback 的正式展示文案配置。
- 用户展示字段与内部判断字段的类型级隔离。
- ResultPage 从 cardId 读取用户展示 copy。
- 用户页友好的触发解释文案。
- 服务承接模块的按风险卡匹配展示。
- `TriggerCondition.operator` 类型层面对 `gt` / `lt` 的支持。

### 3.3 建议新增

- `src/config/audiences/student/risk_card_copy.json`。
- `RiskCardCopyConfig` 类型。
- `ResultPageData` 中增加 `riskCardCopies` 或在 resultPipeline 中组装 `topRiskCardViews`。
- `validate-config` 增加检查：
  - 每个正式 risk card 都有对应展示 copy。
  - 每个 topRiskCard 候选都有 viral copy 或可回退到 defaultViralCopy。
  - H0 fallback 有展示 copy。
  - 用户展示 copy 不包含工程字段名。
- `test-risk-logic` 增加检查：
  - H1-H16 mustTrigger 样例。
  - protectRules 样例。
  - strongMatch 准入样例。
  - H0 fallback 样例。

### 3.4 暂不建议新增

- 暂不建议把正式建议、服务转化、支付或预约逻辑写入风险卡配置。
- 暂不建议把评分分值写入本映射文档。
- 暂不建议在页面直接展示 score、dimension key、finalRisk key。
- 暂不建议把 H1-H16 用户展示文案直接塞进 `risk_cards.json`。
- 暂不建议在 H1-H16 配置落地前做正式视觉页。

## 4. 推荐落地顺序

### 第一步：扩展配置 schema

目标：

- 确定是否新增 `risk_card_copy.json`。
- 更新 `types/config.ts`。
- 更新 `validate-config` 对展示 copy、H0 fallback、viral copy 的检查。
- 明确 `gt` / `lt` 是否进入 `RuleOperator` 类型。

验收：

- 不写入完整 H1-H16 内容也能通过 placeholder 校验。
- 内部字段和用户展示字段在类型上分离。

### 第二步：统一 cardId 并写入 H1-H16 risk_cards.json

目标：

- 用 `RISK_CARD_INTERNAL_SPEC_DRAFT.md` 映射出 16 张风险卡的触发配置。
- 统一工程示例 cardId 与正式 cardId。
- 保持 strongMatch 只做准入。
- 保持 flag 只能作为辅助信号。
- protectRules 任意命中即跳过。

验收：

- `validate-config` 能检查 16 张卡结构合法。
- 不出现 `direct_R*`。
- 每张卡至少有一个 `answer` / `dimension` / `finalRisk` 主风险信号。

### 第三步：补 test_cases

目标：

- 覆盖 H1-H16 mustTrigger。
- 覆盖 strongMatch 不命中。
- 覆盖 protectRules 命中。
- 覆盖 flag-only 不触发。
- 覆盖 H0 fallback。

验收：

- `test-risk-logic` 可以证明触发、跳过、fallback 都按预期执行。
- 局部答案模式仍明确，不把缺失答案误判为低风险。

### 第四步：接 ResultPage 用户展示字段

目标：

- ResultPage 从 resultPipeline 获取 topRiskCards 的展示数据。
- 展示用户可见名称、一句话风险提示、典型场景、不是在说你什么、降低风险的做法、选择前验证清单。
- matchedSignals、score、dimension key、finalRisk key 只保留在开发调试折叠区。

验收：

- 页面不再展示工程示例文案。
- 页面不输出正式职业诊断以外的未确认字段。
- 用户展示和内部调试分区清楚。

### 第五步：补 viral copy

目标：

- 为每张 H1-H16 配置分享页短文案。
- 保留 `defaultViralCopy`。
- 为 H0 fallback 配置默认分享文案。

验收：

- 缺少专属 viral copy 时可以 warning。
- 缺少 `defaultViralCopy` 必须 error。
- 分享文案不包含工程字段和触发边界。

### 第六步：最后做正式视觉页

目标：

- 在配置、测试、文案都稳定后，再做正式结果页视觉和交互。
- 保持正式结果页不接 openid、不接数据库、不接后端，除非产品方另行确认。

验收：

- 风险卡触发结果、展示 copy、viral copy 和 fallback 都由配置驱动。
- 页面不硬编码正式风险卡文案。

## 5. 本阶段不落地的内容

本阶段不执行以下事项：

- 不修改 `src/config/audiences/student/*.json`。
- 不修改 `src` 代码。
- 不修改页面。
- 不补正式 `risk_cards.json`。
- 不补评分分值。
- 不补 B1 / 16 型 MBTI。
- 不接后端、数据库、openid。
- 不安装依赖。

## 6. 需要产品方确认的问题

1. H1-H16 的最终 cardId 是否采用产品定义文档中的新命名。
2. `H3_GROWTH_EXHAUSTION`、`H5_SOE_PROCESS_PRESSURE`、`H16_EXAM_DELAY_PROBLEM` 三个工程示例是否迁移为正式 id。
3. 是否新增独立 `risk_card_copy.json`，还是扩展 `result_copy.json`。
4. 每张卡 priority 是使用 high / medium / low，还是数字排序。
5. H0 fallback 的正式展示文案和分享文案。
6. 服务承接文案是否按风险卡分别配置。
7. B1 / MBTI 路径是否会影响 H1-H16 的触发边界。

