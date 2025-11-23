# API Usage Summary

This app uses multiple APIs for different purposes. Here's what each one does:

## 🤖 Together.ai (Required)
**Purpose**: Generate place descriptions only  
**Used for**: 2-sentence descriptions of each place  
**Setup**: Already configured in `app.py`  

Example: *"Lausanne Cathedral is a stunning Gothic church with beautiful stained glass. It offers panoramic views from its tower."*

---

## 📸 Image APIs (All Optional)

The app tries multiple sources to find the best image for each place:

### 1. OpenStreetMap (Free, No API Key)
- Direct image URLs from OSM database
- Wikipedia references

### 2. Google Places API (Optional)
- Real photos from Google Maps
- Best for: Restaurants, cafes, shops
- **Setup**: See `GOOGLE_PLACES_SETUP.md`
- Free tier: $200 credit/month

### 3. Hugging Face (Optional - Recommended!)
- AI-generated realistic images
- Best for: Places without photos
- **Setup**: See `HUGGINGFACE_SETUP.md`
- Free tier: 1,000 requests/month
- Generates custom images like: "Café de Grancy in Lausanne"

### 4. Wikimedia Commons (Free, No API Key)
- Historical photos and artwork
- Best for: Famous landmarks

### 5. Unsplash (Free, No API Key)
- Generic category images (always works!)
- Fallback for everything else

---

## 🗺️ Place Discovery

**OpenStreetMap Overpass API** (Free, No API Key)
- Finds real places near you
- Gets accurate GPS coordinates
- Used for: All category searches (restaurants, museums, etc.)

---

## Summary

**Minimum Setup**: Works with just Together.ai (descriptions only, colorful icon images)  
**Recommended Setup**: Add Hugging Face key for AI-generated images  
**Maximum Setup**: Add both Google Places + Hugging Face for best results

All image APIs are optional - the app works without them using Unsplash + gradient icons!
