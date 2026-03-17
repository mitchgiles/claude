"""
FastAPI service for the Gluten-Free Price Finder.

Endpoints:
  GET  /health        — liveness probe
  POST /analyze       — upload receipt image → SSE stream with progress + final Excel (base64)
"""

import base64
import json
import os
import tempfile
from datetime import datetime
from pathlib import Path

import anthropic
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from excel_exporter import export_to_excel
from price_finder import search_item_price
from receipt_analyzer import SUPPORTED_FORMATS, analyze_receipt

app = FastAPI(title="GF Price Finder API", version="1.0.0")

# Allow the Vercel frontend (and localhost dev) to call this service
_ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


def _sse(payload: dict) -> str:
    """Format a dict as an SSE data line."""
    return f"data: {json.dumps(payload)}\n\n"


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze")
async def analyze(image: UploadFile = File(...)):
    """
    Accept a receipt image and stream Server-Sent Events:
      {"step": 1, "status": "..."}
      {"step": 2, "status": "...", "progress": N, "total": N}
      {"step": 3, "status": "..."}
      {"done": true, "excel_b64": "...", "filename": "...", "summary": {...}}
      {"error": "..."}   — on failure
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured on server")

    filename = image.filename or "receipt.jpg"
    ext = Path(filename).suffix.lower()
    if ext not in SUPPORTED_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported image type '{ext}'. Use: {', '.join(SUPPORTED_FORMATS)}",
        )

    image_bytes = await image.read()

    async def generate():
        with tempfile.TemporaryDirectory() as tmpdir:
            image_path = os.path.join(tmpdir, f"receipt{ext}")
            output_path = os.path.join(tmpdir, "results.xlsx")

            with open(image_path, "wb") as f:
                f.write(image_bytes)

            client = anthropic.Anthropic(api_key=api_key)

            # ── Step 1: Analyze receipt ──────────────────────────────────────
            yield _sse({"step": 1, "status": "Analyzing receipt image…"})
            try:
                receipt_data = analyze_receipt(client, image_path)
            except Exception as exc:
                yield _sse({"error": f"Receipt analysis failed: {exc}"})
                return

            items = receipt_data.get("items", [])
            yield _sse(
                {
                    "step": 1,
                    "status": f"Found {len(items)} gluten-free item(s)",
                    "store": receipt_data.get("store_name", "Unknown"),
                    "date": receipt_data.get("receipt_date", "Unknown"),
                    "items": [i["receipt_name"] for i in items],
                }
            )

            if not items:
                yield _sse({"done": True, "message": "No gluten-free items found on receipt."})
                return

            # ── Step 2: Search Canadian prices ──────────────────────────────
            results = []
            for idx, item in enumerate(items):
                yield _sse(
                    {
                        "step": 2,
                        "status": f"Searching prices: {item['receipt_name']}",
                        "progress": idx + 1,
                        "total": len(items),
                    }
                )
                try:
                    price_info = search_item_price(client, item)
                except Exception as exc:
                    price_info = {"search_notes": f"Search failed: {exc}"}
                results.append({**item, **price_info})

            # ── Step 3: Export Excel ─────────────────────────────────────────
            yield _sse({"step": 3, "status": "Generating Excel report…"})
            try:
                total_paid, total_lowest, total_savings = export_to_excel(
                    receipt_data, results, output_path
                )
            except Exception as exc:
                yield _sse({"error": f"Excel export failed: {exc}"})
                return

            with open(output_path, "rb") as f:
                excel_b64 = base64.b64encode(f.read()).decode()

            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            yield _sse(
                {
                    "done": True,
                    "excel_b64": excel_b64,
                    "filename": f"gf_prices_{ts}.xlsx",
                    "summary": {
                        "items": len(results),
                        "total_paid": round(total_paid, 2),
                        "total_lowest": round(total_lowest, 2),
                        "savings": round(total_savings, 2),
                        "savings_pct": round(
                            total_savings / total_paid * 100 if total_paid else 0, 1
                        ),
                    },
                }
            )

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # disable nginx buffering
            "Connection": "keep-alive",
        },
    )
