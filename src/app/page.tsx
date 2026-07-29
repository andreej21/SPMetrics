const SNIPPET = `<script>
  !function(){window.sp=window.sp||function(){(sp.q=sp.q||[]).push(arguments)};
  var s=document.createElement('script');s.async=1;s.src='COLLECTOR/px.js';
  document.head.appendChild(s);}();
  sp('init','YOUR_PIXEL_TOKEN');
</script>`;

export default function Home() {
  const origin = process.env.NEXT_PUBLIC_COLLECTOR_ORIGIN || "http://localhost:3000";
  return (
    <main style={{ maxWidth: 760, margin: "48px auto", padding: "0 20px", lineHeight: 1.6 }}>
      <h1 style={{ marginBottom: 4 }}>SPMetrics</h1>
      <p style={{ color: "#666", marginTop: 0 }}>Smart Pixel Metrics — first-party analytics &amp; attribution.</p>
      <p>
        <a href="/dashboard" style={{ display: "inline-block", background: "#0f172a", color: "#fff", padding: "8px 16px", borderRadius: 8, textDecoration: "none" }}>
          Open dashboard →
        </a>
      </p>

      <h2>Install</h2>
      <p>Paste this in your storefront&apos;s <code>&lt;head&gt;</code>:</p>
      <pre style={box}>{SNIPPET.replace("COLLECTOR", origin)}</pre>

      <h2>Track events</h2>
      <pre style={box}>{`sp('page');                       // page view (auto-fired)
sp('identify', { email: 'a@b.com' });
sp('track', 'product_view', { productId: 'SKU-1', price: 4999 });
sp('track', 'add_to_cart', { productId: 'SKU-1', qty: 1 });
sp('track', 'purchase', {
  order: { externalOrderId: '1001', totalAmount: 4999, currency: 'USD' }
});`}</pre>

      <h2>Try it</h2>
      <p>
        Full test store with dummy products, cart &amp; checkout:{" "}
        <a href="/shop.html">/shop.html</a> — buy something, then watch it appear on the{" "}
        <a href="/dashboard">dashboard</a>. Add <code>?utm_source=facebook&amp;fbclid=123</code> to the URL to test attribution.
      </p>
      <p>
        Minimal button-only demo: <a href="/demo.html">/demo.html</a>.
      </p>
    </main>
  );
}

const box: React.CSSProperties = {
  background: "#0f172a",
  color: "#e2e8f0",
  padding: 16,
  borderRadius: 8,
  overflowX: "auto",
  fontSize: 13,
};
