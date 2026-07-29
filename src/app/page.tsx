import Link from "next/link";
import {
  ArrowRight,
  Storefront,
  ShieldCheck,
  Code,
  ChartLineUp,
} from "@phosphor-icons/react/ssr";

const SNIPPET = `<script>
  !function(){window.sp=window.sp||function(){(sp.q=sp.q||[]).push(arguments)};
  var s=document.createElement('script');s.async=1;s.src='COLLECTOR/px.js';
  document.head.appendChild(s);}();
  sp('init','YOUR_PIXEL_TOKEN');
</script>`;

const box: React.CSSProperties = {
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  padding: 16,
  borderRadius: 10,
  overflowX: "auto",
  fontSize: 12.5,
  lineHeight: 1.6,
  fontFamily: "var(--font-mono)",
};

export default function Home() {
  const origin = process.env.NEXT_PUBLIC_COLLECTOR_ORIGIN || "http://localhost:3000";
  return (
    <>
      <header className="topbar">
        <span className="brand"><span className="mark" /> SPMetrics <small>Smart Pixel Metrics</small></span>
        <span className="spacer" />
        <Link href="/dashboard" className="seg"><span className="active">Dashboard</span></Link>
      </header>

      <main className="container" style={{ maxWidth: 760 }}>
        <div style={{ margin: "12px 0 28px" }}>
          <span className="pill"><ShieldCheck size={13} weight="bold" /> First-party pixel</span>
          <h1 style={{ fontSize: 32, letterSpacing: "-0.03em", margin: "16px 0 8px" }}>
            Know which ad actually made the sale.
          </h1>
          <p className="muted" style={{ fontSize: 15, maxWidth: 560 }}>
            A first-party analytics &amp; attribution pixel that survives ITP and ad-blockers, stitches every click to
            its order, and joins your ad spend for true ROAS.
          </p>
          <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/dashboard" className="btn btn-primary">
              Open dashboard <ArrowRight size={16} weight="bold" />
            </Link>
            <Link href="/shop.html" className="btn btn-secondary">
              <Storefront size={16} /> Try the test store
            </Link>
          </div>
        </div>

        <div className="card">
          <h3 className="sec-title"><Code size={14} weight="bold" /> Install</h3>
          <p style={{ marginTop: 0 }}>Paste in your storefront&apos;s <code>&lt;head&gt;</code>:</p>
          <pre style={box}>{SNIPPET.replace("COLLECTOR", origin)}</pre>
        </div>

        <div className="card">
          <h3 className="sec-title"><ChartLineUp size={14} weight="bold" /> Track events</h3>
          <pre style={box}>{`sp('page');                       // page view (auto-fired)
sp('identify', { email: 'a@b.com' });
sp('track', 'product_view', { productId: 'SKU-1', price: 4999 });
sp('track', 'add_to_cart', { productId: 'SKU-1', qty: 1 });
sp('track', 'purchase', {
  order: { externalOrderId: '1001', totalAmount: 4999, currency: 'USD' }
});`}</pre>
        </div>

        <p className="foot">
          Test store: <Link href="/shop.html">/shop.html</Link> · minimal demo: <Link href="/demo.html">/demo.html</Link> ·
          add <code>?utm_source=facebook&amp;fbclid=123</code> to test attribution.
        </p>
      </main>
    </>
  );
}
