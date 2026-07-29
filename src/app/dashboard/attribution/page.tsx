import Link from "next/link";
import { ChartBar, House, Code, Storefront, Rocket } from "@phosphor-icons/react/ssr";
import { getAttributionBySource, getAttributionTimeseries } from "@/lib/attribution-analytics";
import { getSummary, listSites, getPrevPeriod } from "@/lib/analytics";

export const dynamic = "force-dynamic";

const RANGES = [7, 30, 90];

function money(minor: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: minor % 100 === 0 ? 0 : 2 }).format(minor / 100);
}

export default async function AttributionDashboard({
  searchParams,
}: {
  searchParams: Promise<{ site?: string; days?: string }>;
}) {
  const sp = await searchParams;
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

  const [attribution, summary] = await Promise.all([
    getAttributionBySource(siteId, days),
    getSummary(siteId, days),
  ]);

  const totalRevenue = attribution.reduce((sum: number, row) => sum + row.revenue, 0);
  const maxRevenue = Math.max(1, ...attribution.map((a) => a.revenue));

  return (
    <Shell sites={sites} siteId={siteId} days={days}>
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

        {/* Attribution breakdown */}
        <div className="card">
          <h3 className="sec-title"><ChartBar size={14} weight="bold" /> Revenue by source</h3>
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

        <p className="foot">
          <b>{site.name}</b>{site.domain ? ` · ${site.domain}` : ""} · last {days} days · last-non-direct-click attribution.
        </p>
      </div>
    </Shell>
  );
}

function Shell({
  children,
  sites,
  siteId,
  days,
}: {
  children: React.ReactNode;
  sites: { id: string; name: string }[];
  siteId: string;
  days: number;
}) {
  return (
    <div className="app">
      <aside className="sidebar">
        <span className="brand"><span className="mark" /> SPMetrics</span>

        <div className="side-group">
          <div className="side-label">Views</div>
          <Link href={`/dashboard?site=${siteId}&days=${days}`} className="nav-item"><House size={17} weight="bold" /> Overview</Link>
          <Link href={`/dashboard/attribution?site=${siteId}&days=${days}`} className="nav-item active"><ChartBar size={17} weight="bold" /> Attribution</Link>
          <Link href={`/dashboard/campaigns?site=${siteId}&days=${days}`} className="nav-item"><Rocket size={17} weight="bold" /> Campaigns</Link>
          <Link href="/" className="nav-item"><Code size={17} weight="bold" /> Install</Link>
        </div>

        {sites.length > 0 && (
          <div className="side-group">
            <div className="side-label">Sites</div>
            {sites.map((s) => (
              <Link key={s.id} href={`/dashboard/attribution?site=${s.id}&days=${days}`} className={`nav-item${s.id === siteId ? " active" : ""}`}>
                <Storefront size={17} weight="bold" /> {s.name}
              </Link>
            ))}
          </div>
        )}

        <div className="side-foot">SPMetrics · Smart Pixel Metrics</div>
      </aside>

      <div className="main">{children}</div>
    </div>
  );
}
