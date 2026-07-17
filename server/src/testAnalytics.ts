process.env.GOAL_FIT_DB_PATH = "data/analytics-test.db";
process.env.NODE_ENV = "development";
process.env.PAYMENT_MODE = "mock";

const { DatabaseSync } = await import("node:sqlite");
const { initializeDatabase, migrateAnalyticsPlatformColumns, db, databasePath } = await import("./db.js");
const {
  getAdminAnalyticsSummary,
  getAttributionForOrder,
  recordAnalyticsEvents,
  recordAnalyticsVisit,
  recordOrderPaidAnalytics
} = await import("./analytics.js");
const { createOrReuseOrder, updateOrderStatus } = await import("./orders.js");

initializeDatabase();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function count(sql: string, params: Record<string, string | number | null> = {}): number {
  const row = db.prepare(sql).get(params) as { count: number } | undefined;
  return row?.count ?? 0;
}

const runId = `analytics_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const visitorId = `${runId}_visitor`;
const sessionId = `${runId}_session`;

const legacyDb = new DatabaseSync(`data/analytics-platform-migration-${Date.now()}.db`);
legacyDb.exec(`
  CREATE TABLE analytics_visitors (id INTEGER PRIMARY KEY, visitor_id TEXT);
  CREATE TABLE analytics_attributions (id INTEGER PRIMARY KEY, visitor_id TEXT);
  CREATE TABLE analytics_events (id INTEGER PRIMARY KEY, event_id TEXT);
  INSERT INTO analytics_visitors (visitor_id) VALUES ('legacy-visitor');
  INSERT INTO analytics_attributions (visitor_id) VALUES ('legacy-visitor');
  INSERT INTO analytics_events (event_id) VALUES ('legacy-event');
`);
migrateAnalyticsPlatformColumns(legacyDb);
migrateAnalyticsPlatformColumns(legacyDb);
for (const tableName of ["analytics_visitors", "analytics_attributions", "analytics_events"]) {
  const row = legacyDb.prepare(`SELECT platform FROM ${tableName} LIMIT 1`).get() as { platform: string };
  assert(row.platform === "h5", `${tableName} historical rows must migrate to h5`);
}
legacyDb.close();

recordAnalyticsVisit({
  visitorId: `${runId}_legacy_h5_visitor`,
  landingPath: "/legacy"
});
recordAnalyticsVisit({
  visitorId: `${runId}_wechat_visitor`,
  platform: "wechat_miniapp",
  landingPath: "/wechat"
});
recordAnalyticsVisit({
  visitorId: `${runId}_invalid_platform_visitor`,
  platform: "invalid-platform",
  landingPath: "/invalid"
});
assert(
  count("SELECT COUNT(*) AS count FROM analytics_attributions WHERE visitor_id = @visitorId AND platform = 'h5'", { visitorId: `${runId}_legacy_h5_visitor` }) === 1,
  "visit without platform must default to h5"
);
assert(
  count("SELECT COUNT(*) AS count FROM analytics_attributions WHERE visitor_id = @visitorId AND platform = 'wechat_miniapp'", { visitorId: `${runId}_wechat_visitor` }) === 1,
  "wechat_miniapp visit platform must be preserved"
);
assert(
  count("SELECT COUNT(*) AS count FROM analytics_attributions WHERE visitor_id = @visitorId AND platform = 'unknown'", { visitorId: `${runId}_invalid_platform_visitor` }) === 1,
  "invalid visit platform must normalize to unknown"
);

recordAnalyticsEvents([
  {
    eventId: `${runId}_legacy_h5_event`,
    visitorId: `${runId}_legacy_h5_visitor`,
    eventName: "legacy_event"
  },
  {
    eventId: `${runId}_douyin_event`,
    visitorId: `${runId}_legacy_h5_visitor`,
    eventName: "douyin_event",
    platform: "douyin_miniapp"
  }
]);
assert(
  count("SELECT COUNT(*) AS count FROM analytics_events WHERE event_id = @eventId AND platform = 'h5'", { eventId: `${runId}_legacy_h5_event` }) === 1,
  "event without platform must default to h5"
);
assert(
  count("SELECT COUNT(*) AS count FROM analytics_events WHERE event_id = @eventId AND platform = 'douyin_miniapp'", { eventId: `${runId}_douyin_event` }) === 1,
  "douyin_miniapp event platform must be preserved"
);

recordAnalyticsVisit({
  visitorId,
  sessionId,
  source: "xhs",
  channel: "kol_a",
  campaign: "summer_01",
  referralCode: "ref_a",
  landingPath: "/goal-fit-preview",
  landingUrl: "https://first-job-risk.jobeyes.com/goal-fit-preview?source=xhs",
  referrer: "https://example.com"
});

recordAnalyticsVisit({
  visitorId,
  sessionId,
  source: "douyin",
  channel: "kol_b",
  campaign: "later",
  landingPath: "/goal-fit-preview"
});

const attribution = getAttributionForOrder({ visitorId, sessionId });
assert(attribution.source === "xhs", "first-touch source must not be overwritten by later visits");
assert(attribution.channel === "kol_a", "first-touch channel must not be overwritten by later visits");
assert(attribution.campaign === "summer_01", "first-touch campaign must not be overwritten by later visits");

const inserted = recordAnalyticsEvents([
  {
    eventId: `${runId}_event_test_complete`,
    visitorId,
    sessionId,
    eventName: "test_complete",
    pagePath: "/test-goal-fit-preview"
  },
  {
    eventId: `${runId}_event_test_complete`,
    visitorId,
    sessionId,
    eventName: "test_complete",
    pagePath: "/test-goal-fit-preview"
  }
]);
assert(inserted.inserted === 1, "duplicate eventId must only insert once");
assert(
  count("SELECT COUNT(*) AS count FROM analytics_events WHERE event_id = @eventId", {
    eventId: `${runId}_event_test_complete`
  }) === 1,
  "analytics_events must be idempotent by event_id"
);

const order = createOrReuseOrder({
  sessionId,
  accessMode: "direct",
  couponCode: null,
  paymentMode: "mock",
  analyticsVisitorId: attribution.visitorId,
  analyticsSource: attribution.source,
  analyticsChannel: attribution.channel,
  analyticsCampaign: attribution.campaign,
  analyticsReferralCode: attribution.referralCode
});
assert(order.payAmountCents === 1990, "analytics attribution must not affect order price");
assert(order.analyticsSource === "xhs", "order must store analytics source for reporting");

db.prepare(
  `
    INSERT INTO channel_commission_rules (
      source,
      channel,
      campaign,
      commission_type,
      commission_value,
      effective_from,
      effective_to,
      enabled,
      created_at,
      updated_at
    ) VALUES (
      'xhs',
      'kol_a',
      'summer_01',
      'fixed',
      500,
      '2020-01-01T00:00:00.000Z',
      NULL,
      1,
      '2020-01-01T00:00:00.000Z',
      '2020-01-01T00:00:00.000Z'
    )
  `
).run();

const paidOrder = updateOrderStatus(order.id, "paid");
assert(paidOrder?.status === "paid", "test order must be paid before paid analytics");
recordOrderPaidAnalytics(paidOrder);
recordOrderPaidAnalytics(paidOrder);

assert(
  count("SELECT COUNT(*) AS count FROM analytics_events WHERE event_id = @eventId", {
    eventId: `payment_paid:${order.id}`
  }) === 1,
  "payment_paid event must be idempotent"
);
assert(
  count("SELECT COUNT(*) AS count FROM channel_commission_records WHERE order_id = @orderId", {
    orderId: order.id
  }) === 1,
  "commission record must be idempotent by order_id"
);

const summary = getAdminAnalyticsSummary({ source: "xhs", channel: "kol_a", campaign: "summer_01" });
assert(summary.paidOrders >= 1, "admin summary must include paid orders by channel");
assert(summary.revenueCents >= 1990, "admin summary must include channel revenue");
assert(summary.commissionCents >= 500, "admin summary must include estimated commission");

console.log("Goal Fit analytics tests passed.");
console.log(`databasePath: ${databasePath}`);
