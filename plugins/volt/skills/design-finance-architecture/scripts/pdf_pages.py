"""Extract the text of each page of a PDF, for verify_extraction.py.

    python3 -I scripts/pdf_pages.py FILE.pdf

Prints {"sha256", "page_count", "pages": [{"page": 1, "text": "..."}], "empty_pages": [...]}.
Needs the pypdf package. Pages with no text layer (scans) come back empty and are listed in
empty_pages: there is no OCR, so figures on those pages cannot be verified automatically.
Exit 0 on success, 2 when the file cannot be read or pypdf is missing.
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path


def main(argv: list) -> int:
    if len(argv) != 1:
        print("usage: python3 -I pdf_pages.py FILE.pdf", file=sys.stderr)
        return 2
    try:
        from pypdf import PdfReader  # noqa: PLC0415 - optional dependency, loaded only when used
    except ImportError:
        print(json.dumps({"error": "PDF_SUPPORT_MISSING", "detail": "install pypdf (pip install pypdf) to read PDFs"}))
        return 2
    path = Path(argv[0])
    try:
        data = path.read_bytes()
        reader = PdfReader(str(path))
        pages = [{"page": i, "text": (p.extract_text() or "")} for i, p in enumerate(reader.pages, 1)]
    except Exception as exc:  # noqa: BLE001 - any parse failure is reported, not raised
        print(json.dumps({"error": "INPUT_INVALID", "detail": f"{type(exc).__name__}: {exc}"}))
        return 2
    print(json.dumps({
        "sha256": hashlib.sha256(data).hexdigest(),
        "page_count": len(pages),
        "pages": pages,
        "empty_pages": [p["page"] for p in pages if not p["text"].strip()],
    }))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
