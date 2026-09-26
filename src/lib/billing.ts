import { db } from './db';
import { DomainError } from './domain';
import {
  WRITABLE_STATUSES,
  type BillingState,
  type PlanLimits,
} from './plan-math';

/**
 * Server-side billing. This module imports Prisma, so it must never be
 * imported from a client component — use `plan-math.ts` there instead.
 */

export {
  formatMoney,
  withinLimit,
  remaining,
  addMonths,
  TRIAL_DAYS,
  GRACE_DAYS,
  DUE_DAYS,
  WRITABLE_STATUSES,
} from './plan-math';
export type { BillingState, PlanLimits } from './plan-math';

/* ───────────────────── Subscription lifecycle ─────────────────────

   Trialing ─┬─> Active ─┬─> PastDue ─┬─> Active      (invoice paid)
             │           │            └─> Cancelled   (grace expired)
             │           └─> Cancelled
             └─> Cancelled

   A tenant is billable while Trialing or Active. PastDue keeps working
   through a grace window so an unpaid invoice never destroys live data;
   past the window the workspace is suspended, not deleted.              */

/**
 * Counts what a tenant actually uses. Derived from the live tables rather
 * than a counter column, so it cannot drift out of sync with reality. A seat
 * is an active membership of any role (BR-05); storage is the size of every
 * accepted file.
 */
export async function usageFor(tenantId: string) {
  const [courses, members, storage] = await Promise.all([
    db.course.count({ where: { tenantId, archivedAt: null } }),
    db.membership.count({ where: { tenantId, active: true, supportGrant: false } }),
    db.asset.aggregate({ where: { tenantId, status: { not: 'Rejected' } }, _sum: { size: true } }),
  ]);
  return { courses, members, storageMb: Math.ceil((storage._sum.size ?? 0) / 1048576) };
}

export async function subscriptionFor(tenantId: string) {
  return db.subscription.findUnique({ where: { tenantId }, include: { plan: true } });
}

function assertWritable(status: string) {
  if (!WRITABLE_STATUSES.includes(status as (typeof WRITABLE_STATUSES)[number])) {
    throw new DomainError('subscriptionInactive', 402);
  }
}

/**
 * The single gate every limited write goes through. Called inside the command
 * layer and never trusted from the client, which only uses the same numbers
 * to disable a button early. Reaching the limit blocks the next addition and
 * never deletes anything (FR-05).
 */
export async function assertWithinPlan(tenantId: string, resource: 'courses' | 'members', adding = 1) {
  const subscription = await subscriptionFor(tenantId);
  // No subscription row means an internally provisioned workspace: uncapped.
  if (!subscription) return;
  assertWritable(subscription.status);
  const usage = await usageFor(tenantId);
  const limit = { courses: subscription.plan.maxCourses, members: subscription.plan.maxMembers }[resource];
  if (limit >= 0 && usage[resource] + adding > limit) throw new DomainError('planLimit', 402);
}

/** Refuses an upload that would take the workspace past its storage allowance. */
export async function assertStorage(tenantId: string, extraBytes: number) {
  const subscription = await subscriptionFor(tenantId);
  if (!subscription) return;
  assertWritable(subscription.status);
  if (subscription.plan.storageMb < 0) return;
  const used = await db.asset.aggregate({ where: { tenantId, status: { not: 'Rejected' } }, _sum: { size: true } });
  if ((used._sum.size ?? 0) + extraBytes > subscription.plan.storageMb * 1048576) throw new DomainError('storageLimit', 402);
}

/** Feature flags carried by the plan, e.g. the impact-measurement module. */
export async function assertFeature(tenantId: string, feature: string) {
  const subscription = await subscriptionFor(tenantId);
  if (!subscription) return;
  if (!subscription.plan.features.includes(feature)) throw new DomainError('planFeature', 402);
}

export async function billingStateFor(tenantId: string): Promise<BillingState | null> {
  const subscription = await subscriptionFor(tenantId);
  if (!subscription) return null;
  const usage = await usageFor(tenantId);
  const endsAt =
    subscription.status === 'Trialing' && subscription.trialEndsAt
      ? subscription.trialEndsAt
      : subscription.currentPeriodEnd;

  return {
    status: subscription.status,
    planCode: subscription.plan.code,
    planNameAr: subscription.plan.nameAr,
    planNameEn: subscription.plan.nameEn,
    priceMonthly: subscription.plan.priceMonthly,
    currency: subscription.plan.currency,
    limits: {
      maxCourses: subscription.plan.maxCourses,
      maxMembers: subscription.plan.maxMembers,
      storageMb: subscription.plan.storageMb,
      features: subscription.plan.features,
    },
    usage,
    trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
    currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    daysLeft: Math.ceil((endsAt.getTime() - Date.now()) / 86_400_000),
    version: subscription.version,
  };
}

/**
 * Sequential, human-readable invoice numbers: INV-2026-000042.
 *
 * Derived from the highest number already issued this year, NOT from a count:
 * counting breaks the moment an invoice is voided or removed, because the
 * count drops and the next number collides with one still on the books.
 * The suffix is zero-padded to a fixed width, so lexicographic ordering and
 * numeric ordering agree and `orderBy: desc` finds the true maximum.
 *
 * Two concurrent issues could still pick the same number; the unique index on
 * `Invoice.number` is the backstop that turns that into a failed transaction
 * rather than a duplicate.
 */
export async function nextInvoiceNumber(tx: {
  invoice: { findFirst: (args: unknown) => Promise<{ number: string } | null> };
}) {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const latest = await tx.invoice.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: 'desc' },
    select: { number: true },
  } as unknown);
  const previous = latest ? Number.parseInt(latest.number.slice(prefix.length), 10) : 0;
  return `${prefix}${String((Number.isFinite(previous) ? previous : 0) + 1).padStart(6, '0')}`;
}

/* ─────────────────── Payment provider seam ───────────────────

   The app never talks to a gateway directly. `manual` is fully
   implemented: an invoice is issued and an operator marks it paid on
   receipt of a bank transfer — how most B2B billing in the region
   actually works. A hosted gateway (Moyasar, Tap, Stripe) is added by
   implementing this interface and registering it; nothing else in the
   app changes.                                                          */

export type CheckoutRequest = {
  tenantId: string;
  invoiceId: string;
  amount: number;
  currency: string;
  description: string;
  returnUrl: string;
};

export type CheckoutResult =
  /** Money is collected out of band; show the customer what to transfer. */
  | { kind: 'instructions'; reference: string }
  /** Send the customer to the gateway's hosted page; `externalId` is the gateway's own reference for the invoice. */
  | { kind: 'redirect'; url: string; externalId?: string };

export type PaymentProvider = {
  code: string;
  createCheckout(request: CheckoutRequest): Promise<CheckoutResult>;
  /**
   * Normalises one signed provider notification (FR-053). Returning null means
   * the payload is not something this provider recognises, which the route
   * answers as a validation failure rather than guessing.
   */
  parseEvent?(body: Record<string, unknown>):
    | { externalId: string; invoiceId: string; status: 'paid' | 'failed' | 'pending'; amount?: number }
    | null;
};

const manual: PaymentProvider = {
  code: 'manual',
  async createCheckout(request) {
    return { kind: 'instructions', reference: request.invoiceId.slice(0, 8).toUpperCase() };
  },
  // A bank transfer has no gateway callback, but the same envelope lets an
  // operator or a reconciliation script post a receipt through one path.
  parseEvent(body) {
    const externalId = String(body.id ?? '');
    const invoiceId = String(body.invoiceId ?? '');
    if (!externalId || !invoiceId) return null;
    const status = body.status === 'paid' ? 'paid' : body.status === 'failed' ? 'failed' : 'pending';
    return { externalId, invoiceId, status, amount: Number(body.amount ?? 0) || undefined };
  },
};

/* ───────────────────────────── Moyasar ─────────────────────────────

   Hosted invoice flow. The customer is sent to a Moyasar page that takes
   mada, Visa, Mastercard and Apple Pay; Moyasar then redirects back to the
   billing page and, when a webhook is configured, also posts a signed event.
   Both roads end in `settleExternalPayment`, which checks the amount to the
   halala before anything is marked paid. Configuration:

     BILLING_PROVIDER=moyasar
     MOYASAR_SECRET_KEY=sk_test_...      the API secret key (test or live)
     MOYASAR_WEBHOOK_SECRET=...          the secret token set on the webhook

   Without MOYASAR_SECRET_KEY the provider refuses to start a checkout with
   `billingUnavailable`; the bank transfer path keeps working regardless.   */

const MOYASAR_API = 'https://api.moyasar.com/v1';

export type ExternalPayment = {
  externalId: string;
  invoiceId: string;
  status: 'paid' | 'failed' | 'pending';
  amount?: number;
};

function moyasarAuth() {
  const key = process.env.MOYASAR_SECRET_KEY;
  if (!key) throw new DomainError('billingUnavailable', 503);
  return `Basic ${Buffer.from(`${key}:`).toString('base64')}`;
}

/** Maps one Moyasar invoice or payment object to the neutral envelope. */
export function fromMoyasar(object: Record<string, unknown>): ExternalPayment | null {
  const externalId = String(object.id ?? '');
  const metadata = (object.metadata ?? {}) as Record<string, unknown>;
  const invoiceId = String(metadata.invoice_id ?? object.invoice_id ?? '');
  if (!externalId || !invoiceId) return null;
  const raw = String(object.status ?? '');
  const status: ExternalPayment['status'] = raw === 'paid' ? 'paid' : ['failed', 'expired', 'canceled', 'cancelled', 'voided'].includes(raw) ? 'failed' : 'pending';
  const amount = Number(object.amount);
  return { externalId, invoiceId, status, amount: Number.isFinite(amount) ? amount : undefined };
}

export const moyasar: PaymentProvider & { fetchInvoice(externalId: string): Promise<ExternalPayment | null> } = {
  code: 'moyasar',
  async createCheckout(request) {
    const response = await fetch(`${MOYASAR_API}/invoices`, {
      method: 'POST',
      headers: { authorization: moyasarAuth(), 'content-type': 'application/json' },
      body: JSON.stringify({
        amount: request.amount,
        currency: request.currency,
        description: request.description,
        // Moyasar appends its own id and status; ours identifies the invoice on return.
        callback_url: `${request.returnUrl}?payment=${request.invoiceId}`,
        metadata: { invoice_id: request.invoiceId, tenant_id: request.tenantId },
      }),
    });
    if (!response.ok) throw new DomainError('billingUnavailable', 502);
    const body = (await response.json()) as { id?: string; url?: string };
    if (!body.url || !body.id) throw new DomainError('billingUnavailable', 502);
    return { kind: 'redirect', url: body.url, externalId: body.id };
  },
  // Webhook payloads wrap the object: { type: 'invoice_paid' | 'payment_paid' | ..., data: {...} }
  parseEvent(body) {
    const data = (body.data ?? body) as Record<string, unknown>;
    return fromMoyasar(data);
  },
  async fetchInvoice(externalId) {
    const response = await fetch(`${MOYASAR_API}/invoices/${encodeURIComponent(externalId)}`, {
      headers: { authorization: moyasarAuth() },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return fromMoyasar((await response.json()) as Record<string, unknown>);
  },
};

/**
 * Reconciles one external payment against our invoice. Idempotent by the
 * unique (provider, externalId) row: a replayed notification throws P2002 and
 * the caller answers success without touching anything. The amount must match
 * to the halala; a mismatch is recorded for a person to look at, never paid.
 */
export async function settleExternalPayment(
  tx: {
    inboundEvent: { create: (args: unknown) => Promise<unknown>; update: (args: unknown) => Promise<unknown> };
    invoice: { findUnique: (args: unknown) => Promise<{ id: string; tenantId: string; subscriptionId: string; amount: number; status: string } | null>; update: (args: unknown) => Promise<unknown> };
    subscription: { update: (args: unknown) => Promise<unknown> };
    tenant: { updateMany: (args: unknown) => Promise<unknown> };
    audit: { create: (args: unknown) => Promise<unknown> };
  },
  provider: string,
  event: ExternalPayment,
  payload: object,
): Promise<'paid' | 'failed' | 'pending' | 'mismatch' | 'unknown'> {
  await tx.inboundEvent.create({ data: { provider, externalId: event.externalId, type: event.status, payload } });
  const invoice = await tx.invoice.findUnique({ where: { id: event.invoiceId } });
  if (!invoice) return 'unknown';
  if (event.status === 'paid' && invoice.status === 'Open') {
    const amount = event.amount ?? invoice.amount;
    if (amount !== invoice.amount) {
      await tx.inboundEvent.update({ where: { provider_externalId: { provider, externalId: event.externalId } }, data: { status: 'Mismatch', error: `expected ${invoice.amount} received ${amount}` } });
      return 'mismatch';
    }
    await tx.invoice.update({ where: { id: invoice.id }, data: { status: 'Paid', paidAt: new Date(), providerRef: event.externalId } });
    await tx.subscription.update({ where: { id: invoice.subscriptionId }, data: { status: 'Active' } });
    await tx.tenant.updateMany({ where: { id: invoice.tenantId, status: 'Suspended' }, data: { status: 'Active' } });
    await tx.audit.create({ data: { tenantId: invoice.tenantId, actorId: 'provider', action: 'invoice.paid', entityId: invoice.id, detail: { provider, externalId: event.externalId, amount } } });
    return 'paid';
  }
  if (event.status === 'failed' && invoice.status === 'Open') {
    await tx.audit.create({ data: { tenantId: invoice.tenantId, actorId: 'provider', action: 'invoice.payment_failed', entityId: invoice.id, detail: { provider, externalId: event.externalId } } });
    return 'failed';
  }
  return invoice.status === 'Paid' ? 'paid' : event.status;
}

const providers: Record<string, PaymentProvider> = { manual, moyasar };

export function registerProvider(provider: PaymentProvider) {
  providers[provider.code] = provider;
}

export function paymentProvider(code = process.env.BILLING_PROVIDER ?? 'manual') {
  const provider = providers[code];
  if (!provider) throw new DomainError('invalid');
  return provider;
}
