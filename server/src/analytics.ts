import crypto from "node:crypto";
import { nanoid } from "nanoid";
import { db, runImmediateTransaction } from "./db.js";
import type { OrderRecord } from "./types.js";

export type AnalyticsAttribution = {
  visitorId: string;
  source: string;
  channel: string;
  campaign: string;
  referralCode: string | null;
};

export type AnalyticsVisitInput = {
  visitorId: string;
  sessionId?: string | null;
  source?: string | null;
  channel?: string | null;
  campaign?: string | null;
  referralCode?: string | null;
  landingPath?: string | null;
  landingUrl?: string | null;
  referrer?: string | null;
  userAgent?: string | null;
  ip?: string | null;
};

export type AnalyticsEventInput = {
  eventId?: string | null;
  visitorId: string;
  sessionId?: string | null;
  orderId?: string | null;
  eventName: string;
  eventValue?: number | null;
  source?: string | null;
  channel?: string | null;
  campaign?: string | null;
  referralCode?: string | null;
  pagePath?: string | null;
  metadata?: Record<string, unknown> | null;
};

type AnalyticsQuery = {
  from?: string | null;
  to?: string | null;
  source?: string | null;
  channel?: string | null;
  campaign?: string | null;
};

function nowIso(): string {
  return new Date().toISOString();
}

function clean(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim().slice(0, 500) : fallback;
}

function normalizeSource(value: unknown): string {
  return clean(value, "direct");
}

function normalizeChannel(value: unknown): string {
  return clean(value, "organic");
}

function normalizeCampaign(value: unknown): string {
  return clean(value, "none");
}

function nullable(value: unknown): string | null {
  const normalized = clean(value);
  return normalized || null;
}

function hashSensitive(value?: string | null): string | null {
  if (!value) return null;
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function getExistingVisitor(visitorId: string): { visitor_id: string; first_source: string } | null {
  return (
    db
      .prepare("SELECT visitor_id, first_source FROM analytics_visitors WHERE visitor_id = ?")
      .get(visitorId) as { visitor_id: string; first_source: string } | undefined
  ) ?? null;
}

export function recordAnalyticsVisit(input: AnalyticsVisitInput): AnalyticsAttribution {
  const visitorId = clean(input.visitorId);
  if (!visitorId) throw new Error("visitorId is required");

  return runImmediateTransaction(() => {
    const source = normalizeSource(input.source);
    const channel = normalizeChannel(input.channel);
    const campaign = normalizeCampaign(input.campaign);
    const referralCode = nullable(input.referralCode);
    const landingPath = clean(input.landingPath, "/");
    const createdAt = nowIso();
    const existing = getExistingVisitor(visitorId);
    const isFirstTouch = existing ? 0 : 1;

    db.prepare(
      `
        INSERT INTO analytics_visitors (
          visitor_id,
          first_seen_at,
          last_seen_at,
          first_source,
          first_channel,
          first_campaign,
          first_referral_code,
          first_landing_path,
          first_user_agent_hash,
          created_at,
          updated_at
        ) VALUES (
          @visitorId,
          @now,
          @now,
          @source,
          @channel,
          @campaign,
          @referralCode,
          @landingPath,
          @userAgentHash,
          @now,
          @now
        )
        ON CONFLICT(visitor_id) DO UPDATE SET
          last_seen_at = excluded.last_seen_at,
          updated_at = excluded.updated_at
      `
    ).run({
      visitorId,
      now: createdAt,
      source,
      channel,
      campaign,
      referralCode,
      landingPath,
      userAgentHash: hashSensitive(input.userAgent)
    });

    db.prepare(
      `
        INSERT INTO analytics_attributions (
          visitor_id,
          session_id,
          source,
          channel,
          campaign,
          referral_code,
          landing_path,
          landing_url,
          referrer,
          user_agent_hash,
          ip_hash,
          is_first_touch,
          is_valid,
          created_at
        ) VALUES (
          @visitorId,
          @sessionId,
          @source,
          @channel,
          @campaign,
          @referralCode,
          @landingPath,
          @landingUrl,
          @referrer,
          @userAgentHash,
          @ipHash,
          @isFirstTouch,
          1,
          @createdAt
        )
      `
    ).run({
      visitorId,
      sessionId: nullable(input.sessionId),
      source,
      channel,
      campaign,
      referralCode,
      landingPath,
      landingUrl: nullable(input.landingUrl),
      referrer: nullable(input.referrer),
      userAgentHash: hashSensitive(input.userAgent),
      ipHash: hashSensitive(input.ip),
      isFirstTouch,
      createdAt
    });

    const visitor = db
      .prepare(
        `
          SELECT first_source, first_channel, first_campaign, first_referral_code
          FROM analytics_visitors
          WHERE visitor_id = ?
        `
      )
      .get(visitorId) as
      | {
          first_source: string;
          first_channel: string;
          first_campaign: string;
          first_referral_code: string | null;
        }
      | undefined;

    return {
      visitorId,
      source: visitor?.first_source ?? source,
      channel: visitor?.first_channel ?? channel,
      campaign: visitor?.first_campaign ?? campaign,
      referralCode: visitor?.first_referral_code ?? referralCode
    };
  });
}

export function getAttributionForOrder(params: {
  visitorId?: string | null;
  sessionId?: string | null;
  fallbackReferralCode?: string | null;
}): AnalyticsAttribution {
  const visitorId = nullable(params.visitorId);
  const sessionId = nullable(params.sessionId);

  const row = (visitorId
    ? db
        .prepare(
          `
            SELECT visitor_id, source, channel, campaign, referral_code
            FROM analytics_attributions
            WHERE visitor_id = ?
            ORDER BY is_first_touch DESC, created_at ASC
            LIMIT 1
          `
        )
        .get(visitorId)
    : sessionId
      ? db
          .prepare(
            `
              SELECT visitor_id, source, channel, campaign, referral_code
              FROM analytics_attributions
              WHERE session_id = ?
              ORDER BY is_first_touch DESC, created_at ASC
              LIMIT 1
            `
          )
          .get(sessionId)
      : null) as
    | {
        visitor_id: string;
        source: string;
        channel: string;
        campaign: string;
        referral_code: string | null;
      }
    | null;

  return {
    visitorId: row?.visitor_id ?? visitorId ?? "unknown",
    source: row?.source ?? "direct",
    channel: row?.channel ?? "organic",
    campaign: row?.campaign ?? "none",
    referralCode: row?.referral_code ?? nullable(params.fallbackReferralCode)
  };
}

export function recordAnalyticsEvents(events: AnalyticsEventInput[]): { inserted: number; skipped: number } {
  let inserted = 0;
  let skipped = 0;

  for (const event of events.slice(0, 50)) {
    try {
      const visitorId = clean(event.visitorId);
      const eventName = clean(event.eventName);
      if (!visitorId || !eventName) {
        skipped += 1;
        continue;
      }

      const attribution = getAttributionForOrder({
        visitorId,
        sessionId: event.sessionId,
        fallbackReferralCode: event.referralCode
      });
      const result = db
        .prepare(
          `
            INSERT OR IGNORE INTO analytics_events (
              event_id,
              visitor_id,
              session_id,
              order_id,
              event_name,
              event_value,
              source,
              channel,
              campaign,
              referral_code,
              page_path,
              metadata_json,
              created_at
            ) VALUES (
              @eventId,
              @visitorId,
              @sessionId,
              @orderId,
              @eventName,
              @eventValue,
              @source,
              @channel,
              @campaign,
              @referralCode,
              @pagePath,
              @metadataJson,
              @createdAt
            )
          `
        )
        .run({
          eventId: event.eventId || `evt_${nanoid()}`,
          visitorId,
          sessionId: nullable(event.sessionId),
          orderId: nullable(event.orderId),
          eventName,
          eventValue: typeof event.eventValue === "number" ? event.eventValue : null,
          source: normalizeSource(event.source || attribution.source),
          channel: normalizeChannel(event.channel || attribution.channel),
          campaign: normalizeCampaign(event.campaign || attribution.campaign),
          referralCode: nullable(event.referralCode) ?? attribution.referralCode,
          pagePath: nullable(event.pagePath),
          metadataJson: event.metadata ? JSON.stringify(event.metadata).slice(0, 5000) : null,
          createdAt: nowIso()
        });

      if (result.changes > 0) inserted += 1;
      else skipped += 1;
    } catch (error) {
      skipped += 1;
      console.error("[analytics-events]", error instanceof Error ? error.message : error);
    }
  }

  return { inserted, skipped };
}

export function recordOrderPaidAnalytics(order: OrderRecord): void {
  try {
    const eventId = `payment_paid:${order.id}`;
    recordAnalyticsEvents([
      {
        eventId,
        visitorId: order.analyticsVisitorId ?? "unknown",
        sessionId: order.sessionId,
        orderId: order.id,
        eventName: "payment_paid",
        eventValue: order.payAmountCents,
        source: order.analyticsSource,
        channel: order.analyticsChannel,
        campaign: order.analyticsCampaign,
        referralCode: order.analyticsReferralCode,
        pagePath: "/goal-fit-unlock-preview",
        metadata: {
          accessMode: order.accessMode,
          paymentMode: order.paymentMode,
          payAmountCents: order.payAmountCents
        }
      }
    ]);
    createCommissionRecordForOrder(order);
  } catch (error) {
    console.error("[analytics-paid]", error instanceof Error ? error.message : error);
  }
}

function getCommissionRule(order: OrderRecord):
  | {
      commission_type: "fixed" | "percent";
      commission_value: number;
    }
  | null {
  const source = order.analyticsSource ?? "direct";
  const channel = order.analyticsChannel ?? "organic";
  const campaign = order.analyticsCampaign ?? "none";

  return (
    db
      .prepare(
        `
          SELECT commission_type, commission_value
          FROM channel_commission_rules
          WHERE enabled = 1
            AND source = @source
            AND channel = @channel
            AND (campaign = @campaign OR campaign IS NULL)
            AND effective_from <= @now
            AND (effective_to IS NULL OR effective_to >= @now)
          ORDER BY CASE WHEN campaign = @campaign THEN 0 ELSE 1 END, id DESC
          LIMIT 1
        `
      )
      .get({
        source,
        channel,
        campaign,
        now: nowIso()
      }) as { commission_type: "fixed" | "percent"; commission_value: number } | undefined
  ) ?? null;
}

export function createCommissionRecordForOrder(order: OrderRecord): void {
  const rule = getCommissionRule(order);
  const commissionType = rule?.commission_type ?? "fixed";
  const commissionValue = rule?.commission_value ?? 0;
  const commissionAmountCents =
    commissionType === "percent" ? Math.round(order.payAmountCents * (commissionValue / 100)) : Math.round(commissionValue);
  const now = nowIso();

  db.prepare(
    `
      INSERT OR IGNORE INTO channel_commission_records (
        order_id,
        visitor_id,
        session_id,
        source,
        channel,
        campaign,
        paid_amount_cents,
        commission_type,
        commission_value,
        commission_amount_cents,
        settlement_status,
        created_at,
        updated_at
      ) VALUES (
        @orderId,
        @visitorId,
        @sessionId,
        @source,
        @channel,
        @campaign,
        @paidAmountCents,
        @commissionType,
        @commissionValue,
        @commissionAmountCents,
        'pending',
        @now,
        @now
      )
    `
  ).run({
    orderId: order.id,
    visitorId: order.analyticsVisitorId,
    sessionId: order.sessionId,
    source: order.analyticsSource ?? "direct",
    channel: order.analyticsChannel ?? "organic",
    campaign: order.analyticsCampaign ?? "none",
    paidAmountCents: order.payAmountCents,
    commissionType,
    commissionValue,
    commissionAmountCents,
    now
  });
}

function buildWhere(query: AnalyticsQuery, alias = "created_at"): { sql: string; params: Record<string, string> } {
  const params: Record<string, string> = {};
  const conditions: string[] = [];
  if (query.from) {
    conditions.push(`${alias} >= @from`);
    params.from = query.from;
  }
  if (query.to) {
    conditions.push(`${alias} <= @to`);
    params.to = query.to;
  }
  if (query.source) {
    conditions.push("source = @source");
    params.source = query.source;
  }
  if (query.channel) {
    conditions.push("channel = @channel");
    params.channel = query.channel;
  }
  if (query.campaign) {
    conditions.push("campaign = @campaign");
    params.campaign = query.campaign;
  }

  return {
    sql: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    params
  };
}

function buildOrderWhere(query: AnalyticsQuery, dateAlias = "paidAt"): { sql: string; params: Record<string, string> } {
  const params: Record<string, string> = {};
  const conditions: string[] = [];
  if (query.from) {
    conditions.push(`${dateAlias} >= @from`);
    params.from = query.from;
  }
  if (query.to) {
    conditions.push(`${dateAlias} <= @to`);
    params.to = query.to;
  }
  if (query.source) {
    conditions.push("COALESCE(analyticsSource, 'direct') = @source");
    params.source = query.source;
  }
  if (query.channel) {
    conditions.push("COALESCE(analyticsChannel, 'organic') = @channel");
    params.channel = query.channel;
  }
  if (query.campaign) {
    conditions.push("COALESCE(analyticsCampaign, 'none') = @campaign");
    params.campaign = query.campaign;
  }

  return {
    sql: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    params
  };
}

function scalar(sql: string, params: Record<string, string> = {}): number {
  const row = db.prepare(sql).get(params) as { value: number } | undefined;
  return row?.value ?? 0;
}

export function getAdminAnalyticsSummary(query: AnalyticsQuery) {
  const eventWhere = buildWhere(query);
  const orderWhere = buildOrderWhere(query, "paidAt");

  const paidOrders = scalar(
    `
      SELECT COUNT(*) AS value
      FROM orders
      ${orderWhere.sql ? orderWhere.sql.replace("WHERE", "WHERE status = 'paid' AND") : "WHERE status = 'paid'"}
    `,
    orderWhere.params
  );
  const revenueCents = scalar(
    `
      SELECT COALESCE(SUM(payAmountCents), 0) AS value
      FROM orders
      ${orderWhere.sql ? orderWhere.sql.replace("WHERE", "WHERE status = 'paid' AND") : "WHERE status = 'paid'"}
    `,
    orderWhere.params
  );
  const commissionCents = scalar(
    `
      SELECT COALESCE(SUM(commission_amount_cents), 0) AS value
      FROM channel_commission_records
      ${eventWhere.sql}
    `,
    eventWhere.params
  );

  const countEventVisitors = (eventName: string) =>
    scalar(
      `
        SELECT COUNT(DISTINCT visitor_id) AS value
        FROM analytics_events
        ${eventWhere.sql ? `${eventWhere.sql} AND event_name = @eventName` : "WHERE event_name = @eventName"}
      `,
      { ...eventWhere.params, eventName }
    );

  return {
    visits: scalar(
      `SELECT COUNT(DISTINCT visitor_id) AS value FROM analytics_attributions ${eventWhere.sql}`,
      eventWhere.params
    ),
    testStarts: countEventVisitors("test_start"),
    testCompletes: countEventVisitors("test_complete"),
    freeResults: countEventVisitors("free_result_view"),
    payClicks: countEventVisitors("pay_cta_click"),
    referralLinkCopies: countEventVisitors("referral_link_copied"),
    referralQrShown: countEventVisitors("referral_qr_shown"),
    unlockPageViews: countEventVisitors("unlock_page_view"),
    fullReportViews: countEventVisitors("full_report_view"),
    paidOrders,
    revenueCents,
    commissionCents
  };
}

export function getAdminAnalyticsFunnel(query: AnalyticsQuery) {
  const summary = getAdminAnalyticsSummary(query);
  return [
    { key: "landing_view", label: "访问首页", count: summary.visits },
    { key: "test_start", label: "开始测试", count: summary.testStarts },
    { key: "test_complete", label: "完成测试", count: summary.testCompletes },
    { key: "free_result_view", label: "免费结果", count: summary.freeResults },
    { key: "pay_cta_click", label: "点击付费", count: summary.payClicks },
    { key: "referral_link_copied", label: "复制邀请", count: summary.referralLinkCopies },
    { key: "payment_paid", label: "付款成功", count: summary.paidOrders },
    { key: "full_report_view", label: "查看完整报告", count: summary.fullReportViews }
  ];
}

export function getAdminAnalyticsChannels(query: AnalyticsQuery) {
  const where = buildOrderWhere(query, "orders.paidAt");
  return db
    .prepare(
      `
        SELECT
          COALESCE(orders.analyticsSource, 'direct') AS source,
          COALESCE(orders.analyticsChannel, 'organic') AS channel,
          COALESCE(orders.analyticsCampaign, 'none') AS campaign,
          COUNT(*) AS paidOrders,
          COALESCE(SUM(orders.payAmountCents), 0) AS revenueCents,
          COALESCE(SUM(records.commission_amount_cents), 0) AS commissionCents
        FROM orders
        LEFT JOIN channel_commission_records records ON records.order_id = orders.id
        ${where.sql ? where.sql.replace("WHERE", "WHERE orders.status = 'paid' AND") : "WHERE orders.status = 'paid'"}
        GROUP BY source, channel, campaign
        ORDER BY revenueCents DESC, paidOrders DESC
        LIMIT 100
      `
    )
    .all(where.params);
}

export function getAdminRecentOrders(query: AnalyticsQuery) {
  const where = buildOrderWhere(query, "createdAt");
  return db
    .prepare(
      `
        SELECT
          id,
          outTradeNo,
          sessionId,
          status,
          payAmountCents,
          paymentMode,
          COALESCE(analyticsSource, 'direct') AS source,
          COALESCE(analyticsChannel, 'organic') AS channel,
          COALESCE(analyticsCampaign, 'none') AS campaign,
          createdAt,
          paidAt
        FROM orders
        ${where.sql}
        ORDER BY createdAt DESC
        LIMIT 100
      `
    )
    .all(where.params);
}

export function getAdminReferralRows() {
  return db
    .prepare(
      `
        SELECT
          referral.referralCode,
          referral.sourceSessionId,
          referral.copyCount,
          COUNT(visit.id) AS visits,
          SUM(CASE WHEN visit.startedTestAt IS NOT NULL THEN 1 ELSE 0 END) AS testStarts,
          SUM(CASE WHEN visit.completedTestAt IS NOT NULL THEN 1 ELSE 0 END) AS testCompletes,
          SUM(CASE WHEN visit.paidAt IS NOT NULL THEN 1 ELSE 0 END) AS paidOrders
        FROM goal_fit_referrals referral
        LEFT JOIN goal_fit_referral_visits visit ON visit.referralId = referral.id
        GROUP BY referral.id
        ORDER BY referral.createdAt DESC
        LIMIT 100
      `
    )
    .all();
}
