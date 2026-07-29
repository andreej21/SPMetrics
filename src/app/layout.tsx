import "./globals.css";

export const metadata = {
  title: "SPMetrics",
  description: "Smart Pixel Metrics — first-party analytics & attribution",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
