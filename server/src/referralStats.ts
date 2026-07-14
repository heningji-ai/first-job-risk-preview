import { initializeDatabase, db, databasePath } from "./db.js";

initializeDatabase();

function getCount(sql: string): number {
  const row = db.prepare(sql).get() as { count: number } | undefined;
  return row?.count ?? 0;
}

const referralCount = getCount("SELECT COUNT(*) AS count FROM goal_fit_referrals");
const copyCount = getCount("SELECT COALESCE(SUM(copyCount), 0) AS count FROM goal_fit_referrals");
const discountedSessionCount = getCount(
  "SELECT COUNT(*) AS count FROM goal_fit_referrals WHERE discountGrantedAt IS NOT NULL"
);
const uniqueVisitCount = getCount("SELECT COUNT(*) AS count FROM goal_fit_referral_visits");
const startedTestCount = getCount(
  "SELECT COUNT(*) AS count FROM goal_fit_referral_visits WHERE startedTestAt IS NOT NULL"
);
const completedTestCount = getCount(
  "SELECT COUNT(*) AS count FROM goal_fit_referral_visits WHERE completedTestAt IS NOT NULL"
);
const paidCount = getCount("SELECT COUNT(*) AS count FROM goal_fit_referral_visits WHERE paidAt IS NOT NULL");

function formatRate(numerator: number, denominator: number): string {
  if (denominator === 0) return "0.0%";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

console.log("Goal Fit referral stats");
console.log(`databasePath: ${databasePath}`);
console.log(`专属邀请链接数量: ${referralCount}`);
console.log(`成功复制次数: ${copyCount}`);
console.log(`获得优惠的session数: ${discountedSessionCount}`);
console.log(`独立邀请访问数: ${uniqueVisitCount}`);
console.log(`邀请访问后开始测试数: ${startedTestCount}`);
console.log(`完成测试数: ${completedTestCount}`);
console.log(`付费数: ${paidCount}`);
console.log(`访问到开始测试转化率: ${formatRate(startedTestCount, uniqueVisitCount)}`);
console.log(`开始测试到完成测试转化率: ${formatRate(completedTestCount, startedTestCount)}`);
console.log(`完成测试到付费转化率: ${formatRate(paidCount, completedTestCount)}`);
console.log("统计口径说明：邀请归因是近似归因；仅当 visitorId 与发起邀请者一致时过滤自访问。");
