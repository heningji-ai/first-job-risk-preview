import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const audienceType = process.env.AUDIENCE_TYPE ?? "student";
const configDir = path.join(projectRoot, "src", "config", "audiences", audienceType);

const requiredFiles = [
  "questions.json",
  "scoring.json",
  "risk_cards.json",
  "result_copy.json",
  "viral_copy.json",
  "animation_map.json",
  "service_cards.json",
  "labels.json",
  "test_cases.json"
];

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

console.log(`[validate-config] audience_type=${audienceType}`);

if (!fs.existsSync(configDir)) {
  console.error(`[validate-config] ERROR: 配置目录不存在: ${configDir}`);
  process.exit(1);
}

let hasError = false;

for (const fileName of requiredFiles) {
  const filePath = path.join(configDir, fileName);

  if (!fs.existsSync(filePath)) {
    console.error(`[validate-config] ERROR: 缺少配置文件 ${fileName}`);
    hasError = true;
    continue;
  }

  try {
    const content = readJson(filePath);
    const marker = typeof content === "object" && content !== null && "_todo" in content;
    console.log(`[validate-config] OK: ${fileName}${marker ? " (TODO placeholder)" : ""}`);
  } catch (error) {
    console.error(`[validate-config] ERROR: ${fileName} 不是合法 JSON`);
    console.error(error);
    hasError = true;
  }
}

console.log("[validate-config] TODO: 后续补充 question id 唯一性检查。");
console.log("[validate-config] TODO: 后续补充 directR / direct_R* 命名检查。");
console.log("[validate-config] TODO: 后续补充 BASE_FIELDS 引用检查。");
console.log("[validate-config] TODO: 后续补充 risk card primaryRiskSignal 检查。");
console.log("[validate-config] TODO: 后续补充 defaultViralCopy 必填检查。");

if (hasError) {
  process.exit(1);
}
