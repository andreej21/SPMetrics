import Link from "next/link";
import {
  getSummary,
  getRevenueByChannel,
  getTopCampaigns,
  getRecentOrders,
  listSites,
} from "@/lib/analytics";

export const dynamic = "force-dynamic";

// Channel → accent color for the bars.
function channelColor(ch: string): string {
  if (/facebook|meta|instagram/i.test(ch)) return "#1877f2";
  if (/google/i.test(ch)) return "#ea4335";
  if (/tiktok/i.test(ch)) return "#000000";
  if (/direct/i.test(ch)) return "#64748b";
  if (/paid/i.test(ch)) return "#7c3aed";
  return "#0ea5e9";
}

function money(minor: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
}

const RANGES = [7, 30, 90];

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
        <div style={card}>
          <h2 style={{ marginTop: 0 }}>No sites yet</h2>
          <p style={{ color: muted }}>
            Register one with <code>npm run site:create -- --name &quot;My Store&quot;</code>, install the pixel, then
            refresh.
          </p>
        </div>
      </Shell>
    );
  }

  const siteId = sp.site && sites.some((s) => s.id === sp.site) ? sp.site : sites[0].id;
  const days = RANGES.includes(Number(sp.days)) ? Number(sp.days) : 30;
  const site = sites.find((s) => s.id === siteId)!;

  const [summary, channels, campaigns, orders] = await Promise.all([
    getSummary(siteId, days),
    getRevenueByChannel(siteId, days),
    getTopCampaigns(siteId, days),
    getRecentOrders(siteId),
  ]);

  const maxChannelRev = Math.max(1, ...channels.map((c) => c.revenue));

  return (
    <Shell>
      {/* Controls */}
      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <label style={{ color: muted, fontSize: 12, marginRight: 8 }}>Site</label>
          {sites.map((s) => (
            <Link
              key={s.id}
              href={`/dashboard?site=${s.id}&days=${days}`}
              style={{ ...chip, ...(s.id === siteId ? chipActive : {}) }}
            >
              {s.name}
            </Link>
          ))}
        </div>
        <div style={{ marginLeft: "auto" }}>
          <label style={{ color: muted, fontSize: 12, marginRight: 8 }}>Range</label>
          {RANGES.map((d) => (
            <Link
              key={d}
              href={`/dashboard?site=${siteId}&days=${d}`}
              style={{ ...chip, ...(d === days ? chipActive : {}) }}
            >
              {d}d
            </Link>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
        <Kpi label="Revenue" value={money(summary.revenue)} />
        <Kpi label="Orders" value={String(summary.orders)} />
        <Kpi label="Sessions" value={summary.sessions.toLocaleString()} />
        <Kpi label="Conversion rate" value={`${(summary.conversionRate * 100).toFixed(2)}%`} />
        <Kpi label="Avg order value" value={money(summary.aov)} />
      </div>

      {/* Revenue by channel */}
      <div style={card}>
        <h3 style={h3}>Revenue by channel</h3>
        {channels.length === 0 ? (
          <p style={{ color: muted }}>No orders in this range yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {channels.map((c) => (
              <div key={c.channel}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
                  <span>{c.channel}</span>
                  <span style={{ color: muted }}>
                    {money(c.revenue)} · {c.orders} order{c.orders === 1 ? "" : "s"}
                  </span>
                </div>
                <div style={{ background: "#f1f5f9", borderRadius: 6, height: 12, overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${(c.revenue / maxChannelRev) * 100}%`,
                      background: channelColor(c.channel),
                      height: "100%",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginTop: 16 }}>
        {/* Top campaigns */}
        <div style={card}>
          <h3 style={h3}>Top campaigns</h3>
          <Table
            head={["Campaign", "Revenue", "Orders"]}
            rows={campaigns.map((c) => [c.campaign, money(c.revenue), String(c.orders)])}
            empty="No campaign data yet."
          />
        </div>

        {/* Recent orders */}
        <div style={card}>
          <h3 style={h3}>Recent orders</h3>
          <Table
            head={["Order", "Amount", "Attributed to"]}
            rows={orders.map((o) => [o.orderNumber ?? o.id.slice(0, 10), money(o.totalAmount, o.currency), o.channel ?? "—"])}
            empty="No orders yet."
          />
        </div>
      </div>

      <p style={{ color: muted, fontSize: 12, marginTop: 20 }}>
        Showing <b>{site.name}</b>{site.domain ? ` (${site.domain})` : ""} · last {days} days · revenue attributed on a
        last-non-direct-click basis.
      </p>
    </Shell>
  );
}

/* ── little presentational helpers ───────────────────────────── */
const muted = "#64748b";
const card: React.CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 18 };
const h3: React.CSSProperties = { margin: "0 0 12px", fontSize: 13, textTransform: "uppercase", letterSpacing: ".04em", color: muted };
const chip: React.CSSProperties = { display: "inline-block", padding: "5px 12px", marginRight: 6, borderRadius: 999, border: "1px solid #e5e7eb", color: "#0f172a", textDecoration: "none", fontSize: 13 };
const chipActive: React.CSSProperties = { background: "#0f172a", color: "#fff", borderColor: "#0f172a" };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ maxWidth: 980, margin: "32px auto", padding: "0 20px", color: "#0f172a" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>SPMetrics</h1>
        <span style={{ color: muted }}>Attribution dashboard</span>
      </div>
      {children}
    </main>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={card}>
      <div style={{ color: muted, fontSize: 12, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function Table({ head, rows, empty }: { head: string[]; rows: string[][]; empty: string }) {
  if (rows.length === 0) return <p style={{ color: muted }}>{empty}</p>;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr>
          {head.map((h, i) => (
            <th key={h} style={{ textAlign: i === 0 ? "left" : "right", color: muted, fontWeight: 500, padding: "4px 0" }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri} style={{ borderTop: "1px solid #f1f5f9" }}>
            {r.map((cell, ci) => (
              <td key={ci} style={{ textAlign: ci === 0 ? "left" : "right", padding: "6px 0", fontFamily: ci === 0 ? "inherit" : "ui-monospace, monospace" }}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
