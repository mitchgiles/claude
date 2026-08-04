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

  const { lines, customerEmail, orderId } = (await request.json()) as {
    lines?: CheckoutLine[];
    customerEmail?: string;
    orderId?: string;
  };

  if (!lines?.length) {
    return NextResponse.json({ error: 'No items to charge.' }, { status: 400 });
  }

  const origin = request.nextUrl.origin;

  try {
    const stripe = new Stripe(secretKey);
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
