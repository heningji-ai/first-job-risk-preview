# V1.2 应届生第一份工作路径适配题库规格

## 1. 文档定位

本文档定义 V1.2 的应届生第一份工作路径适配题库。它是产品规格文档，不是 `questions.json` 的直接替换稿。

V1.2 题库不做心理测试，不做标准员工考试，也不评价用户能力。题目目标是帮助系统理解：

- 用户现在的求职材料能否进入目标路径的筛选池。
- 用户为什么选择某类公司和岗位。
- 用户的工作方式底色与目标路径是否有摩擦。
- 用户进入真实公司和岗位场景后，可能在哪些地方卡住。

## 2. 题量结构

完整题库约 58 题：

| 模块 | 题量 | 用户是否全答 |
| --- | ---: | --- |
| 基础路径与准入 | 8 | 全部可见 |
| 动机与预期 | 5 | 全部可见 |
| 性格底色 / 工作方式 | 10 | 全部可见 |
| 公司类型场景 | 5 类公司 x 3 题 = 15 | 仅展示用户所选公司类型的 3 题 |
| 岗位分支场景 | 5 类岗位 x 4 题 = 20 | 仅展示用户所选岗位方向的 4 题 |

用户实际答题约 30 题：

```txt
8 + 5 + 10 + 3 + 4 = 30
```

完整题库：

```txt
8 + 5 + 10 + 15 + 20 = 58
```

## 3. 选项信号标注规范

每个选项都必须有内部工程字段 `optionSignal`。这些字段只用于工程计算和结果解释，不展示给普通用户。

```yaml
optionSignal:
  signalLevel: positive | neutral | risk | severeRisk
  scoreDelta: 2 | 1 | 0 | -1 | -2
  affectedDimension:
    - admissionFitScore
    - motivationFitScore
    - baseWorkStyleFitScore
    - companyScenarioFitScore
    - roleScenarioFitScore
  companyAffinity:
    soe: -2 to +2
    mnc: -2 to +2
    big_platform: -2 to +2
    startup: -2 to +2
    sme_private: -2 to +2
  roleAffinity:
    sales: -2 to +2
    operation_project: -2 to +2
    content_marketing: -2 to +2
    tech_data_product: -2 to +2
    function_support: -2 to +2
  explanationTags:
    - need_guidance
    - pressure_sensitive
    - uncertainty_tolerance
    - communication_energy
    - feedback_processing
    - execution_continuity
    - autonomy
    - stability_preference
    - growth_expectation
    - admission_barrier
    - environment_preference
    - role_pressure
  usedForResultExplanation: true | false
```

简写规则：

- `company=all0` 表示五类公司 affinity 均为 0。
- `role=all0` 表示五类岗位 affinity 均为 0。
- `company={soe:+2}` 表示未列出的公司 affinity 为 0。
- `role={sales:+2}` 表示未列出的岗位 affinity 为 0。
- `tags=[...]` 对应 `explanationTags`。
- `explain=Y/N` 对应 `usedForResultExplanation`。

说明：

1. `signalLevel` 是内部字段，不展示给普通用户。
2. `scoreDelta` 是工程实现参考，不是最终真实分数。
3. `companyAffinity` / `roleAffinity` 用于和用户选择的公司类型、岗位方向联动。
4. `explanationTags` 用于结果页解释，不直接等于风险卡。
5. 普通用户页不得显示这些字段。

## 4. 字段规范

每道题必须包含：

| 字段 | 说明 |
| --- | --- |
| questionId | 题目唯一标识 |
| 所属模块 | 基础路径与准入 / 动机与预期 / 工作方式 / 公司场景 / 岗位场景 |
| 是否所有用户可见 | 是 / 否 |
| 显示条件 | 无，或依赖目标公司 / 目标岗位 |
| 题干 | 用户可见题目 |
| 选项 | 选项文案和 optionSignal |
| 对应评分维度 | admissionFitScore 等 |
| 影响的公司类型 | 适用公司类型 |
| 影响的岗位类型 | 适用岗位方向 |
| 评分意图 | 该题用于判断什么 |
| 是否用于结果页解释 | 是 / 否 |

## 5. 事实层级题说明

A3、A5、A6 是事实层级题，天然会体现材料强弱。处理原则：

1. 这些题不评价个人能力。
2. 这些题只判断第一轮简历筛选压力。
3. 同样背景在不同公司和岗位下影响不同。
4. 普通本科、无实习、无作品，不等于不能做，只是进入某些公司和岗位的证明成本更高。
5. 选项文案避免“差 / 不行 / 没优势”，统一表达为材料状态和证明成本。

## 6. 基础路径与准入 8 题

| questionId | 所属模块 | 所有用户可见 | 显示条件 | 题干 | 选项与 optionSignal | 对应评分维度 | 影响公司类型 | 影响岗位类型 | 评分意图 | 结果页解释 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A1 | 基础路径与准入 | 是 | 无 | 你现在处在什么阶段？ | 大三/研一 `{neutral,0,dim=admissionFitScore,company=all0,role=all0,tags=[admission_barrier],explain=Y}`；大四/研二 `{neutral,0,dim=admissionFitScore,company=all0,role=all0,tags=[admission_barrier],explain=Y}`；已毕业正在找第一份工作 `{risk,-1,dim=admissionFitScore,company=all0,role=all0,tags=[admission_barrier,pressure_sensitive],explain=Y}`；已经有 offer，想复盘这条路 `{neutral,0,dim=admissionFitScore,company=all0,role=all0,tags=[growth_expectation],explain=Y}` | admissionFitScore | 全部 | 全部 | 判断时间窗口和求职紧迫度 | 是 |
| A2 | 基础路径与准入 | 是 | 无 | 你的最高学历层级是？ | 专科 `{risk,-1,dim=admissionFitScore,company={soe:-1,mnc:-1,big_platform:-2},role=all0,tags=[admission_barrier],explain=Y}`；本科 `{neutral,0,dim=admissionFitScore,company=all0,role=all0,tags=[admission_barrier],explain=Y}`；硕士 `{positive,+1,dim=admissionFitScore,company={soe:+1,mnc:+1,big_platform:+1},role=all0,tags=[admission_barrier],explain=Y}`；博士或更高 `{positive,+1,dim=admissionFitScore,company={soe:+1,mnc:+1,big_platform:+1},role=all0,tags=[admission_barrier],explain=Y}` | admissionFitScore | 全部 | 全部 | 判断学历门槛相对压力，不评价能力 | 是 |
| A3 | 基础路径与准入 | 是 | 无 | 你的学校或专业在求职时大概属于哪种情况？ | 学校和专业都有较高识别度 `{positive,+2,dim=admissionFitScore,company={soe:+1,mnc:+1,big_platform:+2},role=all0,tags=[admission_barrier],explain=Y}`；学校一般但专业和方向连接紧 `{positive,+1,dim=admissionFitScore,company={big_platform:0,startup:+1,sme_private:+1},role={tech_data_product:+1,function_support:+1},tags=[admission_barrier],explain=Y}`；学校识别度较高但专业连接较弱 `{neutral,0,dim=admissionFitScore,company={soe:+1,mnc:+1,big_platform:+1},role=all0,tags=[admission_barrier],explain=Y}`；学校和专业都需要更多材料来证明 `{risk,-1,dim=admissionFitScore,company={soe:-1,mnc:-1,big_platform:-1},role=all0,tags=[admission_barrier],explain=Y}` | admissionFitScore | 全部 | 全部 | 判断简历第一轮识别度 | 是 |
| A4 | 基础路径与准入 | 是 | 无 | 你的专业和目标岗位方向关系更接近哪种？ | 专业训练和岗位高度相关 `{positive,+2,dim=admissionFitScore,company=all0,role={tech_data_product:+2,function_support:+1},tags=[admission_barrier],explain=Y}`；有课程、项目或实习能连接 `{positive,+1,dim=admissionFitScore,company=all0,role=all0,tags=[admission_barrier,growth_expectation],explain=Y}`；兴趣明确但训练还不系统 `{neutral,0,dim=admissionFitScore,company=all0,role={content_marketing:+1,sales:+1},tags=[growth_expectation],explain=Y}`；目前主要靠后续材料补充证明 `{risk,-1,dim=admissionFitScore,company=all0,role={tech_data_product:-1},tags=[admission_barrier],explain=Y}` | admissionFitScore | 全部 | 全部 | 判断专业迁移成本 | 是 |
| A5 | 基础路径与准入 | 是 | 无 | 你目前和目标方向相关的实习经历更接近哪种？ | 有一段较完整相关实习 `{positive,+2,dim=admissionFitScore,company={mnc:+1,big_platform:+1},role=all0,tags=[admission_barrier],explain=Y}`；有短期或边缘相关经历 `{positive,+1,dim=admissionFitScore,company=all0,role=all0,tags=[admission_barrier],explain=Y}`；有校内实践或比赛项目，企业经历较少 `{neutral,0,dim=admissionFitScore,company={startup:+1,sme_private:+1},role={content_marketing:+1,tech_data_product:+1},tags=[admission_barrier],explain=Y}`；暂时主要靠后续简历材料补充证明 `{risk,-1,dim=admissionFitScore,company={mnc:-1,big_platform:-1},role=all0,tags=[admission_barrier],explain=Y}` | admissionFitScore | 全部 | 全部 | 判断经历证明强度 | 是 |
| A6 | 基础路径与准入 | 是 | 无 | 除了实习，你还有哪些能证明目标方向准备度的材料？ | 有作品/项目/证书且能展示结果 `{positive,+2,dim=admissionFitScore,company=all0,role={content_marketing:+1,tech_data_product:+1,operation_project:+1},tags=[admission_barrier],explain=Y}`；有项目但还比较零散 `{positive,+1,dim=admissionFitScore,company=all0,role=all0,tags=[admission_barrier],explain=Y}`；主要是课程作业、社团或校内经历 `{neutral,0,dim=admissionFitScore,company=all0,role={operation_project:+1,function_support:+1},tags=[admission_barrier],explain=Y}`；目前还需要补充可展示材料 `{risk,-1,dim=admissionFitScore,company={big_platform:-1,mnc:-1},role={tech_data_product:-1,content_marketing:-1},tags=[admission_barrier],explain=Y}` | admissionFitScore | 全部 | 全部 | 判断可被筛选识别的证据 | 是 |
| A7 | 基础路径与准入 | 是 | 无 | 你现在最想预演哪类公司？ | 国企/事业单位/央国企平台 `{neutral,0,dim=admissionFitScore,company={soe:+2},role=all0,tags=[environment_preference,stability_preference],explain=Y}`；外企/跨国公司 `{neutral,0,dim=admissionFitScore,company={mnc:+2},role=all0,tags=[environment_preference],explain=Y}`；大厂/大平台 `{neutral,0,dim=admissionFitScore,company={big_platform:+2},role=all0,tags=[environment_preference,growth_expectation],explain=Y}`；创业公司 `{neutral,0,dim=admissionFitScore,company={startup:+2},role=all0,tags=[environment_preference,autonomy],explain=Y}`；中小民企/传统民企 `{neutral,0,dim=admissionFitScore,company={sme_private:+2},role=all0,tags=[environment_preference],explain=Y}` | 路径参照 | 对应所选公司 | 全部 | 决定公司场景分支和准入参照，本身不直接加减分 | 是 |
| A8 | 基础路径与准入 | 是 | 无 | 你现在最想预演哪类岗位方向？ | 销售/商务/客户拓展 `{neutral,0,dim=admissionFitScore,company=all0,role={sales:+2},tags=[role_pressure,communication_energy],explain=Y}`；运营/项目/用户增长 `{neutral,0,dim=admissionFitScore,company=all0,role={operation_project:+2},tags=[role_pressure,execution_continuity],explain=Y}`；内容/市场/品牌 `{neutral,0,dim=admissionFitScore,company=all0,role={content_marketing:+2},tags=[role_pressure,feedback_processing],explain=Y}`；技术/数据/产品 `{neutral,0,dim=admissionFitScore,company=all0,role={tech_data_product:+2},tags=[role_pressure,autonomy],explain=Y}`；职能支持 `{neutral,0,dim=admissionFitScore,company=all0,role={function_support:+2},tags=[role_pressure,stability_preference],explain=Y}` | 路径参照 | 全部 | 对应所选岗位 | 决定岗位场景分支和岗位参照，本身不直接加减分 | 是 |

## 7. 动机与预期 5 题

| questionId | 所属模块 | 所有用户可见 | 显示条件 | 题干 | 选项与 optionSignal | 对应评分维度 | 影响公司类型 | 影响岗位类型 | 评分意图 | 结果页解释 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M1 | 动机与预期 | 是 | 无 | 你选择这个公司和岗位方向，最主要是因为什么？ | 想要一个相对稳定的开始 `{neutral,0,dim=motivationFitScore,company={soe:+2,mnc:+1},role={function_support:+1},tags=[stability_preference],explain=Y}`；想在真实业务里成长快一点 `{positive,+1,dim=motivationFitScore,company={big_platform:+1,startup:+1},role={operation_project:+1,sales:+1},tags=[growth_expectation],explain=Y}`；希望收入和机会空间更大 `{neutral,0,dim=motivationFitScore,company={startup:+1,big_platform:+1},role={sales:+2},tags=[growth_expectation,role_pressure],explain=Y}`；暂时不确定，想先选一个方向试试 `{risk,-1,dim=motivationFitScore,company=all0,role=all0,tags=[uncertainty_tolerance],explain=Y}` | motivationFitScore | 全部 | 全部 | 判断动机是否和路径真实体验一致 | 是 |
| M2 | 动机与预期 | 是 | 无 | 在真正开始找工作前，你心里最担心的是什么？ | 担心进不了筛选 `{risk,-1,dim=motivationFitScore,company={soe:-1,mnc:-1,big_platform:-1},role=all0,tags=[admission_barrier],explain=Y}`；担心入职后没人系统带 `{risk,-1,dim=motivationFitScore,company={startup:-1,sme_private:-1},role=all0,tags=[need_guidance],explain=Y}`；担心选错方向浪费时间 `{risk,-1,dim=motivationFitScore,company=all0,role=all0,tags=[uncertainty_tolerance],explain=Y}`；担心工作压力和预期不一样 `{risk,-1,dim=motivationFitScore,company=all0,role=all0,tags=[pressure_sensitive],explain=Y}` | motivationFitScore | 全部 | 全部 | 判断主焦虑来源 | 是 |
| M3 | 动机与预期 | 是 | 无 | 第一份工作里，你最看重什么？ | 有清晰培养 `{neutral,0,dim=motivationFitScore,company={mnc:+1,soe:+1,startup:-1,sme_private:-1},role=all0,tags=[need_guidance],explain=Y}`；能快速成长 `{positive,+1,dim=motivationFitScore,company={big_platform:+1,startup:+1},role={sales:+1,operation_project:+1},tags=[growth_expectation],explain=Y}`；有稳定节奏 `{neutral,0,dim=motivationFitScore,company={soe:+2,mnc:+1},role={function_support:+1},tags=[stability_preference],explain=Y}`；能接触真实业务和结果 `{positive,+1,dim=motivationFitScore,company={startup:+1,sme_private:+1,big_platform:+1},role={sales:+1,operation_project:+1},tags=[role_pressure,growth_expectation],explain=Y}` | motivationFitScore | 全部 | 全部 | 判断核心期待 | 是 |
| M4 | 动机与预期 | 是 | 无 | 如果第一份工作出现下面情况，你最需要提前确认哪一种？ | 反馈周期很长 `{risk,-1,dim=motivationFitScore,company={soe:-1,function_support:0},role=all0,tags=[feedback_processing],explain=Y}`；日常节奏持续很快 `{risk,-1,dim=motivationFitScore,company={big_platform:-1,startup:-1},role={sales:-1,operation_project:-1},tags=[pressure_sensitive],explain=Y}`；流程和审批比较多 `{risk,-1,dim=motivationFitScore,company={soe:-1},role={function_support:0},tags=[stability_preference],explain=Y}`；职责边界会阶段性变化 `{risk,-1,dim=motivationFitScore,company={startup:-1,sme_private:-1},role={operation_project:-1},tags=[uncertainty_tolerance],explain=Y}` | motivationFitScore | 全部 | 全部 | 判断不可接受项是否与目标路径冲突 | 是 |
| M5 | 动机与预期 | 是 | 无 | 为了走这条路，你比较能接受哪种成本？ | 前期学习强度大 `{positive,+1,dim=motivationFitScore,company={big_platform:+1,mnc:+1},role={tech_data_product:+1},tags=[growth_expectation],explain=Y}`；反馈直接，需要快速调整 `{positive,+1,dim=motivationFitScore,company={big_platform:+1},role={sales:+1,content_marketing:+1},tags=[feedback_processing],explain=Y}`；节奏慢但稳定积累 `{neutral,0,dim=motivationFitScore,company={soe:+2},role={function_support:+1},tags=[stability_preference],explain=Y}`；短期不确定但有试错空间 `{neutral,0,dim=motivationFitScore,company={startup:+2},role={operation_project:+1,content_marketing:+1},tags=[uncertainty_tolerance,autonomy],explain=Y}` | motivationFitScore | 全部 | 全部 | 判断用户愿意承担的路径成本 | 是 |

## 8. 性格底色 / 工作方式 10 题

| questionId | 所属模块 | 所有用户可见 | 显示条件 | 题干 | 选项与 optionSignal | 对应评分维度 | 影响公司类型 | 影响岗位类型 | 评分意图 | 结果页解释 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| W1 | 工作方式 | 是 | 无 | 你工作时更容易从哪里获得能量？ | 和人交流后更有动力 `{positive,+1,dim=baseWorkStyleFitScore,company=all0,role={sales:+2,operation_project:+1},tags=[communication_energy],explain=Y}`；独立完成后更有掌控感 `{positive,+1,dim=baseWorkStyleFitScore,company=all0,role={tech_data_product:+1,content_marketing:+1},tags=[autonomy],explain=Y}`；看到结果变化更有动力 `{positive,+1,dim=baseWorkStyleFitScore,company={big_platform:+1,startup:+1},role={sales:+1,operation_project:+1},tags=[growth_expectation],explain=Y}`；把流程理顺后更安心 `{positive,+1,dim=baseWorkStyleFitScore,company={soe:+1,mnc:+1},role={function_support:+2},tags=[stability_preference],explain=Y}` | baseWorkStyleFitScore | 全部 | 全部 | 判断能量来源与路径要求的匹配 | 是 |
| W2 | 工作方式 | 是 | 无 | 接到一个不熟悉任务时，你通常先怎么处理？ | 先问清目标和边界 `{positive,+1,dim=baseWorkStyleFitScore,company={mnc:+1},role={function_support:+1,tech_data_product:+1},tags=[need_guidance,autonomy],explain=Y}`；先查资料再动手 `{positive,+1,dim=baseWorkStyleFitScore,company=all0,role={tech_data_product:+1},tags=[autonomy],explain=Y}`；先做一个小版本试试 `{positive,+1,dim=baseWorkStyleFitScore,company={startup:+1,big_platform:+1},role={operation_project:+1,content_marketing:+1},tags=[uncertainty_tolerance],explain=Y}`；先观察别人怎么做 `{neutral,0,dim=baseWorkStyleFitScore,company={soe:+1,sme_private:+1},role={function_support:+1},tags=[need_guidance],explain=Y}` | baseWorkStyleFitScore | 全部 | 全部 | 判断信息处理方式 | 是 |
| W3 | 工作方式 | 是 | 无 | 当一件事没有明确标准时，你通常更接近哪种推进方式？ | 先找一个小切口试起来，用结果校准方向 `{positive,+2,dim=baseWorkStyleFitScore,company={startup:+2,big_platform:+1},role={operation_project:+1,content_marketing:+1},tags=[uncertainty_tolerance,autonomy],explain=Y}`；先拆出几个关键步骤，再边做边确认 `{positive,+1,dim=baseWorkStyleFitScore,company={big_platform:+1,mnc:+1},role={tech_data_product:+1,function_support:+1},tags=[execution_continuity],explain=Y}`；先找类似案例和资料，再开始推进 `{neutral,0,dim=baseWorkStyleFitScore,company={soe:+1,mnc:+1},role={tech_data_product:+1},tags=[need_guidance],explain=Y}`；先确认关键边界和判断标准，投入会更稳定 `{neutral,0,dim=baseWorkStyleFitScore,company={soe:+1,mnc:+1},role={function_support:+1},tags=[need_guidance,stability_preference],explain=Y}` | baseWorkStyleFitScore | 全部 | 全部 | 判断面对不确定性的推进方式 | 是 |
| W4 | 工作方式 | 是 | 无 | 当你的想法被质疑时，你通常会怎么处理？ | 先追问对方在意的标准，再调整表达或方案 `{positive,+2,dim=baseWorkStyleFitScore,company={mnc:+1,big_platform:+1},role={sales:+1,operation_project:+1},tags=[feedback_processing,communication_energy],explain=Y}`；先消化一下，再判断哪些反馈值得吸收 `{neutral,0,dim=baseWorkStyleFitScore,company=all0,role=all0,tags=[feedback_processing],explain=Y}`；保留自己的判断，之后用事实、数据或结果验证 `{positive,+1,dim=baseWorkStyleFitScore,company={big_platform:+1,startup:+1},role={tech_data_product:+1,content_marketing:+1},tags=[autonomy,feedback_processing],explain=Y}`；先确认下一步怎么做更清晰，再继续推进 `{positive,+1,dim=baseWorkStyleFitScore,company=all0,role={function_support:+1,operation_project:+1},tags=[execution_continuity],explain=Y}` | baseWorkStyleFitScore | 全部 | 全部 | 判断反馈承受和转化方式 | 是 |
| W5 | 工作方式 | 是 | 无 | 面对周期比较长、需要反复推进的任务，你通常是什么状态？ | 会拆成阶段节点，持续往前推 `{positive,+2,dim=baseWorkStyleFitScore,company=all0,role={operation_project:+2,function_support:+1},tags=[execution_continuity],explain=Y}`；前期启动快，后期靠复盘或节点提醒保持节奏 `{positive,+1,dim=baseWorkStyleFitScore,company={big_platform:+1,startup:+1},role={sales:+1,content_marketing:+1},tags=[execution_continuity],explain=Y}`；有人定期对齐进度时，会更稳定 `{neutral,0,dim=baseWorkStyleFitScore,company={soe:+1,mnc:+1},role={function_support:+1},tags=[need_guidance,execution_continuity],explain=Y}`；需要阶段性切换节奏，才能保持投入感 `{neutral,0,dim=baseWorkStyleFitScore,company=all0,role={content_marketing:+1},tags=[pressure_sensitive],explain=Y}` | baseWorkStyleFitScore | 全部 | 全部 | 判断长周期任务承受度 | 是 |
| W6 | 工作方式 | 是 | 无 | 和别人协作时，你更习惯哪种方式？ | 先分清责任和节点 `{positive,+1,dim=baseWorkStyleFitScore,company={mnc:+1,soe:+1},role={function_support:+1,operation_project:+1},tags=[execution_continuity],explain=Y}`；保持频繁同步 `{positive,+1,dim=baseWorkStyleFitScore,company={big_platform:+1,startup:+1},role={operation_project:+2,sales:+1},tags=[communication_energy],explain=Y}`；自己先做出初稿再对齐 `{neutral,0,dim=baseWorkStyleFitScore,company=all0,role={content_marketing:+1,tech_data_product:+1},tags=[autonomy],explain=Y}`；看团队习惯再调整 `{neutral,0,dim=baseWorkStyleFitScore,company=all0,role=all0,tags=[environment_preference],explain=Y}` | baseWorkStyleFitScore | 全部 | 全部 | 判断协作方式 | 是 |
| W7 | 工作方式 | 是 | 无 | 面对连续几周节奏很快的工作，你通常会怎样？ | 拆任务保住关键结果 `{positive,+2,dim=baseWorkStyleFitScore,company={big_platform:+1,startup:+1},role={operation_project:+1,sales:+1},tags=[pressure_sensitive,execution_continuity],explain=Y}`；阶段性复盘调整 `{positive,+1,dim=baseWorkStyleFitScore,company=all0,role=all0,tags=[execution_continuity],explain=Y}`；需要明确优先级帮助 `{neutral,0,dim=baseWorkStyleFitScore,company={mnc:+1,soe:+1},role={function_support:+1},tags=[need_guidance],explain=Y}`；节奏会受到影响，需要外部校准 `{risk,-1,dim=baseWorkStyleFitScore,company={big_platform:-1,startup:-1},role={sales:-1,operation_project:-1},tags=[pressure_sensitive],explain=Y}` | baseWorkStyleFitScore | 全部 | 全部 | 判断节奏承受能力 | 是 |
| W8 | 工作方式 | 是 | 无 | 你更习惯哪种工作环境？ | 规则清楚、流程稳定 `{positive,+1,dim=baseWorkStyleFitScore,company={soe:+2,mnc:+1},role={function_support:+1},tags=[stability_preference,environment_preference],explain=Y}`；目标清楚、节奏紧凑 `{positive,+1,dim=baseWorkStyleFitScore,company={big_platform:+2},role={sales:+1,operation_project:+1},tags=[pressure_sensitive],explain=Y}`；空间较大、自己摸索 `{positive,+1,dim=baseWorkStyleFitScore,company={startup:+2},role={content_marketing:+1,tech_data_product:+1},tags=[autonomy,uncertainty_tolerance],explain=Y}`；人际直接、问题现场解决 `{positive,+1,dim=baseWorkStyleFitScore,company={sme_private:+2,startup:+1},role={sales:+1,function_support:+1},tags=[communication_energy],explain=Y}` | baseWorkStyleFitScore | 全部 | 全部 | 判断环境偏好与公司类型匹配 | 是 |
| W9 | 工作方式 | 是 | 无 | 当没人明确安排下一步时，你通常怎么推进？ | 先自己判断目标，再拆出可以开始的动作 `{positive,+2,dim=baseWorkStyleFitScore,company={startup:+2,big_platform:+1},role={operation_project:+1,tech_data_product:+1},tags=[autonomy,execution_continuity],explain=Y}`；先确认优先级，避免方向跑偏 `{positive,+1,dim=baseWorkStyleFitScore,company={mnc:+1,soe:+1},role={function_support:+1,operation_project:+1},tags=[need_guidance],explain=Y}`；参考已有做法或同类案例，找到切入点 `{neutral,0,dim=baseWorkStyleFitScore,company=all0,role={content_marketing:+1,tech_data_product:+1},tags=[autonomy],explain=Y}`；等关键方向更清晰后，投入效率会更高 `{neutral,0,dim=baseWorkStyleFitScore,company={soe:+1,mnc:+1,startup:-1},role={function_support:+1},tags=[need_guidance,stability_preference],explain=Y}` | baseWorkStyleFitScore | 全部 | 全部 | 判断自主推进方式 | 是 |
| W10 | 工作方式 | 是 | 无 | 学一个新工具或新业务时，你更适合哪种方式？ | 看资料后自己练 `{positive,+1,dim=baseWorkStyleFitScore,company=all0,role={tech_data_product:+2},tags=[autonomy],explain=Y}`；有人示范后上手 `{neutral,0,dim=baseWorkStyleFitScore,company={soe:+1,sme_private:+1},role={function_support:+1},tags=[need_guidance],explain=Y}`；边做边问 `{positive,+1,dim=baseWorkStyleFitScore,company={startup:+1,sme_private:+1},role={operation_project:+1},tags=[execution_continuity],explain=Y}`；先理解整体逻辑再做 `{positive,+1,dim=baseWorkStyleFitScore,company={mnc:+1,big_platform:+1},role={tech_data_product:+1,function_support:+1},tags=[autonomy],explain=Y}` | baseWorkStyleFitScore | 全部 | 全部 | 判断学习方式与岗位要求匹配 | 是 |

## 9. 公司类型场景 15 题

| questionId | 所属模块 | 所有用户可见 | 显示条件 | 题干 | 选项与 optionSignal | 对应评分维度 | 影响公司类型 | 影响岗位类型 | 评分意图 | 结果页解释 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C_SOE_1 | 公司场景 | 否 | A7=国企/事业单位/央国企平台 | 一个流程需要多轮审批，反馈很慢，你会怎么处理？ | 按流程推进并定期确认 `{positive,+2,dim=companyScenarioFitScore,company={soe:+2},role={function_support:+1},tags=[stability_preference,execution_continuity],explain=Y}`；先找关键人问清卡点 `{positive,+1,dim=companyScenarioFitScore,company={soe:+1},role={operation_project:+1},tags=[communication_energy],explain=Y}`；先把能准备的材料补齐 `{neutral,0,dim=companyScenarioFitScore,company={soe:+1},role=all0,tags=[execution_continuity],explain=Y}`；需要更明确的反馈节点才更稳定 `{risk,-1,dim=companyScenarioFitScore,company={soe:-1},role=all0,tags=[feedback_processing],explain=Y}` | companyScenarioFitScore | 国企/事业单位/央国企平台 | 全部 | 判断流程审批耐心 | 是 |
| C_SOE_2 | 公司场景 | 否 | A7=国企/事业单位/央国企平台 | 你有一个新想法，但需要逐级汇报后才能试，你更可能怎么做？ | 准备材料按层级沟通 `{positive,+2,dim=companyScenarioFitScore,company={soe:+2},role={function_support:+1},tags=[stability_preference],explain=Y}`；先找直属前辈确认可行性 `{positive,+1,dim=companyScenarioFitScore,company={soe:+1},role=all0,tags=[need_guidance],explain=Y}`；等到更合适的窗口再推动 `{neutral,0,dim=companyScenarioFitScore,company={soe:+1},role=all0,tags=[stability_preference],explain=Y}`；如果边界长期不清，投入感会下降 `{risk,-1,dim=companyScenarioFitScore,company={soe:-1},role=all0,tags=[autonomy],explain=Y}` | companyScenarioFitScore | 国企/事业单位/央国企平台 | 全部 | 判断层级沟通适应 | 是 |
| C_SOE_3 | 公司场景 | 否 | A7=国企/事业单位/央国企平台 | 工作稳定但成长节奏比想象中慢，你会怎么安排自己？ | 在稳定任务中积累长期能力 `{positive,+2,dim=companyScenarioFitScore,company={soe:+2},role={function_support:+1},tags=[stability_preference,growth_expectation],explain=Y}`；主动找可学习的小机会 `{positive,+1,dim=companyScenarioFitScore,company={soe:+1},role=all0,tags=[growth_expectation],explain=Y}`；需要阶段性反馈来确认成长 `{neutral,0,dim=companyScenarioFitScore,company={soe:0},role=all0,tags=[feedback_processing],explain=Y}`；如果长期看不到变化，节奏会受影响 `{risk,-1,dim=companyScenarioFitScore,company={soe:-1},role=all0,tags=[growth_expectation],explain=Y}` | companyScenarioFitScore | 国企/事业单位/央国企平台 | 全部 | 判断稳定环境中的成长预期 | 是 |
| C_MNC_1 | 公司场景 | 否 | A7=外企/跨国公司 | 主管给你目标，但不会手把手拆步骤，你会怎么开始？ | 主动澄清标准并拆计划 `{positive,+2,dim=companyScenarioFitScore,company={mnc:+2},role={tech_data_product:+1,function_support:+1},tags=[autonomy,need_guidance],explain=Y}`；先研究过往资料 `{positive,+1,dim=companyScenarioFitScore,company={mnc:+1},role=all0,tags=[autonomy],explain=Y}`；边做边定期确认 `{positive,+1,dim=companyScenarioFitScore,company={mnc:+1},role={operation_project:+1},tags=[execution_continuity],explain=Y}`；有示范样例时投入会更稳定 `{neutral,0,dim=companyScenarioFitScore,company={mnc:0},role=all0,tags=[need_guidance],explain=Y}` | companyScenarioFitScore | 外企/跨国公司 | 全部 | 判断边界清楚但陪伴少时的推进方式 | 是 |
| C_MNC_2 | 公司场景 | 否 | A7=外企/跨国公司 | 一件事需要用清晰邮件同步多个团队，你会怎么处理？ | 先梳理背景、结论和下一步 `{positive,+2,dim=companyScenarioFitScore,company={mnc:+2},role={function_support:+1,operation_project:+1},tags=[communication_energy],explain=Y}`；先问清各方关注点 `{positive,+1,dim=companyScenarioFitScore,company={mnc:+1},role=all0,tags=[communication_energy],explain=Y}`；写完后请人帮看一遍 `{neutral,0,dim=companyScenarioFitScore,company={mnc:0},role=all0,tags=[need_guidance],explain=Y}`；需要模板或规范来提高表达稳定性 `{neutral,0,dim=companyScenarioFitScore,company={mnc:0},role=all0,tags=[need_guidance],explain=Y}` | companyScenarioFitScore | 外企/跨国公司 | 全部 | 判断专业表达和规则理解 | 是 |
| C_MNC_3 | 公司场景 | 否 | A7=外企/跨国公司 | 跨团队协作中，对方只负责自己的边界，你会怎么理解？ | 尊重边界并补齐自己的部分 `{positive,+2,dim=companyScenarioFitScore,company={mnc:+2},role={function_support:+1},tags=[stability_preference],explain=Y}`；提前确认交付接口 `{positive,+1,dim=companyScenarioFitScore,company={mnc:+1},role={operation_project:+1,tech_data_product:+1},tags=[execution_continuity],explain=Y}`；先厘清谁能推动下一步 `{neutral,0,dim=companyScenarioFitScore,company={mnc:0},role=all0,tags=[communication_energy],explain=Y}`；如果边界过细，协作节奏会受影响 `{risk,-1,dim=companyScenarioFitScore,company={mnc:-1},role=all0,tags=[environment_preference],explain=Y}` | companyScenarioFitScore | 外企/跨国公司 | 全部 | 判断跨团队边界适应 | 是 |
| C_PLATFORM_1 | 公司场景 | 否 | A7=大厂/大平台 | 项目节奏突然加快，需求连续变化，你更可能怎么做？ | 先抓关键目标重新排期 `{positive,+2,dim=companyScenarioFitScore,company={big_platform:+2},role={operation_project:+1,tech_data_product:+1},tags=[pressure_sensitive,execution_continuity],explain=Y}`；同步风险并保住核心交付 `{positive,+1,dim=companyScenarioFitScore,company={big_platform:+1},role=all0,tags=[communication_energy],explain=Y}`；先确认优先级再投入 `{neutral,0,dim=companyScenarioFitScore,company={big_platform:0},role=all0,tags=[need_guidance],explain=Y}`；频繁变化会影响节奏稳定性 `{risk,-1,dim=companyScenarioFitScore,company={big_platform:-1},role=all0,tags=[pressure_sensitive],explain=Y}` | companyScenarioFitScore | 大厂/大平台 | 全部 | 判断快节奏变化承受 | 是 |
| C_PLATFORM_2 | 公司场景 | 否 | A7=大厂/大平台 | 跨部门会议里，有人直接挑战你的方案，你会怎么反应？ | 用事实和数据回应 `{positive,+2,dim=companyScenarioFitScore,company={big_platform:+2},role={tech_data_product:+1,operation_project:+1},tags=[feedback_processing],explain=Y}`；先记录问题再优化 `{positive,+1,dim=companyScenarioFitScore,company={big_platform:+1},role=all0,tags=[feedback_processing],explain=Y}`；会先确认对方的判断标准 `{neutral,0,dim=companyScenarioFitScore,company={big_platform:0},role=all0,tags=[need_guidance],explain=Y}`；需要一点时间把反馈和自我判断分开 `{neutral,0,dim=companyScenarioFitScore,company={big_platform:-1},role=all0,tags=[feedback_processing],explain=Y}` | companyScenarioFitScore | 大厂/大平台 | 全部 | 判断强反馈和协作压力 | 是 |
| C_PLATFORM_3 | 公司场景 | 否 | A7=大厂/大平台 | 同龄人都很强，你会怎么面对比较感？ | 转成学习对象 `{positive,+2,dim=companyScenarioFitScore,company={big_platform:+2},role=all0,tags=[growth_expectation],explain=Y}`；聚焦自己的阶段目标 `{positive,+1,dim=companyScenarioFitScore,company={big_platform:+1},role=all0,tags=[execution_continuity],explain=Y}`；需要外部反馈确认自己位置 `{neutral,0,dim=companyScenarioFitScore,company={big_platform:0},role=all0,tags=[feedback_processing],explain=Y}`；比较感会阶段性影响投入节奏 `{risk,-1,dim=companyScenarioFitScore,company={big_platform:-1},role=all0,tags=[pressure_sensitive],explain=Y}` | companyScenarioFitScore | 大厂/大平台 | 全部 | 判断平台竞争压力 | 是 |
| C_STARTUP_1 | 公司场景 | 否 | A7=创业公司 | 老板只说了大方向，没有标准答案，你会怎么推进？ | 先做可验证的小版本 `{positive,+2,dim=companyScenarioFitScore,company={startup:+2},role={operation_project:+1,content_marketing:+1},tags=[uncertainty_tolerance,autonomy],explain=Y}`；拆出几个假设去确认 `{positive,+1,dim=companyScenarioFitScore,company={startup:+1},role={tech_data_product:+1},tags=[autonomy],explain=Y}`；先找类似案例再动手 `{neutral,0,dim=companyScenarioFitScore,company={startup:0},role=all0,tags=[need_guidance],explain=Y}`；需要关键边界清楚后投入更稳定 `{neutral,0,dim=companyScenarioFitScore,company={startup:-1},role=all0,tags=[need_guidance],explain=Y}` | companyScenarioFitScore | 创业公司 | 全部 | 判断模糊中推进能力 | 是 |
| C_STARTUP_2 | 公司场景 | 否 | A7=创业公司 | 方向两周内变了三次，你会怎么理解？ | 接受变化并保留复盘 `{positive,+2,dim=companyScenarioFitScore,company={startup:+2},role=all0,tags=[uncertainty_tolerance],explain=Y}`；确认变化背后的业务原因 `{positive,+1,dim=companyScenarioFitScore,company={startup:+1},role={tech_data_product:+1,operation_project:+1},tags=[autonomy],explain=Y}`；需要重新对齐优先级 `{neutral,0,dim=companyScenarioFitScore,company={startup:0},role=all0,tags=[need_guidance],explain=Y}`；频繁变化会影响投入感和节奏 `{risk,-1,dim=companyScenarioFitScore,company={startup:-1},role=all0,tags=[pressure_sensitive],explain=Y}` | companyScenarioFitScore | 创业公司 | 全部 | 判断方向变化适应 | 是 |
| C_STARTUP_3 | 公司场景 | 否 | A7=创业公司 | 团队人少，你需要同时做几类事情，你会怎么处理？ | 先排优先级再补位 `{positive,+2,dim=companyScenarioFitScore,company={startup:+2},role={operation_project:+1},tags=[execution_continuity],explain=Y}`；接受阶段性多角色 `{positive,+1,dim=companyScenarioFitScore,company={startup:+1},role=all0,tags=[autonomy],explain=Y}`；需要确认哪些必须做 `{neutral,0,dim=companyScenarioFitScore,company={startup:0},role=all0,tags=[need_guidance],explain=Y}`；长期职责扩张会影响节奏 `{risk,-1,dim=companyScenarioFitScore,company={startup:-1},role=all0,tags=[pressure_sensitive],explain=Y}` | companyScenarioFitScore | 创业公司 | 全部 | 判断一人多岗和资源有限适应 | 是 |
| C_PRIVATE_1 | 公司场景 | 否 | A7=中小民企/传统民企 | 公司流程不够标准，你需要边做边问，你会怎么处理？ | 先把关键流程问清 `{positive,+1,dim=companyScenarioFitScore,company={sme_private:+1},role={function_support:+1},tags=[need_guidance],explain=Y}`；记录经验形成自己的清单 `{positive,+2,dim=companyScenarioFitScore,company={sme_private:+2},role={function_support:+1,operation_project:+1},tags=[execution_continuity],explain=Y}`；先跟着真实任务学 `{neutral,0,dim=companyScenarioFitScore,company={sme_private:+1},role=all0,tags=[growth_expectation],explain=Y}`；流程不清会影响投入感 `{risk,-1,dim=companyScenarioFitScore,company={sme_private:-1},role=all0,tags=[environment_preference],explain=Y}` | companyScenarioFitScore | 中小民企/传统民企 | 全部 | 判断管理不规范适应 | 是 |
| C_PRIVATE_2 | 公司场景 | 否 | A7=中小民企/传统民企 | 你的职责边界经常被临时扩大，你会怎么回应？ | 先确认优先级和边界 `{positive,+1,dim=companyScenarioFitScore,company={sme_private:+1},role={function_support:+1,operation_project:+1},tags=[need_guidance],explain=Y}`；能接受合理补位 `{positive,+2,dim=companyScenarioFitScore,company={sme_private:+2,startup:+1},role=all0,tags=[autonomy],explain=Y}`；短期能做，但需要阶段性对齐 `{neutral,0,dim=companyScenarioFitScore,company={sme_private:0},role=all0,tags=[execution_continuity],explain=Y}`；长期边界变化会影响节奏 `{risk,-1,dim=companyScenarioFitScore,company={sme_private:-1},role=all0,tags=[pressure_sensitive],explain=Y}` | companyScenarioFitScore | 中小民企/传统民企 | 全部 | 判断边界不清适应 | 是 |
| C_PRIVATE_3 | 公司场景 | 否 | A7=中小民企/传统民企 | 入职培训很少，很多事要靠实战学，你会怎么开始？ | 先跟着真实任务学 `{positive,+2,dim=companyScenarioFitScore,company={sme_private:+2,startup:+1},role=all0,tags=[growth_expectation],explain=Y}`；主动请教关键节点 `{positive,+1,dim=companyScenarioFitScore,company={sme_private:+1},role=all0,tags=[need_guidance],explain=Y}`；需要有人先讲清重点 `{neutral,0,dim=companyScenarioFitScore,company={sme_private:0},role=all0,tags=[need_guidance],explain=Y}`；培训少会影响前期投入稳定性 `{risk,-1,dim=companyScenarioFitScore,company={sme_private:-1},role=all0,tags=[need_guidance],explain=Y}` | companyScenarioFitScore | 中小民企/传统民企 | 全部 | 判断培训少、靠实战成长的适应 | 是 |

## 10. 岗位分支场景 20 题

| questionId | 所属模块 | 所有用户可见 | 显示条件 | 题干 | 选项与 optionSignal | 对应评分维度 | 影响公司类型 | 影响岗位类型 | 评分意图 | 结果页解释 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R_SALES_1 | 岗位场景 | 否 | A8=销售/商务/客户拓展 | 你需要主动联系陌生客户，第一次没有回应，你会怎么做？ | 调整话术继续触达 `{positive,+2,dim=roleScenarioFitScore,company=all0,role={sales:+2},tags=[communication_energy,execution_continuity],explain=Y}`；先复盘客户画像 `{positive,+1,dim=roleScenarioFitScore,company=all0,role={sales:+1},tags=[feedback_processing],explain=Y}`；先换一个触达切口 `{neutral,0,dim=roleScenarioFitScore,company=all0,role={sales:+1},tags=[autonomy],explain=Y}`；需要更多反馈样本后再提高投入 `{risk,-1,dim=roleScenarioFitScore,company=all0,role={sales:-1},tags=[feedback_processing],explain=Y}` | roleScenarioFitScore | 全部 | 销售/商务/客户拓展 | 判断陌生触达承受 | 是 |
| R_SALES_2 | 岗位场景 | 否 | A8=销售/商务/客户拓展 | 月底目标还差一截，你会更接近哪种状态？ | 压力会让我更集中，先增加有效触达 `{positive,+2,dim=roleScenarioFitScore,company=all0,role={sales:+2},tags=[pressure_sensitive,execution_continuity],explain=Y}`；先拆目标，找最有机会推进的客户 `{positive,+1,dim=roleScenarioFitScore,company=all0,role={sales:+2},tags=[execution_continuity],explain=Y}`；先找主管或同事确认打法，再继续推进 `{neutral,0,dim=roleScenarioFitScore,company=all0,role={sales:0},tags=[need_guidance,communication_energy],explain=Y}`；先稳住节奏，避免因为着急让动作变形 `{neutral,0,dim=roleScenarioFitScore,company=all0,role={sales:-1},tags=[pressure_sensitive],explain=Y}` | roleScenarioFitScore | 全部 | 销售/商务/客户拓展 | 判断目标压力下的动作质量 | 是 |
| R_SALES_3 | 岗位场景 | 否 | A8=销售/商务/客户拓展 | 一个客户迟迟不下决定，你会怎么跟进？ | 设定节奏持续推进 `{positive,+2,dim=roleScenarioFitScore,company=all0,role={sales:+2},tags=[execution_continuity],explain=Y}`；补充客户关心的信息 `{positive,+1,dim=roleScenarioFitScore,company=all0,role={sales:+1},tags=[communication_energy],explain=Y}`；阶段性降低投入，转向更高意向客户 `{neutral,0,dim=roleScenarioFitScore,company=all0,role={sales:0},tags=[autonomy],explain=Y}`；如果长期没反馈，投入感会下降 `{risk,-1,dim=roleScenarioFitScore,company=all0,role={sales:-1},tags=[feedback_processing],explain=Y}` | roleScenarioFitScore | 全部 | 销售/商务/客户拓展 | 判断长期跟进能力 | 是 |
| R_SALES_4 | 岗位场景 | 否 | A8=销售/商务/客户拓展 | 客户对价格或方案不断压条件，你会怎么回应？ | 先确认真实需求再谈方案 `{positive,+2,dim=roleScenarioFitScore,company=all0,role={sales:+2},tags=[communication_energy],explain=Y}`；整理可让步和不能让步的边界 `{positive,+1,dim=roleScenarioFitScore,company=all0,role={sales:+1},tags=[stability_preference],explain=Y}`；请主管确认谈判边界 `{neutral,0,dim=roleScenarioFitScore,company=all0,role={sales:0},tags=[need_guidance],explain=Y}`；对方节奏太强时需要外部校准 `{risk,-1,dim=roleScenarioFitScore,company=all0,role={sales:-1},tags=[pressure_sensitive],explain=Y}` | roleScenarioFitScore | 全部 | 销售/商务/客户拓展 | 判断谈判和边界处理 | 是 |
| R_OPS_1 | 岗位场景 | 否 | A8=运营/项目/用户增长 | 一个活动要同时协调设计、开发和业务，你会怎么推进？ | 拆节点和责任人 `{positive,+2,dim=roleScenarioFitScore,company=all0,role={operation_project:+2},tags=[execution_continuity],explain=Y}`；先找关键人对齐目标 `{positive,+1,dim=roleScenarioFitScore,company=all0,role={operation_project:+1},tags=[communication_energy],explain=Y}`；先从最确定的部分推进 `{neutral,0,dim=roleScenarioFitScore,company=all0,role={operation_project:0},tags=[autonomy],explain=Y}`；多方反馈不齐时节奏会受影响 `{risk,-1,dim=roleScenarioFitScore,company=all0,role={operation_project:-1},tags=[pressure_sensitive],explain=Y}` | roleScenarioFitScore | 全部 | 运营/项目/用户增长 | 判断多方协调能力 | 是 |
| R_OPS_2 | 岗位场景 | 否 | A8=运营/项目/用户增长 | 活动目标临时变化，你会怎么调整？ | 先改关键动作和指标 `{positive,+2,dim=roleScenarioFitScore,company=all0,role={operation_project:+2},tags=[uncertainty_tolerance],explain=Y}`；同步变化对排期的影响 `{positive,+1,dim=roleScenarioFitScore,company=all0,role={operation_project:+1},tags=[communication_energy],explain=Y}`；先确认新的优先级 `{neutral,0,dim=roleScenarioFitScore,company=all0,role={operation_project:0},tags=[need_guidance],explain=Y}`；变化频繁时需要重新找节奏 `{risk,-1,dim=roleScenarioFitScore,company=all0,role={operation_project:-1},tags=[pressure_sensitive],explain=Y}` | roleScenarioFitScore | 全部 | 运营/项目/用户增长 | 判断目标变化适应 | 是 |
| R_OPS_3 | 岗位场景 | 否 | A8=运营/项目/用户增长 | 每天都有很多细节要跟，你通常怎么避免遗漏？ | 建清单和提醒机制 `{positive,+2,dim=roleScenarioFitScore,company=all0,role={operation_project:+2,function_support:+1},tags=[execution_continuity],explain=Y}`；按优先级分层处理 `{positive,+1,dim=roleScenarioFitScore,company=all0,role={operation_project:+1},tags=[execution_continuity],explain=Y}`；靠节点集中检查 `{neutral,0,dim=roleScenarioFitScore,company=all0,role={operation_project:0},tags=[stability_preference],explain=Y}`；细节密集时需要外部提醒机制 `{risk,-1,dim=roleScenarioFitScore,company=all0,role={operation_project:-1},tags=[need_guidance],explain=Y}` | roleScenarioFitScore | 全部 | 运营/项目/用户增长 | 判断细节跟进 | 是 |
| R_OPS_4 | 岗位场景 | 否 | A8=运营/项目/用户增长 | 数据结果不如预期，需要复盘转化，你会怎么做？ | 找关键漏斗环节 `{positive,+2,dim=roleScenarioFitScore,company=all0,role={operation_project:+2},tags=[feedback_processing],explain=Y}`；对比不同用户反馈 `{positive,+1,dim=roleScenarioFitScore,company=all0,role={operation_project:+1},tags=[feedback_processing],explain=Y}`；先补充更多样本再判断 `{neutral,0,dim=roleScenarioFitScore,company=all0,role={operation_project:0},tags=[autonomy],explain=Y}`；需要一点时间把结果压力和复盘动作分开 `{neutral,0,dim=roleScenarioFitScore,company=all0,role={operation_project:-1},tags=[pressure_sensitive],explain=Y}` | roleScenarioFitScore | 全部 | 运营/项目/用户增长 | 判断数据复盘和转化压力 | 是 |
| R_CONTENT_1 | 岗位场景 | 否 | A8=内容/市场/品牌 | 你写的方案被否掉，需要重改，你会怎么处理？ | 问清否定原因再改 `{positive,+2,dim=roleScenarioFitScore,company=all0,role={content_marketing:+2},tags=[feedback_processing],explain=Y}`；对照目标用户调整 `{positive,+1,dim=roleScenarioFitScore,company=all0,role={content_marketing:+1},tags=[feedback_processing],explain=Y}`；先保留原判断，再做小范围验证 `{neutral,0,dim=roleScenarioFitScore,company=all0,role={content_marketing:0},tags=[autonomy],explain=Y}`；需要一点恢复时间再进入下一轮修改 `{neutral,0,dim=roleScenarioFitScore,company=all0,role={content_marketing:-1},tags=[feedback_processing],explain=Y}` | roleScenarioFitScore | 全部 | 内容/市场/品牌 | 判断作品被否后的反应 | 是 |
| R_CONTENT_2 | 岗位场景 | 否 | A8=内容/市场/品牌 | 需要连续几周保持内容产出，你更接近哪种状态？ | 建素材库和选题节奏 `{positive,+2,dim=roleScenarioFitScore,company=all0,role={content_marketing:+2},tags=[execution_continuity],explain=Y}`；按反馈调整方向 `{positive,+1,dim=roleScenarioFitScore,company=all0,role={content_marketing:+1},tags=[feedback_processing],explain=Y}`；前期产出快，后期需要节点复盘 `{neutral,0,dim=roleScenarioFitScore,company=all0,role={content_marketing:0},tags=[execution_continuity],explain=Y}`；持续产出需要阶段性输入和恢复 `{neutral,0,dim=roleScenarioFitScore,company=all0,role={content_marketing:-1},tags=[pressure_sensitive],explain=Y}` | roleScenarioFitScore | 全部 | 内容/市场/品牌 | 判断持续产出 | 是 |
| R_CONTENT_3 | 岗位场景 | 否 | A8=内容/市场/品牌 | 你认真做的内容数据不好，你会怎么反应？ | 拆用户、渠道、标题、选题等因素继续测试 `{positive,+2,dim=roleScenarioFitScore,company=all0,role={content_marketing:+2},tags=[feedback_processing],explain=Y}`；先把数据反馈和自我评价分开，再决定怎么改 `{positive,+1,dim=roleScenarioFitScore,company=all0,role={content_marketing:+1},tags=[feedback_processing],explain=Y}`；找具体反馈样本，判断问题出在哪里 `{positive,+1,dim=roleScenarioFitScore,company=all0,role={content_marketing:+1},tags=[feedback_processing],explain=Y}`；需要一段恢复和输入时间，再进入下一轮产出 `{neutral,0,dim=roleScenarioFitScore,company=all0,role={content_marketing:-1},tags=[pressure_sensitive],explain=Y}` | roleScenarioFitScore | 全部 | 内容/市场/品牌 | 判断数据反馈承受 | 是 |
| R_CONTENT_4 | 岗位场景 | 否 | A8=内容/市场/品牌 | 热点很快，但品牌调性有限制，你会怎么做？ | 在边界内找表达角度 `{positive,+2,dim=roleScenarioFitScore,company=all0,role={content_marketing:+2},tags=[autonomy],explain=Y}`；先确认不能碰的部分 `{positive,+1,dim=roleScenarioFitScore,company=all0,role={content_marketing:+1},tags=[need_guidance],explain=Y}`；选择不追这个热点，保留品牌稳定性 `{neutral,0,dim=roleScenarioFitScore,company=all0,role={content_marketing:0},tags=[stability_preference],explain=Y}`；限制较多时创作节奏会受影响 `{risk,-1,dim=roleScenarioFitScore,company=all0,role={content_marketing:-1},tags=[environment_preference],explain=Y}` | roleScenarioFitScore | 全部 | 内容/市场/品牌 | 判断创意边界和品牌限制 | 是 |
| R_TECH_1 | 岗位场景 | 否 | A8=技术/数据/产品 | 业务方提的需求不够清楚，你会怎么开始？ | 先澄清目标和使用场景 `{positive,+2,dim=roleScenarioFitScore,company=all0,role={tech_data_product:+2},tags=[communication_energy],explain=Y}`；整理问题清单再沟通 `{positive,+1,dim=roleScenarioFitScore,company=all0,role={tech_data_product:+1},tags=[execution_continuity],explain=Y}`；先按理解做一个版本 `{neutral,0,dim=roleScenarioFitScore,company=all0,role={tech_data_product:0},tags=[autonomy],explain=Y}`；需要关键标准清楚后投入更稳定 `{neutral,0,dim=roleScenarioFitScore,company=all0,role={tech_data_product:-1},tags=[need_guidance],explain=Y}` | roleScenarioFitScore | 全部 | 技术/数据/产品 | 判断需求澄清能力 | 是 |
| R_TECH_2 | 岗位场景 | 否 | A8=技术/数据/产品 | 工作中需要持续学习新工具或新方法，你会怎么安排？ | 固定学习和练习节奏 `{positive,+2,dim=roleScenarioFitScore,company=all0,role={tech_data_product:+2},tags=[execution_continuity],explain=Y}`；围绕任务边学边用 `{positive,+1,dim=roleScenarioFitScore,company=all0,role={tech_data_product:+1},tags=[autonomy],explain=Y}`；遇到问题再集中学习 `{neutral,0,dim=roleScenarioFitScore,company=all0,role={tech_data_product:0},tags=[growth_expectation],explain=Y}`；学习压力大时需要明确优先级 `{neutral,0,dim=roleScenarioFitScore,company=all0,role={tech_data_product:-1},tags=[need_guidance],explain=Y}` | roleScenarioFitScore | 全部 | 技术/数据/产品 | 判断持续学习压力 | 是 |
| R_TECH_3 | 岗位场景 | 否 | A8=技术/数据/产品 | 你的方案被更专业的人指出问题，你会怎么处理？ | 记录问题并补知识 `{positive,+2,dim=roleScenarioFitScore,company=all0,role={tech_data_product:+2},tags=[feedback_processing],explain=Y}`；请对方指出关键判断依据 `{positive,+1,dim=roleScenarioFitScore,company=all0,role={tech_data_product:+1},tags=[need_guidance],explain=Y}`；先复盘自己判断链路 `{positive,+1,dim=roleScenarioFitScore,company=all0,role={tech_data_product:+1},tags=[autonomy],explain=Y}`；需要一点时间消化专业差距 `{neutral,0,dim=roleScenarioFitScore,company=all0,role={tech_data_product:-1},tags=[feedback_processing],explain=Y}` | roleScenarioFitScore | 全部 | 技术/数据/产品 | 判断专业反馈承受 | 是 |
| R_TECH_4 | 岗位场景 | 否 | A8=技术/数据/产品 | 排期、质量和业务需求发生冲突，你会怎么处理？ | 说明取舍和风险 `{positive,+2,dim=roleScenarioFitScore,company=all0,role={tech_data_product:+2},tags=[communication_energy],explain=Y}`；先保证核心目标 `{positive,+1,dim=roleScenarioFitScore,company=all0,role={tech_data_product:+1},tags=[execution_continuity],explain=Y}`；请上级确认取舍边界 `{neutral,0,dim=roleScenarioFitScore,company=all0,role={tech_data_product:0},tags=[need_guidance],explain=Y}`；多方要求都重要时需要外部校准 `{neutral,0,dim=roleScenarioFitScore,company=all0,role={tech_data_product:-1},tags=[pressure_sensitive],explain=Y}` | roleScenarioFitScore | 全部 | 技术/数据/产品 | 判断质量、排期和业务冲突处理 | 是 |
| R_FUNCTION_1 | 岗位场景 | 否 | A8=职能支持 | 同事诉求和流程规则冲突时，你会怎么处理？ | 先解释规则再找可行方案 `{positive,+2,dim=roleScenarioFitScore,company=all0,role={function_support:+2},tags=[communication_energy,stability_preference],explain=Y}`；请关键人确认边界 `{positive,+1,dim=roleScenarioFitScore,company=all0,role={function_support:+1},tags=[need_guidance],explain=Y}`；先处理最紧急的诉求 `{neutral,0,dim=roleScenarioFitScore,company=all0,role={function_support:0},tags=[execution_continuity],explain=Y}`；人情和规则冲突时节奏会受影响 `{risk,-1,dim=roleScenarioFitScore,company=all0,role={function_support:-1},tags=[pressure_sensitive],explain=Y}` | roleScenarioFitScore | 全部 | 职能支持 | 判断流程和服务冲突处理 | 是 |
| R_FUNCTION_2 | 岗位场景 | 否 | A8=职能支持 | 一项重复但必须细致的工作持续很久，你会怎么保持质量？ | 用清单和复核机制 `{positive,+2,dim=roleScenarioFitScore,company=all0,role={function_support:+2},tags=[execution_continuity],explain=Y}`；固定节奏处理 `{positive,+1,dim=roleScenarioFitScore,company=all0,role={function_support:+1},tags=[stability_preference],explain=Y}`；靠节点集中检查 `{neutral,0,dim=roleScenarioFitScore,company=all0,role={function_support:0},tags=[execution_continuity],explain=Y}`；重复周期长时需要反馈节点保持投入 `{risk,-1,dim=roleScenarioFitScore,company=all0,role={function_support:-1},tags=[feedback_processing],explain=Y}` | roleScenarioFitScore | 全部 | 职能支持 | 判断重复细致工作承受 | 是 |
| R_FUNCTION_3 | 岗位场景 | 否 | A8=职能支持 | 职能支持工作有时成果不容易被看见，你会怎么想？ | 可以接受，稳定、准确和秩序本身就是价值 `{positive,+2,dim=roleScenarioFitScore,company=all0,role={function_support:+2},tags=[stability_preference],explain=Y}`；希望有清晰评价标准，知道自己做得怎么样 `{neutral,0,dim=roleScenarioFitScore,company=all0,role={function_support:0},tags=[feedback_processing],explain=Y}`；会主动记录流程优化、问题处理和支持结果 `{positive,+1,dim=roleScenarioFitScore,company=all0,role={function_support:+1},tags=[execution_continuity],explain=Y}`；如果长期缺少反馈，投入感会受到影响 `{risk,-1,dim=roleScenarioFitScore,company=all0,role={function_support:-1},tags=[feedback_processing],explain=Y}` | roleScenarioFitScore | 全部 | 职能支持 | 判断低可见度成果承受 | 是 |
| R_FUNCTION_4 | 岗位场景 | 否 | A8=职能支持 | 多个部门同时找你处理问题，你会怎么安排？ | 按紧急度和影响排序 `{positive,+2,dim=roleScenarioFitScore,company=all0,role={function_support:+2},tags=[execution_continuity],explain=Y}`；同步处理时限和边界 `{positive,+1,dim=roleScenarioFitScore,company=all0,role={function_support:+1},tags=[communication_energy],explain=Y}`；先处理最明确的事项 `{neutral,0,dim=roleScenarioFitScore,company=all0,role={function_support:0},tags=[stability_preference],explain=Y}`；需求密集时需要外部优先级校准 `{risk,-1,dim=roleScenarioFitScore,company=all0,role={function_support:-1},tags=[need_guidance],explain=Y}` | roleScenarioFitScore | 全部 | 职能支持 | 判断跨部门服务边界 | 是 |

## 11. 题目设计边界

题目必须保持：

1. 公司场景题有真实公司日常感。
2. 岗位分支题有业务场景感。
3. 题目不写成心理测试。
4. 选项不明显分好坏。
5. 题目不写成标准员工考试。
6. 每个选项都要有工程信号，而不是只写适配含义。
7. 每题都标注对应评分维度。
8. 每题都标注是否用于结果页解释。

## 12. 普通用户页禁止表达

普通用户页不得展示：

- A 档 / B 档 / C 档 / D 档
- 档位
- 评级
- 等级
- score
- cardId
- pathFitBand
- option.id
- 诊断分数
- 能力分数
- 职业匹配分
- 性格匹配度
- 你不适合
- 你就是
- 必须放弃
- 免费咨询
- 立即咨询
- 购买服务
- 保证入职
- 企业微信
- 回复【重估】

## 13. 当前阶段边界

本文档只定义 V1.2 题库规格，不修改 `questions.json`，不落地正式分值，不修改评分引擎，不修改风险卡引擎，不修改结果页。
