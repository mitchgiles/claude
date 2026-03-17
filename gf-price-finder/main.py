#!/usr/bin/env python3
"""
Gluten-Free Price Finder for Canada
====================================
Usage:
    python main.py <receipt_image> [output.xlsx]

Example:
    python main.py receipt.jpg
    python main.py receipt.png my_savings.xlsx

Requires:
    ANTHROPIC_API_KEY environment variable
"""

import os
import sys
from datetime import datetime
from pathlib import Path

import anthropic

from receipt_analyzer import SUPPORTED_FORMATS, analyze_receipt
from price_finder import find_canadian_prices
from excel_exporter import export_to_excel


def main():
    # ── Argument parsing ─────────────────────────────────────────────────────
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print(__doc__)
        sys.exit(0 if "--help" in sys.argv else 1)

    image_path = sys.argv[1]
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = sys.argv[2] if len(sys.argv) > 2 else f"gf_prices_{timestamp}.xlsx"

    # ── Validation ───────────────────────────────────────────────────────────
    if not Path(image_path).exists():
        print(f"Error: image file not found: {image_path}")
        sys.exit(1)

    ext = Path(image_path).suffix.lower()
    if ext not in SUPPORTED_FORMATS:
        print(f"Error: unsupported image format '{ext}'. Supported: {', '.join(SUPPORTED_FORMATS)}")
        sys.exit(1)

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("Error: ANTHROPIC_API_KEY environment variable is not set.")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)

    # ── Banner ───────────────────────────────────────────────────────────────
    print()
    print("=" * 56)
    print("  Gluten-Free Price Finder for Canada")
    print("=" * 56)
    print(f"  Receipt : {image_path}")
    print(f"  Output  : {output_path}")
    print("=" * 56)
    print()

    # ── Step 1: Analyze the receipt ──────────────────────────────────────────
    print("Step 1/3  Analyzing receipt image with Claude Vision...")
    receipt_data = analyze_receipt(client, image_path)

    items = receipt_data.get("items", [])
    if not items:
        print()
        print("No gluten-free items detected on the receipt.")
        sys.exit(0)

    print(f"  Store : {receipt_data.get('store_name', 'Unknown')}")
    print(f"  Date  : {receipt_data.get('receipt_date', 'Unknown')}")
    print()

    # ── Step 2: Search Canadian prices ───────────────────────────────────────
    print("Step 2/3  Searching Canadian retailers for best prices...")
    results = find_canadian_prices(client, receipt_data)
    print()

    # ── Step 3: Export to Excel ───────────────────────────────────────────────
    print("Step 3/3  Writing Excel report...")
    total_paid, total_lowest, total_savings = export_to_excel(receipt_data, results, output_path)
    print(f"  Saved  : {output_path}")
    print()

    # ── Summary ───────────────────────────────────────────────────────────────
    print("=" * 56)
    print("  Summary")
    print("=" * 56)
    print(f"  Items analysed : {len(results)}")
    print(f"  Total paid     : ${total_paid:>8.2f} CAD")
    print(f"  Lowest found   : ${total_lowest:>8.2f} CAD")
    saving_pct = (total_savings / total_paid * 100) if total_paid else 0
    print(f"  Potential save : ${total_savings:>8.2f} CAD  ({saving_pct:.0f}%)")
    print("=" * 56)
    print()
    print(f"  Report: {Path(output_path).resolve()}")
    print()


if __name__ == "__main__":
    main()
