# RESULT_PAGE_TEXT_DENSITY_NOTES

## 1. 为什么压缩默认可见内容

移动端真机验收后发现，ResultPage 普通用户默认可见文字偏多，页面过长，阅读压力偏大。

本阶段将结果页默认内容压缩到更适合手机快速阅读的结构，优先让用户先看懂一个主风险和下一步验证问题。

## 2. 默认展示内容

普通用户默认可见区域只保留：

- 顶部结果标题和一句说明
- 单个主风险的 `displayName`
- 单个主风险的 `oneLineRiskPrompt`
- 单个主风险的 `resultShortCopy`
- 最多 3 条 `preChoiceValidationChecklist`
- 一句当前限制说明，不展示 copy 状态
- 精简后的公众号 / 企业微信承接入口

## 3. 折叠展示内容

以下内容仍保留，但默认放入“展开看更多解释”折叠区：

- `typicalScenes`
- `notSaying`
- `riskReductionActions`
- `whoToAsk`
- `jiGeCanHelpWith`
- `shareShortCopy`

这些内容不再默认全部展开，避免挤压主结果阅读。

## 4. 底部承接区压缩

底部公众号 / 企业微信承接区已压缩为短模块：

- 只保留一句承接说明
- 只展示公众号名称和企业微信占位
- 删除较长的入口解释文案
- 保留“一对一服务边界”一句说明

## 5. 本阶段未修改内容

本阶段没有修改任何 JSON 配置。

本阶段没有修改评分逻辑、风险卡触发逻辑或 resultPipeline。

普通用户默认可见区不展示 `copyStatusSummary`、`PRODUCT_DRAFT`、`APPROVED` 或 `ENGINEERING_PLACEHOLDER`。如需查看 copy 状态，仅保留在开发调试区。

本阶段没有新增后端、数据库、openid、登录、支付、表单或真实分享链路。

## 6. 后续工作

后续仍需要：

- 正式视觉设计
- 上线前补充真实企业微信二维码或微信号
- 产品方终审结果页文案密度
- 决定是否接入正式分享链路和私域承接数据回收
