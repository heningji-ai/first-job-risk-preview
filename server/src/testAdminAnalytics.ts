process.env.GOAL_FIT_DB_PATH = `data/admin-analytics-test-${Date.now()}.db`;
process.env.NODE_ENV = "production";
process.env.PAYMENT_MODE = "native";
process.env.PUBLIC_APP_URL = "https://first-job-risk.jobeyes.com";
process.env.ADMIN_USERNAME = "admin_test";
process.env.ADMIN_PASSWORD = "password_test";
process.env.ADMIN_SESSION_SECRET = "test_secret_that_is_long_enough";

const fs = await import("node:fs");
const { initializeDatabase, databasePath, db } = await import("./db.js");
const {
  createAdminChannelProfile,
  getAdminAnalyticsChannels,
  getAdminAnalyticsFunnel,
  getAdminAnalyticsSummary,
  getAdminChannels,
  getAdminRecentOrders
} = await import("./analytics.js");
const { loginAdmin, requireAdmin } = await import("./adminAuth.js");
const { createOrder, updateOrderStatus } = await import("./orders.js");

initializeDatabase();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function createMockResponse() {
  const state = {
    statusCode: 200,
    jsonBody: null as unknown,
    cookieOptions: null as Record<string, unknown> | null
  };

  return {
    state,
    res: {
      status(code: number) {
        state.statusCode = code;
        return this;
      },
      json(body: unknown) {
        state.jsonBody = body;
        return this;
      },
      cookie(_name: string, _value: string, options: Record<string, unknown>) {
        state.cookieOptions = options;
        return this;
      },
      clearCookie(_name: string, options: Record<string, unknown>) {
        state.cookieOptions = options;
        return this;
      }
    }
  };
}

const unauthorized = createMockResponse();
const allowed = requireAdmin({ headers: {} } as never, unauthorized.res as never);
assert(!allowed, "unauthenticated admin API access must be rejected");
assert(unauthorized.state.statusCode === 401, "unauthenticated admin API access must return 401");

const indexSource = fs.readFileSync(new URL("./index.ts", import.meta.url), "utf8");
assert(indexSource.includes('app.post("/api/admin/channels"'), "admin channel creation route must exist");
const channelRouteStart = indexSource.indexOf('app.post("/api/admin/channels"');
const channelRouteEnd = indexSource.indexOf('app.get("/api/admin/referrals"', channelRouteStart);
const channelRouteSource = indexSource.slice(channelRouteStart, channelRouteEnd);
assert(channelRouteSource.includes("requireAdmin(req, res)"), "admin channel creation route must require login");

const login = createMockResponse();
loginAdmin({ headers: {} } as never, login.res as never, "admin_test", "password_test");
assert(login.state.statusCode === 200, "valid admin login must succeed");
assert(login.state.cookieOptions?.httpOnly === true, "admin cookie must be httpOnly");
assert(login.state.cookieOptions?.sameSite === "lax", "admin cookie must use sameSite=lax");
assert(login.state.cookieOptions?.secure === true, "admin cookie must be secure in production");

const suffix = Date.now().toString(36);
const channelProfile = createAdminChannelProfile(
  {
    displayName: "测试小红书渠道",
    source: `xhs-${suffix}`,
    channel: "kol-a",
    campaign: "summer",
    commissionType: "fixed",
    commissionValue: 300,
    enabled: true
  },
  "https://first-job-risk.jobeyes.com"
);
assert(channelProfile.promoUrl === `https://first-job-risk.jobeyes.com/goal-fit-preview?source=xhs-${suffix}&channel=kol-a&campaign=summer`, "channel profile must generate official promotion link");
assert(!channelProfile.promoUrl.includes("localhost") && !channelProfile.promoUrl.includes("vercel"), "promotion link must not use local or Vercel domains");
const channelProfiles = getAdminChannels("https://first-job-risk.jobeyes.com");
assert(channelProfiles.some((row) => row.id === channelProfile.id), "created channel profile must be returned in list");

const pendingSource = `pending-${suffix}`;
createOrder({
  sessionId: `session-pending-${suffix}`,
  accessMode: "direct",
  couponCode: null,
  paymentMode: "native",
  analyticsVisitorId: `visitor-pending-${suffix}`,
  analyticsSource: pendingSource,
  analyticsChannel: "organic",
  analyticsCampaign: "none",
  analyticsReferralCode: null,
  sourceReferralCode: null,
  referralVisitId: null
});
const pendingSummary = getAdminAnalyticsSummary({ range: "all", source: pendingSource });
assert(pendingSummary.paidOrders === 0, "pending orders must not be counted as paid");
assert(pendingSummary.revenueCents === 0, "pending orders must not be counted as revenue");

const paidSource = `paid-${suffix}`;
const paidOrder = createOrder({
  sessionId: `session-paid-${suffix}`,
  accessMode: "direct",
  couponCode: null,
  paymentMode: "native",
  analyticsVisitorId: `visitor-paid-${suffix}`,
  analyticsSource: paidSource,
  analyticsChannel: "organic",
  analyticsCampaign: "none",
  analyticsReferralCode: null,
  sourceReferralCode: null,
  referralVisitId: null
});
updateOrderStatus(paidOrder.id, "paid");
const paidSummary = getAdminAnalyticsSummary({ range: "all", source: paidSource });
assert(paidSummary.paidOrders === 1, "paid orders must be counted as paid");
assert(paidSummary.revenueCents > 0, "paid orders must be counted as revenue");

const oldOrder = createOrder({
  sessionId: `session-old-${suffix}`,
  accessMode: "direct",
  couponCode: null,
  paymentMode: "native",
  analyticsVisitorId: `visitor-old-${suffix}`,
  analyticsSource: paidSource,
  analyticsChannel: "organic",
  analyticsCampaign: "none",
  analyticsReferralCode: null,
  sourceReferralCode: null,
  referralVisitId: null
});
db.prepare("UPDATE orders SET createdAt = @createdAt, updatedAt = @createdAt WHERE id = @id").run({
  id: oldOrder.id,
  createdAt: "2020-01-01T00:00:00.000Z"
});
const recentToday = getAdminRecentOrders({ range: "today", source: paidSource }) as Array<{ id: string }>;
assert(recentToday.some((order) => order.id === paidOrder.id), "recent orders must include current orders for today range");
assert(!recentToday.some((order) => order.id === oldOrder.id), "recent orders must honor time filters");
const recentAll = getAdminRecentOrders({ range: "all", source: paidSource }) as Array<{ id: string }>;
assert(recentAll.some((order) => order.id === oldOrder.id), "all range must not limit start time");

for (const range of ["today", "yesterday", "7d", "30d", "all", "custom"] as const) {
  const summary = getAdminAnalyticsSummary({ range, source: paidSource });
  assert(typeof summary.paidOrders === "number", `summary must support ${range} range`);
}
const customSummary = getAdminAnalyticsSummary({ range: "custom", from: "2020-01-01T00:00:00.000Z", to: "2099-01-01T00:00:00.000Z", source: paidSource });
assert(customSummary.paidOrders === 1, "custom range must include matching paid order");

const directOrder = createOrder({
  sessionId: `session-direct-${suffix}`,
  accessMode: "direct",
  couponCode: null,
  paymentMode: "native",
  analyticsVisitorId: `visitor-direct-${suffix}`,
  analyticsSource: "direct",
  analyticsChannel: "organic",
  analyticsCampaign: "none",
  analyticsReferralCode: null,
  sourceReferralCode: null,
  referralVisitId: null
});
updateOrderStatus(directOrder.id, "paid");
const directChannels = getAdminAnalyticsChannels({ range: "all" }) as Array<{ source: string; channel: string; campaign: string; paidOrders: number }>;
assert(directChannels.some((row) => row.source === "direct" && row.channel === "organic" && row.campaign === "none"), "direct/organic/none must remain visible in channel grouping");

const funnel = getAdminAnalyticsFunnel({ range: "all" });
assert(Array.isArray(funnel) && funnel.length === 8, "admin funnel must return all required steps");
assert("previousConversionRate" in funnel[1] && "visitConversionRate" in funnel[1], "funnel steps must include conversion rates");

console.log("Goal Fit admin analytics tests passed.");
console.log(`databasePath: ${databasePath}`);
