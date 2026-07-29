import { getDb } from "@/db/client";
import { orders } from "@/db/schema";
import { sql } from "drizzle-orm";

export async function getAttributionBySource(siteId: string, days: number = 30) {
  const db = await getDb();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const result = await db
    .select({
      source: orders.attributedSource,
      channel: orders.attributedChannel,
      revenue: sql<number>`COALESCE(SUM(CAST(${orders.totalAmount} AS BIGINT)), 0)`.as("revenue"),
      orders: sql<number>`COUNT(*)`.as("orders"),
    })
    .from(orders)
    .where(
      sql`${orders.siteId} = ${siteId} AND ${orders.placedAt} >= ${cutoff}`
    )
    .groupBy(orders.attributedSource, orders.attributedChannel)
    .orderBy(sql`COALESCE(SUM(CAST(${orders.totalAmount} AS BIGINT)), 0) DESC`);

  return result;
}

export async function getAttributionTimeseries(siteId: string, days: number = 30) {
  const db = await getDb();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const result = await db
    .select({
      day: sql<string>`CAST(${orders.placedAt} AS DATE)`.as("day"),
      source: orders.attributedSource,
      revenue: sql<number>`COALESCE(SUM(CAST(${orders.totalAmount} AS BIGINT)), 0)`.as("revenue"),
      orders: sql<number>`COUNT(*)`.as("orders"),
    })
    .from(orders)
    .where(
      sql`${orders.siteId} = ${siteId} AND ${orders.placedAt} >= ${cutoff}`
    )
    .groupBy(
      sql`CAST(${orders.placedAt} AS DATE)`,
      orders.attributedSource
    )
    .orderBy(sql`CAST(${orders.placedAt} AS DATE) ASC`);

  return result;
}
