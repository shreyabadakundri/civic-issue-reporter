#!/usr/bin/env python3
"""Create the dataset folder structure for civic issue training."""

from pathlib import Path

CLASSES = ("garbage", "manhole", "pothole")
ROOT = Path(__file__).parent / "dataset"

for split in ("train", "val"):
    for label in CLASSES:
        folder = ROOT / split / label
        folder.mkdir(parents=True, exist_ok=True)
        readme = folder / "README.txt"
        if not readme.exists():
            readme.write_text(
                f"Add .jpg / .png photos of '{label}' here.\n"
                f"Aim for at least 30 images per class (100+ is better).\n",
                encoding="utf-8",
            )

print("Dataset folders ready:")
print(f"  {ROOT / 'train'}")
print(f"  {ROOT / 'val'}")
print("\nNext steps:")
print("  1. Put photos into each class folder under train/ and val/")
print("  2. Run: python ml/train.py")
