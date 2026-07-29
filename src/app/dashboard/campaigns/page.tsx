import Link from "next/link";
import { Rocket, House, Code, Storefront, ChartBar } from "@phosphor-icons/react/ssr";
import { getCampaignsMetrics } from "@/lib/campaigns-analytics";
import { listSites } from "@/lib/analytics";

export const dynamic = "force-dynamic";

const RANGES = [7, 30, 90];

function money(minor: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: minor % 100 === 0 ? 0 : 2 }).format(minor / 100);
}

function roasClass(r: number | null): string {
  if (r == null) return "muted";
  if (r >= 1) return "good";
  return "bad";
}

export default async function CampaignsDashboard({
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

  const campaigns = await getCampaignsMetrics(siteId, days);

  const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);
  const totalRevenue = campaigns.reduce((sum, c) => sum + c.revenue, 0);
  const blendedRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  return (
    <Shell sites={sites} siteId={siteId} days={days}>
      <div className="topbar">
        <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em", margin: 0 }}>Campaigns</h1>
        <span className="muted" style={{ fontSize: 14, fontWeight: 500 }}>{site.name}</span>
        <span className="spacer" />
        <span className="seg">
          {RANGES.map((d) => (
            <Link key={d} href={`/dashboard/campaigns?site=${siteId}&days=${d}`} className={d === days ? "active" : ""}>
              {d}d
            </Link>
          ))}
        </span>
      </div>

      <div className="container">
        {/* Summary KPIs */}
        <div className="kpi-grid">
          <div className="kpi">
            <div className="k-top">
              <div className="k-label">Total spend</div>
            </div>
            <div className="k-value">{money(totalSpend)}</div>
          </div>
          <div className="kpi">
            <div className="k-top">
              <div className="k-label">Total revenue</div>
            </div>
            <div className="k-value">{money(totalRevenue)}</div>
          </div>
          <div className="kpi hero">
            <div className="k-top">
              <div className="k-label">Blended ROAS</div>
            </div>
            <div className="k-value">{blendedRoas.toFixed(2)}×</div>
          </div>
          <div className="kpi">
            <div className="k-top">
              <div className="k-label">Total orders</div>
            </div>
            <div className="k-value">{campaigns.reduce((sum, c) => sum + c.orders, 0)}</div>
          </div>
        </div>

        {/* Campaigns table */}
        <div className="card">
          <h3 className="sec-title"><Rocket size={14} weight="bold" /> All campaigns</h3>
          {campaigns.length === 0 ? (
            <p className="muted">No campaigns with spend in this range yet. Add spend data with <code>npm run spend:add</code> or connect Meta/Google Ads.</p>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Provider</th>
                    <th>Spend</th>
                    <th>Revenue</th>
                    <th>ROAS</th>
                    <th>Orders</th>
                    <th>Impressions</th>
                    <th>Clicks</th>
                    <th>CTR</th>
                    <th>CPC</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.campaignId || c.campaign}>
                      <td style={{ fontWeight: 500 }}>{c.campaign}</td>
                      <td style={{ fontSize: 12, color: "var(--muted)" }}>{c.provider}</td>
                      <td>{money(c.spend)}</td>
                      <td>{money(c.revenue)}</td>
                      <td className={roasClass(c.roas)} style={{ fontWeight: 700 }}>{c.roas.toFixed(2)}×</td>
                      <td>{c.orders}</td>
                      <td style={{ fontSize: 12, color: "var(--muted)" }}>{c.impressions.toLocaleString()}</td>
                      <td style={{ fontSize: 12, color: "var(--muted)" }}>{c.clicks.toLocaleString()}</td>
                      <td style={{ fontSize: 12, color: "var(--muted)" }}>{c.ctr.toFixed(2)}%</td>
                      <td style={{ fontSize: 12, color: "var(--muted)" }}>{money(c.cpc)}</td>
                    </tr>
                  ))}
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
          <Link href={`/dashboard/attribution?site=${siteId}&days=${days}`} className="nav-item"><ChartBar size={17} weight="bold" /> Attribution</Link>
          <Link href={`/dashboard/campaigns?site=${siteId}&days=${days}`} className="nav-item active"><Rocket size={17} weight="bold" /> Campaigns</Link>
          <Link href="/" className="nav-item"><Code size={17} weight="bold" /> Install</Link>
        </div>

        {sites.length > 0 && (
          <div className="side-group">
            <div className="side-label">Sites</div>
            {sites.map((s) => (
              <Link key={s.id} href={`/dashboard/campaigns?site=${s.id}&days=${days}`} className={`nav-item${s.id === siteId ? " active" : ""}`}>
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
