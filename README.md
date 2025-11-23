# Local Discovery - AI-Powered Place Exploration

An intelligent location discovery application that combines real-world mapping data with AI-generated descriptions and images. Find interesting places near you with rich, contextual information.

## Features

### Discovery Engine
- Real-time place discovery using OpenStreetMap Overpass API
- Metadata-based quality scoring (prioritizes well-documented venues)
- Walking distance filters (5min, 10min, 30min, or any distance)
- 12 category filters (landmarks, restaurants, cafes, museums, parks, etc.)
- Smart geocoding with fallback chains

### AI-Powered Content
- Dynamic AI descriptions using Together.ai (Llama 3.1)
- Intelligent image pipeline with multiple fallback sources:
  - OpenStreetMap/Wikipedia official photos
  - DuckDuckGo web search for real venue images
  - Together AI Flux model for high-quality generated images
  - Pollinations.ai as final fallback
- Context-aware prompts for location-specific content

### Interactive Map
- Leaflet.js powered interactive maps
- Custom numbered markers with click-to-view details
- Auto-fit viewport to show all discovered places
- Real-time GPS location detection with IP geolocation fallback
- Manual city search with geocoding

### User Experience
- Lazy image loading (only when marker clicked)
- Expandable descriptions with "Show More/Less"
- Walking time and distance display
- Verified badges for well-documented places
- Google Maps integration for directions
- Offline-mode fallback descriptions

## Tech Stack

**Backend:**
- Python 3.8+ with Flask
- Together.ai SDK (LLM + image generation)
- DuckDuckGo Search API (image search)
- CORS enabled for frontend requests

**Frontend:**
- Vanilla JavaScript (ES6+)
- Leaflet.js for interactive maps
- OpenStreetMap Overpass API (place data)
- Nominatim geocoding

**Data Sources:**
- OpenStreetMap (venues, metadata)
- Wikipedia/Wikidata (images, articles)
- Wikimedia Commons (photos)
- DuckDuckGo (web image search)
- Together.ai Flux (AI-generated images)
- Pollinations.ai (fallback generation)

## Prerequisites

- Python 3.8 or higher
- A Together.ai API key (get one at [https://api.together.xyz/](https://api.together.xyz/))
- Modern web browser with JavaScript enabled
- Optional: Google Places API key for enhanced venue photos

## Setup Instructions

### 1. Clone Repository

```powershell
git clone https://github.com/Jovan-Savic/LauzHack.git
cd LauzHack
```

### 2. Install Dependencies

```powershell
python -m pip install -r requirements.txt
```

**Required packages:**
- Flask (web framework)
- flask-cors (CORS support)
- together (Together.ai SDK)
- python-dotenv (environment variables)
- duckduckgo-search (image search)

### 3. Configure Environment Variables

Copy the example environment file and add your Together.ai API key:

```powershell
Copy-Item .env.example .env
```

Then edit `.env` and replace `your_together_api_key_here` with your actual Together.ai API key:

```
TOGETHER_API_KEY=your_actual_api_key_here
```

**Get your API key:** Go to [https://api.together.xyz/](https://api.together.xyz/), sign up, and create an API key in Settings.

**Optional:** For enhanced venue photos, add a Google Places API key:
```
GOOGLE_PLACES_API_KEY=your_google_api_key_here
```

### 4. Run the Backend Server

```powershell
python app.py
```

The Flask backend will start on `http://localhost:5000`

You should see:
```
* Running on http://0.0.0.0:5000
* Running on http://127.0.0.1:5000
```

### 5. Open the Frontend

Open `index_new.html` in your web browser:

```powershell
# Option 1: Direct open
start index_new.html

# Option 2: Use Python's built-in server
python -m http.server 8000
# Then navigate to http://localhost:8000/index_new.html
```

The frontend will automatically connect to the backend at `http://localhost:5000`

## How to Use

### 1. Set Your Location
- Click "Set Location" button
- Enter a city name (e.g., "Paris", "New York", "London")
- Or click "Detect My Location" to use GPS/IP geolocation

### 2. Choose a Category
Select what you want to discover:
- Landmarks (monuments, attractions)
- Restaurants (dining venues)
- Cafes (coffee shops)
- Museums (art galleries, exhibitions)
- Parks (nature, gardens)
- Shopping (malls, stores)
- Nightlife (bars, pubs, clubs)
- Entertainment (cinemas, theaters)
- Hotels (accommodation)
- Beaches (coastal areas)
- Viewpoints (scenic overlooks)
- Historical (castles, ruins, monuments)

### 3. Adjust Walking Distance
Filter places by walking time:
- 5 min (≈400m radius)
- 10 min (≈800m radius)
- 30 min (≈2.5km radius)
- Any distance

### 4. Explore Places
- View numbered markers on the map
- Click any marker to see details:
  - High-quality photos (real or AI-generated)
  - AI-written description
  - Walking time and distance
  - "Show More" for full descriptions
  - "Open in Google Maps" for directions

## Backend API Endpoints

### Health Check
**GET** `/health`

Returns server status.

### Generate Place Description
**POST** `/api/generate`

Generate AI description for a place.

**Request:**
```json
{
  "prompt": "Describe the Eiffel Tower in Paris in 1-2 sentences.",
  "model": "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
  "max_tokens": 100,
  "temperature": 0.7
}
```

**Response:**
```json
{
  "success": true,
  "response": "The Eiffel Tower is an iconic iron lattice...",
  "model": "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo"
}
```

### Search for Place Image
**POST** `/api/search-image`

Search for real place images via DuckDuckGo.

**Request:**
```json
{
  "query": "Eiffel Tower Paris landmark"
}
```

**Response:**
```json
{
  "success": true,
  "image_url": "https://example.com/eiffel-tower.jpg",
  "source": "DuckDuckGo"
}
```

### Generate AI Image
**POST** `/api/generate-image`

Generate a place image using Together.ai Flux model.

**Request:**
```json
{
  "prompt": "A high quality photograph of Eiffel Tower in Paris, beautiful lighting, 4k",
  "model": "black-forest-labs/FLUX.1-schnell",
  "steps": 4
}
```

**Response:**
```json
{
  "success": true,
  "image_url": "https://together.ai/image.jpg",
  "model": "black-forest-labs/FLUX.1-schnell"
}
```

### Get Available Models
**GET** `/api/models`

Lists supported Together.ai models.

## Architecture

### Place Discovery Pipeline
1. **Query Construction**: Category mapped to OSM tags (e.g., `cafe` → `[amenity~"cafe|coffee_shop"]`)
2. **Overpass Query**: Fetch nodes/ways/relations within 10km radius
3. **Metadata Scoring**: Prioritize places with Wikipedia, Wikidata, images, websites
4. **Geocoding**: Multi-query geocoding with distance validation (<50km)
5. **Distance Filtering**: Filter by walking time based on user preference
6. **Display**: Add numbered markers to map, lazy-load images on click

### Image Loading Chain
When you click a marker, the app tries (in order):
1. **OSM Image URL** (if tagged in OpenStreetMap)
2. **Google Places API** (if API key configured)
3. **Wikipedia/Wikidata** (official article photos)
4. **Wikimedia Commons** (user-uploaded photos)
5. **DuckDuckGo Search** (real web photos via backend)
6. **Together AI Flux** (high-quality AI generation)
7. **Pollinations.ai** (free AI generation fallback)
8. **Gradient Icon** (final fallback)

### Description Generation
- **Primary**: Together.ai Llama 3.1 8B (1-2 sentences, context-aware)
- **Fallback**: Local template-based descriptions if backend offline

## Key Features Explained

### Metadata Quality Scoring
Places are scored based on available information:
- Wikipedia article: +10 points
- Wikidata ID: +8 points
- Direct image URL: +6 points
- Website: +3 points
- Description: +2 points

Places with score 0 are filtered out. Results sorted by score (desc) then distance (asc).

### Smart Geocoding
Multiple fallback queries prevent missed results:
1. `{place}, {city}`
2. `{place} near {city}`
3. `{place} {category} {city}`
4. `{place}`

Distance validation rejects results >50km away (prevents wrong-city matches).

### Lazy Image Loading
Images load **only when marker clicked**, not during initial search:
- Faster initial page load
- Reduced API calls
- Better user experience
- Loading spinner shows progress

## Configuration

### Frontend Config (`script_new.js`)
```javascript
const API_BASE_URL = 'http://localhost:5000';
const DEFAULT_MODEL = 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo';
const GOOGLE_PLACES_API_KEY = ''; // Optional
```

### Backend Config (`.env`)
```
TOGETHER_API_KEY=your_api_key_here
```

### Category to OSM Tag Mapping
The app maps categories to specific OpenStreetMap queries:
- **Landmarks**: `tourism~"attraction|monument|artwork|viewpoint"`
- **Restaurants**: `amenity="restaurant"`
- **Cafes**: `amenity~"cafe|coffee_shop"`
- **Museums**: `tourism~"museum|gallery"`
- **Parks**: `leisure~"park|garden|nature_reserve"`

See `searchPlacesWithOverpass()` in `script_new.js` for full mappings.

## Project Structure

```
LauzHack/
├── app.py                  # Flask backend (AI + image search)
├── requirements.txt        # Python dependencies
├── .env                    # Environment variables (API keys)
├── .env.example            # Environment template
├── index_new.html          # Main application HTML
├── style_new.css           # Application styles
├── script_new.js           # Core application logic (1500+ lines)
├── README.md               # This file
├── API_USAGE.md            # API integration guide
├── GOOGLE_PLACES_SETUP.md  # Optional Google Places setup
└── HUGGINGFACE_SETUP.md    # Optional Hugging Face setup
```

### Key Files

**`script_new.js`** - Main application logic:
- Location detection and geocoding
- Overpass API integration
- Place discovery and filtering
- Image loading pipeline
- Map interaction handlers
- AI description enrichment

**`app.py`** - Backend API server:
- `/api/generate` - LLM text generation
- `/api/search-image` - DuckDuckGo image search
- `/api/generate-image` - Together.ai Flux image generation
- `/health` - Server health check

**`style_new.css`** - Modern dark theme UI with:
- Responsive grid layouts
- Smooth animations
- Custom map popups
- Loading states

## Troubleshooting

### Backend Issues

**Problem**: `ModuleNotFoundError: No module named 'together'`  
**Solution**: Install dependencies: `python -m pip install -r requirements.txt`

**Problem**: `TOGETHER_API_KEY not found`  
**Solution**: Create `.env` file with your API key (see Setup step 3)

**Problem**: `ModuleNotFoundError: No module named 'duckduckgo_search'`  
**Solution**: Install latest dependencies: `pip install duckduckgo-search`

### Frontend Issues

**Problem**: No places found  
**Solutions**:
- Increase walking distance filter (try "Any")
- Try a different category
- Check browser console for errors
- Ensure backend is running (`http://localhost:5000/health`)

**Problem**: Images not loading  
**Solutions**:
- Click marker again (lazy loading may have failed)
- Check backend logs for API errors
- Verify Together.ai API key is valid
- Some places may only have fallback icons

**Problem**: Descriptions show "Loading..."  
**Solutions**:
- Backend may be offline or slow
- Check Together.ai API quota/rate limits
- Fallback descriptions will appear after 30s timeout

**Problem**: GPS location not detected  
**Solutions**:
- Grant browser location permission
- Use manual city input instead
- Check "Detect My Location" falls back to IP geolocation

### Performance Tips

- **Use caching**: The app caches images and geocoding results
- **Limit distance**: Smaller walking radius = faster searches
- **Clear cache**: Open browser console and run `clearCache()` if data seems stale
- **Backend logs**: Check terminal for detailed debug info

## Development

### Running in Development Mode

Backend has debug mode enabled by default:
```powershell
python app.py
# Debug mode auto-reloads on code changes
```

### Adding New Categories

1. Edit `osmQueries` in `searchPlacesWithOverpass()` (script_new.js)
2. Add category button to `index_new.html`
3. Add search terms to `tryPollinationsImage()` for AI fallback images

### Customizing AI Prompts

Edit prompt templates in `enrichPlacesWithDescriptions()`:
```javascript
const prompt = `Describe ${place.name} in ${userLocation.name} in 1-2 sentences. What makes it special or interesting?`;
```

### Adjusting Filters

Modify constants in `script_new.js`:
- `maxWalkingMinutes` - Default distance filter
- Search radius - Change `10000` (10km) in `searchPlacesWithOverpass()`
- Results limit - Change `12` in `return places.slice(0, 12)`

## Future Expansion Ideas

- User profiles with interest preferences
- Multi-stop itinerary planning
- Time-of-day recommendations (sunset viewpoints, morning cafes)
- Accessibility filters (wheelchair, quiet spaces)
- User-contributed notes and ratings
- Offline mode with cached vector tiles
- Audio guide generation (TTS)
- AR overlay for landmark identification
- Trip collections with shareable links
- Weather-aware suggestions

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - Free to use and modify for your projects.

## Credits

- **OpenStreetMap** - Place data and mapping
- **Together.ai** - LLM and image generation
- **Leaflet.js** - Interactive maps
- **DuckDuckGo** - Image search API
- **Wikipedia/Wikimedia** - Place photos and information
