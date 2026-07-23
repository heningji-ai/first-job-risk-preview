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

export function configureDatabaseConnection(connection: DatabaseSync, enableWal = false, busyTimeoutMs = 1000): DatabaseSync {
  if (enableWal) connection.exec("PRAGMA journal_mode = WAL");
  connection.exec("PRAGMA foreign_keys = ON");
  connection.exec(`PRAGMA busy_timeout = ${busyTimeoutMs}`);
  return connection;
}

export function openConfiguredDatabaseConnection(
  filePath: string,
  enableWal = false,
  options?: { busyTimeoutMs?: number }
): DatabaseSync {
  const busyTimeoutMs = options?.busyTimeoutMs ?? 1000;
  return configureDatabaseConnection(new DatabaseSync(filePath, { timeout: busyTimeoutMs }), enableWal, busyTimeoutMs);
}

export const db = openConfiguredDatabaseConnection(databasePath, true);

export const GOAL_FIT_ORDER_BUSY_RETRY_DELAYS_MS = [25, 50, 100] as const;

export function isSqliteBusyOrLockedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: unknown; message?: unknown; cause?: unknown };
  const code = typeof value.code === "string" ? value.code : "";
  if (code === "SQLITE_BUSY" || code === "SQLITE_LOCKED") return true;
  const message = typeof value.message === "string" ? value.message : "";
  return /^(?:SQLITE_BUSY|SQLITE_LOCKED)|database(?: table)? is locked/i.test(message);
}

function sleepSync(milliseconds: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

export function runImmediateTransactionWithBusyRetry<T>(
  work: () => T,
  options?: { onBusyRetry?: (event: { attempt: number; delayMs: number }) => void },
  database: DatabaseSync = db
): T {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return runImmediateTransaction(work, database);
    } catch (error) {
      if (!isSqliteBusyOrLockedError(error) || attempt >= GOAL_FIT_ORDER_BUSY_RETRY_DELAYS_MS.length) throw error;
      const delayMs = GOAL_FIT_ORDER_BUSY_RETRY_DELAYS_MS[attempt];
      options?.onBusyRetry?.({ attempt: attempt + 1, delayMs });
      sleepSync(delayMs);
    }
  }
}
export function runImmediateTransaction<T>(work: () => T, database: DatabaseSync = db): T {
  database.exec("BEGIN IMMEDIATE");

  try {
    const result = work();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
      // Preserve the original failure.
    }
    throw error;
  }
}

export function migrateAnalyticsPlatformColumns(database: DatabaseSync = db): void {
  for (const tableName of ["analytics_visitors", "analytics_attributions", "analytics_events"]) {
    const analyticsColumns = database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
    if (!analyticsColumns.some((column) => column.name === "platform")) {
      database.exec(`ALTER TABLE ${tableName} ADD COLUMN platform TEXT NOT NULL DEFAULT 'h5'`);
    }
    database.exec(`UPDATE ${tableName} SET platform = 'h5' WHERE platform IS NULL OR TRIM(platform) = ''`);
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
      paidAt TEXT,
      platformIdentityId TEXT,
      assessmentId TEXT,
      reportSnapshotId TEXT,
      orderPurpose TEXT,
      expiresAt TEXT
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
      platform TEXT NOT NULL DEFAULT 'h5',
      first_user_agent_hash TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS analytics_attributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_id TEXT NOT NULL,
      session_id TEXT,
      platform TEXT NOT NULL DEFAULT 'h5',
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
      platform TEXT NOT NULL DEFAULT 'h5',
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

    CREATE TABLE IF NOT EXISTS channel_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      display_name TEXT NOT NULL,
      source TEXT NOT NULL,
      channel TEXT NOT NULL,
      campaign TEXT NOT NULL,
      commission_type TEXT NOT NULL,
      commission_value REAL NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (source, channel, campaign)
    );

    CREATE INDEX IF NOT EXISTS idx_channel_profiles_lookup
      ON channel_profiles (source, channel, campaign, enabled);

    CREATE TABLE IF NOT EXISTS product_pricing_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_key TEXT NOT NULL UNIQUE,
      base_price_cents INTEGER NOT NULL,
      sale_price_cents INTEGER NOT NULL,
      invite_discount_cents INTEGER NOT NULL,
      free_trial_enabled INTEGER NOT NULL DEFAULT 0,
      free_trial_start_at TEXT,
      free_trial_end_at TEXT,
      allow_invite_discount_stack INTEGER NOT NULL DEFAULT 1,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS platform_identities (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      app_id TEXT NOT NULL,
      openid_ciphertext TEXT NOT NULL,
      openid_hash TEXT NOT NULL,
      unionid_ciphertext TEXT,
      unionid_hash TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (platform, app_id, openid_hash)
    );

    CREATE TABLE IF NOT EXISTS miniapp_sessions (
      id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      platform_identity_id TEXT NOT NULL,
      visitor_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      FOREIGN KEY (platform_identity_id) REFERENCES platform_identities(id)
    );

    CREATE INDEX IF NOT EXISTS idx_miniapp_sessions_identity
      ON miniapp_sessions (platform_identity_id, expires_at);

    CREATE TABLE IF NOT EXISTS assessments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assessment_id TEXT NOT NULL UNIQUE,
      platform_identity_id TEXT NOT NULL,
      visitor_id TEXT NOT NULL,
      submission_id TEXT NOT NULL,
      target_company TEXT NOT NULL,
      target_role TEXT NOT NULL,
      question_set_version TEXT NOT NULL,
      question_bank_hash TEXT NOT NULL,
      scoring_version TEXT NOT NULL,
      payload_ciphertext TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status = 'completed'),
      completed_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(platform_identity_id, submission_id),
      FOREIGN KEY(platform_identity_id) REFERENCES platform_identities(id)
    );
    CREATE TABLE IF NOT EXISTS report_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_snapshot_id TEXT NOT NULL UNIQUE,
      assessment_row_id INTEGER NOT NULL UNIQUE,
      report_version TEXT NOT NULL,
      free_result_json TEXT NOT NULL,
      full_report_ciphertext TEXT NOT NULL,
      full_report_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(assessment_row_id) REFERENCES assessments(id)
    );
    CREATE INDEX IF NOT EXISTS idx_assessments_identity_completed ON assessments(platform_identity_id, completed_at);
  `);

  db.prepare(
    `
      INSERT INTO product_pricing_rules (
        product_key,
        base_price_cents,
        sale_price_cents,
        invite_discount_cents,
        free_trial_enabled,
        free_trial_start_at,
        free_trial_end_at,
        allow_invite_discount_stack,
        enabled,
        created_at,
        updated_at
      )
      SELECT
        'goal_fit_report',
        1990,
        1990,
        1000,
        0,
        NULL,
        NULL,
        1,
        1,
        @now,
        @now
      WHERE NOT EXISTS (
        SELECT 1 FROM product_pricing_rules WHERE product_key = 'goal_fit_report'
      )
    `
  ).run({ now: new Date().toISOString() });

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

  if (!columnNames.has("basePriceCents")) {
    db.exec("ALTER TABLE orders ADD COLUMN basePriceCents INTEGER");
  }

  if (!columnNames.has("salePriceCents")) {
    db.exec("ALTER TABLE orders ADD COLUMN salePriceCents INTEGER");
  }

  if (!columnNames.has("discountCents")) {
    db.exec("ALTER TABLE orders ADD COLUMN discountCents INTEGER");
  }

  if (!columnNames.has("finalAmountCents")) {
    db.exec("ALTER TABLE orders ADD COLUMN finalAmountCents INTEGER");
  }

  if (!columnNames.has("pricingRuleId")) {
    db.exec("ALTER TABLE orders ADD COLUMN pricingRuleId INTEGER");
  }

  if (!columnNames.has("pricingSnapshotJson")) {
    db.exec("ALTER TABLE orders ADD COLUMN pricingSnapshotJson TEXT");
  }

  if (!columnNames.has("pricingMode")) {
    db.exec("ALTER TABLE orders ADD COLUMN pricingMode TEXT");
  }

  for (const name of ["platformIdentityId","assessmentId","reportSnapshotId","orderPurpose","expiresAt"]) { if (!columnNames.has(name)) db.exec(`ALTER TABLE orders ADD COLUMN ${name} TEXT`); }
  db.exec("CREATE INDEX IF NOT EXISTS idx_orders_platform_identity ON orders (platformIdentityId); CREATE INDEX IF NOT EXISTS idx_orders_assessment ON orders (assessmentId); CREATE INDEX IF NOT EXISTS idx_orders_report_snapshot ON orders (reportSnapshotId);");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_goal_fit_pending ON orders (platformIdentityId, assessmentId, orderPurpose) WHERE orderPurpose = 'goal_fit_full_report' AND platformIdentityId IS NOT NULL AND assessmentId IS NOT NULL AND status = 'pending';");

  migrateAnalyticsPlatformColumns();
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_analytics_visitors_platform
      ON analytics_visitors (platform);
    CREATE INDEX IF NOT EXISTS idx_analytics_attributions_platform_created
      ON analytics_attributions (platform, created_at);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_platform_created
      ON analytics_events (platform, created_at);
  `);
}
