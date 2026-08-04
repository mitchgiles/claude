'use client';

import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, Trash2, Download, ShoppingCart, CheckCircle2, CreditCard, ExternalLink } from 'lucide-react';
import {
  CATALOG,
  EMPTY_ADDRESS,
  formatCurrency,
  getOrders,
  saveOrder,
  deleteOrder,
  downloadCsv,
  type Address,
  type Order,
  type OrderLine,
  type PaymentMethod,
} from '@/lib/trade-show';

const PAYMENT_METHODS: PaymentMethod[] = ['Card', 'Cash', 'Invoice me'];

export default function TradeShowPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [customerName, setCustomerName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Card');
  const [shippingAddress, setShippingAddress] = useState<Address>(EMPTY_ADDRESS);
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [billingAddress, setBillingAddress] = useState<Address>(EMPTY_ADDRESS);
  const [orderRef, setOrderRef] = useState<string | null>(null);
  const [stripeCheckoutUrl, setStripeCheckoutUrl] = useState<string | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  useEffect(() => {
    // One-time hydration from localStorage; SSR has no access to it.
    setOrders(getOrders());
  }, []);

  const cartLines: OrderLine[] = useMemo(
    () =>
      CATALOG.filter((p) => (quantities[p.id] ?? 0) > 0).map((p) => ({
        productId: p.id,
        sku: p.sku,
        name: p.name,
        unitPrice: p.price,
        quantity: quantities[p.id],
      })),
    [quantities]
  );

  const cartTotal = cartLines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const cartItemCount = cartLines.reduce((sum, l) => sum + l.quantity, 0);

  const dayStats = useMemo(() => {
    const revenue = orders.reduce((sum, o) => sum + o.total, 0);
    const items = orders.reduce((sum, o) => sum + o.lines.reduce((s, l) => s + l.quantity, 0), 0);
    return { orderCount: orders.length, revenue, items };
  }, [orders]);

  function setQty(productId: string, qty: number) {
    setQuantities((prev) => ({ ...prev, [productId]: Math.max(0, qty) }));
  }

  function clearCart() {
    setQuantities({});
    setCustomerName('');
    setCompany('');
    setEmail('');
    setPhone('');
    setNotes('');
    setPaymentMethod('Card');
    setShippingAddress(EMPTY_ADDRESS);
    setBillingSameAsShipping(true);
    setBillingAddress(EMPTY_ADDRESS);
    setOrderRef(null);
    setStripeCheckoutUrl(null);
    setStripeError(null);
  }

  async function generateStripeLink() {
    if (cartLines.length === 0) return;
    setStripeLoading(true);
    setStripeError(null);
    const ref = orderRef ?? crypto.randomUUID().slice(0, 8);
    if (!orderRef) setOrderRef(ref);

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: ref,
          customerEmail: email.trim() || undefined,
          lines: cartLines.map((l) => ({ name: l.name, unitPrice: l.unitPrice, quantity: l.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create Stripe checkout link.');
      setStripeCheckoutUrl(data.url);
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setStripeError(err instanceof Error ? err.message : 'Failed to create Stripe checkout link.');
    } finally {
      setStripeLoading(false);
    }
  }

  function completeOrder() {
    if (cartLines.length === 0) return;

    const order: Order = {
      id: orderRef ?? crypto.randomUUID().slice(0, 8),
      createdAt: new Date().toLocaleString('en-GB'),
      customerName: customerName.trim() || 'Walk-in',
      company: company.trim(),
      email: email.trim(),
      phone: phone.trim(),
      notes: notes.trim(),
      paymentMethod,
      lines: cartLines,
      total: cartTotal,
      shippingAddress,
      billingSameAsShipping,
      billingAddress: billingSameAsShipping ? EMPTY_ADDRESS : billingAddress,
      stripeCheckoutUrl: stripeCheckoutUrl ?? '',
    };

    const updated = saveOrder(order);
    setOrders(updated);
    setConfirmation(`Order #${order.id} saved — ${formatCurrency(order.total)}`);
    clearCart();
    setTimeout(() => setConfirmation(null), 4000);
  }

  function handleDeleteOrder(id: string) {
    if (!window.confirm('Delete this order? This cannot be undone.')) return;
    setOrders(deleteOrder(id));
  }

  function handleClearHistory() {
    if (!window.confirm(`Delete all ${orders.length} saved orders? This cannot be undone.`)) return;
    orders.forEach((o) => deleteOrder(o.id));
    setOrders([]);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">Scourr — Birmingham Trade Show</h1>
            <p className="text-sm text-slate-500">Order taking</p>
          </div>
          <div className="flex gap-4 text-sm">
            <Stat label="Orders" value={String(dayStats.orderCount)} />
            <Stat label="Items sold" value={String(dayStats.items)} />
            <Stat label="Revenue" value={formatCurrency(dayStats.revenue)} />
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-8 lg:grid-cols-5">
        {/* Product catalog */}
        <section className="lg:col-span-3">
          <h2 className="mb-3 text-lg font-semibold">Products</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {CATALOG.map((product) => {
              const qty = quantities[product.id] ?? 0;
              return (
                <div
                  key={product.id}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div>
                    <p className="font-semibold leading-snug">{product.name}</p>
                    <p className="text-sm text-slate-500">{product.description}</p>
                    <p className="mt-1 text-xs text-slate-400">{product.sku}</p>
                    <p className="mt-2 text-lg font-bold">{formatCurrency(product.price)}</p>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Decrease ${product.name} quantity`}
                        onClick={() => setQty(product.id, qty - 1)}
                        className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300"
                      >
                        <Minus size={18} />
                      </button>
                      <span className="w-8 text-center text-lg font-semibold tabular-nums">{qty}</span>
                      <button
                        type="button"
                        aria-label={`Increase ${product.name} quantity`}
                        onClick={() => setQty(product.id, qty + 1)}
                        className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-slate-700 active:bg-slate-600"
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Current order + customer details */}
        <section className="lg:col-span-2">
          <div className="sticky top-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <ShoppingCart size={20} /> Current order
            </h2>

            {cartLines.length === 0 ? (
              <p className="text-sm text-slate-400">No items yet — tap + on a product to add it.</p>
            ) : (
              <ul className="mb-3 divide-y divide-slate-100">
                {cartLines.map((line) => (
                  <li key={line.productId} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <p className="font-medium">{line.name}</p>
                      <p className="text-slate-400">
                        {line.quantity} × {formatCurrency(line.unitPrice)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">{formatCurrency(line.unitPrice * line.quantity)}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${line.name}`}
                        onClick={() => setQty(line.productId, 0)}
                        className="text-slate-400 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base font-bold">
              <span>Total ({cartItemCount} items)</span>
              <span>{formatCurrency(cartTotal)}</span>
            </div>

            <div className="mt-4 space-y-2">
              <p className="text-sm font-semibold text-slate-600">Customer (optional)</p>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Name (leave blank for walk-in)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
              <div className="flex gap-2">
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <textarea
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              {paymentMethod === 'Card' && (
                <div className="rounded-lg bg-slate-50 p-3">
                  <button
                    type="button"
                    onClick={generateStripeLink}
                    disabled={cartLines.length === 0 || stripeLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
                  >
                    <CreditCard size={16} />
                    {stripeLoading ? 'Creating Stripe checkout…' : 'Get Stripe payment link'}
                  </button>
                  {stripeCheckoutUrl && (
                    <a
                      href={stripeCheckoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 flex items-center justify-center gap-1 text-sm font-medium text-emerald-700 hover:underline"
                    >
                      Open Stripe checkout <ExternalLink size={14} />
                    </a>
                  )}
                  {stripeError && <p className="mt-2 text-sm text-red-600">{stripeError}</p>}
                </div>
              )}

              <p className="pt-2 text-sm font-semibold text-slate-600">Shipping address</p>
              <AddressFields value={shippingAddress} onChange={setShippingAddress} idPrefix="ship" />

              <label className="flex items-center gap-2 pt-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={billingSameAsShipping}
                  onChange={(e) => setBillingSameAsShipping(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Billing address same as shipping
              </label>
              {!billingSameAsShipping && (
                <>
                  <p className="pt-1 text-sm font-semibold text-slate-600">Billing address</p>
                  <AddressFields value={billingAddress} onChange={setBillingAddress} idPrefix="bill" />
                </>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={clearCart}
                className="flex-1 rounded-lg border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={completeOrder}
                disabled={cartLines.length === 0}
                className="flex-[2] rounded-lg bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              >
                Complete order & save
              </button>
            </div>

            {confirmation && (
              <p className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                <CheckCircle2 size={16} /> {confirmation}
              </p>
            )}
          </div>
        </section>

        {/* Order history */}
        <section className="lg:col-span-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Order history</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => downloadCsv(orders)}
                disabled={orders.length === 0}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                <Download size={16} /> Export CSV
              </button>
              <button
                type="button"
                onClick={handleClearHistory}
                disabled={orders.length === 0}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                Clear history
              </button>
            </div>
          </div>

          {orders.length === 0 ? (
            <p className="text-sm text-slate-400">No orders saved yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Time</th>
                    <th className="px-4 py-2">Customer</th>
                    <th className="px-4 py-2">Items</th>
                    <th className="px-4 py-2">Payment</th>
                    <th className="px-4 py-2 text-right">Total</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td className="px-4 py-2 whitespace-nowrap text-slate-500">{order.createdAt}</td>
                      <td className="px-4 py-2">
                        <p className="font-medium">{order.customerName}</p>
                        {order.company && <p className="text-xs text-slate-400">{order.company}</p>}
                      </td>
                      <td className="px-4 py-2 text-slate-500">
                        {order.lines.map((l) => `${l.quantity}× ${l.name}`).join(', ')}
                      </td>
                      <td className="px-4 py-2">{order.paymentMethod}</td>
                      <td className="px-4 py-2 text-right font-semibold">{formatCurrency(order.total)}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          aria-label={`Delete order ${order.id}`}
                          onClick={() => handleDeleteOrder(order.id)}
                          className="text-slate-400 hover:text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function AddressFields({
  value,
  onChange,
  idPrefix,
}: {
  value: Address;
  onChange: (next: Address) => void;
  idPrefix: string;
}) {
  function set(field: keyof Address, fieldValue: string) {
    onChange({ ...value, [field]: fieldValue });
  }

  return (
    <div className="space-y-2">
      <input
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        placeholder="Address line 1"
        value={value.line1}
        onChange={(e) => set('line1', e.target.value)}
        id={`${idPrefix}-line1`}
      />
      <input
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        placeholder="Address line 2 (optional)"
        value={value.line2}
        onChange={(e) => set('line2', e.target.value)}
        id={`${idPrefix}-line2`}
      />
      <div className="flex gap-2">
        <input
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          placeholder="City/Town"
          value={value.city}
          onChange={(e) => set('city', e.target.value)}
          id={`${idPrefix}-city`}
        />
        <input
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          placeholder="Postcode"
          value={value.postcode}
          onChange={(e) => set('postcode', e.target.value)}
          id={`${idPrefix}-postcode`}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-100 px-3 py-1.5 text-center">
      <p className="text-sm font-bold leading-tight">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}
