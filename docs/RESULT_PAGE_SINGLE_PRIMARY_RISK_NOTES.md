# RESULT_PAGE_SINGLE_PRIMARY_RISK_NOTES

## 1. 调整原因

产品方验收后决定，普通用户结果页不应同时展示多张风险卡。

多风险卡并列容易让用户误解为风险排行，也容易让结果页显得像正式诊断。本阶段改为单主风险展示，让用户先聚焦一件最需要验证的事。

## 2. 普通用户页展示规则

普通用户页只展示一个主风险结果：

- 主风险结果来自现有 `topRiskCards[0]`。
- 如果 `topRiskCards` 为空，则展示 `H0_GENERAL_REMINDER`。
- 如果主风险卡找不到对应 copy，也回退展示 `H0_GENERAL_REMINDER`。

普通用户页不再 map 展示全部 `topRiskCards`，也不展示第二风险、第三风险或风险排行。

## 3. DEV 调试区

其余 `topRiskCards` 仍保留在 DEV 调试区，方便开发排查。

调试信息继续只在 `import.meta.env.DEV` 为 true 时展示，并放在 `<details>` 折叠区。

## 4. H0 fallback

H0 fallback 仍然有效。

当没有正式触发卡，或主风险卡 copy 缺失时，页面展示 `H0_GENERAL_REMINDER` 的用户展示文案。

H0 仍不进入 `risk_cards.json`，只作为展示兜底。

## 5. 本阶段未修改内容

本阶段没有修改：

- `risk_cards.json`
- `risk_card_copy.json`
- 任何其他 JSON 配置
- scoringEngine
- riskCardEngine
- resultPipeline
- 后端、数据库、openid、登录、支付、分享链路

## 6. 后续工作

后续视觉优化、正式结果页设计、CTA 转化设计、分享链路和文案终审应单独处理。
