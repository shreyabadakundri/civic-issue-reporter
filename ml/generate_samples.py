#!/usr/bin/env python3
"""Generate synthetic starter images when online downloads are unavailable."""

from __future__ import annotations

import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).parent / "dataset" / "train"
COUNT = 12
SIZE = (256, 256)


def asphalt_base(seed: int) -> Image.Image:
    random.seed(seed)
    img = Image.new("RGB", SIZE, (90, 90, 92))
    draw = ImageDraw.Draw(img)
    for _ in range(400):
        x, y = random.randint(0, SIZE[0] - 1), random.randint(0, SIZE[1] - 1)
        tone = random.randint(70, 120)
        draw.point((x, y), fill=(tone, tone, tone + random.randint(-5, 5)))
    return img.filter(ImageFilter.GaussianBlur(radius=0.6))


def save_pothole(folder: Path, index: int) -> None:
    img = asphalt_base(index * 17)
    draw = ImageDraw.Draw(img)
    cx, cy = random.randint(60, 196), random.randint(60, 196)
    rx, ry = random.randint(25, 55), random.randint(18, 40)
    draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=(25, 22, 20))
    draw.ellipse((cx - rx + 8, cy - ry + 6, cx + rx - 6, cy + ry - 4), fill=(45, 40, 35))
    img.save(folder / f"gen_{index:02d}.jpg", quality=90)


def save_garbage(folder: Path, index: int) -> None:
    random.seed(index * 31)
    img = Image.new("RGB", SIZE, (72, 95, 58))
    draw = ImageDraw.Draw(img)
    colors = [(200, 40, 40), (240, 210, 40), (30, 120, 200), (240, 240, 240), (120, 80, 40)]
    for _ in range(random.randint(8, 16)):
        x, y = random.randint(10, 210), random.randint(10, 210)
        w, h = random.randint(12, 45), random.randint(10, 35)
        draw.rounded_rectangle((x, y, x + w, y + h), radius=4, fill=random.choice(colors))
    img.save(folder / f"gen_{index:02d}.jpg", quality=90)


def save_manhole(folder: Path, index: int) -> None:
    random.seed(index * 43)
    img = asphalt_base(index * 11 + 3)
    draw = ImageDraw.Draw(img)
    cx, cy = SIZE[0] // 2, SIZE[1] // 2
    r = random.randint(55, 75)
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(105, 105, 110), outline=(60, 60, 65), width=4)
    for angle in range(0, 360, 20):
        import math

        rad = math.radians(angle)
        x2 = cx + int(math.cos(rad) * (r - 8))
        y2 = cy + int(math.sin(rad) * (r - 8))
        draw.line((cx, cy, x2, y2), fill=(75, 75, 80), width=2)
    draw.ellipse((cx - 12, cy - 12, cx + 12, cy + 12), fill=(85, 85, 90))
    img.save(folder / f"gen_{index:02d}.jpg", quality=90)


GENERATORS = {
    "pothole": save_pothole,
    "garbage": save_garbage,
    "manhole": save_manhole,
}


def main() -> None:
    print("Generating synthetic starter images…\n")
    total = 0
    for label, generator in GENERATORS.items():
        folder = ROOT / label
        folder.mkdir(parents=True, exist_ok=True)
        print(f"[{label}]")
        for i in range(1, COUNT + 1):
            dest = folder / f"gen_{i:02d}.jpg"
            if dest.exists() and dest.stat().st_size > 1000:
                print(f"  exists gen_{i:02d}.jpg")
                total += 1
                continue
            generator(folder, i)
            print(f"  wrote gen_{i:02d}.jpg")
            total += 1
    print(f"\nDone — {total} synthetic images in ml/dataset/train/")
    print("Tip: replace with real photos for better accuracy on uploads.")


if __name__ == "__main__":
    main()
