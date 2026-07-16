import { useEffect, useMemo, useState } from "react";
import { buildApiUrl } from "../config/api";
import { navigateTo } from "../lib/router";

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
  paidOrders: number;
  revenueCents: number;
  commissionCents: number;
};

type FunnelStep = {
  key: string;
  label: string;
  count: number;
};

type ChannelRow = {
  source: string;
  channel: string;
  campaign: string;
  paidOrders: number;
  revenueCents: number;
  commissionCents: number;
};

type OrderRow = {
  id: string;
  outTradeNo: string;
  sessionId: string;
  status: string;
  payAmountCents: number;
  paymentMode: string;
  source: string;
  channel: string;
  campaign: string;
  createdAt: string;
  paidAt: string | null;
};

function formatYuan(cents: number): string {
  return `¥${(cents / 100).toFixed(1)}`;
}

function buildQuery(filters: Record<string, string>): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value.trim()) params.set(key, value.trim());
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}

async function fetchAdminJson<T>(path: string): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    credentials: "include"
  });

  if (response.status === 401) {
    navigateTo("/admin/login");
    throw new Error("admin login required");
  }

  if (!response.ok) throw new Error(`admin request failed: ${response.status}`);
  return (await response.json()) as T;
}

function AdminDashboardPage() {
  const [filters, setFilters] = useState({ from: "", to: "", source: "", channel: "", campaign: "" });
  const [summary, setSummary] = useState<Summary | null>(null);
  const [funnel, setFunnel] = useState<FunnelStep[]>([]);
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [error, setError] = useState("");
  const query = useMemo(() => buildQuery(filters), [filters]);

  useEffect(() => {
    let ignore = false;

    async function loadDashboard(): Promise<void> {
      setError("");

      try {
        const [nextSummary, nextFunnel, nextChannels, nextOrders] = await Promise.all([
          fetchAdminJson<Summary>(`/api/admin/analytics/summary${query}`),
          fetchAdminJson<{ steps: FunnelStep[] }>(`/api/admin/analytics/funnel${query}`),
          fetchAdminJson<{ channels: ChannelRow[] }>(`/api/admin/analytics/channels${query}`),
          fetchAdminJson<{ orders: OrderRow[] }>(`/api/admin/orders${query}`)
        ]);

        if (ignore) return;
        setSummary(nextSummary);
        setFunnel(nextFunnel.steps);
        setChannels(nextChannels.channels);
        setOrders(nextOrders.orders);
      } catch (loadError) {
        if (!ignore && loadError instanceof Error && loadError.message !== "admin login required") {
          setError("后台数据暂时无法加载。");
        }
      }
    }

    void loadDashboard();

    return () => {
      ignore = true;
    };
  }, [query]);

  async function handleLogout(): Promise<void> {
    await fetch(buildApiUrl("/api/admin/logout"), {
      method: "POST",
      credentials: "include"
    });
    navigateTo("/admin/login");
  }

  const metricCards = summary
    ? [
        ["访问人数", summary.visits],
        ["开始测试人数", summary.testStarts],
        ["完成测试人数", summary.testCompletes],
        ["查看免费结果", summary.freeResults],
        ["点击付费人数", summary.payClicks],
        ["邀请链接复制数", summary.referralLinkCopies],
        ["邀请二维码展示数", summary.referralQrShown],
        ["支付成功人数", summary.paidOrders],
        ["渠道收入", formatYuan(summary.revenueCents)],
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

      <section className="admin-filter-card">
        {(["from", "to", "source", "channel", "campaign"] as const).map((key) => (
          <label key={key}>
            {key}
            <input
              value={filters[key]}
              placeholder={key === "from" || key === "to" ? "2026-07-01" : key}
              onChange={(event) => setFilters((current) => ({ ...current, [key]: event.target.value }))}
            />
          </label>
        ))}
      </section>

      {error ? <p className="admin-error">{error}</p> : null}

      <section className="admin-metric-grid">
        {metricCards.map(([label, value]) => (
          <article className="admin-metric-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="admin-grid-two">
        <article className="admin-panel">
          <h2>产品漏斗</h2>
          <ol className="admin-funnel-list">
            {funnel.map((step) => (
              <li key={step.key}>
                <span>{step.label}</span>
                <strong>{step.count}</strong>
              </li>
            ))}
          </ol>
        </article>

        <article className="admin-panel">
          <h2>渠道排行</h2>
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
        <h2>最近订单</h2>
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>订单号</th>
                <th>金额</th>
                <th>状态</th>
                <th>渠道</th>
                <th>创建时间</th>
                <th>支付时间</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>{order.outTradeNo}</td>
                  <td>{formatYuan(order.payAmountCents)}</td>
                  <td>{order.status}</td>
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
