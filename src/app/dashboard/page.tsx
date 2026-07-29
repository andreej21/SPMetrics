import Link from "next/link";
import {
  Wallet,
  Megaphone,
  TrendUp,
  ShoppingBag,
  Target,
  Receipt,
  ChartBar,
  ChartLineUp,
  Rocket,
} from "@phosphor-icons/react/ssr";
import {
  getSummary,
  getRevenueByChannel,
  getTopCampaigns,
  getRecentOrders,
  getRoasByChannel,
  getSpendTotal,
  listSites,
} from "@/lib/analytics";

export const dynamic = "force-dynamic";

const RANGES = [7, 30, 90];

function money(minor: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: minor % 100 === 0 ? 0 : 2 }).format(minor / 100);
}
const fmtRoas = (r: number | null) => (r == null ? "—" : r.toFixed(2) + "×");
function roasClass(r: number | null): string {
  if (r == null) return "muted";
  if (r >= 1) return "good";
  return "bad";
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ site?: string; days?: string }>;
}) {
  const sp = await searchParams;
  const sites = await listSites();

  if (sites.length === 0) {
    return (
      <Shell>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>No sites yet</h2>
          <p className="muted">
            Register one with <code>npm run site:create -- --name &quot;My Store&quot;</code>, install the pixel, then refresh.
          </p>
        </div>
      </Shell>
    );
  }

  const siteId = sp.site && sites.some((s) => s.id === sp.site) ? sp.site : sites[0].id;
  const days = RANGES.includes(Number(sp.days)) ? Number(sp.days) : 30;
  const site = sites.find((s) => s.id === siteId)!;

  const [summary, channels, campaigns, orders, roas, spendTotal] = await Promise.all([
    getSummary(siteId, days),
    getRevenueByChannel(siteId, days),
    getTopCampaigns(siteId, days),
    getRecentOrders(siteId),
    getRoasByChannel(siteId, days),
    getSpendTotal(siteId, days),
  ]);

  const maxChannelRev = Math.max(1, ...channels.map((c) => c.revenue));
  const blendedRoas = spendTotal > 0 ? summary.revenue / spendTotal : null;
  const hasSpend = roas.some((r) => r.spend > 0);

  return (
    <Shell
      controls={
        <>
          <span className="label-inline">Site</span>
          <span className="seg">
            {sites.map((s) => (
              <Link key={s.id} href={`/dashboard?site=${s.id}&days=${days}`} className={s.id === siteId ? "active" : ""}>
                {s.name}
              </Link>
            ))}
          </span>
          <span className="spacer" />
          <span className="seg">
            {RANGES.map((d) => (
              <Link key={d} href={`/dashboard?site=${siteId}&days=${d}`} className={d === days ? "active" : ""}>
                {d}d
              </Link>
            ))}
          </span>
        </>
      }
    >
      {/* KPIs */}
      <div className="kpi-grid">
        <Kpi label="Revenue" value={money(summary.revenue)} icon={<Wallet size={16} weight="bold" />} />
        <Kpi label="Ad spend" value={money(spendTotal)} icon={<Megaphone size={16} weight="bold" />} />
        <Kpi label="Blended ROAS" value={fmtRoas(blendedRoas)} icon={<TrendUp size={16} weight="bold" />} hero />
        <Kpi label="Orders" value={String(summary.orders)} icon={<ShoppingBag size={16} weight="bold" />} />
        <Kpi label="Conv. rate" value={`${(summary.conversionRate * 100).toFixed(2)}%`} icon={<Target size={16} weight="bold" />} />
        <Kpi label="Avg order value" value={money(summary.aov)} icon={<Receipt size={16} weight="bold" />} />
      </div>

      {/* Revenue by channel — single hue: category identity is on the label */}
      <div className="card">
        <h3 className="sec-title"><ChartBar size={14} weight="bold" /> Revenue by channel</h3>
        {channels.length === 0 ? (
          <p className="muted">No orders in this range yet.</p>
        ) : (
          <div className="bars">
            {channels.map((c) => (
              <div className="bar-row" key={c.channel}>
                <div className="bar-head">
                  <span>{c.channel}</span>
                  <span className="val">
                    {money(c.revenue)} · {c.orders} order{c.orders === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${Math.max(2, (c.revenue / maxChannelRev) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ad spend & ROAS */}
      <div className="card">
        <h3 className="sec-title"><ChartLineUp size={14} weight="bold" /> Ad spend &amp; ROAS by channel</h3>
        {!hasSpend ? (
          <p className="muted">
            No ad spend loaded. Add some with <code>npm run spend:add</code> or connect Meta with <code>npm run spend:meta</code>.
          </p>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Channel</th><th>Spend</th><th>Revenue</th><th>ROAS</th><th>Orders</th>
                </tr>
              </thead>
              <tbody>
                {roas.map((r) => (
                  <tr key={r.channel}>
                    <td>{r.channel}</td>
                    <td>{r.spend > 0 ? money(r.spend) : "—"}</td>
                    <td>{money(r.revenue)}</td>
                    <td className={roasClass(r.roas)} style={{ fontWeight: 700 }}>{fmtRoas(r.roas)}</td>
                    <td>{r.orders}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid-2">
        <div className="card">
          <h3 className="sec-title"><Rocket size={14} weight="bold" /> Top campaigns</h3>
          <Table head={["Campaign", "Revenue", "Orders"]} rows={campaigns.map((c) => [c.campaign, money(c.revenue), String(c.orders)])} empty="No campaign data yet." />
        </div>
        <div className="card">
          <h3 className="sec-title"><ShoppingBag size={14} weight="bold" /> Recent orders</h3>
          <Table head={["Order", "Amount", "Attributed to"]} rows={orders.map((o) => [o.orderNumber ?? o.id.slice(0, 10), money(o.totalAmount, o.currency), o.channel ?? "—"])} empty="No orders yet." />
        </div>
      </div>

      <p className="foot">
        <b>{site.name}</b>{site.domain ? ` · ${site.domain}` : ""} · last {days} days · last-non-direct-click attribution.
      </p>
    </Shell>
  );
}

function Shell({ children, controls }: { children: React.ReactNode; controls?: React.ReactNode }) {
  return (
    <>
      <header className="topbar">
        <Link href="/" className="brand" style={{ color: "inherit" }}>
          <span className="mark" />
          SPMetrics <small>Attribution</small>
        </Link>
      </header>
      <main className="container">
        <div className="page-h">
          <h1>Overview</h1>
        </div>
        {controls && <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>{controls}</div>}
        {children}
      </main>
    </>
  );
}

function Kpi({ label, value, icon, hero }: { label: string; value: string; icon?: React.ReactNode; hero?: boolean }) {
  return (
    <div className={`kpi${hero ? " hero" : ""}`}>
      <div className="k-top">
        <div className="k-label">{label}</div>
        {icon && <span className="k-icon">{icon}</span>}
      </div>
      <div className="k-value">{value}</div>
    </div>
  );
}

function Table({ head, rows, empty }: { head: string[]; rows: string[][]; empty: string }) {
  if (rows.length === 0) return <p className="muted">{empty}</p>;
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead>
          <tr>{head.map((h) => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>{r.map((cell, ci) => <td key={ci}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
