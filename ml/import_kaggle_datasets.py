#!/usr/bin/env python3
"""
Import Kaggle road-hazard + manhole datasets as CROPPED classification images.

Cropping YOLO boxes (instead of full frames) teaches pothole vs manhole
appearance and avoids whole-road scenes that push the model toward manhole.
"""

from __future__ import annotations

import random
from collections import Counter
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).parent
TRAIN = ROOT / "dataset" / "train"
VAL = ROOT / "dataset" / "val"
CROPS = ROOT / "dataset" / "crops"

ROAD = Path.home() / ".cache/kagglehub/datasets/lorenzoarcioni/road-damage-dataset-potholes-cracks-and-manholes/versions/4"
MANHOLE = Path.home() / ".cache/kagglehub/datasets/cubeai/manhole-for-yolov8/versions/1"

MAX_PER_CLASS = 280
VAL_RATIO = 0.15
PAD = 0.12  # expand box slightly
MIN_CROP_PX = 28
IMG_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

# Road YOLO: 0 pothole, 1 crack (skip), 2 manhole
ROAD_CLASS_MAP = {0: "pothole", 2: "manhole"}


def find_image(stem: str, image_dirs: list[Path]) -> Path | None:
    for folder in image_dirs:
        for ext in (*IMG_EXTS, *[e.upper() for e in IMG_EXTS]):
            candidate = folder / f"{stem}{ext}"
            if candidate.exists():
                return candidate
        matches = list(folder.glob(f"{stem}.*"))
        if matches:
            return matches[0]
    return None


def clear_split_images(label: str) -> None:
    for split in (TRAIN, VAL):
        folder = split / label
        folder.mkdir(parents=True, exist_ok=True)
        for f in folder.iterdir():
            if f.is_file() and f.suffix.lower() in IMG_EXTS:
                f.unlink()


def clear_crop_images(label: str) -> None:
    folder = CROPS / label
    folder.mkdir(parents=True, exist_ok=True)
    for f in folder.iterdir():
        if f.is_file() and f.suffix.lower() in IMG_EXTS:
            f.unlink()


def clear_class_images(label: str) -> None:
    clear_split_images(label)
    clear_crop_images(label)


def yolo_to_xyxy(cx: float, cy: float, w: float, h: float, iw: int, ih: int) -> tuple[int, int, int, int]:
    bw, bh = w * iw, h * ih
    x1 = (cx * iw) - bw / 2
    y1 = (cy * ih) - bh / 2
    x2 = x1 + bw
    y2 = y1 + bh
    # pad
    pw, ph = bw * PAD, bh * PAD
    x1 -= pw
    y1 -= ph
    x2 += pw
    y2 += ph
    x1 = max(0, int(x1))
    y1 = max(0, int(y1))
    x2 = min(iw, int(x2))
    y2 = min(ih, int(y2))
    return x1, y1, x2, y2


def save_crop(img: Image.Image, box: tuple[int, int, int, int], dest: Path) -> bool:
    x1, y1, x2, y2 = box
    if x2 - x1 < MIN_CROP_PX or y2 - y1 < MIN_CROP_PX:
        return False
    crop = img.crop((x1, y1, x2, y2)).convert("RGB")
    # square-ish resize later by trainer; keep aspect
    dest.parent.mkdir(parents=True, exist_ok=True)
    crop.save(dest, quality=92)
    return True


def crop_from_yolo_dir(
    label_dir: Path,
    image_dirs: list[Path],
    class_map: dict[int, str],
    prefix: str,
    buckets: dict[str, list[Path]],
) -> Counter:
    counts: Counter = Counter()
    crop_root = CROPS
    for label_file in label_dir.glob("*.txt"):
        text = label_file.read_text(encoding="utf-8", errors="ignore").strip()
        if not text:
            continue
        img_path = find_image(label_file.stem, image_dirs)
        if not img_path:
            continue
        try:
            with Image.open(img_path) as im:
                im = im.convert("RGB")
                iw, ih = im.size
                for idx, line in enumerate(text.splitlines()):
                    parts = line.strip().split()
                    if len(parts) < 5:
                        continue
                    try:
                        cid = int(float(parts[0]))
                        cx, cy, w, h = map(float, parts[1:5])
                    except ValueError:
                        continue
                    label = class_map.get(cid)
                    if not label:
                        continue
                    box = yolo_to_xyxy(cx, cy, w, h, iw, ih)
                    out = crop_root / label / f"{prefix}_{label_file.stem}_{idx}.jpg"
                    if save_crop(im, box, out):
                        buckets[label].append(out)
                        counts[label] += 1
        except OSError:
            continue
    return counts


def import_road_crops(buckets: dict[str, list[Path]]) -> None:
    data = ROAD / "data"
    label_dir = data / "labels-YOLO" if (data / "labels-YOLO").exists() else data / "labels"
    image_dirs = [p for p in [data / "images", data / "Images"] if p.exists()]
    if not image_dirs:
        image_dirs = [p for p in data.rglob("images") if p.is_dir()]
    print(f"[road] cropping from {label_dir}")
    counts = crop_from_yolo_dir(label_dir, image_dirs, ROAD_CLASS_MAP, "road", buckets)
    print(f"[road] crops: {dict(counts)}")


def import_manhole_yolo_crops(buckets: dict[str, list[Path]]) -> None:
    # Manhole dataset: class 0 closed, class 1 open — both are manhole for our app
    class_map = {0: "manhole", 1: "manhole"}
    total = Counter()
    for split in ("train", "valid", "test"):
        img_dir = MANHOLE / split / "images"
        label_dir = MANHOLE / split / "labels"
        if not img_dir.exists() or not label_dir.exists():
            continue
        counts = crop_from_yolo_dir(label_dir, [img_dir], class_map, f"mh{split[:3]}", buckets)
        total.update(counts)
    print(f"[manhole-yolo] crops: {dict(total)}")


def split_and_write(buckets: dict[str, list[Path]]) -> None:
    random.seed(42)
    for label, paths in buckets.items():
        unique = []
        seen = set()
        for p in paths:
            rp = str(p.resolve())
            if rp in seen or not p.exists():
                continue
            seen.add(rp)
            unique.append(p)
        random.shuffle(unique)
        # Balance: keep equal caps; prefer road pothole crops, mix manhole sources
        unique = unique[:MAX_PER_CLASS]
        n_val = max(1, int(len(unique) * VAL_RATIO)) if len(unique) >= 8 else 0
        val_set = unique[:n_val]
        train_set = unique[n_val:]
        clear_split_images(label)
        for i, img in enumerate(train_set):
            dest = TRAIN / label / f"{label}_{i:04d}.jpg"
            Image.open(img).convert("RGB").save(dest, quality=92)
        for i, img in enumerate(val_set):
            dest = VAL / label / f"{label}_{i:04d}.jpg"
            Image.open(img).convert("RGB").save(dest, quality=92)
        print(f"[{label}] train={len(train_set)} val={len(val_set)}")


def ensure_garbage_fallback() -> None:
    train_g = TRAIN / "garbage"
    train_g.mkdir(parents=True, exist_ok=True)
    existing = [f for f in train_g.iterdir() if f.suffix.lower() in IMG_EXTS]
    if len(existing) >= 30:
        print(f"[garbage] keeping {len(existing)} existing images")
        return
    print("[garbage] generating synthetic fallback images…")
    from generate_samples import save_garbage

    clear_split_images("garbage")
    for i in range(1, 61):
        save_garbage(train_g, i)
    val_g = VAL / "garbage"
    val_g.mkdir(parents=True, exist_ok=True)
    for i in range(61, 73):
        save_garbage(val_g, i)


def main() -> None:
    if not ROAD.exists():
        raise SystemExit(f"Missing road dataset at {ROAD}")
    if not MANHOLE.exists():
        raise SystemExit(f"Missing manhole dataset at {MANHOLE}")

    for label in ("pothole", "manhole", "garbage"):
        clear_class_images(label)

    buckets: dict[str, list[Path]] = {"pothole": [], "manhole": []}
    import_road_crops(buckets)
    import_manhole_yolo_crops(buckets)

    # Cap manhole to match pothole count so we don't bias toward manhole
    n_pothole = len({str(p.resolve()) for p in buckets["pothole"]})
    n_manhole = len({str(p.resolve()) for p in buckets["manhole"]})
    print(f"Before balance: pothole={n_pothole} manhole={n_manhole}")
    if n_manhole > n_pothole and n_pothole > 0:
        random.seed(42)
        random.shuffle(buckets["manhole"])
        buckets["manhole"] = buckets["manhole"][:n_pothole]
        print(f"Balanced manhole down to {n_pothole}")

    split_and_write(buckets)
    ensure_garbage_fallback()
    print("\nDone. Next: python train.py")


if __name__ == "__main__":
    main()
