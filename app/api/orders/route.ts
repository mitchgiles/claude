import { NextRequest, NextResponse } from 'next/server';
import { JWT } from 'google-auth-library';
import type { Address, Order } from '@/lib/trade-show';

const SHEET_RANGE = 'Sheet1!A:O';

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

// Accepts the key in whatever shape it survived pasting into an env var UI:
// literal "\n" escape sequences, real newlines, or accidentally-included
// surrounding quotes from the downloaded JSON file. GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_B64
// (the whole key, base64-encoded) sidesteps all of that and is the most reliable option.
function resolvePrivateKey(): string | undefined {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_B64;
  if (b64) {
    try {
      return Buffer.from(b64.trim(), 'base64').toString('utf8');
    } catch {
      return undefined;
    }
  }

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!raw) return undefined;

  let key = raw.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, '\n');
}

// Strips surrounding quotes/whitespace, and pulls the ID out if the whole sheet
// URL got pasted instead of just its ID segment — the same class of mistake as
// the private key field.
function resolveSheetId(): string | undefined {
  const raw = process.env.GOOGLE_SHEET_ID;
  if (!raw) return undefined;

  let id = raw.trim();
  if ((id.startsWith('"') && id.endsWith('"')) || (id.startsWith("'") && id.endsWith("'"))) {
    id = id.slice(1, -1).trim();
  }

  const urlMatch = id.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (urlMatch) {
    id = urlMatch[1];
  }

  return id;
}

export async function POST(request: NextRequest) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = resolvePrivateKey();
  const sheetId = resolveSheetId();

  if (!email || !key || !sheetId) {
    const missing = [
      !email && 'GOOGLE_SERVICE_ACCOUNT_EMAIL',
      !key && 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY (or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_B64)',
      !sheetId && 'GOOGLE_SHEET_ID',
    ].filter(Boolean);
    return NextResponse.json(
      { error: `Google Sheets sync is not configured. Missing: ${missing.join(', ')}.` },
      { status: 500 }
    );
  }

  if (!/^[a-zA-Z0-9_-]{20,}$/.test(sheetId)) {
    return NextResponse.json(
      {
        error: `GOOGLE_SHEET_ID doesn't look like a valid spreadsheet ID (got "${sheetId}", ${sheetId.length} chars). It should be only the ID segment from the sheet's URL — a long string of letters/numbers/underscores/hyphens with no slashes, spaces, or quotes.`,
      },
      { status: 500 }
    );
  }

  const { order } = (await request.json()) as { order?: Order };
  if (!order) {
    return NextResponse.json({ error: 'Missing order.' }, { status: 400 });
  }

  // Diagnose key corruption without ever echoing the secret itself — the PEM
  // markers and line count are safe to report (every RSA key has them).
  const hasBegin = key.includes('BEGIN PRIVATE KEY');
  const hasEnd = key.includes('END PRIVATE KEY');
  const lineCount = key.split('\n').length;
  if (!hasBegin || !hasEnd || lineCount < 3) {
    return NextResponse.json(
      {
        error: `The resolved private key doesn't look valid (length ${key.length} chars, ${lineCount} line(s), BEGIN marker: ${hasBegin}, END marker: ${hasEnd}). It's likely the whole JSON file got pasted instead of just the private_key field, or the value is truncated/empty.`,
      },
      { status: 500 }
    );
  }

  try {
    const client = new JWT({
      email,
      key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      sheetId
    )}/values/${encodeURIComponent(
      SHEET_RANGE
    )}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    await client.request({
      url,
      method: 'POST',
      data: { values: [orderToRow(order)] },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    let message = err instanceof Error ? err.message : 'Failed to sync order to Google Sheets.';
    // gaxios (used by google-auth-library) attaches the HTTP response; surface its
    // status so "not found" vs "permission denied" vs other failures are distinguishable.
    const status = (err as { response?: { status?: number } })?.response?.status;
    // Google returns an HTML "file not found" page (not JSON) when the sheet ID is wrong,
    // which otherwise surfaces as a wall of unreadable markup.
    if (/^\s*<!DOCTYPE html/i.test(message) || /<title>Page Not Found<\/title>/i.test(message)) {
      message =
        status === 403
          ? `Google Sheets denied access to spreadsheet ID "${sheetId}". Share the sheet (Editor access) with the service account email in GOOGLE_SERVICE_ACCOUNT_EMAIL.`
          : `Google Sheets couldn't find spreadsheet ID "${sheetId}" (HTTP ${status ?? 'unknown'}). Double-check it against the sheet's URL (https://docs.google.com/spreadsheets/d/THIS_PART/edit) and that the sheet hasn't been deleted.`;
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
