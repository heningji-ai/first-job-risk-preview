import { Fragment, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { buildApiUrl } from "../config/api";
import { navigateTo } from "../lib/router";

type RangeKey = "today" | "yesterday" | "7d" | "30d" | "all" | "custom";

type Summary = {
  visits: number;
  testStarts: number;
  testCompletes: number;
  freeResults: number;
  payClicks: number;
  referralLinkCopies: number;
  referralQrShown: number;
  unlockPageViews: number;
  fullReportViews: number;
  pendingOrders: number;
  paidOrders: number;
  revenueCents: number;
  commissionCents: number;
};

type FunnelStep = {
  key: string;
  label: string;
  count: number;
  previousConversionRate: number | null;
  visitConversionRate: number | null;
};

type ChannelRow = {
  source: string;
  channel: string;
  campaign: string;
  paidOrders: number;
  revenueCents: number;
  commissionCents: number;
};

type ChannelProfile = {
  id: number;
  displayName: string;
  source: string;
  channel: string;
  campaign: string;
  commissionType: "fixed" | "percent";
  commissionValue: number;
  enabled: boolean;
  hasData: boolean;
  canEditIdentity: boolean;
  visitCount: number;
  paidOrderCount: number;
  promoUrl: string;
  createdAt: string;
  updatedAt: string;
};

type OrderRow = {
  id: string;
  outTradeNo: string;
  sessionId: string;
  status: string;
  accessMode: string;
  originalAmountCents: number;
  discountAmountCents: number;
  payAmountCents: number;
  paymentMode: string;
  source: string;
  channel: string;
  campaign: string;
  createdAt: string;
  paidAt: string | null;
};

type EventRow = {
  eventId: string;
  eventName: string;
  visitorId: string;
  sessionId: string | null;
  orderId: string | null;
  source: string;
  channel: string;
  campaign: string;
  pagePath: string | null;
  createdAt: string;
};

const rangeOptions: Array<{ key: RangeKey; label: string }> = [
  { key: "today", label: "今日" },
  { key: "yesterday", label: "昨日" },
  { key: "7d", label: "近7天" },
  { key: "30d", label: "近30天" },
  { key: "all", label: "全部" },
  { key: "custom", label: "自定义日期" }
];

const sourceHints = [
  ["xhs", "小红书"],
  ["douyin", "抖音"],
  ["shipinhao", "视频号"],
  ["gzh", "公众号"],
  ["pyq", "朋友圈"],
  ["wechat", "微信好友/微信群"],
  ["zhihu", "知乎"],
  ["bilibili", "B站"],
  ["kol", "外部渠道"]
];

function formatYuan(cents: number): string {
  return `¥${(cents / 100).toFixed(1)}`;
}

function formatRate(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "-";
  return `${(value * 100).toFixed(1)}%`;
}

function formatOrderStatus(status: string): string {
  const map: Record<string, string> = {
    pending: "待支付",
    paid: "已支付",
    failed: "支付失败",
    closed: "已关闭",
    unknown: "未知"
  };
  return map[status] ?? map.unknown;
}

function tail(value: string | null | undefined): string {
  return value ? value.slice(-6) : "-";
}

function buildQuery(filters: {
  range: RangeKey;
  from: string;
  to: string;
  source: string;
  channel: string;
  campaign: string;
}): string {
  const params = new URLSearchParams();
  params.set("range", filters.range);
  if (filters.range === "custom") {
    if (filters.from.trim()) params.set("from", filters.from.trim());
    if (filters.to.trim()) params.set("to", filters.to.trim());
  }
  (["source", "channel", "campaign"] as const).forEach((key) => {
    if (filters[key].trim()) params.set(key, filters[key].trim());
  });
  return `?${params.toString()}`;
}

async function fetchAdminJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (response.status === 401) {
    navigateTo("/admin/login");
    throw new Error("admin login required");
  }

  if (!response.ok) throw new Error(`admin request failed: ${response.status}`);
  return (await response.json()) as T;
}

function AdminDashboardPage() {
  const [filters, setFilters] = useState({ range: "7d" as RangeKey, from: "", to: "", source: "", channel: "", campaign: "" });
  const [summary, setSummary] = useState<Summary | null>(null);
  const [funnel, setFunnel] = useState<FunnelStep[]>([]);
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [channelProfiles, setChannelProfiles] = useState<ChannelProfile[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [detailOrders, setDetailOrders] = useState<OrderRow[]>([]);
  const [detailTitle, setDetailTitle] = useState("最近事件");
  const [selectedPromoUrl, setSelectedPromoUrl] = useState("");
  const [promoQr, setPromoQr] = useState("");
  const [qrError, setQrError] = useState("");
  const [channelForm, setChannelForm] = useState({
    editingId: null as number | null,
    identityLocked: false,
    displayName: "",
    source: "",
    channel: "",
    campaign: "",
    commissionType: "fixed" as "fixed" | "percent",
    commissionValue: "0",
    enabled: true
  });
  const [error, setError] = useState("");
  const [eventsError, setEventsError] = useState("");
  const [notice, setNotice] = useState("");
  const query = useMemo(() => buildQuery(filters), [filters]);

  async function loadRecentEvents(): Promise<void> {
    setEventsError("");

    try {
      const result = await fetchAdminJson<{ events: EventRow[] }>(`/api/admin/analytics/events${query}&limit=30`);
      setEvents(result.events);
      setDetailOrders([]);
      setDetailTitle("最近事件");
    } catch (loadError) {
      if (loadError instanceof Error && loadError.message === "admin login required") return;
      setEvents([]);
      setDetailOrders([]);
      setDetailTitle("最近事件");
      setEventsError("最近事件暂时无法加载");
    }
  }

  async function loadDashboard(): Promise<void> {
    setError("");

    try {
      const [nextSummary, nextFunnel, nextChannels, nextOrders, nextChannelProfiles] = await Promise.all([
        fetchAdminJson<Summary>(`/api/admin/analytics/summary${query}`),
        fetchAdminJson<{ steps: FunnelStep[] }>(`/api/admin/analytics/funnel${query}`),
        fetchAdminJson<{ channels: ChannelRow[] }>(`/api/admin/analytics/channels${query}`),
        fetchAdminJson<{ orders: OrderRow[] }>(`/api/admin/orders${query}`),
        fetchAdminJson<{ channels: ChannelProfile[] }>("/api/admin/channels")
      ]);

      setSummary(nextSummary);
      setFunnel(nextFunnel.steps);
      setChannels(nextChannels.channels);
      setOrders(nextOrders.orders);
      setChannelProfiles(nextChannelProfiles.channels);
      if (!selectedPromoUrl && nextChannelProfiles.channels[0]?.promoUrl) {
        setSelectedPromoUrl(nextChannelProfiles.channels[0].promoUrl);
      }
      await loadRecentEvents();
    } catch (loadError) {
      if (loadError instanceof Error && loadError.message !== "admin login required") {
        setError("后台数据暂时无法加载。");
      }
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, [query]);

  useEffect(() => {
    let canceled = false;
    async function renderQr(): Promise<void> {
      if (!selectedPromoUrl) {
        setPromoQr("");
        setQrError("");
        return;
      }
      try {
        setQrError("");
        const QRCode = await import("qrcode");
        const dataUrl = await QRCode.toDataURL(selectedPromoUrl, {
          width: 192,
          margin: 1,
          color: {
            dark: "#29382f",
            light: "#fffaf0"
          }
        });
        if (!canceled) setPromoQr(dataUrl);
      } catch {
        if (!canceled) {
          setPromoQr("");
          setQrError("二维码暂时无法生成，不影响复制链接。");
        }
      }
    }
    void renderQr();
    return () => {
      canceled = true;
    };
  }, [selectedPromoUrl]);

  async function handleLogout(): Promise<void> {
    await fetch(buildApiUrl("/api/admin/logout"), {
      method: "POST",
      credentials: "include"
    });
    navigateTo("/admin/login");
  }

  function resetChannelForm(): void {
    setChannelForm({
      editingId: null,
      identityLocked: false,
      displayName: "",
      source: "",
      channel: "",
      campaign: "",
      commissionType: "fixed",
      commissionValue: "0",
      enabled: true
    });
  }

  function startEditChannel(row: ChannelProfile): void {
    setNotice("");
    setError("");
    setSelectedPromoUrl(row.promoUrl);
    setChannelForm({
      editingId: row.id,
      identityLocked: !row.canEditIdentity,
      displayName: row.displayName,
      source: row.source,
      channel: row.channel,
      campaign: row.campaign,
      commissionType: row.commissionType,
      commissionValue: String(row.commissionValue),
      enabled: row.enabled
    });
  }

  function duplicateChannel(row: ChannelProfile): void {
    setNotice("已复制为新渠道，请修改 channel 或 campaign 后保存。");
    setError("");
    setChannelForm({
      editingId: null,
      identityLocked: false,
      displayName: `${row.displayName} 副本`,
      source: row.source,
      channel: `${row.channel}_copy`,
      campaign: row.campaign === "none" ? "none_copy" : `${row.campaign}_copy`,
      commissionType: row.commissionType,
      commissionValue: String(row.commissionValue),
      enabled: row.enabled
    });
  }

  async function saveChannel(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError("");
    setNotice("");

    try {
      const path = channelForm.editingId ? `/api/admin/channels/${channelForm.editingId}` : "/api/admin/channels";
      const result = await fetchAdminJson<{ channel: ChannelProfile }>(path, {
        method: channelForm.editingId ? "PATCH" : "POST",
        body: JSON.stringify({
          ...channelForm,
          commissionValue: Number(channelForm.commissionValue || 0)
        })
      });
      setNotice(channelForm.editingId ? "渠道已更新。" : "渠道已保存，推广链接已生成。");
      setSelectedPromoUrl(result.channel.promoUrl);
      resetChannelForm();
      await loadDashboard();
    } catch (saveError) {
      if (saveError instanceof Error && channelForm.editingId && channelForm.identityLocked) {
        setError("该渠道已有访问或订单，source/channel/campaign 已锁定。如需新链接，请使用复制为新渠道。");
        return;
      }
      setError("渠道保存失败，请检查渠道名称、source 和 channel 是否填写完整。campaign 留空会按 none 统计。");
    }
  }

  async function toggleChannel(row: ChannelProfile): Promise<void> {
    setError("");
    setNotice("");

    try {
      const result = await fetchAdminJson<{ channel: ChannelProfile }>(`/api/admin/channels/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          displayName: row.displayName,
          source: row.source,
          channel: row.channel,
          campaign: row.campaign,
          commissionType: row.commissionType,
          commissionValue: row.commissionValue,
          enabled: !row.enabled
        })
      });
      setNotice(result.channel.enabled ? "渠道已启用。" : "渠道已停用。");
      await loadDashboard();
    } catch {
      setError("渠道状态更新失败。");
    }
  }

  async function copyPromoUrl(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      setNotice("推广链接已复制。");
    } catch {
      setNotice("当前浏览器不支持自动复制，请手动复制推广链接。");
    }
  }

  async function loadFunnelDetail(step: FunnelStep): Promise<void> {
    setError("");
    setDetailTitle(`${step.label}明细`);

    try {
      if (step.key === "pending_order") {
        const result = await fetchAdminJson<{ orders: OrderRow[] }>(`/api/admin/orders${query}&status=pending&limit=30`);
        setDetailOrders(result.orders);
        setEvents([]);
        return;
      }

      if (step.key === "landing_view") {
        const result = await fetchAdminJson<{ events: EventRow[] }>(`/api/admin/analytics/events${query}&limit=30`);
        setEvents(result.events);
        setDetailOrders([]);
        return;
      }

      const result = await fetchAdminJson<{ events: EventRow[] }>(`/api/admin/analytics/events${query}&eventName=${encodeURIComponent(step.key)}&limit=30`);
      setEvents(result.events);
      setDetailOrders([]);
    } catch {
      setError("明细暂时无法加载。");
    }
  }

  const metricCards = summary
    ? [
        ["独立访客", summary.visits],
        ["开始测试次数", summary.testStarts],
        ["完成测试次数", summary.testCompletes],
        ["到达支付页次数", summary.unlockPageViews],
        ["待支付订单", summary.pendingOrders],
        ["支付成功订单", summary.paidOrders],
        ["收入", formatYuan(summary.revenueCents)],
        ["预估佣金", formatYuan(summary.commissionCents)]
      ]
    : [];

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <div>
          <p className="admin-eyebrow">后台统计与渠道归因</p>
          <h1>第一份工作预演数据后台</h1>
        </div>
        <button className="secondary-button" type="button" onClick={handleLogout}>
          退出登录
        </button>
      </header>

      <section className="admin-filter-card" aria-label="时间和渠道筛选">
        <div className="admin-range-tabs">
          {rangeOptions.map((option) => (
            <button
              key={option.key}
              className={filters.range === option.key ? "admin-range-tab active" : "admin-range-tab"}
              type="button"
              onClick={() => setFilters((current) => ({ ...current, range: option.key }))}
            >
              {option.label}
            </button>
          ))}
        </div>
        {filters.range === "custom" ? (
          <div className="admin-date-row">
            <label>
              from
              <input value={filters.from} placeholder="2026-07-01" onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} />
            </label>
            <label>
              to
              <input value={filters.to} placeholder="2026-07-16" onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} />
            </label>
          </div>
        ) : null}
        <div className="admin-date-row">
          {(["source", "channel", "campaign"] as const).map((key) => (
            <label key={key}>
              {key}
              <input value={filters[key]} placeholder={key} onChange={(event) => setFilters((current) => ({ ...current, [key]: event.target.value }))} />
            </label>
          ))}
        </div>
      </section>

      {error ? <p className="admin-error">{error}</p> : null}
      {notice ? <p className="admin-notice">{notice}</p> : null}

      <section className="admin-metric-grid">
        {metricCards.map(([label, value]) => (
          <article className="admin-metric-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="admin-panel admin-channel-manager">
        <div className="admin-section-heading">
          <div>
            <h2>渠道管理</h2>
            <p>新增渠道后会生成推广链接和二维码；渠道参数仅用于统计和佣金，不参与价格或优惠资格判断。</p>
          </div>
        </div>

        <div className="admin-source-hints">
          <strong>常用 source：</strong>
          {sourceHints.map(([key, label]) => (
            <span key={key}>{key} {label}</span>
          ))}
        </div>

        <form className="admin-channel-form" onSubmit={saveChannel}>
          <label>
            渠道名称
            <input value={channelForm.displayName} onChange={(event) => setChannelForm((current) => ({ ...current, displayName: event.target.value }))} />
          </label>
          <label>
            source
            <input disabled={channelForm.identityLocked} value={channelForm.source} placeholder="xhs" onChange={(event) => setChannelForm((current) => ({ ...current, source: event.target.value }))} />
          </label>
          <label>
            channel
            <input disabled={channelForm.identityLocked} value={channelForm.channel} placeholder="kol-a" onChange={(event) => setChannelForm((current) => ({ ...current, channel: event.target.value }))} />
          </label>
          <label>
            campaign
            <input disabled={channelForm.identityLocked} value={channelForm.campaign} placeholder="summer-2026" onChange={(event) => setChannelForm((current) => ({ ...current, campaign: event.target.value }))} />
          </label>
          <label>
            佣金类型
            <select value={channelForm.commissionType} onChange={(event) => setChannelForm((current) => ({ ...current, commissionType: event.target.value as "fixed" | "percent" }))}>
              <option value="fixed">fixed 固定金额</option>
              <option value="percent">percent 百分比</option>
            </select>
          </label>
          <label>
            佣金值
            <input type="number" min="0" step="0.01" value={channelForm.commissionValue} onChange={(event) => setChannelForm((current) => ({ ...current, commissionValue: event.target.value }))} />
          </label>
          <label className="admin-checkbox-row">
            <input type="checkbox" checked={channelForm.enabled} onChange={(event) => setChannelForm((current) => ({ ...current, enabled: event.target.checked }))} />
            启用
          </label>
          <div className="admin-form-actions">
            <button className="primary-button" type="submit">{channelForm.editingId ? "保存渠道" : "新增渠道"}</button>
            {channelForm.editingId ? (
              <button className="secondary-button" type="button" onClick={resetChannelForm}>
                取消编辑
              </button>
            ) : null}
          </div>
        </form>
        {channelForm.identityLocked ? (
          <p className="admin-help-text">该渠道已有访问或订单，source/channel/campaign 已锁定。如需新链接，请使用复制为新渠道。</p>
        ) : null}

        <div className="admin-channel-layout">
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>渠道名称</th>
                  <th>source/channel/campaign</th>
                  <th>佣金</th>
                  <th>状态</th>
                  <th>数据</th>
                  <th>推广链接</th>
                </tr>
              </thead>
              <tbody>
                {channelProfiles.map((row) => (
                  <Fragment key={row.id}>
                    <tr>
                      <td>{row.displayName}</td>
                      <td>{`${row.source}/${row.channel}/${row.campaign}`}</td>
                      <td>{row.commissionType === "percent" ? `${row.commissionValue}%` : formatYuan(row.commissionValue)}</td>
                      <td>
                        <span className={row.enabled ? "admin-status-pill active" : "admin-status-pill"}>{row.enabled ? "启用" : "停用"}</span>
                      </td>
                      <td>{row.hasData ? `访问 ${row.visitCount} / 付款 ${row.paidOrderCount} · 身份锁定` : "无历史数据"}</td>
                      <td>
                        <div className="admin-link-actions">
                          <button type="button" onClick={() => startEditChannel(row)}>编辑</button>
                          <button type="button" onClick={() => void toggleChannel(row)}>{row.enabled ? "停用" : "启用"}</button>
                          <button type="button" onClick={() => duplicateChannel(row)}>复制为新渠道</button>
                          <button type="button" onClick={() => setSelectedPromoUrl(row.promoUrl)}>展开链接和二维码</button>
                          <button type="button" onClick={() => void copyPromoUrl(row.promoUrl)}>复制链接</button>
                        </div>
                      </td>
                    </tr>
                    {selectedPromoUrl === row.promoUrl ? (
                      <tr className="admin-channel-expanded">
                        <td colSpan={6}>
                          <code>{row.promoUrl}</code>
                          {promoQr ? <img src={promoQr} alt={`${row.displayName} 推广链接二维码`} /> : <span>{qrError || "二维码生成中..."}</span>}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <aside className="admin-qr-card">
            <h3>推广链接二维码</h3>
            {promoQr ? <img src={promoQr} alt="渠道推广链接二维码" /> : <p>{qrError || "选择一个渠道后生成二维码。"}</p>}
            {selectedPromoUrl ? <code>{selectedPromoUrl}</code> : null}
          </aside>
        </div>
      </section>

      <section className="admin-grid-two">
        <article className="admin-panel">
          <h2>产品漏斗</h2>
          <ol className="admin-funnel-list">
            {funnel.map((step) => (
              <li key={step.key}>
                {step.key === "landing_view" ? (
                  <span>{step.label}</span>
                ) : (
                  <button type="button" onClick={() => void loadFunnelDetail(step)}>
                    {step.label}
                  </button>
                )}
                <strong>{step.count}</strong>
                <small>上一步 {formatRate(step.previousConversionRate)} · 访问 {formatRate(step.visitConversionRate)}</small>
              </li>
            ))}
          </ol>
        </article>

        <article className="admin-panel">
          <h2>渠道排行</h2>
          <p className="admin-help-text">direct = 直接访问，未识别到来源平台；organic = 自然来源，未指定渠道；none = 未指定推广活动。</p>
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>source</th>
                  <th>channel</th>
                  <th>campaign</th>
                  <th>付款</th>
                  <th>收入</th>
                  <th>佣金</th>
                </tr>
              </thead>
              <tbody>
                {channels.map((row) => (
                  <tr key={`${row.source}:${row.channel}:${row.campaign}`}>
                    <td>{row.source}</td>
                    <td>{row.channel}</td>
                    <td>{row.campaign}</td>
                    <td>{row.paidOrders}</td>
                    <td>{formatYuan(row.revenueCents)}</td>
                    <td>{formatYuan(row.commissionCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="admin-panel">
        <h2>{detailTitle}</h2>
        <p className="admin-help-text">用于核对重复测试、支付页到达、完整报告查看等行为是否被逐次记录。</p>
        {eventsError && detailOrders.length === 0 ? <p className="admin-error">{eventsError}</p> : null}
        {detailOrders.length > 0 ? (
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>订单号</th>
                  <th>金额</th>
                  <th>状态</th>
                  <th>source/channel/campaign</th>
                  <th>创建时间</th>
                </tr>
              </thead>
              <tbody>
                {detailOrders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.outTradeNo}</td>
                    <td>{formatYuan(order.payAmountCents)}</td>
                    <td>{formatOrderStatus(order.status)}</td>
                    <td>{`${order.source}/${order.channel}/${order.campaign}`}</td>
                    <td>{order.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>createdAt</th>
                  <th>eventName</th>
                  <th>visitorId</th>
                  <th>sessionId</th>
                  <th>orderId</th>
                  <th>source/channel/campaign</th>
                  <th>pagePath</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.eventId}>
                    <td>{event.createdAt}</td>
                    <td>{event.eventName}</td>
                    <td>{tail(event.visitorId)}</td>
                    <td>{tail(event.sessionId)}</td>
                    <td>{event.orderId ?? "-"}</td>
                    <td>{`${event.source}/${event.channel}/${event.campaign}`}</td>
                    <td>{event.pagePath ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-panel">
        <h2>最近订单</h2>
        <p className="admin-help-text">待支付表示用户已创建订单但尚未支付成功，不代表已经付款，也不代表已经查看完整报告。默认显示最近 50 条。</p>
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>订单号</th>
                <th>金额</th>
                <th>优惠</th>
                <th>状态</th>
                <th>source/channel/campaign</th>
                <th>创建时间</th>
                <th>支付时间</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>{order.outTradeNo}</td>
                  <td>{formatYuan(order.payAmountCents)}</td>
                  <td>{order.discountAmountCents > 0 ? `优惠 ${formatYuan(order.discountAmountCents)}` : "标准价"}</td>
                  <td>{formatOrderStatus(order.status)}</td>
                  <td>{`${order.source}/${order.channel}/${order.campaign}`}</td>
                  <td>{order.createdAt}</td>
                  <td>{order.paidAt ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export default AdminDashboardPage;
