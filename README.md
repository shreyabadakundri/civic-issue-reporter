# CivicMind AI

AI-enabled smart governance platform for real-time civic issue detection, routing, and resolution.

## Features

- **Auto photo classification** — upload a photo; AI detects pothole / garbage / manhole automatically
- **Citizen reporting** — submit issue type (auto-detected), description, photo, and GPS location
- **Server-side AI pipeline** — vision + NLP scoring with weighted routing (`0.7 × vision + 0.3 × NLP`)
- **Persistent tickets** — JSON-backed store with status history
- **Admin dashboard** — `/admin` for triage and status updates
- **Department portal** — `/dept` for department queue management
- **Ticket tracking** — `/reports/:id` for full ticket timeline

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Train your own photo classifier (no API key)

See **`ml/README.md`** for the full guide.

```bash
# 1. Create folders
npm run ml:prepare

# 2. Add photos to ml/dataset/train/{garbage,manhole,pothole}/ and val/

# 3. Install Python deps & train
cd ml
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
python train.py

# 4. Restart app — uploads use your trained model
npm run dev
```

After training, the app shows **"Local ML Model"** when classifying photos.

## Optional: OpenAI vision

Set these in a `.env` file for **automatic photo classification** from image content:

```env
OPENAI_API_KEY=sk-...
OPENAI_VISION_MODEL=gpt-4o-mini
```

Without an API key, classification falls back to filename/description keyword matching (less accurate).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run preview` | Preview production build |

## Project structure

```
routes/           TanStack Router pages (/, /admin, /dept, /reports/:id)
server/reports.ts Server functions (submit, fetch, update status)
lib/db.ts         JSON file persistence (data/store.json)
lib/ai.ts         Multimodal analysis engine
public/uploads/   Uploaded report images
```

## Workflow

1. Citizen submits report on home page
2. Image saved to `public/uploads/`
3. AI scores vision + NLP confidence on the server
4. Score ≥ 0.45 → auto-route to department; else → manual review
5. Admin/dept portals update ticket status through the lifecycle:
   `submitted → routed/manual_review → in_progress → resolved → closed`

## Tech stack

TanStack Start · React 19 · Vite · Tailwind CSS 4 · shadcn/ui · Zod
