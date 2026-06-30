# RISK_CARD_COPY_SCHEMA

## 1. 定位

`risk_card_copy.json` 是风险卡用户展示文案配置文件。

它只负责给结果页、分享页和后续行动模块提供用户可读文案，不负责风险卡触发、保护、排序、评分或测试判断。

当前第一版内容仍是工程占位，不是正式结果文案，不代表正式职业判断。

## 2. 与 risk_cards.json 的边界

`risk_cards.json` 负责内部规则：

- cardId
- strongMatch
- conditions
- protectRules
- priority
- baseTriggerScore
- relatedRisks
- animationType
- musicType

`risk_card_copy.json` 负责用户展示：

- cardId
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
- status

这两个文件通过相同的 cardId 关联。

## 3. 第一版结构

```ts
type RiskCardCopyConfig = {
  _todo?: string;
  riskCardCopies: Record<string, RiskCardCopy>;
};

type RiskCardCopy = {
  cardId: string;
  displayName: string;
  oneLineRiskPrompt: string;
  typicalScenes: string[];
  notSaying: string;
  riskReductionActions: string[];
  preChoiceValidationChecklist: string[];
  whoToAsk: string;
  jiGeCanHelpWith: string;
  resultShortCopy: string;
  shareShortCopy: string;
  status: "ENGINEERING_PLACEHOLDER" | "PRODUCT_DRAFT" | "APPROVED";
};
```

第一版必须包含：

- `H0_GENERAL_REMINDER`
- 当前 `risk_cards.json` 中已有的每张工程示例卡

## 4. 禁止进入 risk_card_copy.json 的字段

以下字段只能属于内部规则或测试，不得进入用户展示文案配置：

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

## 5. 为什么不能展示内部字段

用户页不能展示 `triggerBoundary`、`protectBoundary`、`strongMatch`、`matchedSignals`、`score`、`dimension key` 或 `finalRisk key`，原因是：

- 这些字段是工程判断语言，不是用户能稳定理解的表达。
- 直接展示会让结果看起来像正式诊断或算法判决。
- strongMatch 只是准入条件，不能被解释为触发原因。
- score 是内部排序和阈值判断依据，不能包装成职业判断分数。
- dimension key 和 finalRisk key 是配置 key，不是用户文案。
- protectBoundary 属于防误伤规则，展示给用户会造成误解。

用户页应展示“需要验证什么”和“下一步可以怎么确认”，而不是展示内部触发过程。

## 6. 当前内容状态

当前 `risk_card_copy.json` 只放工程占位内容：

- 不写 H1-H16 正式风险卡文案。
- 不写正式用户结论。
- 不写“你就是某某风险型”。
- 不写正式职业建议。
- 不把工程示例包装成正式判断。

`status` 说明：

- `ENGINEERING_PLACEHOLDER`：工程占位，只输出 warning，不作为 error。
- `PRODUCT_DRAFT`：产品文案草稿，可以进入工程联调，但不是最终上线确认稿。
- `APPROVED`：产品方最终确认后才能使用。

## 7. 后续迁移方式

后续正式内容应从 `docs/RISK_CARD_USER_DISPLAY_COPY_DRAFT.md` 迁移到 `risk_card_copy.json`：

1. 先统一 H1-H16 的最终 cardId。
2. 将每张卡的用户可见名称迁移到 `displayName`。
3. 将一句话风险提示迁移到 `oneLineRiskPrompt`。
4. 将典型场景迁移到 `typicalScenes`。
5. 将“不是在说你什么”迁移到 `notSaying`。
6. 将降低风险的做法迁移到 `riskReductionActions`。
7. 将选择前验证清单迁移到 `preChoiceValidationChecklist`。
8. 将可以找谁验证迁移到 `whoToAsk`。
9. 将“找猎头季哥可以帮你判断什么”迁移到 `jiGeCanHelpWith`。
10. 将结果页短文案迁移到 `resultShortCopy`。
11. 将分享页短文案迁移到 `shareShortCopy` 或同步到 `viral_copy.json`。
12. 本阶段迁移后可将 H1-H16 的 `status` 标记为 `PRODUCT_DRAFT`。
13. 产品方最终确认后再把 `status` 改为 `APPROVED`。

正式迁移完成前，结果页仍应保留工程占位或非正式判断提示。
