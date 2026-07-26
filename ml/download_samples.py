#!/usr/bin/env python3
"""Download starter training images from Wikimedia Commons (free to use)."""

from __future__ import annotations

import json
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).parent / "dataset" / "train"
API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "CivicMindAI/1.0 (local ML training; contact: local-dev)"

SEARCHES: dict[str, list[str]] = {
    "pothole": ["pothole road asphalt", "pothole street damage"],
    "garbage": ["garbage litter street", "trash pile waste"],
    "manhole": ["manhole cover street", "sewer manhole cover"],
}

TARGET_PER_CLASS = 10


def api_query(params: dict[str, str]) -> dict:
    url = API + "?" + urllib.parse.urlencode({**params, "format": "json"})
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def search_image_urls(query: str, limit: int = 15) -> list[str]:
    data = api_query(
        {
            "action": "query",
            "generator": "search",
            "gsrsearch": f"filetype:bitmap {query}",
            "gsrnamespace": "6",
            "gsrlimit": str(limit),
            "prop": "imageinfo",
            "iiprop": "url|mime",
            "iiurlwidth": "512",
        }
    )

    urls: list[str] = []
    pages = data.get("query", {}).get("pages", {})
    for page in pages.values():
        for info in page.get("imageinfo", []):
            mime = info.get("mime", "")
            if not mime.startswith("image/"):
                continue
            url = info.get("thumburl") or info.get("url")
            if url and url not in urls:
                urls.append(url)
    return urls


def download(url: str, dest: Path) -> bool:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=45) as response:
            data = response.read()
        if len(data) < 2000:
            return False
        dest.write_bytes(data)
        return True
    except Exception as exc:
        print(f"  skip {dest.name}: {exc}")
        if dest.exists():
            dest.unlink(missing_ok=True)
        return False


def collect_urls(label: str) -> list[str]:
    seen: set[str] = set()
    urls: list[str] = []
    for query in SEARCHES[label]:
        for url in search_image_urls(query, limit=20):
            if url not in seen:
                seen.add(url)
                urls.append(url)
            if len(urls) >= TARGET_PER_CLASS + 4:
                break
        if len(urls) >= TARGET_PER_CLASS + 4:
            break
    return urls


def main() -> None:
    print("Downloading starter sample images from Wikimedia Commons…\n")
    total = 0

    for label in SEARCHES:
        folder = ROOT / label
        folder.mkdir(parents=True, exist_ok=True)
        print(f"[{label}]")

        urls = collect_urls(label)
        if not urls:
            print("  no images found via API")
            continue

        saved = 0
        for index, url in enumerate(urls, start=1):
            if saved >= TARGET_PER_CLASS:
                break
            dest = folder / f"sample_{index:02d}.jpg"
            if dest.exists() and dest.stat().st_size > 2000:
                print(f"  exists {dest.name}")
                saved += 1
                total += 1
                continue
            if download(url, dest):
                print(f"  saved {dest.name}")
                saved += 1
                total += 1

        if saved < 5:
            print(f"  warning: only {saved} images for {label} (need >= 5 to train)")

    print(f"\nDone — {total} images ready in ml/dataset/train/")
    print("Next: python ml/train.py")


if __name__ == "__main__":
    main()
