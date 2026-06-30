# H1-H16 风险卡内部判断规格表（第一版）

> 用途：产品方、开发方、测试方内部使用。  
> 不展示给用户。  
> 当前版本用于指导后续 `risk_cards.json`、`test_cases.json` 与结果页文案配置，不代表正式评分规则。

## 使用原则

- 内部判断要精确，用户解释要克制。
- `triggerBoundary`、`protectBoundary`、`strongMatch`、`primaryRiskSignals` 不进入用户结果页。
- `strongMatch` 只做准入，不直接触发风险卡。
- 风险卡不能只由 flag 触发，必须至少命中一个主风险信号：answer / dimension / finalRisk。
- protectRules 任意命中时，该卡应跳过，避免误伤。
- 当前文档只定义产品判断边界，不编正式分值。

## 工程示例映射提醒

当前工程示例中已有部分 cardId，可在正式落配置时统一命名：

- `H3_GROWTH_EXHAUSTION` → `H3_GROWTH_EXHAUSTION_RISK`
- `H5_SOE_PROCESS_PRESSURE` → `H5_ORG_PROCESS_PRESSURE_RISK`
- `H16_EXAM_DELAY_PROBLEM` → `H16_EXAM_PATH_UNFINISHED_RISK`

正式写入 `risk_cards.json` 前，应先统一最终 cardId 命名，避免旧工程示例与正式卡重复。

---

## H1｜第一份工作适应断裂风险

**cardId：** `H1_ADAPTATION_BREAK_RISK`  
**内部名称：** 入职适应断裂风险  
**用户可见名称：** 第一份工作适应断裂风险

### 风险本质

从学生系统进入职场系统时，对任务模糊、反馈压力、责任承担、主动推进和真实工作节奏准备不足，容易在入职早期出现焦虑、自我怀疑和逃离感。

### 触发边界

缺少真实工作体验；对职场规则理解浅；反馈敏感；主动推进弱；对第一份工作的适应问题明显担忧。

### 保护边界

已有较完整实习、项目、兼职或责任承担经验；能主动确认标准、同步进展、暴露问题、复盘调整；对第一份工作基础训练期有现实预期。

### strongMatch

无。不绑定 companyType 或 workType。

### 主风险信号

R1_adaptation_risk；V1_social_exhaustion、V5_feedback_sensitivity、V6_execution_gap、V7_low_initiative、V8_job_action_misunderstanding；main_concern / choice_reason / current_status 中的适应相关答案。

### 辅助信号

缺少实习或真实交付经历；害怕被批评、做不好、不敢问；对新人前三个月任务和评价标准不清楚。

### 不应触发场景

只是紧张、内向或谨慎，但能主动确认、主动反馈、主动复盘；已经知道岗位日常和新人训练期要求。

### priority 建议

基础通用卡。触发门槛必须控制，避免变成所有应届生都会命中的泛化卡。

### 测试用例说明

需要准备：无实习/低主动/高反馈敏感应触发；有实习、主动反馈、现实预期应保护。

---

## H2｜第一份工作现实落差风险

**cardId：** `H2_REALITY_GAP_RISK`  
**内部名称：** 工作现实落差风险  
**用户可见名称：** 第一份工作现实落差风险

### 风险本质

用户对第一份工作的真实日常、基础任务、重复执行、协作流程和价值感形成速度预期不足，容易把正常的新人成长期误判为方向错误或岗位不适合。

### 触发边界

选择岗位时主要看兴趣、行业光环、公司名气、成长想象，但对岗位日常、前三个月任务、基础训练内容缺少具体理解。

### 保护边界

通过实习、兼职、项目或访谈理解岗位日常；能接受基础任务、重复执行和辅助性工作；能把第一份工作视为训练场。

### strongMatch

无。不绑定 companyType 或 workType。

### 主风险信号

R2_reality_gap_risk；V8_job_action_misunderstanding、V10_peer_platform_anxiety、V6_execution_gap；choice_reason / main_concern 中的兴趣化、光环化、想象化选择信号。

### 辅助信号

过度关注行业前景、公司名气、兴趣、成长空间；对重复性任务、流程配合、表格材料、细节修改缺少心理准备。

### 不应触发场景

用户已经知道真实日常，并接受基础训练期；选择岗位时能说明训练价值，而不是只看兴趣和名气。

### priority 建议

通用卡。常与 H4、H14 同时出现，需要通过“工作日常落差”区分。

### 测试用例说明

需要准备：只知道岗位名/兴趣驱动应触发；能描述岗位一天和新人前三个月任务应保护。

---

## H3｜高消耗增长岗误入风险

**cardId：** `H3_GROWTH_EXHAUSTION_RISK`  
**内部名称：** 高消耗增长岗误入风险  
**用户可见名称：** 高消耗增长岗误入风险

### 风险本质

用户被增长类岗位的成长快、机会多、离业务近、收入弹性吸引，但低估了销售、BD、市场增长、渠道、电商运营等岗位中的目标压力、拒绝密度、外部沟通和结果波动。

### 触发边界

选择增长类岗位，但对强 KPI、高频拒绝、客户/用户沟通、持续追结果和失败复盘准备不足。

### 保护边界

有真实销售、推广、商务、运营转化经验；清楚增长岗压力来源；能用行动和复盘承接结果波动。

### strongMatch

workType = GROWTH。只做准入，不直接触发。

### 主风险信号

R1_adaptation_risk、R2_reality_gap_risk、R4_quit_6_18_month_risk；V1_social_exhaustion、V2_rejection_conflict_exhaustion、V5_feedback_sensitivity、V6_execution_gap；G1 组增长岗位相关答案。

### 辅助信号

选择原因偏成长快、赚钱、机会多、锻炼人；担心被拒绝、压力、做不好；社交消耗和反馈敏感高。

### 不应触发场景

明确知道增长岗的目标压力和拒绝频率，并有真实承压、跟进、复盘经验。

### priority 建议

岗位强匹配卡。只在 GROWTH 准入后判断，避免误伤非增长岗位用户。

### 测试用例说明

需要准备：GROWTH + 拒绝敏感/目标压力/执行波动应触发；有销售推广经历且能复盘应保护。

---

## H4｜第一份工作方向误判风险

**cardId：** `H4_DIRECTION_MISJUDGMENT_RISK`  
**内部名称：** 职业方向误判风险  
**用户可见名称：** 第一份工作方向误判风险

### 风险本质

用户选择第一份工作时，过度依赖专业、热门、父母建议、同学选择、公司光环或模糊兴趣，而没有真正验证岗位日常、能力匹配和长期承受度。

### 触发边界

选择依据外部化、模糊化；对岗位真实日常理解不足；在多个方向之间摇摆但缺少验证标准。

### 保护边界

通过实习、项目、访谈或明确标准验证过方向；能说清岗位日常、训练价值和阶段性试错目标。

### strongMatch

无。不绑定 companyType 或 workType。

### 主风险信号

R3_direction_misjudgment_risk；V8_job_action_misunderstanding、V10_peer_platform_anxiety、V11_education_filter_pressure；choice_reason / main_concern 中的外部化、光环化、模糊化选择信号。

### 辅助信号

父母建议、同学影响、热门方向、专业惯性、平台光环；投递方向分散；怕选错、怕浪费学历。

### 不应触发场景

方向仍在探索，但每个方向都有验证计划和判断标准；不追求一步到位。

### priority 建议

通用方向卡。应与 H2、H13、H16 区分。

### 测试用例说明

需要准备：外部化选择 + 岗位日常不清应触发；有验证标准的探索应保护。

---

## H5｜大组织流程压力风险

**cardId：** `H5_ORG_PROCESS_PRESSURE_RISK`  
**内部名称：** 体制/大组织流程压力风险  
**用户可见名称：** 大组织流程压力风险

### 风险本质

用户被国企、事业单位、大厂、外企、大型集团等组织的稳定、平台、规范和父母认可吸引，但低估了流程成本、层级秩序、汇报要求、跨部门协同和低自主权。

### 触发边界

倾向选择强流程、大组织环境，但对审批、汇报、等待、低自主权、成长节奏慢和隐性协同规则准备不足。

### 保护边界

理解大组织运转方式；能接受流程、汇报、留痕和阶段性低自主权；能在系统内稳定推进事情。

### strongMatch

companyType = SOE / 大组织类选项。第一版可先以 SOE 为准入，后续按 questions.json 真实 option.id 调整。

### 主风险信号

R1_adaptation_risk、R2_reality_gap_risk、R4_quit_6_18_month_risk；V8_job_action_misunderstanding、V10_peer_platform_anxiety、V7_low_initiative；F 组中关于流程、汇报、层级、低自主权的答案。

### 辅助信号

选择原因偏稳定、父母认可、平台名气、制度完善；担心没成长、被边缘化、不适应。

### 不应触发场景

用户明确知道大组织流程长、节奏慢、汇报多，并愿意训练规范化工作能力。

### priority 建议

组织环境强匹配卡。strongMatch 只做准入。

### 测试用例说明

需要准备：SOE/大组织 + 低自主权/流程压力高应触发；能接受流程和留痕推进应保护。

---

## H6｜等安排型行动不足风险

**cardId：** `H6_LOW_INITIATIVE_RISK`  
**内部名称：** 等安排型行动不足风险  
**用户可见名称：** 等安排型行动不足风险

### 风险本质

用户习惯等待明确安排、明确标准和外部提醒，但第一份工作需要主动确认任务、主动同步进展、主动暴露问题和主动争取下一步。

### 触发边界

遇到模糊任务容易等待、不敢问、不主动汇报、不主动推进，习惯完成明确交代事项但缺少职场主动动作。

### 保护边界

虽然谨慎或内向，但能主动确认标准、同步进展、暴露问题，并通过书面或口头方式稳定推进事情。

### strongMatch

无。不绑定 companyType 或 workType。

### 主风险信号

R1_adaptation_risk、R3_direction_misjudgment_risk、R4_quit_6_18_month_risk；V7_low_initiative、V8_job_action_misunderstanding、V6_execution_gap；关于主动确认、主动反馈、主动推进的题目答案。

### 辅助信号

怕问问题显得自己差；求职中只海投等反馈；担心没人带；不知道下一步就停住。

### 不应触发场景

内向但能稳定推进；谨慎但会确认权限边界；知道新人主动性的边界。

### priority 建议

行动方式通用卡。不能把内向误判为低主动。

### 测试用例说明

需要准备：模糊任务等待/不反馈应触发；书面推进能力强应保护。

---

## H7｜想法多、落地弱风险

**cardId：** `H7_EXECUTION_GAP_RISK`  
**内部名称：** 想法多、落地弱风险  
**用户可见名称：** 想法多、落地弱风险

### 风险本质

用户在想法、表达、分析和判断层面较活跃，但执行拆解、过程推进、细节打磨和结果闭环不足，容易出现“理解不差，但交付不稳”。

### 触发边界

有较多想法和职业想象，但任务拆解、执行推进、版本交付、反复修改和结果闭环能力不足。

### 保护边界

已有真实作品、项目或实习交付物；能把想法拆成任务、时间表和可验收成果；能根据反馈持续迭代。

### strongMatch

无。不绑定 companyType 或 workType。CONTENT / PRODUCT_OPS / GROWTH 可作为辅助解释。

### 主风险信号

R1_adaptation_risk、R2_reality_gap_risk、R4_quit_6_18_month_risk、R5_three_year_flexibility_risk；V6_execution_gap、V7_low_initiative、V8_job_action_misunderstanding；关于执行、完成度、复盘和交付闭环的题目答案。

### 辅助信号

兴趣强、想法多、计划多；不喜欢机械细节；求职行动少、复盘少、反馈少。

### 不应触发场景

有想法且能交付，有作品、版本、项目结果和复盘记录。

### priority 建议

行动方式通用卡。必须看到交付闭环弱，不能只因想法多触发。

### 测试用例说明

需要准备：想法多但拖延/交付弱应触发；有作品或项目闭环应保护。

---

## H8｜高社交协作消耗风险

**cardId：** `H8_SOCIAL_COLLABORATION_EXHAUSTION_RISK`  
**内部名称：** 高社交协作消耗风险  
**用户可见名称：** 高社交协作消耗风险

### 风险本质

用户可能具备独立完成任务的能力，但在高频沟通、多方协作、客户/用户接触、跨部门推动、需求变化和人际拉扯中容易被持续消耗。

### 触发边界

对沟通、冲突、催进度、跨部门协作和高频反馈明显消耗，但选择了沟通密度较高岗位。

### 保护边界

虽然内向或不喜欢无效社交，但能通过清晰表达、书面沟通、会议纪要、流程管理稳定推进协作。

### strongMatch

无。不绑定 companyType 或 workType。workType 只作为辅助解释。

### 主风险信号

R1_adaptation_risk、R2_reality_gap_risk、R4_quit_6_18_month_risk；V1_social_exhaustion、V2_rejection_conflict_exhaustion、V5_feedback_sensitivity；关于沟通、协作、冲突、催进度的题目答案。

### 辅助信号

害怕冲突；不擅长催进度；以为非销售岗位就不需要沟通；喜欢独立完成任务。

### 不应触发场景

内向但能结构化协作；不喜欢无效社交但能处理必要沟通；岗位沟通边界清楚。

### priority 建议

心理/协作通用卡。不能把内向误判为高社交消耗。

### 测试用例说明

需要准备：高沟通岗位 + 沟通消耗高应触发；结构化沟通强应保护。

---

## H9｜反馈敏感与自我否定风险

**cardId：** `H9_FEEDBACK_SENSITIVITY_SELF_DOUBT_RISK`  
**内部名称：** 反馈敏感与自我否定风险  
**用户可见名称：** 反馈敏感与自我否定风险

### 风险本质

用户在第一份工作中可能难以区分“任务反馈”和“自我价值评价”，容易在被批评、被否定、被比较或被要求重做后陷入自我怀疑。

### 触发边界

对批评、否定、拒绝和比较高度敏感，反馈后容易长时间内耗、自我否定、不敢继续沟通或行动。

### 保护边界

虽然会受到情绪影响，但能把反馈拆成具体修改动作，主动追问标准，并快速恢复行动。

### strongMatch

无。不绑定 companyType 或 workType。

### 主风险信号

R1_adaptation_risk、R4_quit_6_18_month_risk；V5_feedback_sensitivity、V2_rejection_conflict_exhaustion、V1_social_exhaustion；关于批评承受、失败恢复、是否敢暴露问题的题目答案。

### 辅助信号

怕被批评、怕暴露问题、怕领导觉得自己不行；投递或面试失败后长时间低落。

### 不应触发场景

被批评会难受，但能拆解问题、确认标准、快速行动和迭代。

### priority 建议

心理承受通用卡。语气必须克制，避免二次伤害。

### 测试用例说明

需要准备：反馈后长期内耗应触发；会承接反馈并改版本应保护。

---

## H10｜同辈与平台比较焦虑风险

**cardId：** `H10_PEER_PLATFORM_ANXIETY_RISK`  
**内部名称：** 同辈/平台比较焦虑风险  
**用户可见名称：** 同辈与平台比较焦虑风险

### 风险本质

用户在选择第一份工作时，容易被同学 offer、公司名气、薪资起点、父母认可、社交媒体路径和平台光环影响，把第一份工作变成起点比较。

### 触发边界

明显受同辈比较、平台焦虑、公司光环和外部评价影响，导致职业方向、岗位判断和 offer 选择发生变形。

### 保护边界

能理性参考外部信息，同时清楚判断岗位训练价值、能力资产和阶段性路径。

### strongMatch

无。不绑定 companyType 或 workType。

### 主风险信号

R2_reality_gap_risk、R3_direction_misjudgment_risk、R5_three_year_flexibility_risk；V10_peer_platform_anxiety、V11_education_filter_pressure；choice_reason / main_concern 中关于同辈比较、平台焦虑、父母认可和起点焦虑的答案。

### 辅助信号

同学进大厂、朋友圈晒 offer、父母看重体面、担心输在起点、过度追平台。

### 不应触发场景

参考别人但不被绑架；能区分平台背书和岗位训练价值；知道第一份工作不是终身定价。

### priority 建议

外部比较通用卡。必须看到比较已经干扰判断，而不是单纯追求好平台。

### 测试用例说明

需要准备：平台比较干扰选择应触发；能说明能力资产和阶段路径应保护。

---

## H11｜学历门槛与筛选压力风险

**cardId：** `H11_EDUCATION_FILTER_PRESSURE_RISK`  
**内部名称：** 学历门槛与筛选压力风险  
**用户可见名称：** 学历门槛与筛选压力风险

### 风险本质

用户的学历、学校、专业或履历背景在目标岗位的公开招聘筛选中可能不占优势，如果仍主要依赖海投和标准简历，容易出现能力尚未被理解、简历已经被筛掉的情况。

### 触发边界

背景不占优势、目标岗位竞争强、缺少强实习/项目/作品证明，同时过度依赖公开投递。

### 保护边界

虽然学历或学校普通，但有强项目、强实习、作品、证书、竞赛或明确能力证据，并能通过内推、信息访谈、校友或垂直路径进入机会。

### strongMatch

无。不绑定 companyType 或 workType。主要通过 education、目标公司/岗位竞争度、V11_education_filter_pressure 和求职策略信号触发。

### 主风险信号

R3_direction_misjudgment_risk、R5_three_year_flexibility_risk、R2_reality_gap_risk；V11_education_filter_pressure、V10_peer_platform_anxiety；education / company_type / main_concern / current_status 中关于学历筛选、投递反馈和目标竞争度的答案。

### 辅助信号

目标为大厂、外企、国企、热门岗；投递多反馈少；简历缺少作品、项目、实习、关键词和连接路径。

### 不应触发场景

背景不顶配但证据强、路径正确、目标匹配度高，不应轻易触发。

### priority 建议

求职策略卡。适合承接人才重估逻辑。

### 测试用例说明

需要准备：背景不占优 + 海投无反馈应触发；强项目/内推/垂直路径应保护。

---

## H12｜稳定偏好错配风险

**cardId：** `H12_STABILITY_PREFERENCE_MISMATCH_RISK`  
**内部名称：** 稳定偏好错配风险  
**用户可见名称：** 稳定偏好错配风险

### 风险本质

用户把稳定作为第一份工作的重要目标，但没有拆清楚自己真正需要的是收入稳定、时间稳定、组织稳定、成长路径稳定还是心理安全感。

### 触发边界

稳定诉求强，但稳定类型不清、取舍不清，或所选公司/岗位与自身稳定需求存在明显冲突。

### 保护边界

能清楚定义自己需要哪种稳定，知道稳定的代价，并能接受相应限制和阶段性取舍。

### strongMatch

无。不绑定 companyType 或 workType。

### 主风险信号

R2_reality_gap_risk、R3_direction_misjudgment_risk、R5_three_year_flexibility_risk、R4_quit_6_18_month_risk；V10_peer_platform_anxiety、V11_education_filter_pressure；choice_reason / main_concern 中关于稳定、父母建议、平台安全感和成长冲突的答案。

### 辅助信号

既想稳定又想成长快；既想安全又想自由；说不清想要收入、时间、组织还是心理安全感稳定。

### 不应触发场景

稳定需求清楚、代价接受清楚、有阶段性取舍的人不应触发。

### priority 建议

通用价值取舍卡。不能把“追求稳定”本身当风险。

### 测试用例说明

需要准备：稳定诉求强但取舍冲突应触发；能定义稳定类型和代价应保护。

---

## H13｜专业路径摇摆风险

**cardId：** `H13_MAJOR_PATH_SWING_RISK`  
**内部名称：** 专业路径摇摆风险  
**用户可见名称：** 专业路径摇摆风险

### 风险本质

用户在“继续本专业”和“转向新方向”之间反复摇摆，既担心放弃专业浪费，又没有为新方向建立足够项目、作品、实习或能力证据。

### 触发边界

对本专业岗位缺少真实了解，同时想转向新岗位但缺少证据支撑，在专业惯性、兴趣转向和外部建议之间反复摇摆。

### 保护边界

已经明确专业路径价值，或已用项目、作品、实习、课程、案例证明转向能力，并有阶段性试错计划。

### strongMatch

无。不绑定 companyType 或 workType。

### 主风险信号

R3_direction_misjudgment_risk、R2_reality_gap_risk、R5_three_year_flexibility_risk；V8_job_action_misunderstanding、V11_education_filter_pressure；choice_reason / main_concern 中关于专业浪费、转方向不确定、路径摇摆的答案。

### 辅助信号

本专业和新方向混投；怕专业浪费；想转运营/产品/市场/数据/HR 但缺少证据；家庭或老师期待专业路径。

### 不应触发场景

明确继续或明确转向且有证据；有相邻路径方案，不是长期摇摆。

### priority 建议

路径选择卡。与 H4、H11、H16 区分。

### 测试用例说明

需要准备：专业与转向长期摇摆应触发；转向证据充分或专业路径清楚应保护。

---

## H14｜第一份工作成长速度误判风险

**cardId：** `H14_GROWTH_SPEED_MISJUDGMENT_RISK`  
**内部名称：** 成长速度误判风险  
**用户可见名称：** 第一份工作成长速度误判风险

### 风险本质

用户期待第一份工作快速带来成长、负责感、成就感和被重用，但低估了新人阶段的基础训练周期。

### 触发边界

强烈期待快速成长、快速负责、快速看到成果，但对前 6-12 个月的基础训练、稳定交付和能力沉淀缺少耐心或理解。

### 保护边界

能接受基础训练期，能把成长拆成 30 天、90 天、180 天阶段目标，并关注反馈质量、训练密度和交付能力积累。

### strongMatch

无。不绑定 companyType 或 workType。

### 主风险信号

R2_reality_gap_risk、R3_direction_misjudgment_risk、R5_three_year_flexibility_risk；V10_peer_platform_anxiety、V8_job_action_misunderstanding；main_concern / choice_reason 中的快速成长、平台焦虑、怕浪费时间信号。

### 辅助信号

不想做螺丝钉；怕打杂；期待快速负责、快速成长、快速被重用。

### 不应触发场景

知道前期基础训练，关注训练密度和反馈质量，能区分成长慢和没有成长。

### priority 建议

预期管理卡。常与 H2、H10、H7 同时出现。

### 测试用例说明

需要准备：快速成长期待 + 基础任务接受低应触发；阶段目标清楚应保护。

---

## H15｜低容错岗位压力风险

**cardId：** `H15_LOW_TOLERANCE_ROLE_PRESSURE_RISK`  
**内部名称：** 低容错岗位压力风险  
**用户可见名称：** 低容错岗位压力风险

### 风险本质

用户选择看起来稳定、专业、流程清楚或少社交的岗位，但低估了财务、法务、数据、测试、质量、供应链、工艺、合规等岗位中的细节要求、复核压力、责任追溯和错误成本。

### 触发边界

倾向选择职能、技术、数据、质量、供应链等低容错岗位，但细节管理、复核习惯、错误承受和流程意识不足。

### 保护边界

有细节交付经验；能接受标准化流程、复核机制和责任追溯；能通过清单、复盘和错误记录降低失误。

### strongMatch

第一版不设置 strongMatch。FUNCTION / TECH 只作为辅助信号，避免误伤。

### 主风险信号

R1_adaptation_risk、R2_reality_gap_risk、R4_quit_6_18_month_risk；V5_feedback_sensitivity、V6_execution_gap、V8_job_action_misunderstanding；G4/G5 中关于细节、流程、准确性、错误成本的答案。

### 辅助信号

想稳定、专业、少社交；怕犯错、怕做不好；低估低容错岗位的错误成本。

### 不应触发场景

有复核系统、清单习惯、细节交付记录，且知道低容错岗位压力来源。

### priority 建议

岗位压力类型卡。第一版不粗暴绑定 FUNCTION / TECH。

### 测试用例说明

需要准备：低容错倾向 + 细节/复核弱应触发；有 checklist 和错误管理应保护。

---

## H16｜考研/考公路径未结束风险

**cardId：** `H16_EXAM_PATH_UNFINISHED_RISK`  
**内部名称：** 考研/考公路径未结束风险  
**用户可见名称：** 考研/考公路径未结束风险

### 风险本质

用户在考研、考公与就业之间没有完成优先级决策，表面开始找工作，但内心仍停留在考试路径中，导致求职目标不清、动作强度不足、面试准备不充分。

### 触发边界

考研/考公失败、待定、二战考虑、边找边考或考试结果未放下，同时求职动作弱、目标不清、只是先投着看。

### 保护边界

已经明确放弃考试并系统求职，或已经设定考试与就业优先级、时间线、动作计划和切换条件。

### strongMatch

不使用 companyType / workType。主要依赖 postgraduate_exam、current_status、V12_exam_delay_risk 和求职动作信号。

### 主风险信号

R3_direction_misjudgment_risk、R4_quit_6_18_month_risk、R5_three_year_flexibility_risk；V12_exam_delay_risk、V8_job_action_misunderstanding、V7_low_initiative；postgraduate_exam / current_status / main_concern 中关于考试路径未结束和求职动作弱的答案。

### 辅助信号

边找边看；等待成绩；二战考虑；家庭仍期待考试上岸；把工作当保底动作。

### 不应触发场景

有优先级、有时间线、有退出条件；考试和就业互不拖累。

### priority 建议

路径优先级卡。不能因为考过研或考过公就触发。

### 测试用例说明

需要准备：考试路径未结束 + 求职动作弱应触发；明确就业主路径或考试主路径应保护。

---
