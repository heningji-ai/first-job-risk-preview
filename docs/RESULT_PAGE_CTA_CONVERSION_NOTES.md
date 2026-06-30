# RESULT_PAGE_CTA_CONVERSION_NOTES

## 1. 本阶段完成内容

本阶段在 ResultPage 普通用户可见区域新增 CTA 行动区。

CTA 放在主风险结果之后、当前限制说明之前，用于引导用户把正在考虑的岗位 JD、招聘截图或 offer 信息发给猎头季哥做进一步岗位验证。

## 2. 为什么采用岗位验证路径

本阶段 CTA 不采用硬销售表达，而是围绕“岗位验证”展开。

原因是当前结果仍是风险预演，不是正式职业诊断。用户下一步最需要做的，不是被推向交易动作，而是把具体岗位放进真实工作场景里验证：

- 新人前三个月会遇到什么。
- 这份工作会不会放大当前主风险。
- 岗位是在训练能力，还是在消耗新人。

## 3. 当前 CTA 的边界

当前 CTA 只提供一段可复制话术。

本阶段没有接入：

- 后端
- 数据库
- openid
- 登录
- 留资表单
- 支付
- 真实分享链路

页面也没有硬编码微信号、二维码或第三方服务入口。

## 4. CTA 如何引用主风险

ResultPage 先从现有 `topRiskCards[0]` 得到当前主风险卡，再通过 `risk_card_copy.json` 解析对应展示 copy。

复制话术中的风险名称来自当前主风险 copy 的 `displayName`。

如果主风险为空或 copy 缺失，页面仍使用 `H0_GENERAL_REMINDER` 作为展示兜底，并用 H0 的 `displayName` 生成话术。

## 5. 本阶段未修改内容

本阶段没有修改：

- `risk_cards.json`
- `risk_card_copy.json`
- 任何其他 JSON 配置
- scoringEngine
- riskCardEngine
- resultPipeline
- validate-config
- test-risk-logic

copy 仍然只用于展示，不参与风险触发判断。

## 6. 后续工作

后续需要产品方确认：

- 是否配置真实联系方式或企业微信二维码。
- 是否接入留资表单。
- 是否接入数据回收。
- 是否接入支付。
- 是否做正式分享链路。
- CTA 文案是否需要随正式视觉页一起终审。
