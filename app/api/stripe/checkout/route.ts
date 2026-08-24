import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

interface CheckoutLine {
  name: string;
  unitPrice: number;
  quantity: number;
}

export async function POST(request: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json(
      { error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in the environment.' },
      { status: 500 }
    );
  }

  const { lines, customerEmail, orderId, discountPercent } = (await request.json()) as {
    lines?: CheckoutLine[];
    customerEmail?: string;
    orderId?: string;
    discountPercent?: number;
  };

  if (!lines?.length) {
    return NextResponse.json({ error: 'No items to charge.' }, { status: 400 });
  }

  const origin = request.nextUrl.origin;
  const percentOff = Math.min(100, Math.max(0, discountPercent ?? 0));

  try {
    const stripe = new Stripe(secretKey);

    let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
    if (percentOff > 0) {
      const coupon = await stripe.coupons.create({ percent_off: percentOff, duration: 'once' });
      discounts = [{ coupon: coupon.id }];
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lines.map((line) => ({
        quantity: line.quantity,
        price_data: {
          currency: 'gbp',
          unit_amount: Math.round(line.unitPrice * 100),
          product_data: { name: line.name },
        },
      })),
      discounts,
      customer_email: customerEmail || undefined,
      client_reference_id: orderId,
      success_url: `${origin}/trade-show?stripe=success`,
      cancel_url: `${origin}/trade-show?stripe=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create Stripe checkout session.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
