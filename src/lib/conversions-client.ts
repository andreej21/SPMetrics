import type { IncomingEvent } from "./ingest";

export interface ConversionsAPIConfig {
  baseUrl: string; // e.g. "https://your-domain.com" or "http://localhost:3000"
  s2sKey: string;
}

export interface ConversionEventOptions {
  anonId?: string; // visitor ID from sp_vid cookie
  email?: string;
  externalId?: string;
  events: IncomingEvent[];
}

/**
 * Server-to-server conversions client for sending purchase & custom events from your backend.
 * Bypasses ad-blockers, eliminates client-side pixel reliability issues.
 */
export class ConversionsClient {
  private baseUrl: string;
  private s2sKey: string;

  constructor(config: ConversionsAPIConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.s2sKey = config.s2sKey;
  }

  async send(payload: ConversionEventOptions): Promise<{ ok: boolean; accepted: number }> {
    const res = await fetch(`${this.baseUrl}/api/conversions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.s2sKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Conversions API error: ${err.error}`);
    }

    return res.json();
  }

  /**
   * Track a purchase order. This is the most common integration point.
   * Call this from your backend when an order is placed (Shopify webhook, checkout webhook, etc).
   */
  async recordPurchase(
    externalOrderId: string,
    options: {
      anonId?: string;
      email?: string;
      externalId?: string;
      orderNumber?: string;
      totalAmount: number; // minor units (cents)
      subtotalAmount?: number;
      currency?: string;
      isNewCustomer?: boolean;
      lineItems?: Array<{
        productId?: string;
        variantId?: string;
        title?: string;
        quantity: number;
        price: number; // minor units
      }>;
    },
  ): Promise<{ ok: boolean; accepted: number }> {
    return this.send({
      anonId: options.anonId,
      email: options.email,
      externalId: options.externalId,
      events: [
        {
          type: "purchase",
          order: {
            externalOrderId,
            orderNumber: options.orderNumber,
            totalAmount: options.totalAmount,
            subtotalAmount: options.subtotalAmount,
            currency: options.currency ?? "USD",
            isNewCustomer: options.isNewCustomer,
            lineItems: options.lineItems,
          },
          dedupeKey: `order_${externalOrderId}`,
        },
      ],
    });
  }

  /**
   * Track a custom event (add to cart, wishlist, etc) from the backend.
   */
  async trackEvent(
    name: string,
    options: {
      anonId?: string;
      email?: string;
      props?: Record<string, unknown>;
      dedupeKey?: string;
    } = {},
  ): Promise<{ ok: boolean; accepted: number }> {
    return this.send({
      anonId: options.anonId,
      email: options.email,
      events: [
        {
          type: "custom",
          name,
          props: options.props,
          dedupeKey: options.dedupeKey,
        },
      ],
    });
  }

  /**
   * Identify a visitor by email or external ID.
   * Merges cross-session identity and enables repeat-purchase cohort tracking.
   */
  async identify(
    anonId: string,
    options: {
      email?: string;
      externalId?: string;
      traits?: Record<string, unknown>;
    } = {},
  ): Promise<{ ok: boolean; accepted: number }> {
    return this.send({
      anonId,
      email: options.email,
      externalId: options.externalId,
      events: [
        {
          type: "identify",
          email: options.email,
          externalId: options.externalId,
          traits: options.traits,
        },
      ],
    });
  }
}
