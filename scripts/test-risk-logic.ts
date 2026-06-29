import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const audienceType = process.env.AUDIENCE_TYPE ?? "student";
const testCasesPath = path.join(
  projectRoot,
  "src",
  "config",
  "audiences",
  audienceType,
  "test_cases.json"
);

console.log(`[test-risk-logic] audience_type=${audienceType}`);

if (!fs.existsSync(testCasesPath)) {
  console.log(`[test-risk-logic] 暂未找到 test_cases.json: ${testCasesPath}`);
  console.log("[test-risk-logic] TODO: 配置测试用例后执行局部答案风险逻辑测试。");
  process.exit(0);
}

const raw = JSON.parse(fs.readFileSync(testCasesPath, "utf8"));
const testCases = Array.isArray(raw) ? raw : raw.testCases;

if (!Array.isArray(testCases) || testCases.length === 0) {
  console.log("[test-risk-logic] test_cases.json 当前没有正式测试用例。");
  console.log("[test-risk-logic] TODO: 后续只对 answers 中出现的 question 计算 actualScores 和 maxScores。");
  console.log("[test-risk-logic] TODO: 后续补充 mustTrigger、riskLevels、viralCopy、fallback 断言。");
  process.exit(0);
}

console.log(`[test-risk-logic] 发现 ${testCases.length} 个测试用例。`);
console.log("[test-risk-logic] TODO: 风险逻辑引擎尚未实现，本阶段不执行完整评分。");
