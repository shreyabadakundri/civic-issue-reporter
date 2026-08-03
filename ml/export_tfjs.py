#!/usr/bin/env python3
"""Export an already-trained Keras model to TensorFlow.js (no retrain)."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

from tensorflow import keras

from train import TFJS_DIR, KERAS_PATH, export_tfjs

LABELS = ["garbage", "manhole", "pothole"]


def main() -> None:
    if not KERAS_PATH.exists():
        raise SystemExit(f"No Keras model at {KERAS_PATH}. Run: python train.py")

    print(f"Loading {KERAS_PATH}…")
    model = keras.models.load_model(KERAS_PATH)

    if TFJS_DIR.exists():
        shutil.rmtree(TFJS_DIR)
    TFJS_DIR.mkdir(parents=True, exist_ok=True)

    print("Exporting TensorFlow.js model…")
    export_tfjs(model, TFJS_DIR)

    metadata = {
        "labels": LABELS,
        "imageSize": 224,
        "model": "MobileNetV2",
        "note": "Class order must match folder names (alphabetical).",
    }
    (TFJS_DIR / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(f"Exported: {TFJS_DIR}")
    print("Files:", sorted(p.name for p in TFJS_DIR.iterdir()))


if __name__ == "__main__":
    main()
