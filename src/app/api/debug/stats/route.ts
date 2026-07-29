import { desc, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { getDb, schema } from "@/db/client";
import { json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Dev-only introspection. Do not expose in production.
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return json({ error: "disabled" }, { status: 404 });
  }
  const db = await getDb();

  const count = async (table: PgTable) => {
    const rows = (await db.select({ n: sql<number>`count(*)` }).from(table)) as { n: number }[];
    return Number(rows[0]?.n ?? 0);
  };

  const [sites, visitors, sessions, events, identities, orders] = await Promise.all([
    count(schema.sites),
    count(schema.visitors),
    count(schema.sessions),
    count(schema.events),
    count(schema.identities),
    count(schema.orders),
  ]);

  const recentEvents = await db.query.events.findMany({
    orderBy: [desc(schema.events.receivedAt)],
    limit: 15,
    columns: { id: true, type: true, name: true, source: true, path: true, sessionId: true, receivedAt: true },
  });

  const recentSessions = await db.query.sessions.findMany({
    orderBy: [desc(schema.sessions.startedAt)],
    limit: 5,
    columns: { id: true, channel: true, utmSource: true, deviceType: true, eventCount: true, landingPage: true },
  });

  const recentOrders = await db.query.orders.findMany({
    orderBy: [desc(schema.orders.placedAt)],
    limit: 5,
    columns: { id: true, orderNumber: true, totalAmount: true, currency: true, attributedChannel: true },
  });

  return json({
    counts: { sites, visitors, sessions, events, identities, orders },
    recentEvents,
    recentSessions,
    recentOrders,
  });
}
