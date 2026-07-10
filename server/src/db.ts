import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "..", "data");
const dbPath = path.join(dataDir, "orders.db");

fs.mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(dbPath);

db.exec("PRAGMA journal_mode = WAL");

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
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      paidAt TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_orders_session_status
      ON orders (sessionId, status, updatedAt);
  `);
}
