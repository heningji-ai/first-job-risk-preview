# RESULT_PAGE_RISK_COPY_INTEGRATION_NOTES

## 1. 本阶段完成内容

本阶段将 ResultPage 的普通用户可见风险卡区域接入 `risk_card_copy.json`。

页面现在使用 `topRiskCards` 的 cardId 查找对应 copy，并展示：

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

## 2. copy 读取方式

新增 `src/lib/riskCardCopyResolver.ts`，负责根据 cardId 读取 `risk_card_copy.json` 中的 copy。

如果某张 topRiskCard 找不到 copy，resolver 会回退到 `H0_GENERAL_REMINDER`。

## 3. copy 不参与触发判断

`risk_card_copy.json` 只作为展示文案来源。

风险卡触发仍由现有链路决定：

answers -> scoringEngine -> resultDraft -> riskCardEngine -> topRiskCards

resolver 不读取 triggerRules、protectRules、score、dimension key 或 finalRisk key，也不改变 topRiskCards。

## 4. 普通用户页不展示内部字段

普通用户可见区域不展示：

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

cardId 只保留在开发调试信息中。

## 5. 调试信息

开发调试信息仅在 `import.meta.env.DEV` 为 true 时展示。

调试信息位于折叠 details 中，并标记为“开发调试信息”。

生产构建中不会展示开发调试信息。

## 6. 本阶段没有修改

本阶段没有修改：

- risk_cards.json
- risk_card_copy.json
- scoringEngine
- riskCardEngine
- resultPipeline
- questions.json
- scoring.json
- result_copy.json
- viral_copy.json

## 7. 后续工作

后续仍需处理：

- 正式视觉页。
- 移动端样式优化。
- 分享链路。
- 文案终审后升级 APPROVED。
- 是否将 `shareShortCopy` 同步到 `viral_copy.json`。

