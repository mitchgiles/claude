# Gluten-Free Price Finder — Canada

Takes a photo of your grocery receipt, identifies gluten-free items (and items that have GF alternatives), then searches Canadian retailers for the lowest comparable prices — all exported to a tidy Excel spreadsheet.

## How it works

1. **Receipt scan** — Claude Vision reads your receipt image and extracts every food item, flagging:
   - Naturally gluten-free products (produce, meat, dairy, rice, etc.)
   - Products explicitly labelled gluten-free
   - Products that have well-known gluten-free alternatives (pasta, bread, crackers, flour, soy sauce, etc.)

2. **Canadian price search** — For each flagged item, Claude uses live web search to find the lowest current in-stock price across major Canadian retailers including Walmart, Loblaws, Metro, Sobeys, Costco, Amazon.ca, Well.ca, and more.

3. **Excel report** — Results are written to a three-tab workbook:
   - **Price Comparison** — side-by-side: what you paid vs. the lowest Canadian price, savings per item and totals
   - **Store Comparisons** — full breakdown of every price found per item
   - **Search Notes** — the exact search query used and any notes from the search

## Setup

```bash
cd gf-price-finder
pip install -r requirements.txt
export ANTHROPIC_API_KEY="sk-ant-..."
```

## Usage

```bash
# Basic — output file is auto-named with a timestamp
python main.py receipt.jpg

# Custom output filename
python main.py receipt.png my_savings_march.xlsx
```

Supported image formats: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`

## Example output

```
========================================================
  Gluten-Free Price Finder for Canada
========================================================
  Receipt : receipt.jpg
  Output  : gf_prices_20260317_143022.xlsx
========================================================

Step 1/3  Analyzing receipt image with Claude Vision...
  Found 8 gluten-free item(s) on the receipt.
  Store : Loblaws
  Date  : 2026-03-15

Step 2/3  Searching Canadian retailers for best prices...
  [1/8] Searching: PC GF Brown Rice Pasta 340g...
  [2/8] Searching: Udi's GF Sandwich Bread...
  ...

Step 3/3  Writing Excel report...
  Saved  : gf_prices_20260317_143022.xlsx

========================================================
  Summary
========================================================
  Items analysed :  8
  Total paid     :   $47.62 CAD
  Lowest found   :   $39.15 CAD
  Potential save :    $8.47 CAD  (18%)
========================================================
```

## Notes

- Prices retrieved are live web search results and may change; always verify at checkout.
- Some items may not be found if they are store-exclusive or delisted.
- The app works best with clear, well-lit receipt photos where item names are legible.
