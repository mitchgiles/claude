"""
Searches Canadian retailers for the lowest price on each gluten-free item
using Claude's server-side web search tool.
"""

import json
import re

import anthropic


CANADIAN_RETAILERS = [
    "Walmart Canada (walmart.ca)",
    "Loblaws / PC Express (loblaws.ca)",
    "Metro (metro.ca)",
    "Sobeys (sobeys.com)",
    "Real Canadian Superstore",
    "No Frills (nofrills.ca)",
    "Food Basics",
    "Costco Canada (costco.ca)",
    "Amazon Canada (amazon.ca)",
    "Well.ca",
    "Healthy Planet Canada",
    "Nature's Emporium",
    "Thrive Market Canada",
]


def parse_json_from_response(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
    return {}


def search_item_price(client: anthropic.Anthropic, item: dict) -> dict:
    """
    Search Canadian online retailers for the lowest price on one GF item.
    Returns a dict with: lowest_price_cad, lowest_price_store, lowest_price_product,
    lowest_price_url, comparison_prices, search_notes.
    """
    receipt_name = item["receipt_name"]
    search_query = item.get("search_query", receipt_name)

    prompt = f"""Search Canadian grocery and health-food retailers to find the LOWEST current price
for: "{search_query}"

Check these Canadian stores: {", ".join(CANADIAN_RETAILERS)}

Find:
1. The single LOWEST in-stock price in Canadian dollars (CAD)
2. Which store carries it at that price
3. The exact product name and size/weight at that price
4. The direct product page URL (if available)
5. Up to 3 other current Canadian prices for comparison

Return ONLY a JSON object, no extra text:
{{
  "lowest_price_cad": 0.00,
  "lowest_price_store": "store name",
  "lowest_price_product": "exact product name and size",
  "lowest_price_url": "url or null",
  "comparison_prices": [
    {{"store": "store name", "price_cad": 0.00, "product": "product name and size"}}
  ],
  "search_notes": "brief note e.g. prices as of today, sale price, etc."
}}

If no price can be found, return: {{"lowest_price_cad": null, "search_notes": "not found"}}"""

    messages: list[anthropic.types.MessageParam] = [
        {"role": "user", "content": prompt}
    ]

    max_continuations = 5
    response = None

    for _ in range(max_continuations):
        response = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=2048,
            tools=[
                {"type": "web_search_20260209", "name": "web_search"},
            ],
            messages=messages,
        )

        if response.stop_reason == "end_turn":
            break

        # Server-side tool hit its iteration limit — re-send to continue
        if response.stop_reason == "pause_turn":
            messages.append({"role": "assistant", "content": response.content})
            continue

        # Unexpected stop reason
        break

    if response is None:
        return {}

    text = next(
        (b.text for b in response.content if hasattr(b, "type") and b.type == "text"),
        "",
    )
    price_data = parse_json_from_response(text) if text else {}

    # Compute savings vs what was paid on the receipt
    price_paid = item.get("price_paid") or 0.0
    lowest = price_data.get("lowest_price_cad")
    savings = round(price_paid - lowest, 2) if lowest is not None else 0.0

    return {**price_data, "savings_cad": savings}


def find_canadian_prices(client: anthropic.Anthropic, receipt_data: dict) -> list[dict]:
    """
    For every GF item on the receipt, search for the best Canadian price.
    Returns a merged list of item dicts with price info attached.
    """
    items = receipt_data.get("items", [])
    results = []

    for i, item in enumerate(items, 1):
        print(f"  [{i}/{len(items)}] Searching: {item['receipt_name']}...")
        price_info = search_item_price(client, item)
        results.append({**item, **price_info})

    return results
