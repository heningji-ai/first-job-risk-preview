# IMPLEMENTATION_PLAN

## 1. 第一阶段边界

本阶段只输出文档，不创建 React 页面组件，不初始化 Vite，不安装依赖，不实现业务代码。

后续开发必须继续遵守：

1. 所有配置、文案、题库、评分、风险卡、标签、分享文案从 `audience_type` 对应配置读取。
2. 第一版只上线 `student`，但目录和函数保留多版本扩展能力。
3. 第一版不接入 openid、支付、后台、数据库、第三方 API。
4. localStorage 只用于本地体验、调试、测试记录和 CSV 导出，不作为运营后台。

## 2. 技术栈

固定技术栈：

```txt
React + Vite + TypeScript
```

产品形态：

```txt
移动端 H5
```

数据保存：

```txt
localStorage
```

## 3. 路由结构

第一版只保留三个路由：

```txt
/                         首页
/test                     答题页
/result/:testSessionId    结果页
```

不要额外设置 `/result/loading`。结果页内部使用状态或屏幕步骤承载加载动画、路径复述、最大风险、风险指数、服务与分享。

## 4. 建议组件结构

后续可按以下结构拆分，但第一阶段不创建组件：

```txt
src/
  app/
    routes/
  components/
    layout/
    question/
    result/
    share/
    service/
  config/
    audiences/
      student/
  core/
    config/
    scoring/
    riskCards/
    share/
    storage/
    validation/
  types/
  scripts/
```

组件只负责展示与交互，不写死题目、评分、风险卡、中文标签、分享文案或动画映射。

## 5. 配置文件结构

第一版配置目录：

```txt
src/config/audiences/student/
  questions.json
  scoring.json
  risk_cards.json
  result_copy.json
  viral_copy.json
  animation_map.json
  service_cards.json
  labels.json
  test_cases.json
```

未来扩展新受众时新增同构目录，例如：

```txt
src/config/audiences/career/
```

## 6. 核心函数边界

后续核心函数应至少包括：

```ts
loadAudienceConfig(audienceType)
getVisibleQuestions(allQuestions, answers)
calculateScores(questions, answers, scoringConfig)
triggerRiskCards(riskCards, answers, flags, normalizedScores, finalRisks, riskLevels)
generatePathShareCard(viralCopyConfig, labels, companyType, workType)
generateViralCopy(viralCopyConfig, topRiskCardId)
```

配置校验与测试命令后续必须实现：

```bash
npm run validate-config
npm run test-risk-logic
```

## 7. 开发顺序建议

1. 补齐 `student` 版本配置文件草案，但不得自行编造正式题库、评分分值或风险卡业务内容。
2. 定义 TypeScript 类型和配置读取边界。
3. 实现配置校验，优先检查引用关系、命名一致性和风险卡触发边界。
4. 实现可见题目计算、分数计算和 finalRisk 可用权重重归一化。
5. 实现风险卡触发逻辑，并确保 strongMatch、flag、field、protectRules 边界正确。
6. 实现风险逻辑测试，使用 `test_cases.json` 验证 mustTrigger、riskLevels、viralCopy。
7. 最后再进入页面和结果展示开发。

## 8. 本次文档检查结论

产品规格整体逻辑可以落地，但存在需要在后续配置或实现前明确的点：

1. 需要定义 `BASE_FIELDS`，否则 showWhen、risk card condition、labels 校验中的基础字段边界不够明确。
2. `test_cases.json` 示例是局部答案，后续应明确测试用例采用完整答案，还是允许局部答案测试模式。
3. `topRiskCards` 为空时需要 fallback 结果展示策略。
4. 风险卡触发规则已经防止路径选择过度触发，但 validate-config 需要强制检查每张卡至少有一个 answer / dimension / finalRisk 条件。
5. `directR` 命名规则清晰，后续校验必须禁止 `direct_R*` 出现在 `questions.json` 和 `scoring.json`。
