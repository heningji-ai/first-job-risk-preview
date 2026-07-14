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
}
