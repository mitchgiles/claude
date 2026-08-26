import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { formatCurrency, type Order } from '@/lib/trade-show';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderOrderHtml(order: Order, audience: 'merchant' | 'customer'): string {
  const itemRows = order.lines
    .map(
      (l) =>
        `<tr><td style="padding:4px 8px;">${l.quantity}</td><td style="padding:4px 8px;">${escapeHtml(l.name)}</td><td style="padding:4px 8px;">${formatCurrency(l.unitPrice)}</td><td style="padding:4px 8px;">${formatCurrency(l.unitPrice * l.quantity)}</td></tr>`
    )
    .join('');

  const billing = order.billingSameAsShipping ? order.shippingAddress : order.billingAddress;
  const discountAmount = order.subtotal - order.total;

  const merchantBlock =
    audience === 'merchant'
      ? `<p>
          <strong>Customer:</strong> ${escapeHtml(order.customerName)}${order.company ? ` (${escapeHtml(order.company)})` : ''}<br/>
          ${order.email ? `Email: ${escapeHtml(order.email)}<br/>` : ''}
          ${order.phone ? `Phone: ${escapeHtml(order.phone)}<br/>` : ''}
          Payment method: ${escapeHtml(order.paymentMethod)}
        </p>`
      : '';

  const addressLines = (a: Order['shippingAddress']) =>
    [a.line1, a.line2, a.city, a.postcode].filter(Boolean).map(escapeHtml).join('<br/>');

  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; color: #1e293b;">
      <h2 style="margin-bottom:4px;">Scourr — Birmingham Trade Show</h2>
      <p style="color:#64748b; margin-top:0;">Order #${order.id} — ${escapeHtml(order.createdAt)}</p>
      ${merchantBlock}
      <table style="width:100%; border-collapse: collapse; font-size:14px;">
        <thead>
          <tr style="text-align:left; border-bottom:1px solid #e2e8f0;">
            <th style="padding:4px 8px;">Qty</th><th style="padding:4px 8px;">Item</th><th style="padding:4px 8px;">Unit</th><th style="padding:4px 8px;">Total</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <p style="font-size:14px;">
        Subtotal: ${formatCurrency(order.subtotal)}<br/>
        ${order.discountPercent > 0 ? `Discount (${order.discountPercent}%): -${formatCurrency(discountAmount)}<br/>` : ''}
        <strong>Total: ${formatCurrency(order.total)}</strong>
      </p>
      ${order.shippingAddress.line1 ? `<p><strong>Shipping address</strong><br/>${addressLines(order.shippingAddress)}</p>` : ''}
      ${!order.billingSameAsShipping && billing.line1 ? `<p><strong>Billing address</strong><br/>${addressLines(billing)}</p>` : ''}
      ${order.notes ? `<p><strong>Notes:</strong> ${escapeHtml(order.notes)}</p>` : ''}
    </div>
  `;
}

export async function POST(request: NextRequest) {
  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
  const merchantEmail = process.env.MERCHANT_EMAIL || gmailUser;
  // Custom "From" address — must be a verified "Send mail as" alias on the
  // GMAIL_USER account (Gmail Settings > Accounts and Import), otherwise
  // Gmail silently rewrites the From header back to gmailUser.
  const fromEmail = process.env.GMAIL_FROM_EMAIL || gmailUser;

  if (!gmailUser || !gmailAppPassword) {
    return NextResponse.json(
      {
        error:
          'Email is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in the environment.',
      },
      { status: 500 }
    );
  }

  const { order } = (await request.json()) as { order?: Order };
  if (!order) {
    return NextResponse.json({ error: 'Missing order.' }, { status: 400 });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailUser, pass: gmailAppPassword },
  });

  const messages: { to: string; subject: string; html: string }[] = [];
  if (merchantEmail) {
    messages.push({
      to: merchantEmail,
      subject: `New order #${order.id} — ${formatCurrency(order.total)}`,
      html: renderOrderHtml(order, 'merchant'),
    });
  }
  if (order.email) {
    messages.push({
      to: order.email,
      subject: `Your Scourr order confirmation #${order.id}`,
      html: renderOrderHtml(order, 'customer'),
    });
  }

  if (messages.length === 0) {
    return NextResponse.json({ sent: [] });
  }

  try {
    await Promise.all(
      messages.map((m) => transporter.sendMail({ from: fromEmail, to: m.to, subject: m.subject, html: m.html }))
    );
    return NextResponse.json({ sent: messages.map((m) => m.to) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send order confirmation email.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
