import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prisma } from '@/lib/db'

function getStripeClient(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) {
    return null
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-04-22.dahlia',
  })
}

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET

export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  let event: Stripe.Event

  try {
    if (!WEBHOOK_SECRET) {
      console.error('Stripe webhook secret not configured')
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
    }

    const stripe = getStripeClient()
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe secret key not configured' }, { status: 500 })
    }

    event = stripe.webhooks.constructEvent(body, sig || '', WEBHOOK_SECRET)
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`)
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 })
  }

  console.log(`Received Stripe webhook: ${event.type}`)

  try {
    switch (event.type) {
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice)
        break

      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case 'customer.created':
        await handleCustomerCreated(event.data.object as Stripe.Customer)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true, eventType: event.type })
  } catch (err: any) {
    console.error('Webhook processing error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const stripe = getStripeClient()
  if (!stripe) return

  if (!invoice.customer) {
    console.error('No customer on invoice')
    return
  }

  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer.id

  const subscription = await prisma.subscription.findFirst({
    where: { stripeCustomerId: customerId },
  })

  if (!subscription) {
    console.error(`No subscription found for customer ${customerId}`)
    return
  }

  const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId || '')

  await prisma.subscription.update({
    where: { userId: subscription.userId },
    data: {
      status: 'ACTIVE',
      tier: mapStripePriceToTier(stripeSubscription.items.data[0]?.price?.id || ''),
      generationLimit: getCreditLimitFromTier(mapStripePriceToTier(stripeSubscription.items.data[0]?.price?.id || '')),
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      canceledAt: stripeSubscription.cancel_at_period_end ? new Date() : null,
      updatedAt: new Date(),
    },
  })

  // Update user profile tier
  await prisma.profile.update({
    where: { userId: subscription.userId },
    data: {
      preferences: {
        subscriptionTier: mapStripePriceToTier(stripeSubscription.items.data[0]?.price?.id || ''),
      },
    },
  })

  console.log(`Subscription updated for user ${subscription.userId}: ${mapStripePriceToTier(stripeSubscription.items.data[0]?.price?.id || '')}`)
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const existingSub = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  })

  if (!existingSub) {
    console.error(`No local subscription found for Stripe subscription ${subscription.id}`)
    return
  }

  await prisma.subscription.update({
    where: { userId: existingSub.userId },
    data: {
      tier: mapStripePriceToTier(subscription.items.data[0]?.price?.id || ''),
      generationLimit: getCreditLimitFromTier(mapStripePriceToTier(subscription.items.data[0]?.price?.id || '')),
      status: subscription.status === 'active' ? 'ACTIVE' : subscription.status === 'past_due' ? 'EXPIRED' : 'CANCELED',
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      canceledAt: subscription.cancel_at_period_end ? new Date() : null,
      updatedAt: new Date(),
    },
  })

  await prisma.profile.update({
    where: { userId: existingSub.userId },
    data: {
      preferences: {
        subscriptionTier: mapStripePriceToTier(subscription.items.data[0]?.price?.id || ''),
      },
    },
  })

  console.log(`Subscription updated: ${existingSub.userId} -> ${mapStripePriceToTier(subscription.items.data[0]?.price?.id || '')}`)
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const existingSub = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  })

  if (!existingSub) return

  await prisma.subscription.update({
    where: { userId: existingSub.userId },
    data: {
      status: 'CANCELED',
      tier: 'FREE',
      generationLimit: 100,
      canceledAt: new Date(),
      updatedAt: new Date(),
    },
  })

  console.log(`Subscription canceled: ${existingSub.userId}`)
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscription = await prisma.subscription.findFirst({
    where: { stripeCustomerId: invoice.customer as string },
  })

  if (!subscription) return

  await prisma.subscription.update({
    where: { userId: subscription.userId },
    data: {
      status: 'EXPIRED',
      updatedAt: new Date(),
    },
  })

  console.log(`Payment failed for user ${subscription.userId}`)
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const stripe = getStripeClient()
  if (!stripe) return

  if (!session.customer || !session.subscription) {
    console.error('Missing customer or subscription in session')
    return
  }

  const customerId = typeof session.customer === 'string' ? session.customer : session.customer.id
  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: session.customer_details?.email || '' },
        { id: session.metadata?.userId || '' },
      ],
    },
    include: { profiles: true },
  })

  if (!user) {
    console.error(`No user found for customer ${customerId}`)
    return
  }

  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId)
  const tier = mapStripePriceToTier(stripeSubscription.items.data[0]?.price?.id || '')
  const limit = getCreditLimitFromTier(tier)

  await prisma.subscription.upsert({
    where: { userId: user.id },
    update: {
      tier,
      generationLimit: limit,
      status: 'ACTIVE',
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      canceledAt: stripeSubscription.cancel_at_period_end ? new Date() : null,
    },
    create: {
      userId: user.id,
      tier,
      generationLimit: limit,
      status: 'ACTIVE',
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      canceledAt: stripeSubscription.cancel_at_period_end ? new Date() : null,
    },
  })

  if (user.profiles?.[0]) {
    await prisma.profile.update({
      where: { id: user.profiles[0].id },
      data: {
        preferences: {
          ...(user.profiles[0].preferences as any || {}),
          subscriptionTier: tier,
        },
      },
    })
  }

  console.log(`Checkout completed: ${user.id} -> ${tier}`)
}

async function handleCustomerCreated(customer: Stripe.Customer) {
  if (!customer.email) return

  const user = await prisma.user.findUnique({ where: { email: customer.email } })
  if (!user) return

  await prisma.subscription.upsert({
    where: { userId: user.id },
    update: { stripeCustomerId: customer.id },
    create: {
      userId: user.id,
      tier: 'FREE',
      generationLimit: 100,
      status: 'ACTIVE',
      stripeCustomerId: customer.id,
    },
  })

  console.log(`Customer created for user: ${user.id}`)
}

function mapStripePriceToTier(priceId: string): 'FREE' | 'PRO' | 'ENTERPRISE' {
  const tierMap: Record<string, 'FREE' | 'PRO' | 'ENTERPRISE'> = {
    'price_pro_monthly': 'PRO',
    'price_pro_yearly': 'PRO',
    'price_enterprise_monthly': 'ENTERPRISE',
    'price_enterprise_yearly': 'ENTERPRISE',
  }
  return tierMap[priceId] || 'FREE'
}

function getCreditLimitFromTier(tier: 'FREE' | 'PRO' | 'ENTERPRISE'): number {
  const limits: Record<'FREE' | 'PRO' | 'ENTERPRISE', number> = {
    FREE: 100,
    PRO: 1000,
    ENTERPRISE: 10000,
  }
  return limits[tier]
}

