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
  getAdminAnalyticsEvents,
  getAdminAnalyticsFunnel,
  getAdminAnalyticsSummary,
  getAdminChannels,
  getAdminRecentOrders,
  recordAnalyticsEvents,
  recordAnalyticsVisit,
  recordOrderPaidAnalytics,
  updateAdminChannelProfile
} = await import("./analytics.js");
const { loginAdmin, requireAdmin } = await import("./adminAuth.js");
const { createOrder, updateOrderStatus } = await import("./orders.js");
const {
  getGoalFitPricingDisplay,
  updateGoalFitPricingRule
} = await import("./pricing.js");

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
const adminPageSource = fs.readFileSync(new URL("../../src/pages/AdminDashboardPage.tsx", import.meta.url), "utf8");
assert(indexSource.includes('app.post("/api/admin/channels"'), "admin channel creation route must exist");
assert(indexSource.includes('app.get("/api/admin/analytics/events"'), "admin analytics events route must exist");
assert(indexSource.includes('app.patch("/api/admin/channels/:id"'), "admin channel update route must exist");
assert(indexSource.includes('app.get("/api/admin/pricing"'), "admin pricing read route must exist");
assert(indexSource.includes('app.patch("/api/admin/pricing"'), "admin pricing update route must exist");
assert(indexSource.includes('app.get("/api/pricing/goal-fit-report"'), "public pricing display route must exist");
assert(indexSource.includes("platform: getString(body.platform)"), "analytics visit route must accept optional platform");
assert(indexSource.includes("platform: getString(req.query.platform)"), "admin analytics routes must accept platform filter");
const channelRouteStart = indexSource.indexOf('app.post("/api/admin/channels"');
const channelRouteEnd = indexSource.indexOf('app.get("/api/admin/referrals"', channelRouteStart);
const channelRouteSource = indexSource.slice(channelRouteStart, channelRouteEnd);
assert(channelRouteSource.includes("requireAdmin(req, res)"), "admin channel creation route must require login");
const channelPatchRouteStart = indexSource.indexOf('app.patch("/api/admin/channels/:id"');
const channelPatchRouteEnd = indexSource.indexOf('app.get("/api/admin/referrals"', channelPatchRouteStart);
const channelPatchRouteSource = indexSource.slice(channelPatchRouteStart, channelPatchRouteEnd);
assert(channelPatchRouteSource.includes("requireAdmin(req, res)"), "admin channel update route must require login");
const eventsRouteStart = indexSource.indexOf('app.get("/api/admin/analytics/events"');
const eventsRouteEnd = indexSource.indexOf('app.get("/api/admin/orders"', eventsRouteStart);
const eventsRouteSource = indexSource.slice(eventsRouteStart, eventsRouteEnd);
assert(eventsRouteSource.includes("requireAdmin(req, res)"), "admin events route must require login");
assert(adminPageSource.includes('import("qrcode")'), "admin dashboard must generate QR codes locally with qrcode");
assert(adminPageSource.includes("setSelectedPromoUrl(row.promoUrl)"), "existing channel rows must be selectable for QR generation");
assert(adminPageSource.includes("展开链接和二维码"), "channel rows must expose promotion link and QR expansion");
assert(adminPageSource.includes("async function loadRecentEvents"), "recent events must load independently from core dashboard data");
assert(adminPageSource.includes("最近事件暂时无法加载"), "recent events failure must show a local fallback message");
assert(!adminPageSource.includes("nextEvents, nextChannelProfiles"), "events API failure must not break the core dashboard Promise.all");
assert(adminPageSource.includes("价格设置"), "admin dashboard must expose pricing settings");
assert(adminPageSource.includes("免费试用期间不会创建微信支付订单，收入为 0"), "admin pricing module must explain free-trial revenue behavior");
for (const platform of ["h5", "wechat_miniapp", "douyin_miniapp", "xiaohongshu_miniapp", "unknown"]) {
  assert(adminPageSource.includes(`value: "${platform}"`), `admin dashboard must expose ${platform} filter`);
}

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

const disabledChannel = createAdminChannelProfile(
  {
    displayName: "禁用渠道",
    source: `disabled-${suffix}`,
    channel: "kol-b",
    campaign: "none",
    commissionType: "fixed",
    commissionValue: 100,
    enabled: false
  },
  "https://first-job-risk.jobeyes.com"
);
const enabledChannel = updateAdminChannelProfile(
  disabledChannel.id,
  {
    displayName: disabledChannel.displayName,
    source: disabledChannel.source,
    channel: disabledChannel.channel,
    campaign: disabledChannel.campaign,
    commissionType: disabledChannel.commissionType,
    commissionValue: disabledChannel.commissionValue,
    enabled: true
  },
  "https://first-job-risk.jobeyes.com"
);
assert(enabledChannel.enabled === true, "logged in admin logic must enable disabled channels");
const disabledAgain = updateAdminChannelProfile(
  disabledChannel.id,
  {
    enabled: false
  },
  "https://first-job-risk.jobeyes.com"
);
assert(disabledAgain.enabled === false, "logged in admin logic must disable enabled channels");
const renamedChannel = updateAdminChannelProfile(
  disabledChannel.id,
  {
    displayName: "已改名渠道",
    commissionType: "percent",
    commissionValue: 12.5,
    enabled: true
  },
  "https://first-job-risk.jobeyes.com"
);
assert(renamedChannel.displayName === "已改名渠道", "channel display name must be editable");
const updatedRule = db
  .prepare(
    "SELECT commission_type, commission_value, enabled FROM channel_commission_rules WHERE source = @source AND channel = @channel AND campaign = @campaign ORDER BY id DESC LIMIT 1"
  )
  .get({
    source: renamedChannel.source,
    channel: renamedChannel.channel,
    campaign: renamedChannel.campaign
  }) as { commission_type: string; commission_value: number; enabled: number } | undefined;
assert(updatedRule?.commission_type === "percent" && updatedRule.commission_value === 12.5 && updatedRule.enabled === 1, "channel updates must sync commission rules");

const identityEditable = updateAdminChannelProfile(
  disabledChannel.id,
  {
    source: `edited-${suffix}`,
    channel: "kol-edited",
    campaign: "campaign-edited"
  },
  "https://first-job-risk.jobeyes.com"
);
assert(identityEditable.source === `edited-${suffix}` && identityEditable.canEditIdentity === true, "channels without history must allow identity edits");

recordAnalyticsVisit({
  visitorId: `visitor-locked-${suffix}`,
  source: identityEditable.source,
  channel: identityEditable.channel,
  campaign: identityEditable.campaign,
  landingPath: "/goal-fit-preview"
});
const lockedChannel = getAdminChannels("https://first-job-risk.jobeyes.com").find((row) => row.id === identityEditable.id);
assert(lockedChannel?.hasData === true && lockedChannel.canEditIdentity === false, "channels with history must return canEditIdentity=false");
let identityLocked = false;
try {
  updateAdminChannelProfile(
    identityEditable.id,
    {
      source: `locked-edit-${suffix}`
    },
    "https://first-job-risk.jobeyes.com"
  );
} catch {
  identityLocked = true;
}
assert(identityLocked, "channels with history must reject source/channel/campaign edits");

const duplicatedChannel = createAdminChannelProfile(
  {
    displayName: `${lockedChannel?.displayName ?? "渠道"} 副本`,
    source: lockedChannel?.source ?? `dup-${suffix}`,
    channel: `${lockedChannel?.channel ?? "kol"}_copy`,
    campaign: `${lockedChannel?.campaign ?? "none"}_copy`,
    commissionType: lockedChannel?.commissionType ?? "fixed",
    commissionValue: lockedChannel?.commissionValue ?? 0,
    enabled: lockedChannel?.enabled ?? true
  },
  "https://first-job-risk.jobeyes.com"
);
assert(duplicatedChannel.promoUrl.includes("_copy"), "duplicated channels must generate a distinct promotion link");
const channelAttributedOrder = createOrder({
  sessionId: `session-channel-price-${suffix}`,
  accessMode: "direct",
  couponCode: null,
  paymentMode: "native",
  analyticsVisitorId: `visitor-channel-price-${suffix}`,
  analyticsSource: duplicatedChannel.source,
  analyticsChannel: duplicatedChannel.channel,
  analyticsCampaign: duplicatedChannel.campaign,
  analyticsReferralCode: null,
  sourceReferralCode: null,
  referralVisitId: null
});
assert(
  channelAttributedOrder.originalAmountCents === 1990 &&
    channelAttributedOrder.discountAmountCents === 0 &&
    channelAttributedOrder.payAmountCents === 1990,
  "source/channel/campaign must not affect order amount or discount eligibility"
);

const repeatSource = `repeat-${suffix}`;
const repeatVisitor = `visitor-repeat-${suffix}`;
recordAnalyticsVisit({
  visitorId: repeatVisitor,
  source: repeatSource,
  channel: "organic",
  campaign: "none",
  landingPath: "/goal-fit-preview"
});
for (let index = 0; index < 3; index += 1) {
  recordAnalyticsEvents([
    {
      eventId: `test_start:${suffix}:${index}`,
      visitorId: repeatVisitor,
      eventName: "test_start",
      source: repeatSource,
      channel: "organic",
      campaign: "none",
      pagePath: "/test-goal-fit-preview"
    },
    {
      eventId: `test_complete:${suffix}:${index}`,
      visitorId: repeatVisitor,
      eventName: "test_complete",
      source: repeatSource,
      channel: "organic",
      campaign: "none",
      pagePath: "/test-goal-fit-preview"
    },
    {
      eventId: `free_result_view:${suffix}:${index}`,
      visitorId: repeatVisitor,
      eventName: "free_result_view",
      source: repeatSource,
      channel: "organic",
      campaign: "none",
      pagePath: "/result-goal-fit-free-preview"
    }
  ]);
}
const repeatSummary = getAdminAnalyticsSummary({ range: "all", source: repeatSource });
assert(repeatSummary.visits === 1, "same visitor must be counted as one independent visitor");
assert(repeatSummary.testStarts === 3, "repeated test_start events must be counted as behavior occurrences");
assert(repeatSummary.testCompletes === 3, "repeated test_complete events must be counted as behavior occurrences");
assert(repeatSummary.freeResults === 3, "repeated free_result_view events must be counted as behavior occurrences");

const noPaySource = `nopay-${suffix}`;
recordAnalyticsEvents([
  {
    eventId: `unlock_page_view:${suffix}`,
    visitorId: `visitor-nopay-${suffix}`,
    eventName: "unlock_page_view",
    source: noPaySource,
    channel: "organic",
    campaign: "none",
    pagePath: "/goal-fit-unlock-preview"
  },
  {
    eventId: `full_report_view:${suffix}`,
    visitorId: `visitor-nopay-${suffix}`,
    sessionId: `session-nopay-${suffix}`,
    eventName: "full_report_view",
    source: noPaySource,
    channel: "organic",
    campaign: "none",
    pagePath: "/result-goal-fit-preview"
  }
]);
const noPaySummary = getAdminAnalyticsSummary({ range: "all", source: noPaySource });
assert(noPaySummary.unlockPageViews === 1, "unlock_page_view must be counted separately");
assert(noPaySummary.fullReportViews === 1, "full_report_view must be counted separately");
assert(noPaySummary.paidOrders === 0, "viewing report events must not be counted as paid orders");
const reportEvents = getAdminAnalyticsEvents({ range: "all", source: noPaySource, eventName: "full_report_view" }) as Array<{ eventName: string; sessionId: string | null }>;
assert(reportEvents.length === 1 && reportEvents[0]?.eventName === "full_report_view", "full_report_view must be queryable through admin events");
const sevenDayEvents = getAdminAnalyticsEvents({ range: "7d" }) as Array<{ eventName: string }>;
assert(Array.isArray(sevenDayEvents), "admin events must support range=7d");
const sevenDayReportEvents = getAdminAnalyticsEvents({ range: "7d", eventName: "full_report_view" }) as Array<{ eventName: string }>;
assert(Array.isArray(sevenDayReportEvents), "admin events must support range=7d with full_report_view eventName");
const sevenDayCompleteEvents = getAdminAnalyticsEvents({ range: "7d", eventName: "test_complete" }) as Array<{ eventName: string }>;
assert(Array.isArray(sevenDayCompleteEvents), "admin events must support range=7d with test_complete eventName");
const channelFilteredEvents = getAdminAnalyticsEvents({
  range: "7d",
  source: noPaySource,
  channel: "organic",
  campaign: "none"
}) as Array<{ source: string; channel: string; campaign: string }>;
assert(Array.isArray(channelFilteredEvents), "admin events must support source/channel/campaign filters");

const platformSource = `platform-${suffix}`;
const platformVisitor = `visitor-platform-${suffix}`;
recordAnalyticsVisit({
  visitorId: platformVisitor,
  platform: "wechat_miniapp",
  source: platformSource,
  channel: "organic",
  campaign: "none",
  landingPath: "/pages/index/index"
});
recordAnalyticsEvents([
  {
    eventId: `platform-wechat:${suffix}`,
    visitorId: platformVisitor,
    platform: "wechat_miniapp",
    eventName: "test_start",
    source: platformSource,
    channel: "organic",
    campaign: "none"
  },
  {
    eventId: `platform-h5:${suffix}`,
    visitorId: platformVisitor,
    eventName: "test_start",
    source: platformSource,
    channel: "organic",
    campaign: "none"
  }
]);
const wechatPlatformSummary = getAdminAnalyticsSummary({ range: "all", platform: "wechat_miniapp", source: platformSource });
assert(wechatPlatformSummary.visits === 1, "platform summary filter must include matching visits");
assert(wechatPlatformSummary.testStarts === 1, "platform summary filter must include only matching events");
const wechatPlatformEvents = getAdminAnalyticsEvents({ range: "all", platform: "wechat_miniapp", source: platformSource }) as Array<{ platform: string }>;
assert(wechatPlatformEvents.length === 1 && wechatPlatformEvents[0]?.platform === "wechat_miniapp", "admin event platform filter must return matching rows with platform");
const platformOrder = createOrder({
  sessionId: `session-platform-${suffix}`,
  accessMode: "direct",
  couponCode: null,
  paymentMode: "native",
  analyticsVisitorId: platformVisitor,
  analyticsSource: platformSource,
  analyticsChannel: "organic",
  analyticsCampaign: "none",
  analyticsReferralCode: null
});
updateOrderStatus(platformOrder.id, "paid");
const platformPaidRecord = db.prepare("SELECT * FROM orders WHERE id = ?").get(platformOrder.id) as Parameters<typeof recordOrderPaidAnalytics>[0];
recordOrderPaidAnalytics(platformPaidRecord);
const wechatPaidSummary = getAdminAnalyticsSummary({ range: "all", platform: "wechat_miniapp", source: platformSource });
assert(wechatPaidSummary.paidOrders === 1 && wechatPaidSummary.revenueCents === 1990, "platform filter must preserve paid-only positive revenue metrics");
const wechatPlatformChannels = getAdminAnalyticsChannels({ range: "all", platform: "wechat_miniapp", source: platformSource }) as Array<{ platform: string; paidOrders: number }>;
assert(wechatPlatformChannels.length === 1 && wechatPlatformChannels[0]?.platform === "wechat_miniapp" && wechatPlatformChannels[0].paidOrders === 1, "channel summary must group and filter by platform");
const wechatPlatformOrders = getAdminRecentOrders({ range: "all", platform: "wechat_miniapp", source: platformSource }) as Array<{ id: string; platform: string }>;
assert(wechatPlatformOrders.some((order) => order.id === platformOrder.id && order.platform === "wechat_miniapp"), "admin order list must return and filter derived platform");
const h5PaidSummary = getAdminAnalyticsSummary({ range: "all", platform: "h5", source: platformSource });
assert(h5PaidSummary.paidOrders === 0 && h5PaidSummary.revenueCents === 0, "platform filter must exclude non-matching paid orders");

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
assert(pendingSummary.pendingOrders === 1, "pending orders must be counted as pending orders");
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
const paidRecord = db.prepare("SELECT * FROM orders WHERE id = ?").get(paidOrder.id) as Parameters<typeof recordOrderPaidAnalytics>[0];
recordOrderPaidAnalytics(paidRecord);
recordOrderPaidAnalytics(paidRecord);
const paidSummary = getAdminAnalyticsSummary({ range: "all", source: paidSource });
assert(paidSummary.paidOrders === 1, "paid orders must be counted as paid");
assert(paidSummary.revenueCents > 0, "paid orders must be counted as revenue");
const paidEvents = getAdminAnalyticsEvents({ range: "all", source: paidSource, eventName: "payment_paid" }) as Array<{ orderId: string | null }>;
assert(paidEvents.filter((event) => event.orderId === paidOrder.id).length === 1, "payment_paid must be idempotent by orderId");

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
assert(Array.isArray(funnel) && funnel.length === 9, "admin funnel must return all required steps");
assert("previousConversionRate" in funnel[1] && "visitConversionRate" in funnel[1], "funnel steps must include conversion rates");

const defaultPricing = getGoalFitPricingDisplay();
assert(
  defaultPricing.basePriceCents === 1990 &&
    defaultPricing.salePriceCents === 1990 &&
    defaultPricing.inviteDiscountCents === 1000,
  "default pricing must be 19.9 with 10 yuan invite discount"
);

updateGoalFitPricingRule({
  basePriceCents: 1990,
  salePriceCents: 1590,
  inviteDiscountCents: 700,
  freeTrialEnabled: false,
  freeTrialStartAt: null,
  freeTrialEndAt: null,
  allowInviteDiscountStack: true
});
const saleOrder = createOrder({
  sessionId: `session-sale-${suffix}`,
  accessMode: "direct",
  couponCode: null,
  paymentMode: "native",
  analyticsVisitorId: `visitor-sale-${suffix}`,
  analyticsSource: `pricing-sale-${suffix}`,
  analyticsChannel: "organic",
  analyticsCampaign: "none",
  analyticsReferralCode: null,
  sourceReferralCode: null,
  referralVisitId: null
});
assert(saleOrder.payAmountCents === 1590 && saleOrder.salePriceCents === 1590, "new orders must use updated sale price");
assert(paidOrder.payAmountCents === 1990, "pricing changes must not mutate historical orders");

const couponOrder = createOrder({
  sessionId: `session-config-coupon-${suffix}`,
  accessMode: "share_coupon",
  couponCode: "share_card",
  paymentMode: "native",
  analyticsVisitorId: `visitor-config-coupon-${suffix}`,
  analyticsSource: `pricing-coupon-${suffix}`,
  analyticsChannel: "organic",
  analyticsCampaign: "none",
  analyticsReferralCode: null,
  sourceReferralCode: null,
  referralVisitId: null
});
assert(
  couponOrder.discountAmountCents === 1100 && couponOrder.payAmountCents === 890,
  "invite discount must be calculated from pricing config, not hardcoded 10 yuan"
);

updateGoalFitPricingRule({
  freeTrialEnabled: true,
  freeTrialStartAt: "2020-01-01T00:00:00.000Z",
  freeTrialEndAt: "2099-01-01T00:00:00.000Z"
});
const freeTrialSource = `free-trial-${suffix}`;
const freeTrialOrder = createOrder({
  sessionId: `session-free-trial-${suffix}`,
  accessMode: "direct",
  couponCode: null,
  paymentMode: "native",
  analyticsVisitorId: `visitor-free-trial-${suffix}`,
  analyticsSource: freeTrialSource,
  analyticsChannel: "organic",
  analyticsCampaign: "none",
  analyticsReferralCode: null,
  sourceReferralCode: null,
  referralVisitId: null
});
assert(
  freeTrialOrder.payAmountCents === 0 &&
    freeTrialOrder.status === "paid" &&
    freeTrialOrder.paymentProvider === "free_trial" &&
    freeTrialOrder.pricingMode === "free_trial",
  "active free trial must create a paid zero-yuan unlock order without WeChat payment"
);
const freeTrialSummary = getAdminAnalyticsSummary({ range: "all", source: freeTrialSource });
assert(freeTrialSummary.freeUnlockOrders === 1, "free trial unlocks must be counted separately");
assert(freeTrialSummary.paidOrders === 0, "free trial unlocks must not count as paid orders");
assert(freeTrialSummary.revenueCents === 0, "free trial unlocks must not count as revenue");

updateGoalFitPricingRule({
  basePriceCents: 1990,
  salePriceCents: 1990,
  inviteDiscountCents: 1000,
  freeTrialEnabled: false,
  freeTrialStartAt: null,
  freeTrialEndAt: null,
  allowInviteDiscountStack: true
});
const restoredOrder = createOrder({
  sessionId: `session-restored-${suffix}`,
  accessMode: "direct",
  couponCode: null,
  paymentMode: "native",
  analyticsVisitorId: `visitor-restored-${suffix}`,
  analyticsSource: `pricing-restored-${suffix}`,
  analyticsChannel: "organic",
  analyticsCampaign: "none",
  analyticsReferralCode: null,
  sourceReferralCode: null,
  referralVisitId: null
});
assert(restoredOrder.payAmountCents === 1990, "closing free trial must restore normal pricing for new orders");

console.log("Goal Fit admin analytics tests passed.");
console.log(`databasePath: ${databasePath}`);
