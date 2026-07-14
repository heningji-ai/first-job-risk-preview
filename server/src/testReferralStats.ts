process.env.GOAL_FIT_DB_PATH = "data/referral-discount-test.db";

const { initializeDatabase, databasePath } = await import("./db.js");

initializeDatabase();

assert(databasePath.endsWith("referral-discount-test.db"), "referral stats test must use the configured database path");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

console.log("Goal Fit referral stats database path test passed.");
console.log(`databasePath: ${databasePath}`);
