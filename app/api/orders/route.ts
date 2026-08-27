import { NextRequest, NextResponse } from 'next/server';
import { JWT } from 'google-auth-library';
import type { Address, Order } from '@/lib/trade-show';

const SHEET_RANGE = 'Orders!A:O';

function addressLine(a: Address): string {
  return [a.line1, a.line2, a.city, a.postcode].filter(Boolean).join(', ');
}

function orderToRow(order: Order): string[] {
  const billing = order.billingSameAsShipping ? order.shippingAddress : order.billingAddress;
  return [
    order.id,
    order.createdAt,
    order.customerName,
    order.company,
    order.email,
    order.phone,
    order.paymentMethod,
    order.lines.map((l) => `${l.quantity}x ${l.name}`).join('; '),
    order.subtotal.toFixed(2),
    `${order.discountPercent}%`,
    order.total.toFixed(2),
    addressLine(order.shippingAddress),
    order.billingSameAsShipping ? 'Same as shipping' : addressLine(billing),
    order.stripeCheckoutUrl,
    order.notes,
  ];
}

export async function POST(request: NextRequest) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!email || !rawKey || !sheetId) {
    const missing = [
      !email && 'GOOGLE_SERVICE_ACCOUNT_EMAIL',
      !rawKey && 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
      !sheetId && 'GOOGLE_SHEET_ID',
    ].filter(Boolean);
    return NextResponse.json(
      { error: `Google Sheets sync is not configured. Missing: ${missing.join(', ')}.` },
      { status: 500 }
    );
  }

  const { order } = (await request.json()) as { order?: Order };
  if (!order) {
    return NextResponse.json({ error: 'Missing order.' }, { status: 400 });
  }

  try {
    const client = new JWT({
      email,
      key: rawKey.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(
      SHEET_RANGE
    )}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    await client.request({
      url,
      method: 'POST',
      data: { values: [orderToRow(order)] },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to sync order to Google Sheets.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
