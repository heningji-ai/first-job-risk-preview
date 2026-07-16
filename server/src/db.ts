import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "..", "data");
export const databasePath = process.env.GOAL_FIT_DB_PATH
  ? path.resolve(process.cwd(), process.env.GOAL_FIT_DB_PATH)
  : path.join(dataDir, "orders.db");

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

export const db = new DatabaseSync(databasePath);

db.exec("PRAGMA journal_mode = WAL");

export function runImmediateTransaction<T>(work: () => T): T {
  db.exec("BEGIN IMMEDIATE");

  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // Preserve the original failure.
    }
    throw error;
  }
}

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      outTradeNo TEXT NOT NULL UNIQUE,
      sessionId TEXT NOT NULL,
      status TEXT NOT NULL,
      accessMode TEXT NOT NULL,
      originalAmountCents INTEGER NOT NULL,
      discountAmountCents INTEGER NOT NULL,
      payAmountCents INTEGER NOT NULL,
      couponCode TEXT,
      paymentProvider TEXT NOT NULL,
      paymentMode TEXT NOT NULL,
      wechatPrepayId TEXT,
      wechatCodeUrl TEXT,
      wechatTransactionId TEXT,
      sourceReferralCode TEXT,
      referralVisitId TEXT,
      analyticsVisitorId TEXT,
      analyticsSource TEXT,
      analyticsChannel TEXT,
      analyticsCampaign TEXT,
      analyticsReferralCode TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      paidAt TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_orders_session_status
      ON orders (sessionId, status, updatedAt);

    CREATE INDEX IF NOT EXISTS idx_orders_out_trade_no
      ON orders (outTradeNo);

    CREATE TABLE IF NOT EXISTS wechat_oauth_states (
      state TEXT PRIMARY KEY,
      returnTo TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      expiresAt TEXT NOT NULL,
      usedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS wechat_openid_tokens (
      token TEXT PRIMARY KEY,
      openid TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      expiresAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS goal_fit_referrals (
      id TEXT PRIMARY KEY,
      referralCode TEXT NOT NULL UNIQUE,
      sourceSessionId TEXT NOT NULL UNIQUE,
      sourceVisitorId TEXT,
      createdAt TEXT NOT NULL,
      firstCopiedAt TEXT,
      copyCount INTEGER NOT NULL DEFAULT 0,
      discountGrantedAt TEXT,
      discountUsedOrderId TEXT,
      status TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_goal_fit_referrals_code
      ON goal_fit_referrals (referralCode);

    CREATE INDEX IF NOT EXISTS idx_goal_fit_referrals_source_session
      ON goal_fit_referrals (sourceSessionId);

    CREATE TABLE IF NOT EXISTS goal_fit_referral_visits (
      id TEXT PRIMARY KEY,
      referralId TEXT NOT NULL,
      visitorId TEXT NOT NULL,
      landingPath TEXT NOT NULL,
      firstVisitedAt TEXT NOT NULL,
      startedTestAt TEXT,
      completedTestAt TEXT,
      resultSessionId TEXT,
      orderId TEXT,
      paidAt TEXT,
      FOREIGN KEY (referralId) REFERENCES goal_fit_referrals(id),
      UNIQUE (referralId, visitorId)
    );

    CREATE INDEX IF NOT EXISTS idx_goal_fit_referral_visits_visitor
      ON goal_fit_referral_visits (visitorId);

    CREATE INDEX IF NOT EXISTS idx_goal_fit_referral_visits_result_session
      ON goal_fit_referral_visits (resultSessionId);

    CREATE TABLE IF NOT EXISTS analytics_visitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_id TEXT NOT NULL UNIQUE,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      first_source TEXT NOT NULL,
      first_channel TEXT NOT NULL,
      first_campaign TEXT NOT NULL,
      first_referral_code TEXT,
      first_landing_path TEXT NOT NULL,
      first_user_agent_hash TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS analytics_attributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_id TEXT NOT NULL,
      session_id TEXT,
      source TEXT NOT NULL,
      channel TEXT NOT NULL,
      campaign TEXT NOT NULL,
      referral_code TEXT,
      landing_path TEXT NOT NULL,
      landing_url TEXT,
      referrer TEXT,
      user_agent_hash TEXT,
      ip_hash TEXT,
      is_first_touch INTEGER NOT NULL,
      is_valid INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_analytics_attributions_visitor
      ON analytics_attributions (visitor_id);

    CREATE INDEX IF NOT EXISTS idx_analytics_attributions_session
      ON analytics_attributions (session_id);

    CREATE INDEX IF NOT EXISTS idx_analytics_attributions_channel
      ON analytics_attributions (source, channel, campaign);

    CREATE INDEX IF NOT EXISTS idx_analytics_attributions_referral
      ON analytics_attributions (referral_code);

    CREATE INDEX IF NOT EXISTS idx_analytics_attributions_created
      ON analytics_attributions (created_at);

    CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL UNIQUE,
      visitor_id TEXT NOT NULL,
      session_id TEXT,
      order_id TEXT,
      event_name TEXT NOT NULL,
      event_value REAL,
      source TEXT NOT NULL,
      channel TEXT NOT NULL,
      campaign TEXT NOT NULL,
      referral_code TEXT,
      page_path TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_analytics_events_name_created
      ON analytics_events (event_name, created_at);

    CREATE INDEX IF NOT EXISTS idx_analytics_events_visitor
      ON analytics_events (visitor_id);

    CREATE INDEX IF NOT EXISTS idx_analytics_events_session
      ON analytics_events (session_id);

    CREATE INDEX IF NOT EXISTS idx_analytics_events_order
      ON analytics_events (order_id);

    CREATE INDEX IF NOT EXISTS idx_analytics_events_channel
      ON analytics_events (source, channel, campaign);

    CREATE TABLE IF NOT EXISTS channel_commission_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      channel TEXT NOT NULL,
      campaign TEXT,
      commission_type TEXT NOT NULL,
      commission_value REAL NOT NULL,
      effective_from TEXT NOT NULL,
      effective_to TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_channel_commission_rules_lookup
      ON channel_commission_rules (source, channel, campaign, enabled);

    CREATE TABLE IF NOT EXISTS channel_commission_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL UNIQUE,
      visitor_id TEXT,
      session_id TEXT NOT NULL,
      source TEXT NOT NULL,
      channel TEXT NOT NULL,
      campaign TEXT NOT NULL,
      paid_amount_cents INTEGER NOT NULL,
      commission_type TEXT NOT NULL,
      commission_value REAL NOT NULL,
      commission_amount_cents INTEGER NOT NULL,
      settlement_status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_channel_commission_records_channel
      ON channel_commission_records (source, channel, campaign);
  `);

  const columns = db.prepare("PRAGMA table_info(orders)").all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has("wechatTransactionId")) {
    db.exec("ALTER TABLE orders ADD COLUMN wechatTransactionId TEXT");
  }

  if (!columnNames.has("sourceReferralCode")) {
    db.exec("ALTER TABLE orders ADD COLUMN sourceReferralCode TEXT");
  }

  if (!columnNames.has("referralVisitId")) {
    db.exec("ALTER TABLE orders ADD COLUMN referralVisitId TEXT");
  }

  if (!columnNames.has("analyticsVisitorId")) {
    db.exec("ALTER TABLE orders ADD COLUMN analyticsVisitorId TEXT");
  }

  if (!columnNames.has("analyticsSource")) {
    db.exec("ALTER TABLE orders ADD COLUMN analyticsSource TEXT");
  }

  if (!columnNames.has("analyticsChannel")) {
    db.exec("ALTER TABLE orders ADD COLUMN analyticsChannel TEXT");
  }

  if (!columnNames.has("analyticsCampaign")) {
    db.exec("ALTER TABLE orders ADD COLUMN analyticsCampaign TEXT");
  }

  if (!columnNames.has("analyticsReferralCode")) {
    db.exec("ALTER TABLE orders ADD COLUMN analyticsReferralCode TEXT");
  }
}
