# Train Your Own Civic Issue Classifier

Classify **garbage**, **manhole**, and **pothole** photos locally — no OpenAI API key.

## 1. Install Python dependencies

Requires **Python 3.10+**.

```bash
cd ml
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

## 2. Create folders

From project root:

```bash
python ml/prepare_dataset.py
```

This creates:

```
ml/dataset/
  train/
    garbage/    ← put training photos here
    manhole/
    pothole/
  val/
    garbage/    ← put validation photos here (optional but recommended)
    manhole/
    pothole/
```

## 3. Collect images

| Class | What to photograph | Tips |
|-------|-------------------|------|
| **pothole** | Cracks, holes, damaged asphalt | Various sizes, angles, lighting |
| **garbage** | Trash piles, litter, bins overflowing | Street/sidewark context |
| **manhole** | Sewer covers, open/missing manholes | Include metal ring/cover when possible |

**Minimum:** ~30 images per class for training (100+ per class is much better).

**Split:** ~80% in `train/`, ~20% in `val/` for each class.

### Where to find sample images

- Take your own photos (best for your area)
- Search open datasets: *"pothole detection dataset"*, *"road damage dataset"*
- [Google Teachable Machine](https://teachablemachine.withgoogle.com/) — export images per class, then copy into these folders

## 4. Train

```bash
python ml/train.py
```

Training uses **MobileNetV2** (transfer learning) with data augmentation.

Output:

- `ml/output/civic_classifier.keras` — Keras model
- `public/models/civic-classifier/` — TensorFlow.js model (used by the app)

## 5. Run the app

```bash
npm install
npm run dev
```

Upload a photo on the home page. If the model exists, you'll see **"Local ML Model"** in the detection panel.

## Class order (important)

Folders are read in **alphabetical order**:

1. `garbage` (index 0)
2. `manhole` (index 1)
3. `pothole` (index 2)

Do not rename folders unless you retrain and update `metadata.json`.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "only N train images" | Add more photos to that class folder |
| Still defaults to pothole | Model not trained yet — run `python ml/train.py` |
| Manhole vs pothole confused | Add more distinct manhole photos (visible cover/ring) |
| Training slow | Normal on CPU; reduce images or use GPU TensorFlow |

## Retrain after adding photos

Add new images → run `python ml/train.py` again → restart dev server.
