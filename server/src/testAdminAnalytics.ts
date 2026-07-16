process.env.GOAL_FIT_DB_PATH = "data/admin-analytics-test.db";
process.env.NODE_ENV = "production";
process.env.PAYMENT_MODE = "native";
process.env.ADMIN_USERNAME = "admin_test";
process.env.ADMIN_PASSWORD = "password_test";
process.env.ADMIN_SESSION_SECRET = "test_secret_that_is_long_enough";

const { initializeDatabase, databasePath } = await import("./db.js");
const { getAdminAnalyticsChannels, getAdminAnalyticsFunnel, getAdminAnalyticsSummary } = await import("./analytics.js");
const { loginAdmin, requireAdmin } = await import("./adminAuth.js");

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

const login = createMockResponse();
loginAdmin({ headers: {} } as never, login.res as never, "admin_test", "password_test");
assert(login.state.statusCode === 200, "valid admin login must succeed");
assert(login.state.cookieOptions?.httpOnly === true, "admin cookie must be httpOnly");
assert(login.state.cookieOptions?.sameSite === "lax", "admin cookie must use sameSite=lax");
assert(login.state.cookieOptions?.secure === true, "admin cookie must be secure in production");

const summary = getAdminAnalyticsSummary({});
const funnel = getAdminAnalyticsFunnel({});
const channels = getAdminAnalyticsChannels({});
assert(typeof summary.visits === "number", "admin summary must be readable");
assert(Array.isArray(funnel) && funnel.length > 0, "admin funnel must be readable");
assert(Array.isArray(channels), "admin channels must be readable");

console.log("Goal Fit admin analytics tests passed.");
console.log(`databasePath: ${databasePath}`);
