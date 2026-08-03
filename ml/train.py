#!/usr/bin/env python3
"""
Train a 3-class civic issue classifier (garbage, manhole, pothole).

Folder layout (alphabetical class order matters for the app):
  ml/dataset/train/garbage/
  ml/dataset/train/manhole/
  ml/dataset/train/pothole/
  ml/dataset/val/...

Exports TensorFlow.js model to:
  public/models/civic-classifier/
"""

from __future__ import annotations

import json
import shutil
import sys
import types
from pathlib import Path

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from tensorflow.keras.preprocessing.image import ImageDataGenerator

ROOT = Path(__file__).parent
DATASET = ROOT / "dataset"
TRAIN_DIR = DATASET / "train"
VAL_DIR = DATASET / "val"
OUTPUT_DIR = ROOT / "output"
KERAS_PATH = OUTPUT_DIR / "civic_classifier.keras"
TFJS_DIR = ROOT.parent / "public" / "models" / "civic-classifier"

IMG_SIZE = (224, 224)
BATCH_SIZE = 16
EPOCHS = 15
QUICK_EPOCHS = 12
MIN_IMAGES_PER_CLASS = 5


def count_images(folder: Path) -> int:
    if not folder.exists():
        return 0
    exts = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
    return sum(1 for f in folder.rglob("*") if f.suffix.lower() in exts)


def validate_dataset() -> list[str]:
    classes = sorted([p.name for p in TRAIN_DIR.iterdir() if p.is_dir()])
    if not classes:
        raise SystemExit(
            "No training folders found. Run: python ml/prepare_dataset.py\n"
            "Then add images to ml/dataset/train/<class>/"
        )

    problems: list[str] = []
    for label in classes:
        train_count = count_images(TRAIN_DIR / label)
        val_count = count_images(VAL_DIR / label)
        if train_count < MIN_IMAGES_PER_CLASS:
            problems.append(f"  - {label}: only {train_count} train images (need >= {MIN_IMAGES_PER_CLASS})")
        if val_count == 0:
            print(f"Note: no val images for '{label}' — some will be held out from train automatically.")
    return problems


def build_model(num_classes: int, fine_tune: bool = True) -> keras.Model:
    base = keras.applications.MobileNetV2(
        input_shape=(*IMG_SIZE, 3),
        include_top=False,
        weights="imagenet",
    )
    # Unfreeze last blocks so pothole vs manhole features can separate.
    base.trainable = fine_tune
    if fine_tune:
        for layer in base.layers[:-40]:
            layer.trainable = False

    inputs = keras.Input(shape=(*IMG_SIZE, 3))
    x = keras.applications.mobilenet_v2.preprocess_input(inputs)
    x = base(x, training=False)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dropout(0.35)(x)
    x = layers.Dense(128, activation="relu")(x)
    x = layers.Dropout(0.25)(x)
    outputs = layers.Dense(num_classes, activation="softmax")(x)
    return keras.Model(inputs, outputs)


def main() -> None:
    quick = "--quick" in sys.argv
    epochs = QUICK_EPOCHS if quick else EPOCHS
    print("CivicMind AI — local vision trainer")
    if quick:
        print(f"(quick mode: {epochs} epochs)\n")
    else:
        print()

    if not TRAIN_DIR.exists():
        raise SystemExit("Run first: python ml/prepare_dataset.py")

    problems = validate_dataset()
    if problems:
        print("Dataset issues:")
        print("\n".join(problems))
        raise SystemExit("\nAdd more photos, then run training again.")

    train_datagen = ImageDataGenerator(
        rotation_range=20,
        width_shift_range=0.15,
        height_shift_range=0.15,
        zoom_range=0.2,
        horizontal_flip=True,
        validation_split=0.2,
        fill_mode="nearest",
    )

    val_datagen = ImageDataGenerator()

    has_val = any(count_images(VAL_DIR / label) > 0 for label in sorted(p.name for p in TRAIN_DIR.iterdir() if p.is_dir()))

    train_flow = train_datagen.flow_from_directory(
        TRAIN_DIR,
        target_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
        class_mode="categorical",
        shuffle=True,
        subset="training" if not has_val else None,
    )

    if has_val:
        val_flow = val_datagen.flow_from_directory(
            VAL_DIR,
            target_size=IMG_SIZE,
            batch_size=BATCH_SIZE,
            class_mode="categorical",
            shuffle=False,
        )
    else:
        val_flow = train_datagen.flow_from_directory(
            TRAIN_DIR,
            target_size=IMG_SIZE,
            batch_size=BATCH_SIZE,
            class_mode="categorical",
            shuffle=False,
            subset="validation",
        )

    class_indices = train_flow.class_indices
    labels = sorted(class_indices, key=lambda k: class_indices[k])
    print(f"Classes (index order): {labels}")

    # Class weights: up-weight weaker classes so manhole doesn't dominate.
    counts = {label: float(count_images(TRAIN_DIR / label)) for label in labels}
    total = sum(counts.values()) or 1.0
    class_weight = {
        class_indices[label]: (total / (len(labels) * max(1.0, counts[label])))
        for label in labels
    }
    # Extra nudge: pothole & garbage often confused with manhole/road texture
    if "pothole" in class_indices:
        class_weight[class_indices["pothole"]] *= 1.2
    if "garbage" in class_indices:
        class_weight[class_indices["garbage"]] *= 1.35
    print(f"Class weights: { {labels[i]: round(w, 3) for i, w in class_weight.items()} }")

    model = build_model(num_classes=len(labels), fine_tune=True)
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=5e-5),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    callbacks = [
        keras.callbacks.EarlyStopping(patience=5, restore_best_weights=True, monitor="val_accuracy"),
        keras.callbacks.ModelCheckpoint(KERAS_PATH, save_best_only=True, monitor="val_accuracy"),
        keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=2, min_lr=1e-6),
    ]

    print("\nTraining…")
    history = model.fit(
        train_flow,
        validation_data=val_flow,
        epochs=epochs,
        callbacks=callbacks,
        class_weight=class_weight,
    )

    model.save(KERAS_PATH)
    print(f"\nSaved Keras model: {KERAS_PATH}")
    print(f"Best val accuracy: {max(history.history.get('val_accuracy', [0])):.2%}")

    if TFJS_DIR.exists():
        shutil.rmtree(TFJS_DIR)
    TFJS_DIR.mkdir(parents=True, exist_ok=True)

    print("\nExporting TensorFlow.js model…")
    export_tfjs(model, TFJS_DIR)

    metadata = {
        "labels": labels,
        "imageSize": IMG_SIZE[0],
        "model": "MobileNetV2",
        "note": "Class order must match folder names (alphabetical).",
    }
    (TFJS_DIR / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    print(f"Exported TF.js model: {TFJS_DIR}")
    print("\nDone! Restart npm run dev and upload a photo to test local classification.")


def _stub_package(name: str) -> types.ModuleType:
    """Create a fake package so optional tensorflowjs imports don't crash."""
    parts = name.split(".")
    parent: types.ModuleType | None = None
    for i, part in enumerate(parts):
        full = ".".join(parts[: i + 1])
        mod = sys.modules.get(full)
        if mod is None:
            mod = types.ModuleType(full)
            mod.__path__ = []  # mark as package
            sys.modules[full] = mod
            if parent is not None:
                setattr(parent, part, mod)
        parent = mod
    assert parent is not None
    return parent


def export_tfjs(model: keras.Model, tfjs_dir: Path) -> None:
    """Export Keras model to TF.js, stubbing optional deps that break on Python 3.13."""
    # tensorflowjs imports these at module load even for plain Keras conversion.
    for name in (
        "tensorflow_decision_forests",
        "tensorflow_hub",
        "flax",
        "flax.linen",
        "flax.training",
        "jax",
        "jax.experimental",
        "jax.experimental.jax2tf",
        "jax.numpy",
        "jaxlib",
    ):
        _stub_package(name)

    try:
        import tensorflowjs as tfjs
    except ImportError as exc:
        raise SystemExit(
            "tensorflowjs is not installed. Activate ml/.venv and run:\n"
            '  pip install "tensorflowjs==4.22.0" --no-deps tf_keras scipy importlib_resources\n'
            f"Original error: {exc}"
        ) from exc

    tfjs.converters.save_keras_model(model, str(tfjs_dir))


if __name__ == "__main__":
    main()
