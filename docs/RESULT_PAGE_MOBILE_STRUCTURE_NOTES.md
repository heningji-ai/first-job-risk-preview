# RESULT_PAGE_MOBILE_STRUCTURE_NOTES

## 1. 本阶段完成内容

本阶段完成 ResultPage 移动端信息结构和基础视觉整理。

调整重点是让 375px / 390px 手机宽度下的结果页更容易阅读：

- 顶部结果区更清晰地说明这是风险预演，不是正式职业诊断。
- 基础信息区改为“你的基础选择”，展示用户可读的选择结果。
- 风险卡区改为“本次需要重点留意的风险”，以卡片形式展示风险预演文案。
- 每张风险卡内突出“下一步你要验证什么”。
- 分享文案只做展示，不新增真实分享功能。
- 当前限制说明改为“当前结果怎么看”。

## 2. 页面信息结构

普通用户可见区域按以下顺序展示：

1. 顶部结果区
2. 你的基础选择
3. 本次需要重点留意的风险
4. 每张风险卡内的下一步验证清单
5. 适合分享的一句话
6. 当前结果怎么看

每张风险卡展示来自 `risk_card_copy.json` 的用户可读字段：

- displayName
- oneLineRiskPrompt
- resultShortCopy
- typicalScenes
- notSaying
- riskReductionActions
- preChoiceValidationChecklist
- whoToAsk
- jiGeCanHelpWith
- shareShortCopy

## 3. 内部字段边界

普通用户页仍不展示内部字段，包括：

- triggerBoundary
- protectBoundary
- strongMatch
- primaryRiskSignals
- auxiliarySignals
- matchedSignals
- score
- finalRisk
- dimension
- conditions
- protectRules
- priority
- test_cases
- dimension key
- finalRisk key
- session 原始 JSON
- anonymousUserId

cardId、score、matchedSignals、dimension / finalRisk key 等工程信息只允许出现在开发调试区。

## 4. 调试信息

开发调试信息仍只在 `import.meta.env.DEV` 为 true 时展示。

调试信息继续放在 `<details>` 折叠区，并标记为“开发调试信息”。

生产环境不展示调试信息。

## 5. 本阶段未修改内容

本阶段没有修改：

- 任何 JSON 配置
- scoringEngine
- riskCardEngine
- resultPipeline
- validate-config
- test-risk-logic
- 后端、数据库、openid、登录、支付、分享链路

## 6. 后续工作

后续仍需要产品方和设计侧确认：

- 正式视觉设计
- 移动端细节继续打磨
- 分享链路
- 结果页 CTA 转化设计
- 文案终审后将 risk card copy 状态升级为 APPROVED
