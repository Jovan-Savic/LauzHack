# Hugging Face AI Image Generation Setup (Optional)

Use AI to generate realistic images for places that don't have photos available!

## How to Get a Hugging Face API Key:

1. Go to [Hugging Face](https://huggingface.co/)
2. Create a free account or sign in
3. Go to **Settings** → **Access Tokens**
4. Click **New token**
5. Give it a name (e.g., "LauzHack Images")
6. Select **Read** permissions
7. Click **Generate**
8. Copy the token (starts with `hf_...`)

## Add the Key to Your App:

Open `script_new.js` and find line 6:

```javascript
const HUGGINGFACE_API_KEY = ''; // Add your key here
```

Replace with:

```javascript
const HUGGINGFACE_API_KEY = 'hf_YOUR_TOKEN_HERE';
```

## What It Does:

- **Generates AI images** when no real photos are found
- Uses **Stable Diffusion 2.1** model
- Creates realistic photos of:
  - Restaurants and cafes
  - Historic buildings
  - Parks and nature spots
  - Museums and galleries
  - Any place in your city!

## Example Prompts:

The AI generates images based on prompts like:
- "A high quality photograph of Café de Grancy in Lausanne, cafe, beautiful lighting, professional photography"
- "A high quality photograph of Lausanne Cathedral in Lausanne, monument, beautiful lighting, professional photography"

## Free Tier:

- **1,000 requests/month** on free tier
- Perfect for this use case!
- No credit card required

## Current Image Priority Chain:

1. OSM Image Tag
2. Google Places API (if key provided)
3. Wikipedia (OSM reference)
4. Wikipedia (exact name)
5. Wikimedia Commons
6. **🤖 Hugging Face AI Generation** (if key provided) ⭐ NEW!
7. Unsplash (generic)
8. Gradient Icons

With Hugging Face, every place gets a custom AI-generated image that matches its actual location and type!
