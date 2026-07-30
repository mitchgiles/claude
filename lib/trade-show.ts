// Data model, catalog, and persistence for the Scourr trade show order-taking app.

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  price: number;
}

export interface OrderLine {
  productId: string;
  sku: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

export type PaymentMethod = 'Card' | 'Cash' | 'Invoice me';

export interface Order {
  id: string;
  createdAt: string;
  customerName: string;
  company: string;
  email: string;
  phone: string;
  notes: string;
  paymentMethod: PaymentMethod;
  lines: OrderLine[];
  total: number;
}

// Placeholder catalog — replace names/SKUs/prices with the real Scourr trade show lineup.
export const CATALOG: Product[] = [
  {
    id: 'single',
    sku: 'SCR-001',
    name: 'Scourr Original Cloth — Single',
    description: 'One reusable cleaning cloth',
    price: 4.99,
  },
  {
    id: 'pack3',
    sku: 'SCR-003',
    name: 'Scourr Original Cloth — 3 Pack',
    description: 'Three cloths, mixed colours',
    price: 12.99,
  },
  {
    id: 'pack6',
    sku: 'SCR-006',
    name: 'Scourr Original Cloth — 6 Pack',
    description: 'Six cloths, mixed colours',
    price: 22.99,
  },
  {
    id: 'bundle',
    sku: 'SCR-BUNDLE',
    name: 'Scourr Kitchen Bundle',
    description: '6 cloths + storage caddy',
    price: 29.99,
  },
  {
    id: 'pack12',
    sku: 'SCR-012',
    name: 'Scourr Trade Show Special — 12 Pack',
    description: 'Show-only bulk pack',
    price: 39.99,
  },
];

const STORAGE_KEY = 'scourr-trade-show-orders';

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
}

export function getOrders(): Order[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Order[]) : [];
  } catch {
    return [];
  }
}

function persist(orders: Order[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
}

export function saveOrder(order: Order): Order[] {
  const orders = [order, ...getOrders()];
  persist(orders);
  return orders;
}

export function deleteOrder(orderId: string): Order[] {
  const orders = getOrders().filter((o) => o.id !== orderId);
  persist(orders);
  return orders;
}

function csvEscape(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function ordersToCsv(orders: Order[]): string {
  const headers = [
    'Order ID',
    'Date/Time',
    'Customer Name',
    'Company',
    'Email',
    'Phone',
    'Payment Method',
    'Product SKU',
    'Product Name',
    'Quantity',
    'Unit Price',
    'Line Total',
    'Order Total',
    'Notes',
  ];

  const rows: string[][] = [];
  for (const order of orders) {
    for (const line of order.lines) {
      rows.push([
        order.id,
        order.createdAt,
        order.customerName,
        order.company,
        order.email,
        order.phone,
        order.paymentMethod,
        line.sku,
        line.name,
        String(line.quantity),
        line.unitPrice.toFixed(2),
        (line.unitPrice * line.quantity).toFixed(2),
        order.total.toFixed(2),
        order.notes,
      ]);
    }
  }

  return [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
}

export function downloadCsv(orders: Order[]) {
  const csv = ordersToCsv(orders);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `scourr-trade-show-orders-${timestamp}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
