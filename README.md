# Local Discovery

AI-powered place discovery app that combines OpenStreetMap data with generated descriptions and images.

## What it does
- Finds nearby places by category and walking distance
- Shows results on an interactive Leaflet map
- Adds short AI descriptions
- Tries multiple image sources with fallbacks

## Stack
- **Backend:** Flask (`app.py`)
- **Frontend:** `index_new.html` + `script_new.js` + `style_new.css`
- **Data/APIs:** OpenStreetMap (Overpass), Nominatim, Together.ai, DuckDuckGo

## Requirements
- Python 3.8+
- Together.ai API key
- Optional: Google Places API key

## Quick start
1. Install dependencies:
   ```bash
   python -m pip install -r requirements.txt
   ```
2. Create `.env` and set your key:
   ```env
   TOGETHER_API_KEY=your_api_key_here
   # Optional:
   GOOGLE_PLACES_API_KEY=your_google_api_key_here
   ```
3. Run backend:
   ```bash
   python app.py
   ```
4. Open frontend:
   - Open `index_new.html` directly, or
   - Serve project root and visit `/index_new.html`

Backend runs on `http://localhost:5000`.

## How to use
1. Set location (city or auto-detect)
2. Pick a category
3. Pick a walking distance
4. Click map markers to view details, images, and directions

## API (backend)
- `GET /health` — service status
- `POST /api/generate` — generate place description
- `POST /api/search-image` — search for place images
- `POST /api/generate-image` — generate AI image
- `GET /api/models` — list supported models

## Project files
- `app.py` — Flask API
- `script_new.js` — main app logic
- `index_new.html` — UI
- `style_new.css` — styling

## Additional docs
- `API_USAGE.md`
- `GOOGLE_PLACES_SETUP.md`
- `HUGGINGFACE_SETUP.md`

## License
MIT
