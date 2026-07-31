import Link from "next/link";
import { ChartBar } from "@phosphor-icons/react/ssr";
import { getCohorts, getLtvBySource } from "@/lib/cohort-analytics";
import { listSites } from "@/lib/analytics";
import { Shell } from "@/components/dashboard/Shell";
import { Kpi } from "@/components/dashboard/Kpi";

export const dynamic = "force-dynamic";

const RANGES = [7, 30, 90];

function money(minor: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
}

export default async function CohortsDashboard({
  searchParams,
}: {
  searchParams: Promise<{ site?: string; days?: string }>;
}) {
  const sp = await searchParams;
  const sites = await listSites();

  if (sites.length === 0) {
    return (
      <Shell sites={[]} siteId="" days={30} active="cohorts">
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

  const [cohorts, ltvBySource] = await Promise.all([
    getCohorts(siteId),
    getLtvBySource(siteId, days),
  ]);

  const totalCustomers = new Set(cohorts.flatMap((c) => c.month)).size;
  const totalRevenue = cohorts.reduce((sum, c) => sum + c.d30Revenue + c.d60Revenue + c.d90Revenue, 0);
  const avgRepeatRate = cohorts.length > 0 ? cohorts.reduce((sum, c) => sum + c.d30RepeatRate, 0) / cohorts.length : 0;

  return (
    <Shell sites={sites} siteId={siteId} days={days} active="cohorts">
      <div className="topbar">
        <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em", margin: 0 }}>Cohorts & LTV</h1>
        <span className="muted" style={{ fontSize: 14, fontWeight: 500 }}>{site.name}</span>
        <span className="spacer" />
        <span className="seg">
          {RANGES.map((d) => (
            <Link key={d} href={`/dashboard/cohorts?site=${siteId}&days=${d}`} className={d === days ? "active" : ""}>
              {d}d
            </Link>
          ))}
        </span>
      </div>

      <div className="container">
        {/* Summary KPIs */}
        <div className="kpi-grid">
          <Kpi label="Cohorts" value={String(cohorts.length)} />
          <Kpi label="Avg 30d repeat rate" value={`${(avgRepeatRate * 100).toFixed(1)}%`} />
          <Kpi label="Unique channels" value={String(new Set(cohorts.map((c) => c.channel ?? "direct")).size)} hero />
        </div>

        {/* LTV by source */}
        <div className="card">
          <h3 className="sec-title"><ChartBar size={14} weight="bold" /> Lifetime value by source</h3>
          {ltvBySource.length === 0 ? (
            <p className="muted">No customer data yet.</p>
          ) : (
            <div>
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th>Customers</th>
                      <th>Lifetime Revenue</th>
                      <th>Avg LTV</th>
                      <th>Avg Orders</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ltvBySource.map((row) => (
                      <tr key={row.source || "direct"}>
                        <td style={{ fontWeight: 500 }}>{row.source || "Direct"}</td>
                        <td>{row.customerCount}</td>
                        <td>{money(row.lifetimeRevenue)}</td>
                        <td style={{ fontWeight: 600 }}>{money(row.avgLtv)}</td>
                        <td style={{ fontSize: 12, color: "var(--muted)" }}>{row.avgOrders.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {ltvBySource.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 12px 0" }}>Revenue distribution by source</h4>
                  <div className="bars">
                    {ltvBySource.map((row) => {
                      const totalRev = ltvBySource.reduce((sum, r) => sum + r.lifetimeRevenue, 0);
                      const pct = totalRev > 0 ? (row.lifetimeRevenue / totalRev) * 100 : 0;
                      return (
                        <div className="bar-row" key={row.source || "direct"}>
                          <div className="bar-head">
                            <span>{row.source || "Direct"}</span>
                            <span className="val">{money(row.lifetimeRevenue)} · {pct.toFixed(1)}%</span>
                          </div>
                          <div className="bar-track">
                            <div className="bar-fill" style={{ width: `${Math.max(2, pct)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cohort retention table */}
        {cohorts.length > 0 && (
          <div className="card">
            <h3 className="sec-title"><ChartBar size={14} weight="bold" /> Cohort retention (repeat rates)</h3>
            <div className="tbl-wrap">
              <table className="tbl" style={{ fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Cohort</th>
                    <th>Channel</th>
                    <th>Customers</th>
                    <th>Day 30</th>
                    <th>Day 60</th>
                    <th>Day 90</th>
                  </tr>
                </thead>
                <tbody>
                  {cohorts.slice(0, 20).map((c) => (
                    <tr key={`${c.month}-${c.channel}`}>
                      <td style={{ fontWeight: 500 }}>{c.month}</td>
                      <td style={{ fontSize: 12, color: "var(--muted)" }}>{c.channel || "Direct"}</td>
                      <td>{c.cohortSize}</td>
                      <td style={{ fontWeight: 600 }}>{(c.d30RepeatRate * 100).toFixed(1)}%</td>
                      <td style={{ fontWeight: 600 }}>{(c.d60RepeatRate * 100).toFixed(1)}%</td>
                      <td style={{ fontWeight: 600 }}>{(c.d90RepeatRate * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="foot">
          <b>{site.name}</b>{site.domain ? ` · ${site.domain}` : ""} · last {days} days.
        </p>
      </div>
    </Shell>
  );
}
