import Link from "next/link";
import { House, Storefront, Code, ChartBar, Rocket } from "@phosphor-icons/react/ssr";

export function Shell({
  children,
  sites,
  siteId,
  days,
  active = "overview",
}: {
  children: React.ReactNode;
  sites: { id: string; name: string }[];
  siteId: string;
  days: number;
  active?: "overview" | "attribution" | "campaigns" | "cohorts";
}) {
  const routeMap = {
    overview: "/dashboard",
    attribution: "/dashboard/attribution",
    campaigns: "/dashboard/campaigns",
    cohorts: "/dashboard/cohorts",
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <span className="brand"><span className="mark" /> SPMetrics</span>

        <div className="side-group">
          <div className="side-label">Views</div>
          <Link href={`${routeMap.overview}?site=${siteId}&days=${days}`} className={`nav-item${active === "overview" ? " active" : ""}`}><House size={17} weight="bold" /> Overview</Link>
          <Link href={`${routeMap.attribution}?site=${siteId}&days=${days}`} className={`nav-item${active === "attribution" ? " active" : ""}`}><ChartBar size={17} weight="bold" /> Attribution</Link>
          <Link href={`${routeMap.campaigns}?site=${siteId}&days=${days}`} className={`nav-item${active === "campaigns" ? " active" : ""}`}><Rocket size={17} weight="bold" /> Campaigns</Link>
          <Link href={`${routeMap.cohorts}?site=${siteId}&days=${days}`} className={`nav-item${active === "cohorts" ? " active" : ""}`}><ChartBar size={17} weight="bold" /> Cohorts</Link>
          <Link href="/" className="nav-item"><Code size={17} weight="bold" /> Install</Link>
        </div>

        {sites.length > 0 && (
          <div className="side-group">
            <div className="side-label">Sites</div>
            {sites.map((s) => (
              <Link key={s.id} href={`${routeMap[active]}?site=${s.id}&days=${days}`} className={`nav-item${s.id === siteId ? " active" : ""}`}>
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
