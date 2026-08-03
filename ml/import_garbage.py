#!/usr/bin/env python3
"""Import real garbage/litter photos into train/val (keeps pothole & manhole)."""

from __future__ import annotations

import random
import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).parent
TRAIN = ROOT / "dataset" / "train" / "garbage"
VAL = ROOT / "dataset" / "val" / "garbage"

TACO = Path.home() / ".cache/kagglehub/datasets/kneroma/tacotrashdataset/versions/3"
GARBAGE_CLS = (
    Path.home()
    / ".cache/kagglehub/datasets/asdasdasasdas/garbage-classification/versions/2"
    / "Garbage classification"
    / "Garbage classification"
)

MAX_TOTAL = 280
VAL_RATIO = 0.15
IMG_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def collect_images() -> list[Path]:
    images: list[Path] = []

    if TACO.exists():
        taco_imgs = [
            p
            for p in TACO.rglob("*")
            if p.is_file() and p.suffix.lower() in IMG_EXTS
        ]
        random.shuffle(taco_imgs)
        # Prefer TACO (litter in real street/outdoor context)
        images.extend(taco_imgs[:220])
        print(f"[taco] selected {min(220, len(taco_imgs))} / {len(taco_imgs)}")
    else:
        print("[taco] missing — skip")

    if GARBAGE_CLS.exists():
        cls_imgs: list[Path] = []
        for folder in GARBAGE_CLS.iterdir():
            if not folder.is_dir():
                continue
            files = [p for p in folder.iterdir() if p.suffix.lower() in IMG_EXTS]
            random.shuffle(files)
            # sample from each material class
            cls_imgs.extend(files[:40])
            print(f"[garbage-cls/{folder.name}] +{min(40, len(files))}")
        random.shuffle(cls_imgs)
        images.extend(cls_imgs[:120])
    else:
        print("[garbage-cls] missing — skip")

    # de-dupe
    unique: list[Path] = []
    seen: set[str] = set()
    for p in images:
        key = str(p.resolve())
        if key in seen:
            continue
        seen.add(key)
        unique.append(p)
    random.shuffle(unique)
    return unique[:MAX_TOTAL]


def clear_garbage() -> None:
    for folder in (TRAIN, VAL):
        folder.mkdir(parents=True, exist_ok=True)
        for f in folder.iterdir():
            if f.is_file() and f.suffix.lower() in IMG_EXTS:
                f.unlink()


def write_split(paths: list[Path]) -> None:
    clear_garbage()
    n_val = max(1, int(len(paths) * VAL_RATIO)) if len(paths) >= 8 else 0
    val_set = paths[:n_val]
    train_set = paths[n_val:]

    for i, src in enumerate(train_set):
        dest = TRAIN / f"garbage_{i:04d}.jpg"
        try:
            Image.open(src).convert("RGB").save(dest, quality=90)
        except OSError:
            shutil.copy2(src, dest)

    for i, src in enumerate(val_set):
        dest = VAL / f"garbage_{i:04d}.jpg"
        try:
            Image.open(src).convert("RGB").save(dest, quality=90)
        except OSError:
            shutil.copy2(src, dest)

    print(f"[garbage] train={len(train_set)} val={len(val_set)}")


def main() -> None:
    random.seed(42)
    paths = collect_images()
    if len(paths) < 30:
        raise SystemExit(
            "Not enough garbage images. Download TACO / garbage-classification via kagglehub first."
        )
    write_split(paths)
    print("\nDone. Next: python train.py")


if __name__ == "__main__":
    main()
