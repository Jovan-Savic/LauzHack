# Google Places API Setup (Optional)

To get better images for restaurants, cafes, and other places, you can add a Google Places API key.

## How to Get a Google Places API Key:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Places API** and **Places API (New)**
4. Go to **Credentials** → Create API Key
5. Restrict the API key to:
   - **Places API**
   - **HTTP referrers** (add your domain)

## Add the Key to Your App:

Open `script_new.js` and find line 5:

```javascript
const GOOGLE_PLACES_API_KEY = ''; // Add your key here
```

Replace with:

```javascript
const GOOGLE_PLACES_API_KEY = 'YOUR_API_KEY_HERE';
```

## Current Image Fallback Chain:

The app tries to get images in this order:

1. **OSM Image Tag** (if available in OpenStreetMap data)
2. **Google Places API** (if API key provided) ⭐ Best for restaurants/cafes
3. **Wikipedia** (via OSM reference)
4. **Wikipedia** (exact name search)
5. **Wikimedia Commons** (search)
6. **Unsplash** (generic category images) 🎨 Always works!
7. **Gradient Icon** (colorful fallback)

Even without the Google API key, the app will use Unsplash for nice generic images!
