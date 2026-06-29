# MISSING_REQUIREMENTS

## 1. 当前还缺哪些配置

产品规格定义了配置目录和 schema。当前已从 `docs/SOURCE_STUDENT_QUESTIONS.md` 工程化生成部分 student 配置，但仍不是完整正式配置。

```txt
src/config/audiences/student/questions.json
src/config/audiences/student/scoring.json
src/config/audiences/student/risk_cards.json
src/config/audiences/student/result_copy.json
src/config/audiences/student/viral_copy.json
src/config/audiences/student/animation_map.json
src/config/audiences/student/service_cards.json
src/config/audiences/student/labels.json
src/config/audiences/student/test_cases.json
```

这些配置中仍含 TODO 标记，不能冒充正式业务内容，尤其是完整评分权重、完整 16 张风险卡文案和高刺痛分享文案。

源题目检查结果：

1. 已确认：`docs/SOURCE_STUDENT_QUESTIONS.md` 中没有 `Q1`、`Q2`、`Q3` 字样。
2. 已确认：Q1-Q3 缺失不阻塞第一版，当前以 `SOURCE_STUDENT_QUESTIONS.md` 的 A/C/D/E/F/G 编号为准。
3. 已确认：源文档题目编号从 `A1` 开始，当前 `questions.json` 整理源文档中已有的 A/C/D/E/F/G 题目。
4. 已确认：`A9. 是否知道MBTI` 已按产品方确认的最小工程化选项写入 `questions.json`，字段为 `mbti_known`。
5. 待补充：B1 / `mbti_type` 正式选项仍需产品方提供。
6. 已确认：当前第一版可以先通过 `mbti_known=unknown` 进入 C 组快速倾向题。
7. 待补充：`mbti_known=known` 后续需要 B1 承接。

## 2. 需要补齐或确认的字段

1. 已确认：`BASE_FIELDS` 最终范围为 `current_status`、`education`、`gender`、`postgraduate_exam`、`company_type`、`work_type`、`choice_reason`、`main_concern`、`mbti_known`、`mbti_type`、`audience_type`。
2. 已确认：`postgraduate_exam` 属于基础字段，可以被 showWhen、risk card condition、test_cases 和 validate-config 引用。
3. 已确认：`anonymousUserId` 不属于 `BASE_FIELDS`，它是用户身份字段，不参与题目展示、评分和风险卡触发。
4. 已确认：`test_cases.json` 使用局部答案；测试时只对 `answers` 中出现的 question 计算 actualScores 和 maxScores。
5. 已确认：正式用户流程仍然要求完整答题后才能进入结果页。
6. 已确认：`topRiskCards` 为空时展示 `H0_GENERAL_REMINDER`，且它不进入 `triggeredRiskCards`。
7. 已确认：`viral_copy.json` 必须提供 `defaultViralCopy`；缺少专属 viral copy 只 warning，缺少 `defaultViralCopy` 是 error。
8. 每个 `question.id` 与 `answers` key 是否完全一致，需要在题库配置中确认。
9. `flags` 的合法 key 列表未定义，后续需要从 questions 选项自动收集，或单独配置允许列表。

## 3. 素材缺失

当前规格允许动画与音乐降级：

1. Lottie 素材可以缺失，使用 CSS / SVG 占位。
2. 音频素材可以缺失，默认静音。
3. 分享卡第一版不保存图片，不需要 html2canvas 或海报素材。

已确认：

1. 第一版默认静音，但保留 AudioToggle 组件。
2. 第一版不要求真实音频文件。
3. `musicMap` 可以为空字符串。
4. 无音频文件时页面不报错。
5. 不得因为音频素材缺失阻塞主流程。

仍需后续确认：

1. 是否提供风险卡专属动画素材。
2. 是否提供加载页、风险指数页、服务页的统一视觉素材。

## 4. 可暂时使用 fallback 的内容

以下内容可用 fallback 支撑主流程，但不能冒充正式业务内容：

1. `animation_map.json` 可使用 CSS / SVG 占位 key。
2. `musicMap` 可使用空字符串表示静音。
3. 风险卡动画缺失时可使用 `fallbackRiskCardAnimation`。
4. `topRiskCards` 为空时展示 `H0_GENERAL_REMINDER`，该卡只作为结果页展示兜底，不进入 `triggeredRiskCards`。
5. `viralCopy` 缺失专属文案时使用 `defaultViralCopy`。

## 5. 不能自行猜测的内容

1. 完整题库题目、选项、顺序和 showWhen。
2. 每个选项的 dimensions / directR 分值。
3. 风险卡的正式标题、主文案、副文案、刺痛文案。
4. 风险卡的 baseTriggerScore、conditions、protectRules。
5. 服务卡是否涉及具体价格、服务承诺或转化路径。
6. 高刺痛分享文案的正式措辞。
7. 正式投放是否接入后端、数据库、统计或公众号授权。

## 6. 必须由你补充确认的问题

以下问题已确认：

1. 已确认：`BASE_FIELDS` 最终范围见 `docs/DECISIONS.md`。
2. 已确认：`test_cases.json` 使用局部答案。
3. 已确认：`topRiskCards` 为空时展示 `H0_GENERAL_REMINDER`。
4. 已确认：`viral_copy.json` 必须提供 `defaultViralCopy`，专属 viral copy 缺失只 warning。
5. 已确认：第一版默认静音，不要求真实音频文件。
6. 已确认：`postgraduate_exam` 是基础字段。

仍需后续补充确认：

1. B1 / `mbti_type` 的正式题干、16 型选项和分流规则。
2. 正式题库、选项、顺序和 showWhen。
3. 正式评分权重和完整风险卡业务内容。
4. 风险卡专属动画素材是否提供。
5. 加载页、风险指数页、服务页是否提供统一视觉素材。
