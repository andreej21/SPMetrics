import Link from "next/link";
import { ChartBar } from "@phosphor-icons/react/ssr";
import { getAttributionBySource, getAttributionTimeseries } from "@/lib/attribution-analytics";
import { getSummary, listSites, getPrevPeriod } from "@/lib/analytics";
import { Shell } from "@/components/dashboard/Shell";
import { getAssistedConversions, getTouchpoints, attributeOrder } from "@/lib/multitouch-attribution";
import { getViewThroughAttribution } from "@/lib/viewthrough-attribution";

export const dynamic = "force-dynamic";

const RANGES = [7, 30, 90];
type Model = "last_touch" | "linear";

function money(minor: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: minor % 100 === 0 ? 0 : 2 }).format(minor / 100);
}

export default async function AttributionDashboard({
  searchParams,
}: {
  searchParams: Promise<{ site?: string; days?: string; model?: string }>;
}) {
  const sp = await searchParams;
  const model = (sp.model === "linear" ? "linear" : "last_touch") as Model;
  const sites = await listSites();

  if (sites.length === 0) {
    return (
      <Shell sites={[]} siteId="" days={30}>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>No sites yet</h2>
          <p className="muted">Register one with <code>npm run site:create -- --name "My Store"</code>, install the pixel, then refresh.</p>
        </div>
      </Shell>
    );
  }

  const siteId = sp.site && sites.some((s) => s.id === sp.site) ? sp.site : sites[0].id;
  const days = RANGES.includes(Number(sp.days)) ? Number(sp.days) : 30;
  const site = sites.find((s) => s.id === siteId)!;

  const [attribution, summary, assisted, viewThrough] = await Promise.all([
    getAttributionBySource(siteId, days),
    getSummary(siteId, days),
    getAssistedConversions(siteId, days),
    getViewThroughAttribution(siteId, days),
  ]);

  const totalRevenue = attribution.reduce((sum: number, row) => sum + row.revenue, 0);
  const maxRevenue = Math.max(1, ...attribution.map((a) => a.revenue));

  return (
    <Shell sites={sites} siteId={siteId} days={days} active="attribution">
      <div className="topbar">
        <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em", margin: 0 }}>Attribution</h1>
        <span className="muted" style={{ fontSize: 14, fontWeight: 500 }}>{site.name}</span>
        <span className="spacer" />
        <span className="seg">
          {RANGES.map((d) => (
            <Link key={d} href={`/dashboard/attribution?site=${siteId}&days=${d}`} className={d === days ? "active" : ""}>
              {d}d
            </Link>
          ))}
        </span>
      </div>

      <div className="container">
        {/* Summary cards */}
        <div className="kpi-grid">
          <div className="kpi">
            <div className="k-top">
              <div className="k-label">Total revenue</div>
            </div>
            <div className="k-value">{money(totalRevenue)}</div>
          </div>
          <div className="kpi">
            <div className="k-top">
              <div className="k-label">Attribution sources</div>
            </div>
            <div className="k-value">{attribution.length}</div>
          </div>
          <div className="kpi">
            <div className="k-top">
              <div className="k-label">Attributed orders</div>
            </div>
            <div className="k-value">{attribution.reduce((sum: number, row) => sum + row.orders, 0)}</div>
          </div>
        </div>

        {/* Attribution model toggle */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, fontSize: 13 }}>
          <span style={{ color: "var(--muted)" }}>Attribution model:</span>
          <div className="seg">
            <Link href={`/dashboard/attribution?site=${siteId}&days=${days}&model=last_touch`} className={model === "last_touch" ? "active" : ""}>
              Last-click
            </Link>
            <Link href={`/dashboard/attribution?site=${siteId}&days=${days}&model=linear`} className={model === "linear" ? "active" : ""}>
              Linear
            </Link>
          </div>
        </div>

        {/* Attribution breakdown */}
        <div className="card">
          <h3 className="sec-title"><ChartBar size={14} weight="bold" /> Revenue by source ({model === "linear" ? "linear" : "last-click"})</h3>
          {attribution.length === 0 ? (
            <p className="muted">No attributed orders in this range yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {attribution.map((attr: typeof attribution[0]) => {
                const pct = (attr.revenue / maxRevenue) * 100;
                const revenuePct = totalRevenue > 0 ? (attr.revenue / totalRevenue) * 100 : 0;
                return (
                  <div key={attr.source || "direct"}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, fontSize: 13, fontWeight: 500 }}>
                      <span>{attr.source || "Direct"}</span>
                      <span style={{ color: "var(--ink-2)", fontSize: 12 }}>
                        {money(attr.revenue)} · {attr.orders} order{attr.orders === 1 ? "" : "s"} · {revenuePct.toFixed(1)}%
                      </span>
                    </div>
                    <div style={{ background: "var(--surface-2)", borderRadius: 2, height: 8, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          background: "var(--accent)",
                          borderRadius: 2,
                          width: `${pct}%`,
                          transition: "width 300ms linear",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detailed table */}
        <div className="card">
          <h3 className="sec-title"><ChartBar size={14} weight="bold" /> Attribution details</h3>
          {attribution.length === 0 ? (
            <p className="muted">No data.</p>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Revenue</th>
                    <th>Orders</th>
                    <th>AOV</th>
                    <th>% of total</th>
                  </tr>
                </thead>
                <tbody>
                  {attribution.map((attr: typeof attribution[0]) => {
                    const aov = attr.orders > 0 ? attr.revenue / attr.orders : 0;
                    const pct = totalRevenue > 0 ? (attr.revenue / totalRevenue) * 100 : 0;
                    return (
                      <tr key={attr.source || "direct"}>
                        <td>{attr.source || "Direct"}</td>
                        <td>{money(attr.revenue)}</td>
                        <td>{attr.orders}</td>
                        <td>{money(aov)}</td>
                        <td style={{ fontWeight: 600, color: "var(--ink)" }}>{pct.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* View-through attribution */}
        <div className="card">
          <h3 className="sec-title"><ChartBar size={14} weight="bold" /> View-through vs click-through</h3>
          {viewThrough.length === 0 ? (
            <p className="muted">No impression data yet. Send impressions via /api/impressions to enable view-through tracking.</p>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl" style={{ fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Provider</th>
                    <th>View-through Revenue</th>
                    <th>Click-through Revenue</th>
                    <th>Total Revenue</th>
                    <th>VT %</th>
                    <th>Total Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {viewThrough.map((row) => (
                    <tr key={`${row.source}-${row.provider}`}>
                      <td style={{ fontWeight: 500 }}>{row.source || "Direct"}</td>
                      <td style={{ fontSize: 12, color: "var(--muted)" }}>{row.provider}</td>
                      <td style={{ color: "var(--accent)" }}>{money(row.viewThroughRevenue)}</td>
                      <td>{money(row.clickThroughRevenue)}</td>
                      <td style={{ fontWeight: 600 }}>{money(row.totalRevenue)}</td>
                      <td style={{ fontWeight: 600 }}>{row.vt_pct}%</td>
                      <td style={{ fontSize: 12, color: "var(--muted)" }}>{row.totalOrders}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Assisted conversions */}
        <div className="card">
          <h3 className="sec-title"><ChartBar size={14} weight="bold" /> Assisted conversions (non-final touches)</h3>
          {assisted.length === 0 ? (
            <p className="muted">No multi-session journeys yet.</p>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Last-click Revenue</th>
                    <th>Assisted Revenue</th>
                    <th>Assists</th>
                    <th>Total Influenced</th>
                  </tr>
                </thead>
                <tbody>
                  {assisted.map((row) => {
                    const assistedPct = row.totalRevenue > 0 ? ((row.assistedRevenue / row.totalRevenue) * 100).toFixed(1) : "0";
                    return (
                      <tr key={row.source || "direct"}>
                        <td style={{ fontWeight: 500 }}>{row.source || "Direct"}</td>
                        <td>{money(row.lastTouchRevenue)}</td>
                        <td style={{ color: "var(--accent)" }}>{money(row.assistedRevenue)}</td>
                        <td>{row.assists}</td>
                        <td style={{ fontWeight: 600 }}>{money(row.totalRevenue)} ({assistedPct}%)</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="foot">
          <b>{site.name}</b>{site.domain ? ` · ${site.domain}` : ""} · last {days} days.
        </p>
      </div>
    </Shell>
  );
}

