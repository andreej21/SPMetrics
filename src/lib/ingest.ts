import { and, desc, eq, gt } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import {
  newVisitorId,
  newSessionId,
  newEventId,
  newIdentityId,
  newOrderId,
  hashEmail,
} from "./ids";
import { classify, deviceTypeFromUA, type Attribution } from "./attribution";
import type { OrderLineItem } from "@/db/schema";

// A visit ends after this much inactivity; the next event opens a fresh session.
const SESSION_WINDOW_MS = 30 * 60 * 1000;

export type IncomingEvent = {
  type: (typeof schema.eventTypeEnum.enumValues)[number];
  name?: string;
  props?: Record<string, unknown>;
  url?: string;
  path?: string;
  referrer?: string;
  ts?: number; // client epoch ms
  dedupeKey?: string;
  // identify payload
  email?: string;
  externalId?: string;
  traits?: Record<string, unknown>;
  // purchase payload
  order?: {
    externalOrderId?: string;
    orderNumber?: string;
    totalAmount: number; // minor units
    subtotalAmount?: number;
    currency?: string;
    isNewCustomer?: boolean;
    lineItems?: OrderLineItem[];
  };
};

export type IngestContext = {
  siteId: string;
  selfHost?: string;
  anonId?: string; // from first-party cookie
  landingPage?: string; // first URL of the visit (for session attribution)
  referrer?: string;
  userAgent?: string;
  ipHash?: string;
  country?: string;
  region?: string;
  source: "client" | "server";
};

export type IngestResult = {
  visitorId: string;
  sessionId: string;
  accepted: number;
  identityId?: string;
};

export async function ingestBatch(ctx: IngestContext, incoming: IncomingEvent[]): Promise<IngestResult> {
  const db = await getDb();
  const now = new Date();

  // ── 1. Resolve or create the visitor ──────────────────────────────
  const visitor = await resolveVisitor(db, ctx, now);

  // ── 2. Resolve or open a session ───────────────────────────────────
  const session = await resolveSession(db, ctx, visitor.id, now);

  // ── 3. Write each event, handling identify/purchase side effects ───
  let accepted = 0;
  let identityId: string | undefined = visitor.identityId ?? undefined;

  for (const ev of incoming) {
    if (ev.type === "identify") {
      identityId = (await upsertIdentity(db, ctx.siteId, ev, now)) ?? identityId;
      if (identityId && identityId !== visitor.identityId) {
        await db
          .update(schema.visitors)
          .set({ identityId, lastSeenAt: now })
          .where(eq(schema.visitors.id, visitor.id));
      }
    }

    const inserted = await db
      .insert(schema.events)
      .values({
        id: newEventId(),
        siteId: ctx.siteId,
        visitorId: visitor.id,
        sessionId: session.id,
        identityId: identityId ?? null,
        type: ev.type,
        name: ev.name ?? null,
        props: ev.props ?? {},
        url: ev.url ?? null,
        path: ev.path ?? null,
        referrer: ev.referrer ?? null,
        utmSource: session.utmSource ?? null,
        utmMedium: session.utmMedium ?? null,
        utmCampaign: session.utmCampaign ?? null,
        source: ctx.source,
        dedupeKey: ev.dedupeKey ?? null,
        clientTs: ev.ts ? new Date(ev.ts) : null,
        receivedAt: now,
      })
      .onConflictDoNothing({ target: [schema.events.siteId, schema.events.dedupeKey] })
      .returning({ id: schema.events.id });

    if (inserted.length > 0) {
      accepted++;
      if (ev.type === "purchase" && ev.order) {
        await recordOrder(db, ctx, visitor.id, session, identityId, ev, now);
      }
    }
  }

  // ── 4. Roll up session counters ────────────────────────────────────
  await db
    .update(schema.sessions)
    .set({ lastEventAt: now, eventCount: session.eventCount + accepted })
    .where(eq(schema.sessions.id, session.id));

  await db.update(schema.visitors).set({ lastSeenAt: now }).where(eq(schema.visitors.id, visitor.id));

  return { visitorId: visitor.id, sessionId: session.id, accepted, identityId };
}

async function resolveVisitor(
  db: Awaited<ReturnType<typeof getDb>>,
  ctx: IngestContext,
  now: Date,
) {
  if (ctx.anonId) {
    const found = await db.query.visitors.findFirst({
      where: and(eq(schema.visitors.id, ctx.anonId), eq(schema.visitors.siteId, ctx.siteId)),
    });
    if (found) return found;
  }

  const attr = classify(ctx.landingPage, ctx.referrer, ctx.selfHost);
  const id = ctx.anonId || newVisitorId();
  const [created] = await db
    .insert(schema.visitors)
    .values({
      id,
      siteId: ctx.siteId,
      firstUtmSource: attr.utmSource ?? null,
      firstUtmMedium: attr.utmMedium ?? null,
      firstUtmCampaign: attr.utmCampaign ?? null,
      firstReferrer: attr.referrer ?? null,
      firstLandingPage: attr.landingPage ?? null,
      firstSeenAt: now,
      lastSeenAt: now,
    })
    .onConflictDoNothing({ target: schema.visitors.id })
    .returning();

  // If a concurrent request created it first, fetch it.
  return (
    created ??
    (await db.query.visitors.findFirst({ where: eq(schema.visitors.id, id) }))!
  );
}

async function resolveSession(
  db: Awaited<ReturnType<typeof getDb>>,
  ctx: IngestContext,
  visitorId: string,
  now: Date,
) {
  const recent = await db.query.sessions.findFirst({
    where: and(
      eq(schema.sessions.siteId, ctx.siteId),
      eq(schema.sessions.visitorId, visitorId),
      gt(schema.sessions.lastEventAt, new Date(now.getTime() - SESSION_WINDOW_MS)),
    ),
    orderBy: [desc(schema.sessions.lastEventAt)],
  });
  if (recent) return recent;

  const attr: Attribution = classify(ctx.landingPage, ctx.referrer, ctx.selfHost);
  const [created] = await db
    .insert(schema.sessions)
    .values({
      id: newSessionId(),
      siteId: ctx.siteId,
      visitorId,
      utmSource: attr.utmSource ?? null,
      utmMedium: attr.utmMedium ?? null,
      utmCampaign: attr.utmCampaign ?? null,
      utmContent: attr.utmContent ?? null,
      utmTerm: attr.utmTerm ?? null,
      fbclid: attr.fbclid ?? null,
      gclid: attr.gclid ?? null,
      ttclid: attr.ttclid ?? null,
      channel: attr.channel,
      referrer: attr.referrer ?? null,
      landingPage: attr.landingPage ?? null,
      userAgent: ctx.userAgent ?? null,
      deviceType: deviceTypeFromUA(ctx.userAgent),
      country: ctx.country ?? null,
      region: ctx.region ?? null,
      ipHash: ctx.ipHash ?? null,
      startedAt: now,
      lastEventAt: now,
      eventCount: 0,
    })
    .returning();
  return created;
}

async function upsertIdentity(
  db: Awaited<ReturnType<typeof getDb>>,
  siteId: string,
  ev: IncomingEvent,
  now: Date,
): Promise<string | undefined> {
  const email = ev.email?.trim().toLowerCase();
  const emailHash = email ? hashEmail(email) : null;
  if (!emailHash && !ev.externalId) return undefined;

  if (emailHash) {
    const existing = await db.query.identities.findFirst({
      where: and(eq(schema.identities.siteId, siteId), eq(schema.identities.emailHash, emailHash)),
    });
    if (existing) {
      await db
        .update(schema.identities)
        .set({ lastSeenAt: now, externalId: ev.externalId ?? existing.externalId, traits: { ...existing.traits, ...ev.traits } })
        .where(eq(schema.identities.id, existing.id));
      return existing.id;
    }
  }

  const id = newIdentityId();
  const [created] = await db
    .insert(schema.identities)
    .values({
      id,
      siteId,
      email: email ?? null,
      emailHash,
      externalId: ev.externalId ?? null,
      traits: ev.traits ?? {},
      firstSeenAt: now,
      lastSeenAt: now,
    })
    .onConflictDoNothing({ target: [schema.identities.siteId, schema.identities.emailHash] })
    .returning({ id: schema.identities.id });
  return created?.id ?? id;
}

async function recordOrder(
  db: Awaited<ReturnType<typeof getDb>>,
  ctx: IngestContext,
  visitorId: string,
  session: { id: string; channel: string | null; utmSource: string | null; utmCampaign: string | null },
  identityId: string | undefined,
  ev: IncomingEvent,
  now: Date,
) {
  const o = ev.order!;
  await db
    .insert(schema.orders)
    .values({
      id: newOrderId(),
      siteId: ctx.siteId,
      visitorId,
      sessionId: session.id,
      identityId: identityId ?? null,
      externalOrderId: o.externalOrderId ?? null,
      orderNumber: o.orderNumber ?? null,
      totalAmount: o.totalAmount,
      subtotalAmount: o.subtotalAmount ?? null,
      currency: o.currency ?? "USD",
      isNewCustomer: o.isNewCustomer ?? null,
      lineItems: o.lineItems ?? [],
      attributedChannel: session.channel,
      attributedSource: session.utmSource,
      attributedCampaign: session.utmCampaign,
      placedAt: ev.ts ? new Date(ev.ts) : now,
      receivedAt: now,
    })
    // s2s/webhook is source of truth; ignore a duplicate order id (e.g. client + server both fire).
    .onConflictDoNothing({ target: [schema.orders.siteId, schema.orders.externalOrderId] });
}
