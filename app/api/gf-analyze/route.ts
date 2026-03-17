import Anthropic from '@anthropic-ai/sdk';
import ExcelJS from 'exceljs';
import { NextRequest } from 'next/server';

export const maxDuration = 300; // 5 min — Vercel Pro/Enterprise only; free tier capped at 60s

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReceiptItem {
  receipt_name: string;
  price_paid: number;
  gluten_free_status: string;
  search_query: string;
  category: string;
}

interface ReceiptData {
  store_name: string;
  receipt_date: string;
  currency: string;
  items: ReceiptItem[];
}

interface PriceComparison {
  store: string;
  price_cad: number;
  product: string;
}

interface PriceInfo {
  lowest_price_cad: number | null;
  lowest_price_store: string;
  lowest_price_product: string;
  lowest_price_url: string | null;
  comparison_prices: PriceComparison[];
  search_notes: string;
  savings_cad: number;
}

type ResultItem = ReceiptItem & PriceInfo;

// ── Helpers ───────────────────────────────────────────────────────────────────

function sse(payload: object): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

function parseJson(text: string): Record<string, unknown> {
  text = text.trim();
  if (text.startsWith('```')) {
    const lines = text.split('\n');
    text = lines.slice(1, lines[lines.length - 1].trim() === '```' ? -1 : undefined).join('\n');
  }
  text = text.trim();
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    return {};
  }
}

// ── Receipt analysis ──────────────────────────────────────────────────────────

const SUPPORTED_MIME: Record<string, string> = {
  'image/jpeg': 'image/jpeg',
  'image/png': 'image/png',
  'image/gif': 'image/gif',
  'image/webp': 'image/webp',
};

async function analyzeReceipt(client: Anthropic, imageBytes: Buffer, mimeType: string): Promise<ReceiptData> {
  const imageData = imageBytes.toString('base64');

  const prompt = `Analyze this receipt image and extract ALL purchased items.

For each item decide whether it IS gluten-free OR commonly has a gluten-free alternative:

Gluten-free status values:
- "naturally_gf"      — product is inherently gluten-free (fresh produce, meat, eggs, dairy, rice, etc.)
- "labeled_gf"        — receipt/packaging explicitly states gluten-free
- "has_gf_alternative"— product (bread, pasta, crackers, flour, soy sauce, beer, etc.) has widely-sold GF versions
- "skip"              — clearly NOT gluten-related and no GF version exists (e.g., cleaning products, non-food)

Only include items whose gluten_free_status is NOT "skip".

Return ONLY a JSON object — no extra text, no markdown fences:
{
  "store_name": "store name or unknown",
  "receipt_date": "date as printed or unknown",
  "currency": "CAD",
  "items": [
    {
      "receipt_name": "item name exactly as on receipt",
      "price_paid": 0.00,
      "gluten_free_status": "naturally_gf|labeled_gf|has_gf_alternative",
      "search_query": "precise search string to find a comparable Canadian product, e.g. 'gluten free penne pasta 454g Canada'",
      "category": "e.g. pasta, bread, cereal, snacks, dairy, produce, meat"
    }
  ]
}`;

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    thinking: { type: 'adaptive' },
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mimeType as 'image/jpeg', data: imageData },
        },
        { type: 'text', text: prompt },
      ],
    }],
  });

  const text = response.content.find((b) => b.type === 'text')?.text ?? '';
  return parseJson(text) as unknown as ReceiptData;
}

// ── Price search ──────────────────────────────────────────────────────────────

const CANADIAN_RETAILERS = [
  'Walmart Canada (walmart.ca)',
  'Loblaws / PC Express (loblaws.ca)',
  'Metro (metro.ca)',
  'Sobeys (sobeys.com)',
  'Real Canadian Superstore',
  'No Frills (nofrills.ca)',
  'Food Basics',
  'Costco Canada (costco.ca)',
  'Amazon Canada (amazon.ca)',
  'Well.ca',
  'Healthy Planet Canada',
].join(', ');

async function searchItemPrice(client: Anthropic, item: ReceiptItem): Promise<PriceInfo> {
  const prompt = `Search Canadian grocery and health-food retailers to find the LOWEST current price
for: "${item.search_query}"

Check these Canadian stores: ${CANADIAN_RETAILERS}

Find:
1. The single LOWEST in-stock price in Canadian dollars (CAD)
2. Which store carries it at that price
3. The exact product name and size/weight at that price
4. The direct product page URL (if available)
5. Up to 3 other current Canadian prices for comparison

Return ONLY a JSON object, no extra text:
{
  "lowest_price_cad": 0.00,
  "lowest_price_store": "store name",
  "lowest_price_product": "exact product name and size",
  "lowest_price_url": "url or null",
  "comparison_prices": [
    {"store": "store name", "price_cad": 0.00, "product": "product name and size"}
  ],
  "search_notes": "brief note e.g. prices as of today, sale price, etc."
}

If no price can be found, return: {"lowest_price_cad": null, "search_notes": "not found"}`;

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt }];

  let response: Anthropic.Message | null = null;
  for (let i = 0; i < 5; i++) {
    response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2048,
      tools: [{ type: 'web_search_20260209', name: 'web_search' }],
      messages,
    });

    if (response.stop_reason === 'end_turn') break;
    if (response.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: response.content });
      continue;
    }
    break;
  }

  if (!response) return { lowest_price_cad: null, lowest_price_store: '', lowest_price_product: '', lowest_price_url: null, comparison_prices: [], search_notes: 'no response', savings_cad: 0 };

  const text = response.content.find((b) => b.type === 'text')?.text ?? '';
  const priceData = parseJson(text) as unknown as Omit<PriceInfo, 'savings_cad'>;

  const lowest = priceData.lowest_price_cad ?? null;
  const savings = lowest !== null ? Math.round((item.price_paid - lowest) * 100) / 100 : 0;

  return { ...priceData, savings_cad: savings };
}

// ── Excel export ──────────────────────────────────────────────────────────────

const GREEN_DARK = 'FF1B5E20';
const GREEN_MID  = 'FF2E7D32';
const GREEN_LIGHT = 'FFC8E6C9';
const GREEN_ROW1 = 'FFE8F5E9';
const GREEN_ROW2 = 'FFF1F8E9';
const BLUE_LINK  = 'FF1565C0';
const RED_LOSS   = 'FFC62828';
const GREY_BORDER = 'FFCCCCCC';
const WHITE = 'FFFFFFFF';

function thinBorder(): Partial<ExcelJS.Borders> {
  const side: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: GREY_BORDER } };
  return { top: side, bottom: side, left: side, right: side };
}

function solidFill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function headerRow(ws: ExcelJS.Worksheet, rowNum: number, headers: string[]) {
  const row = ws.getRow(rowNum);
  headers.forEach((h, i) => {
    const cell = row.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: WHITE }, size: 11 };
    cell.fill = solidFill(GREEN_MID);
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = thinBorder();
  });
  row.height = 26;
}

const GF_LABELS: Record<string, string> = {
  naturally_gf: 'Naturally GF',
  labeled_gf: 'Labeled GF',
  has_gf_alternative: 'GF Alternative',
};

const MAIN_HEADERS = [
  'Item (as on Receipt)', 'Category', 'GF Status', 'Paid (CAD)',
  'Lowest CA Price', 'Best Store (Canada)', 'Best Matching Product', 'Savings (CAD)', 'Product Link',
];

async function buildExcel(receiptData: ReceiptData, results: ResultItem[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const now = new Date().toLocaleString('en-CA', { hour12: false });

  // ── Sheet 1: Price Comparison ────────────────────────────────────────────────
  const ws = wb.addWorksheet('Price Comparison');

  ws.mergeCells(`A1:${String.fromCharCode(64 + MAIN_HEADERS.length)}1`);
  const title = ws.getCell('A1');
  title.value = 'Gluten-Free Price Finder — Canada';
  title.font = { bold: true, size: 15, color: { argb: GREEN_DARK } };
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 34;

  ws.mergeCells(`A2:${String.fromCharCode(64 + MAIN_HEADERS.length)}2`);
  const sub = ws.getCell('A2');
  sub.value = `Receipt: ${receiptData.store_name}  |  Date: ${receiptData.receipt_date}  |  Generated: ${now}`;
  sub.font = { italic: true, size: 10, color: { argb: 'FF555555' } };
  sub.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 18;

  const HDR = 4;
  headerRow(ws, HDR, MAIN_HEADERS);

  let totalPaid = 0, totalLowest = 0, totalSavings = 0;

  results.forEach((item, i) => {
    const rowNum = HDR + 1 + i;
    const fillArgb = i % 2 === 0 ? GREEN_ROW1 : GREEN_ROW2;
    const r = ws.getRow(rowNum);

    const paid = item.price_paid || 0;
    const lowest = item.lowest_price_cad ?? paid;
    const savings = item.savings_cad || 0;
    totalPaid += paid; totalLowest += lowest; totalSavings += savings;

    const url = item.lowest_price_url ?? '';
    const values: unknown[] = [
      item.receipt_name,
      (item.category || '').replace(/\b\w/g, (c) => c.toUpperCase()),
      GF_LABELS[item.gluten_free_status] ?? item.gluten_free_status,
      paid, lowest,
      item.lowest_price_store || 'N/A',
      item.lowest_price_product || 'N/A',
      savings, url,
    ];

    values.forEach((val, ci) => {
      const col = ci + 1;
      const cell = r.getCell(col);
      cell.border = thinBorder();
      cell.fill = solidFill(fillArgb);
      cell.alignment = { vertical: 'middle', wrapText: [1, 7, 9].includes(col) };

      if ([4, 5, 8].includes(col)) {
        cell.value = val as number;
        cell.numFmt = '"$"#,##0.00';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (col === 8) {
          cell.font = { bold: true, color: { argb: savings >= 0 ? GREEN_MID : RED_LOSS } };
        }
      } else if (col === 9 && typeof val === 'string' && val.startsWith('http')) {
        cell.value = { text: 'View Product', hyperlink: val };
        cell.font = { color: { argb: BLUE_LINK }, underline: true };
      } else {
        cell.value = val as string;
      }
    });
    r.height = 28;
  });

  // Summary row
  const sRow = HDR + results.length + 2;
  ws.mergeCells(`A${sRow}:C${sRow}`);
  const lbl = ws.getCell(`A${sRow}`);
  lbl.value = 'TOTALS';
  lbl.font = { bold: true, size: 11, color: { argb: GREEN_DARK } };
  lbl.alignment = { horizontal: 'center', vertical: 'middle' };
  lbl.fill = solidFill(GREEN_LIGHT);

  [[4, totalPaid], [5, totalLowest], [8, totalSavings]].forEach(([col, val]) => {
    const cell = ws.getCell(sRow, col as number);
    cell.value = val as number;
    cell.font = { bold: true, color: { argb: GREEN_DARK } };
    cell.numFmt = '"$"#,##0.00';
    cell.alignment = { horizontal: 'right', vertical: 'middle' };
    cell.fill = solidFill(GREEN_LIGHT);
    cell.border = thinBorder();
  });
  ws.getRow(sRow).height = 24;

  [32, 14, 18, 14, 16, 26, 38, 14, 18].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.views = [{ state: 'frozen', ySplit: HDR, xSplit: 0 }];

  // ── Sheet 2: Store Comparisons ───────────────────────────────────────────────
  const ws2 = wb.addWorksheet('Store Comparisons');
  ws2.getCell('A1').value = 'Store-by-Store Price Comparisons';
  ws2.getCell('A1').font = { bold: true, size: 13, color: { argb: GREEN_DARK } };
  ws2.getRow(1).height = 24;
  headerRow(ws2, 3, ['Receipt Item', 'Store', 'Price (CAD)', 'Product / Size']);

  let r2 = 4;
  results.forEach((item) => {
    (item.comparison_prices || []).forEach((comp) => {
      const fill = solidFill(r2 % 2 === 0 ? GREEN_ROW1 : GREEN_ROW2);
      [item.receipt_name, comp.store, comp.price_cad, comp.product].forEach((val, ci) => {
        const cell = ws2.getCell(r2, ci + 1);
        cell.value = val as string | number;
        cell.border = thinBorder();
        cell.fill = fill;
        if (ci === 2) { cell.numFmt = '"$"#,##0.00'; cell.alignment = { horizontal: 'right', vertical: 'middle' }; }
        else { cell.alignment = { vertical: 'middle', wrapText: ci === 3 }; }
      });
      ws2.getRow(r2).height = 22;
      r2++;
    });
  });
  [32, 28, 14, 40].forEach((w, i) => { ws2.getColumn(i + 1).width = w; });
  ws2.views = [{ state: 'frozen', ySplit: 3, xSplit: 0 }];

  // ── Sheet 3: Search Notes ────────────────────────────────────────────────────
  const ws3 = wb.addWorksheet('Search Notes');
  ws3.getCell('A1').value = 'Search Notes & Details';
  ws3.getCell('A1').font = { bold: true, size: 13, color: { argb: GREEN_DARK } };
  ws3.getRow(1).height = 24;
  headerRow(ws3, 3, ['Receipt Item', 'Search Query Used', 'Search Notes']);

  results.forEach((item, i) => {
    const rowNum = 4 + i;
    const fill = solidFill(rowNum % 2 === 0 ? GREEN_ROW1 : GREEN_ROW2);
    [item.receipt_name, item.search_query, item.search_notes].forEach((val, ci) => {
      const cell = ws3.getCell(rowNum, ci + 1);
      cell.value = val;
      cell.border = thinBorder();
      cell.fill = fill;
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
    ws3.getRow(rowNum).height = 30;
  });
  [32, 40, 50].forEach((w, i) => { ws3.getColumn(i + 1).width = w; });
  ws3.views = [{ state: 'frozen', ySplit: 3, xSplit: 0 }];

  return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response('ANTHROPIC_API_KEY not configured on server', { status: 500 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return new Response('Invalid form data', { status: 400 });
  }

  const file = form.get('image') as File | null;
  if (!file) return new Response('No image uploaded', { status: 400 });

  const mimeType = SUPPORTED_MIME[file.type];
  if (!mimeType) {
    return new Response(`Unsupported image type "${file.type}". Use JPEG, PNG, WebP, or GIF.`, { status: 400 });
  }

  const imageBytes = Buffer.from(await file.arrayBuffer());
  const client = new Anthropic({ apiKey });

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (payload: object) => controller.enqueue(sse(payload));

      try {
        // Step 1 — analyze receipt
        emit({ step: 1, status: 'Analyzing receipt image…' });
        let receiptData: ReceiptData;
        try {
          receiptData = await analyzeReceipt(client, imageBytes, mimeType);
        } catch (e) {
          emit({ error: `Receipt analysis failed: ${e}` });
          controller.close();
          return;
        }

        const items = receiptData.items ?? [];
        emit({
          step: 1,
          status: `Found ${items.length} gluten-free item(s)`,
          store: receiptData.store_name,
          date: receiptData.receipt_date,
          items: items.map((i) => i.receipt_name),
        });

        if (items.length === 0) {
          emit({ done: true, message: 'No gluten-free items found on receipt.' });
          controller.close();
          return;
        }

        // Step 2 — search prices
        const results: ResultItem[] = [];
        for (let idx = 0; idx < items.length; idx++) {
          const item = items[idx];
          emit({ step: 2, status: `Searching prices: ${item.receipt_name}`, progress: idx + 1, total: items.length });
          let priceInfo: PriceInfo;
          try {
            priceInfo = await searchItemPrice(client, item);
          } catch (e) {
            priceInfo = { lowest_price_cad: null, lowest_price_store: '', lowest_price_product: '', lowest_price_url: null, comparison_prices: [], search_notes: `Search failed: ${e}`, savings_cad: 0 };
          }
          results.push({ ...item, ...priceInfo });
        }

        // Step 3 — Excel
        emit({ step: 3, status: 'Generating Excel report…' });
        let excelBuf: Buffer;
        try {
          excelBuf = await buildExcel(receiptData, results);
        } catch (e) {
          emit({ error: `Excel export failed: ${e}` });
          controller.close();
          return;
        }

        const totalPaid = results.reduce((s, r) => s + (r.price_paid || 0), 0);
        const totalLowest = results.reduce((s, r) => s + (r.lowest_price_cad ?? r.price_paid ?? 0), 0);
        const totalSavings = results.reduce((s, r) => s + (r.savings_cad || 0), 0);
        const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);

        emit({
          done: true,
          excel_b64: excelBuf.toString('base64'),
          filename: `gf_prices_${ts}.xlsx`,
          summary: {
            items: results.length,
            total_paid: Math.round(totalPaid * 100) / 100,
            total_lowest: Math.round(totalLowest * 100) / 100,
            savings: Math.round(totalSavings * 100) / 100,
            savings_pct: Math.round(totalPaid ? (totalSavings / totalPaid) * 100 * 10 : 0) / 10,
          },
        });
      } catch (e) {
        controller.enqueue(sse({ error: String(e) }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}
