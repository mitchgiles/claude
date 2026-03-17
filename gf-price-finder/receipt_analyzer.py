"""
Analyzes a receipt image using Claude Vision to extract items
and identify gluten-free products or those with GF alternatives.
"""

import base64
import json
import re
from pathlib import Path

import anthropic


SUPPORTED_FORMATS = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
}


def encode_image(image_path: str) -> tuple[str, str]:
    path = Path(image_path)
    ext = path.suffix.lower()
    media_type = SUPPORTED_FORMATS.get(ext, "image/jpeg")
    with open(image_path, "rb") as f:
        data = base64.standard_b64encode(f.read()).decode("utf-8")
    return data, media_type


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
            return json.loads(match.group())
        raise ValueError(f"Could not parse JSON from response:\n{text[:500]}")


def analyze_receipt(client: anthropic.Anthropic, image_path: str) -> dict:
    """
    Send receipt image to Claude and extract all items, flagging those that
    are gluten-free or have a common GF alternative.

    Returns a dict with keys: store_name, receipt_date, currency, items.
    Each item has: receipt_name, price_paid, gluten_free_status, search_query, category.
    """
    print("Analyzing receipt image...")
    image_data, media_type = encode_image(image_path)

    prompt = """Analyze this receipt image and extract ALL purchased items.

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
}"""

    response = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=4096,
        thinking={"type": "adaptive"},
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_data,
                        },
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        ],
    )

    text = next(
        (b.text for b in response.content if b.type == "text"), ""
    )
    receipt_data = parse_json_from_response(text)
    count = len(receipt_data.get("items", []))
    print(f"  Found {count} gluten-free item(s) on the receipt.")
    return receipt_data
