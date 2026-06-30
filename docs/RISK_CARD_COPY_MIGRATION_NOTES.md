# RISK_CARD_COPY_MIGRATION_NOTES

## 1. 本次迁移内容

本阶段将 `docs/RISK_CARD_USER_DISPLAY_COPY_DRAFT.md` 中的 H1-H16 用户展示文案迁移到 `src/config/audiences/student/risk_card_copy.json`。

迁移字段包括：

- displayName
- oneLineRiskPrompt
- typicalScenes
- notSaying
- riskReductionActions
- preChoiceValidationChecklist
- whoToAsk
- jiGeCanHelpWith
- resultShortCopy
- shareShortCopy

本阶段没有迁移内部判断字段，也没有把触发边界、保护边界、strongMatch、matchedSignals、score、dimension key 或 finalRisk key 写入 `risk_card_copy.json`。

## 2. status 变化

H1-H16 已从 `ENGINEERING_PLACEHOLDER` 升为 `PRODUCT_DRAFT`。

`PRODUCT_DRAFT` 表示：

- 文案已从产品展示稿迁移。
- 可以用于后续工程接入和产品评审。
- 不是最终上线确认稿。
- 不代表正式职业判断。

本阶段没有使用 `APPROVED`。`APPROVED` 只能在产品方最终确认后使用。

## 3. H0 fallback 当前状态

`H0_GENERAL_REMINDER` 仍然保留在 `risk_card_copy.json` 中。

当前 H0 已调整为克制的 fallback 文案：

- 说明本次没有明显触发某一类高风险卡。
- 明确不代表完全没有风险。
- 建议继续验证岗位日常、团队反馈机制、成长路径和试用期要求。
- 不做正式职业判断。

H0 没有进入 `risk_cards.json`。

## 4. 本阶段没有修改的内容

本阶段没有修改：

- `risk_cards.json`
- ResultPage
- scoringEngine
- riskCardEngine
- resultPipeline
- questions.json
- scoring.json
- result_copy.json
- viral_copy.json

本阶段也没有接入后端、数据库或 openid。

## 5. 后续需要做

后续仍需完成：

- ResultPage 接入 `risk_card_copy.json`。
- 正式结果页视觉设计。
- 文案产品方终审。
- 决定哪些 copy 可以从 `PRODUCT_DRAFT` 升级为 `APPROVED`。
- 如正式上线需要，补充与 `viral_copy.json` 的分享文案联动。

