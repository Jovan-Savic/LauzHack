// Configuration
const API_BASE_URL = 'http://localhost:5000';
const DEFAULT_MODEL = 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo';
const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes
const GOOGLE_PLACES_API_KEY = ''; // Optional: Add your Google Places API key for better images
const HUGGINGFACE_API_KEY = ''; // Optional: Add your Hugging Face API key for AI-generated images

// State
let userLocation = null;
let map = null;
let markers = [];
let currentPlaces = [];
let maxWalkingMinutes = 5; // Default 5 minutes walking distance

// Cache storage
const cache = {
    recommendations: {}, // category -> {data, timestamp}
    images: {}, // placeName -> imageUrl
    geocoding: {} // query -> {lat, lon, timestamp}
};

// DOM Elements
const locationBtn = document.getElementById('locationBtn');
const locationInput = document.getElementById('locationInput');
const setLocationBtn = document.getElementById('setLocationBtn');
const detectLocationBtn = document.getElementById('detectLocationBtn');
const currentLocation = document.getElementById('currentLocation');
const locationPanel = document.getElementById('locationPanel');
const categoryPanel = document.getElementById('categoryPanel');
const mapContainer = document.getElementById('mapContainer');
const detailsPanel = document.getElementById('detailsPanel');
const closeDetails = document.getElementById('closeDetails');
const detailsImage = document.getElementById('detailsImage');
const detailsTitle = document.getElementById('detailsTitle');
const detailsDescription = document.getElementById('detailsDescription');
const directionsBtn = document.getElementById('directionsBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    checkServerHealth();
    loadCacheFromStorage();
});

function setupEventListeners() {
    setLocationBtn.addEventListener('click', handleSetLocation);
    detectLocationBtn.addEventListener('click', handleDetectLocation);
    locationBtn.addEventListener('click', () => {
        locationPanel.classList.toggle('hidden');
    });
    
    locationInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSetLocation();
        }
    });
    
    // Category buttons
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const category = btn.dataset.category;
            handleCategorySelect(category);
        });
    });
    
    // Close details panel
    closeDetails.addEventListener('click', () => {
        detailsPanel.classList.remove('active');
    });
    
    // Distance filter buttons
    document.querySelectorAll('.distance-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            document.querySelectorAll('.distance-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update max walking distance
            maxWalkingMinutes = parseInt(btn.dataset.distance);
            console.log(`🚶 Walking distance filter: ${maxWalkingMinutes === 999 ? 'Any' : maxWalkingMinutes + ' min'}`);
            
            // If places are already loaded, re-filter them
            if (currentPlaces.length > 0 && markers.length > 0) {
                refilterCurrentPlaces();
            }
        });
    });
}

// Set location manually
function handleSetLocation() {
    const location = locationInput.value.trim();
    if (!location) {
        alert('Please enter a location');
        return;
    }
    
    showLoading('Setting location...');
    
    // Geocode the location
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`, {
        headers: { 'User-Agent': 'LocalDiscoveryApp/1.0' }
    })
    .then(res => res.json())
    .then(data => {
        hideLoading();
        if (data && data.length > 0) {
            const place = data[0];
            userLocation = {
                name: location,
                latitude: parseFloat(place.lat),
                longitude: parseFloat(place.lon)
            };
            
            currentLocation.textContent = location;
            locationPanel.classList.add('hidden');
            categoryPanel.classList.remove('hidden');
            
            initializeMap();
            centerMapOnLocation(userLocation.latitude, userLocation.longitude);
        } else {
            alert('Location not found. Please try another city name.');
        }
    })
    .catch(error => {
        hideLoading();
        console.error('Error geocoding:', error);
        alert('Error finding location. Please try again.');
    });
}

// Detect location with GPS (with IP fallback)
async function handleDetectLocation() {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser');
        return;
    }
    
    showLoading('Detecting your location...');
    
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            
            console.log('✅ GPS Location detected:', lat, lon);
            
            // Reverse geocode to get city name
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`, {
                    headers: { 'User-Agent': 'LocalDiscoveryApp/1.0' }
                });
                const data = await response.json();
                
                let locationName = 'Your Location';
                if (data.address) {
                    const city = data.address.city || data.address.town || data.address.village || data.address.county;
                    const country = data.address.country;
                    locationName = city ? `${city}, ${country}` : country;
                }
                
                userLocation = {
                    name: locationName,
                    latitude: lat,
                    longitude: lon
                };
                
                currentLocation.textContent = locationName;
                locationPanel.classList.add('hidden');
                categoryPanel.classList.remove('hidden');
                
                initializeMap();
                centerMapOnLocation(lat, lon);
                
                hideLoading();
            } catch (error) {
                hideLoading();
                console.error('❌ Error reverse geocoding:', error);
                
                // Still save location even if reverse geocoding fails
                userLocation = {
                    name: 'Your Location',
                    latitude: lat,
                    longitude: lon
                };
                
                currentLocation.textContent = 'Your Location';
                locationPanel.classList.add('hidden');
                categoryPanel.classList.remove('hidden');
                
                initializeMap();
                centerMapOnLocation(lat, lon);
            }
        },
        async (error) => {
            console.error('❌ Geolocation error:', error);
            
            // If position unavailable, try IP-based geolocation as fallback
            if (error.code === error.POSITION_UNAVAILABLE) {
                console.log('🔄 Trying IP-based geolocation...');
                try {
                    const response = await fetch('https://ipapi.co/json/');
                    const data = await response.json();
                    
                    if (data.latitude && data.longitude) {
                        console.log('✅ IP Location detected:', data.city, data.country_name);
                        
                        userLocation = {
                            name: `${data.city}, ${data.country_name}`,
                            latitude: data.latitude,
                            longitude: data.longitude
                        };
                        
                        currentLocation.textContent = userLocation.name;
                        locationPanel.classList.add('hidden');
                        categoryPanel.classList.remove('hidden');
                        
                        initializeMap();
                        centerMapOnLocation(data.latitude, data.longitude);
                        
                        hideLoading();
                        return;
                    }
                } catch (ipError) {
                    console.error('❌ IP geolocation failed:', ipError);
                }
            }
            
            hideLoading();
            
            let message = '';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    message = '🚫 Location access denied.\n\nPlease:\n1. Click the location icon in your browser\'s address bar\n2. Allow location access\n3. Try again\n\nOr enter your city name manually above.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    message = '📍 GPS unavailable. Please enter your city name manually above.';
                    break;
                case error.TIMEOUT:
                    message = '⏱️ Location request timed out. Please try again or enter your city manually.';
                    break;
                default:
                    message = '❌ Unable to get location. Please enter your city name manually.';
            }
            alert(message);
        },
        {
            enableHighAccuracy: false, // Changed to false for better compatibility with Brave
            timeout: 10000,
            maximumAge: 60000 // Allow cached location up to 1 minute old
        }
    );
}

// Initialize map
function initializeMap() {
    if (map) return;
    
    mapContainer.classList.remove('hidden');
    
    map = L.map('map').setView([userLocation.latitude, userLocation.longitude], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
    
    // Add user location marker
    L.marker([userLocation.latitude, userLocation.longitude], {
        icon: L.divIcon({
            className: 'user-marker',
            html: '<div style="background:#ef4444;color:white;border:3px solid white;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:18px;">📍</div>',
            iconSize: [30, 30]
        })
    }).addTo(map).bindPopup(`<b>You are here</b><br>${userLocation.name}`);
    
    setTimeout(() => map.invalidateSize(), 100);
}

function centerMapOnLocation(lat, lon) {
    if (map) {
        map.setView([lat, lon], 13);
    }
}

// Handle category selection
async function handleCategorySelect(category) {
    if (!userLocation) {
        alert('Please set your location first');
        return;
    }
    
    // Update active button
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.closest('.category-btn').classList.add('active');
    
    // Check cache first - but validate it's not empty
    const cached = getCachedRecommendations(category, userLocation.name);
    if (cached && cached.length > 0) {
        console.log(`📦 Using ${cached.length} cached places`);
        displayPlacesOnMap(cached, category);
        return;
    } else if (cached && cached.length === 0) {
        console.log(`⚠️ Cache has 0 places, fetching fresh data...`);
        // Clear this bad cache entry
        const key = `${category}-${userLocation.name}`;
        delete cache.recommendations[key];
        saveCacheToStorage();
    }
    
    showLoading(`Searching for ${category} near you...`);
    
    // Use Overpass API to find real places from OpenStreetMap
    try {
        const places = await searchPlacesWithOverpass(category, userLocation);
        
        if (places.length === 0) {
            hideLoading();
            alert(`No ${category} found nearby.\n\nTry:\n• Different category\n• Increasing distance filter`);
            return;
        }
        
        console.log(`🗺️ Found ${places.length} places from OpenStreetMap`);
        
        // Get descriptions from LLM in background
        enrichPlacesWithDescriptions(places, category);
        
        // Display immediately with coordinates already from OSM
        displayPlacesWithParallelProcessing(places, category);
        
    } catch (error) {
        hideLoading();
        console.error('Error:', error);
        alert('Error searching for places. Please try again.');
    }
}

// Search for places using Overpass API
async function searchPlacesWithOverpass(category, location) {
    const lat = location.latitude;
    const lon = location.longitude;
    const radius = 10000; // 10km radius search (increased from 5km)
    
    // Map categories to OSM tags with better coverage
    const osmQueries = {
        landmarks: `[tourism~"attraction|monument|artwork|viewpoint|gallery"][name]`,
        restaurants: `[amenity="restaurant"][name]`,
        cafes: `[amenity~"cafe|coffee_shop"][name]`,
        museums: `[tourism~"museum|gallery"][name]`,
        parks: `[leisure~"park|garden|nature_reserve"][name]`,
        shopping: `[shop~"mall|department_store|supermarket|convenience|clothes|books"][name]`,
        nightlife: `[amenity~"bar|pub|nightclub|biergarten"][name]`,
        entertainment: `[amenity~"theatre|cinema|casino|arts_centre"][name]`,
        hotels: `[tourism~"hotel|hostel|guest_house|motel"][name]`,
        beaches: `[natural~"beach|coastline"][name]`,
        viewpoints: `[tourism~"viewpoint|attraction"][natural~"peak|cliff"][name]`,
        historical: `[historic~"monument|memorial|castle|ruins|archaeological_site|building"][name]`
    };
    
    const query = osmQueries[category] || osmQueries.landmarks;
    
    // Overpass QL query - get more results and prioritize places with metadata
    const overpassQuery = `
        [out:json][timeout:25];
        (
          node${query}(around:${radius},${lat},${lon});
          way${query}(around:${radius},${lat},${lon});
          relation${query}(around:${radius},${lat},${lon});
        );
        out tags center 100;
    `;
    
    console.log(`🔍 Querying Overpass API for ${category}...`);
    
    const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: overpassQuery
    });
    
    if (!response.ok) {
        throw new Error(`Overpass API error: ${response.status}`);
    }
    
    const data = await response.json();
    const places = [];
    
    for (const element of data.elements) {
        if (!element.tags || !element.tags.name) continue;
        
        // Get coordinates (handle nodes vs ways/relations)
        let placeLat, placeLon;
        if (element.type === 'node') {
            placeLat = element.lat;
            placeLon = element.lon;
        } else if (element.center) {
            placeLat = element.center.lat;
            placeLon = element.center.lon;
        } else {
            continue;
        }
        
        // Calculate distance
        const distanceKm = Math.sqrt(
            Math.pow((placeLat - lat) * 111, 2) +
            Math.pow((placeLon - lon) * 111, 2)
        );
        
        // Calculate metadata score (prioritize places with more information)
        let metadataScore = 0;
        const hasWikipedia = element.tags.wikipedia || element.tags['wikipedia:en'];
        const hasWikidata = element.tags.wikidata;
        const hasImage = element.tags.image;
        const hasWebsite = element.tags.website;
        const hasDescription = element.tags.description;
        
        // Scoring system (higher = better)
        if (hasWikipedia) metadataScore += 10; // Wikipedia article = excellent
        if (hasWikidata) metadataScore += 8;   // Wikidata ID = very good
        if (hasImage) metadataScore += 6;      // Direct image = good
        if (hasWebsite) metadataScore += 3;    // Website = some info
        if (hasDescription) metadataScore += 2; // Description = minimal
        
        // Skip places with absolutely no metadata (score 0)
        if (metadataScore === 0) {
            console.log(`⚠️ Skipping ${element.tags.name} - no metadata available`);
            continue;
        }
        
        places.push({
            name: element.tags.name,
            latitude: placeLat,
            longitude: placeLon,
            description: element.tags.description || 'Loading description...',
            descriptionLoaded: false,
            osmType: element.tags.tourism || element.tags.amenity || element.tags.leisure || element.tags.historic || 'place',
            distanceKm: distanceKm,
            wikidata: element.tags.wikidata || null,
            wikipedia: hasWikipedia ? (element.tags.wikipedia || element.tags['wikipedia:en']) : null,
            imageUrl: element.tags.image || null,
            website: element.tags.website || null,
            metadataScore: metadataScore  // Store score for sorting
        });
    }
    
    // Sort by metadata quality first, then by distance
    // This ensures we show well-documented places even if slightly farther
    places.sort((a, b) => {
        // If metadata scores are different by more than 3 points, prioritize metadata
        const scoreDiff = b.metadataScore - a.metadataScore;
        if (Math.abs(scoreDiff) > 3) {
            return scoreDiff;
        }
        // Otherwise sort by distance
        return a.distanceKm - b.distanceKm;
    });
    
    console.log(`✅ Found ${places.length} well-documented places, returning top 12`);
    
    return places.slice(0, 12);
}

// Enrich places with AI-generated descriptions (background)
async function enrichPlacesWithDescriptions(places, category) {
    console.log('📝 Enriching places with AI descriptions in background...');
    
    setTimeout(async () => {
        for (const place of places) {
            if (place.descriptionLoaded) continue;
            
            try {
                const prompt = `Describe ${place.name} in ${userLocation.name} in 1-2 sentences. What makes it special or interesting?`;
                
                const response = await fetch(`${API_BASE_URL}/api/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt: prompt,
                        model: DEFAULT_MODEL,
                        max_tokens: 100,
                        temperature: 0.7
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    place.description = data.response.trim();
                    place.descriptionLoaded = true;
                    console.log(`✅ Enriched: ${place.name}`);
                }
            } catch (error) {
                console.error(`Failed to enrich ${place.name}:`, error);
                place.description = `A ${place.osmType} in ${userLocation.name}.`;
                place.descriptionLoaded = true;
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.log('✅ All descriptions enriched');
    }, 1000); // Start after 1 second to not block display
}

// Parse places with descriptions from AI response (kept for backward compatibility)
function parseAttractionsWithDescriptions(text) {
    const attractions = [];
    
    console.log('📄 Parsing AI response...');
    
    // Pattern 1: "1. **Name** - Description"
    const pattern1 = /\d+\.\s*\*\*([^*]+)\*\*[\s\-–—:]+([^\n]+)/g;
    let matches = [...text.matchAll(pattern1)];
    
    if (matches.length > 0) {
        console.log(`✓ Pattern 1 matched: ${matches.length} entries`);
        matches.forEach(match => {
            const name = match[1].trim();
            const description = match[2].trim();
            if (name.length > 2 && description.length > 5) {
                attractions.push({ name, description, descriptionLoaded: true });
            }
        });
    } else {
        console.log('✓ Trying Pattern 2...');
        // Pattern 2: Try simpler format "1. Name - Description"
        const lines = text.split('\n');
        for (const line of lines) {
            // Match various formats
            let match = line.match(/^(\d+)[\.\)]\s*\*\*([^*]+)\*\*\s*[-–—:]\s*(.+)$/);
            if (!match) {
                match = line.match(/^(\d+)[\.\)]\s*([^-–—:]+)\s*[-–—:]\s*(.+)$/);
            }
            
            if (match && match[2] && match[3]) {
                const name = match[2].trim().replace(/\*\*/g, '');
                const description = match[3].trim();
                if (name.length > 2 && description.length > 5 && !name.toLowerCase().includes('name:')) {
                    attractions.push({ name, description, descriptionLoaded: true });
                }
            }
        }
        console.log(`✓ Pattern 2 matched: ${attractions.length} entries`);
    }
    
    if (attractions.length === 0) {
        console.error('❌ Failed to parse any attractions from response:');
        console.error(text.substring(0, 500)); // Show first 500 chars
    }
    
    console.log(`📝 Successfully parsed ${attractions.length} places with descriptions`);
    return attractions.slice(0, 8); // Ensure max 8 places
}

// Display places with parallel geocoding and image loading
async function displayPlacesWithParallelProcessing(places, category) {
    currentPlaces = places;
    
    console.log(`� Starting parallel processing for ${places.length} places...`);
    showLoading('Geocoding locations...');
    
    // Clear existing markers
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    
    // Phase 1: Geocode all places in parallel batches
    const batchSize = 3; // Process 3 at a time to avoid rate limits
    const geocodedPlaces = [];
    
    for (let i = 0; i < places.length; i += batchSize) {
        const batch = places.slice(i, i + batchSize);
        const batchPromises = batch.map(place => geocodePlaceParallel(place, category));
        
        const results = await Promise.all(batchPromises);
        geocodedPlaces.push(...results.filter(p => p !== null));
        
        // Update progress
        showLoading(`Geocoded ${Math.min(i + batchSize, places.length)}/${places.length} places...`);
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`✅ Geocoded ${geocodedPlaces.length}/${places.length} places`);
    
    // Phase 2: Add all markers to map immediately
    hideLoading();
    
    for (const place of geocodedPlaces) {
        if (place.latitude && place.longitude) {
            addMarkerToMap(place);
        }
    }
    
    console.log(`📍 Added ${markers.length} markers to map`);
    
    // Check if places were filtered by distance
    const filteredCount = geocodedPlaces.filter(p => p.filteredByDistance).length;
    
    if (markers.length === 0 && filteredCount > 0) {
        // All places were filtered out by distance
        alert(`All ${filteredCount} places are beyond your ${maxWalkingMinutes} min walking distance.\n\nTry:\n• Increasing the distance filter (10 min or 30 min)\n• Selecting "Any" distance\n\nThe closest place is ${Math.round(geocodedPlaces[0].walkingMinutes)} minutes away.`);
        console.log(`⚠️ All places filtered by distance. Closest: ${geocodedPlaces[0].name} at ${geocodedPlaces[0].walkingMinutes} min`);
    } else if (markers.length === 0) {
        alert('Could not find locations for any places. Try a different category or location.');
    }
    
    // Fit map to show all markers
    if (markers.length > 0) {
        const group = new L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
    
    // Phase 3: Load images in background (non-blocking)
    console.log(`🖼️ Starting background image loading...`);
    loadAllImagesInBackground(geocodedPlaces);
}

// Geocode a single place (parallel-safe)
async function geocodePlaceParallel(place, category) {
    const query = `${place.name}, ${userLocation.name}`;
    
    console.log(`🔍 Geocoding: ${place.name}`);
    
    // Try geocoding with multiple queries prioritizing local results
    const queries = [
        `${place.name}, ${userLocation.name}`,
        `${place.name} near ${userLocation.name}`,
        `${place.name} ${category} ${userLocation.name}`,
        place.name
    ];
    
    for (const searchQuery of queries) {
        if (!searchQuery || searchQuery.length < 3) continue;
        
        const success = await tryGeocodeWithDistanceCheck(place, searchQuery, query, 50); // 50km max
        if (success) {
            console.log(`✅ Geocoded within range: ${place.name}`);
            return place;
        }
        
        // Small delay between attempts
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    console.log(`❌ Failed to find ${place.name} within 50km`);
    return null;
}

// Try to geocode with distance validation
async function tryGeocodeWithDistanceCheck(place, searchQuery, cacheKey, maxDistanceKm) {
    const result = await tryGeocode(place, searchQuery, cacheKey);
    
    if (result && place.latitude && place.longitude) {
        // Calculate distance
        const distanceKm = Math.sqrt(
            Math.pow((place.latitude - userLocation.latitude) * 111, 2) +
            Math.pow((place.longitude - userLocation.longitude) * 111, 2)
        );
        
        // Reject if too far
        if (distanceKm > maxDistanceKm) {
            console.log(`   ❌ Rejected: ${distanceKm.toFixed(1)}km away (max: ${maxDistanceKm}km)`);
            place.latitude = null;
            place.longitude = null;
            return false;
        }
        
        return true;
    }
    
    return false;
}

// Load images for all places in background
async function loadAllImagesInBackground(places) {
    for (const place of places) {
        if (!place.latitude || !place.longitude) continue;
        
        // Pre-load images into cache (doesn't display yet)
        try {
            await loadImageToCache(place);
        } catch (error) {
            console.error(`Failed to load image for ${place.name}:`, error);
        }
        
        // Small delay between image requests
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(`✅ Background image loading complete`);
}

// Load image and cache it (doesn't display)
async function loadImageToCache(place) {
    console.log(`🖼️ Loading image for: ${place.name}`);
    
    // Try Wikipedia
    let imageUrl = await tryWikipediaImage(place.name);
    
    if (!imageUrl && userLocation) {
        imageUrl = await tryWikipediaImage(`${place.name}, ${userLocation.name}`);
    }
    
    // Try Wikimedia Commons
    if (!imageUrl) {
        imageUrl = await tryWikimediaCommons(place.name, userLocation?.name);
    }
    
    if (imageUrl) {
        console.log(`✅ Found image: ${place.name}`);
        return imageUrl;
    } else {
        return 'FALLBACK';
    }
}

// Display places on map with markers (fallback for cached data)
async function displayPlacesOnMap(places, category) {
    // Use the new parallel processing function
    displayPlacesWithParallelProcessing(places, category);
}

// Try to geocode a place with a specific query
async function tryGeocode(place, searchQuery, cacheKey) {
    try {
        const lat = userLocation.latitude;
        const lon = userLocation.longitude;
        
        // Build URL with proximity bias but not bounded (to find places even outside immediate area)
        const url = `https://nominatim.openstreetmap.org/search?` +
            `format=json` +
            `&q=${encodeURIComponent(searchQuery)}` +
            `&limit=20` + // Increased limit for better results
            `&addressdetails=1` +
            `&extratags=1` +
            `&namedetails=1`;
        
        const response = await fetch(url, {
            headers: { 'User-Agent': 'LocalDiscoveryApp/1.0' }
        });
        
        if (!response.ok) {
            console.log(`   ⚠️ HTTP ${response.status}`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retry
            return false;
        }
        
        const data = await response.json();
        
        if (data && data.length > 0) {
            // Filter results to prefer places in the same country/region
            let filteredResults = data;
            
            // Try to find results within reasonable distance first (50km)
            const nearbyResults = data.filter(result => {
                const distance = Math.sqrt(
                    Math.pow(parseFloat(result.lat) - lat, 2) +
                    Math.pow(parseFloat(result.lon) - lon, 2)
                ) * 111; // Convert to km
                return distance < 50;
            });
            
            // If we have nearby results, use those; otherwise use all results
            if (nearbyResults.length > 0) {
                filteredResults = nearbyResults;
                console.log(`   ℹ️ Found ${nearbyResults.length} nearby results`);
            } else {
                console.log(`   ℹ️ No nearby results, using ${data.length} total results`);
            }
            
            // Find best match (closest to user location from filtered results)
            let bestMatch = filteredResults[0];
            let minDistance = Infinity;
            
            for (const result of filteredResults) {
                const distance = Math.sqrt(
                    Math.pow(parseFloat(result.lat) - lat, 2) +
                    Math.pow(parseFloat(result.lon) - lon, 2)
                );
                if (distance < minDistance) {
                    minDistance = distance;
                    bestMatch = result;
                }
            }
            
            const resultLat = parseFloat(bestMatch.lat);
            const resultLon = parseFloat(bestMatch.lon);
            
            // Calculate distance in km
            const distanceKm = Math.sqrt(
                Math.pow((resultLat - lat) * 111, 2) +
                Math.pow((resultLon - lon) * 111, 2)
            );
            
            place.latitude = resultLat;
            place.longitude = resultLon;
            
            console.log(`✅ Found: ${place.name} at (${resultLat.toFixed(4)}, ${resultLon.toFixed(4)}) - ${distanceKm.toFixed(1)}km away`);
            
            // Log if the result seems far away
            if (distanceKm > 10) {
                console.log(`   ⚠️ Warning: Result is ${distanceKm.toFixed(1)}km away (might be in different area)`);
            }
            
            return true;
        }
        
        console.log(`   ❌ No results found for: ${searchQuery}`);
        return false;
    } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        return false;
    }
}

// Add a marker to the map for a place
function addMarkerToMap(place) {
    // Calculate walking distance in km (average walking speed: 5 km/h)
    const distanceKm = Math.sqrt(
        Math.pow((place.latitude - userLocation.latitude) * 111, 2) +
        Math.pow((place.longitude - userLocation.longitude) * 111, 2)
    );
    
    // Calculate walking time in minutes
    const walkingTimeMinutes = (distanceKm / 5) * 60;
    place.walkingMinutes = Math.round(walkingTimeMinutes);
    place.distanceKm = distanceKm;
    
    // If place is extremely far (>100km), likely bad geocoding - skip it
    if (distanceKm > 100) {
        console.log(`⚠️ Skipped ${place.name}: Too far away (${distanceKm.toFixed(1)}km) - likely bad geocoding`);
        return false;
    }
    
    // Check if within walking distance filter
    if (maxWalkingMinutes !== 999 && walkingTimeMinutes > maxWalkingMinutes) {
        console.log(`⏱️ Filtered out ${place.name}: ${Math.round(walkingTimeMinutes)} min walk (limit: ${maxWalkingMinutes} min) - adjust filter to see it`);
        place.filteredByDistance = true; // Mark as filtered, not failed
        return false;
    }
    
    const markerNumber = markers.length + 1;
    place.markerNumber = markerNumber;
    
    const marker = L.marker([place.latitude, place.longitude], {
        icon: L.divIcon({
            className: 'custom-marker',
            html: `<div class="custom-marker">${markerNumber}</div>`,
            iconSize: [40, 40]
        })
    }).addTo(map);
    
    marker.on('click', () => showPlaceDetails(place, markerNumber, marker));
    
    markers.push(marker);
    console.log(`📍 Marker ${markerNumber} added: ${place.name} (${Math.round(walkingTimeMinutes)} min walk, ${distanceKm.toFixed(1)}km)`);
    return true;
}

// Re-filter current places when distance filter changes
function refilterCurrentPlaces() {
    console.log('🔄 Re-filtering places with new distance...');
    
    // Clear existing markers
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    
    // Re-add markers that pass the distance filter
    for (const place of currentPlaces) {
        if (place.latitude && place.longitude) {
            addMarkerToMap(place);
        }
    }
    
    console.log(`✅ Filtered: ${markers.length}/${currentPlaces.length} places within ${maxWalkingMinutes === 999 ? 'any' : maxWalkingMinutes + ' min'} walk`);
    
    // Fit map to show filtered markers
    if (markers.length > 0) {
        const group = new L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

// Show place details in popup next to marker
async function showPlaceDetails(place, number, marker) {
    // Create popup content with image
    const popupContent = document.createElement('div');
    popupContent.style.cssText = 'width: 280px; font-family: sans-serif;';
    
    // Add image container
    const imageDiv = document.createElement('div');
    imageDiv.style.cssText = 'width: 100%; height: 150px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0; display: flex; align-items: center; justify-content: center; color: white; font-size: 48px;';
    imageDiv.innerHTML = '📸';
    popupContent.appendChild(imageDiv);
    
    // Add content container
    const contentDiv = document.createElement('div');
    contentDiv.style.cssText = 'padding: 12px; background: #1e293b; color: #f1f5f9; border-radius: 0 0 8px 8px;';
    
    const title = document.createElement('h3');
    title.style.cssText = 'margin: 0 0 8px 0; font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 6px;';
    title.innerHTML = `${number}. ${place.name}`;
    
    // Add verified badge if place has good metadata
    if (place.wikipedia || place.wikidata) {
        const verifiedBadge = document.createElement('span');
        verifiedBadge.style.cssText = 'font-size: 14px;';
        verifiedBadge.textContent = '✓';
        verifiedBadge.title = 'Verified - has Wikipedia article';
        title.appendChild(verifiedBadge);
    }
    
    contentDiv.appendChild(title);
    
    // Add metadata badges row
    const badgesRow = document.createElement('div');
    badgesRow.style.cssText = 'display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap;';
    
    // Add walking time badge
    if (place.walkingMinutes !== undefined) {
        const walkingBadge = document.createElement('div');
        walkingBadge.style.cssText = 'display: inline-block; background: #6366f1; color: white; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600;';
        walkingBadge.textContent = `🚶 ${place.walkingMinutes} min walk • ${place.distanceKm.toFixed(1)} km`;
        badgesRow.appendChild(walkingBadge);
    }
    
    // Add info badge showing available metadata
    if (place.wikipedia || place.website) {
        const infoBadge = document.createElement('div');
        infoBadge.style.cssText = 'display: inline-block; background: #10b981; color: white; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 600;';
        infoBadge.textContent = '📚 Well-documented';
        infoBadge.title = 'This place has verified information online';
        badgesRow.appendChild(infoBadge);
    }
    
    contentDiv.appendChild(badgesRow);
    
    const description = document.createElement('p');
    description.style.cssText = 'margin: 0 0 8px 0; font-size: 13px; line-height: 1.4; color: #94a3b8; overflow: hidden; transition: max-height 0.3s ease;';
    description.id = `desc-${number}`;
    let isExpanded = false;
    
    // Show loading or actual description
    if (place.descriptionLoaded) {
        const fullDesc = place.description;
        const shortDesc = fullDesc.length > 120 ? fullDesc.substring(0, 120) + '...' : fullDesc;
        description.textContent = shortDesc;
        description.style.maxHeight = '60px';
        
        // Store full description for expand/collapse
        description.dataset.fullDesc = fullDesc;
        description.dataset.shortDesc = shortDesc;
    } else {
        description.textContent = 'Loading description...';
        description.style.fontStyle = 'italic';
        description.style.maxHeight = '60px';
        
        // Poll for description update
        const checkDescription = setInterval(() => {
            if (place.descriptionLoaded) {
                const fullDesc = place.description;
                const shortDesc = fullDesc.length > 120 ? fullDesc.substring(0, 120) + '...' : fullDesc;
                description.textContent = shortDesc;
                description.style.fontStyle = 'normal';
                description.dataset.fullDesc = fullDesc;
                description.dataset.shortDesc = shortDesc;
                
                // Show "Show More" button if description is long
                if (fullDesc.length > 120) {
                    showMoreBtn.style.display = 'block';
                }
                
                clearInterval(checkDescription);
            }
        }, 500);
        
        // Stop checking after 30 seconds
        setTimeout(() => clearInterval(checkDescription), 30000);
    }
    
    contentDiv.appendChild(description);
    
    // Add "Show More / Show Less" button for long descriptions
    const showMoreBtn = document.createElement('button');
    showMoreBtn.style.cssText = 'display: none; margin-bottom: 12px; padding: 4px 12px; background: transparent; color: #6366f1; border: 1px solid #6366f1; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s;';
    showMoreBtn.textContent = '📖 Show Full Description';
    
    // Show button if description is long
    if (place.descriptionLoaded && place.description.length > 120) {
        showMoreBtn.style.display = 'block';
    }
    
    showMoreBtn.onmouseover = () => {
        showMoreBtn.style.background = '#6366f1';
        showMoreBtn.style.color = 'white';
    };
    showMoreBtn.onmouseout = () => {
        showMoreBtn.style.background = 'transparent';
        showMoreBtn.style.color = '#6366f1';
    };
    showMoreBtn.onclick = () => {
        if (!isExpanded) {
            // Expand
            description.textContent = description.dataset.fullDesc;
            description.style.maxHeight = 'none';
            showMoreBtn.textContent = '📕 Show Less';
            isExpanded = true;
        } else {
            // Collapse
            description.textContent = description.dataset.shortDesc;
            description.style.maxHeight = '60px';
            showMoreBtn.textContent = '📖 Show Full Description';
            isExpanded = false;
        }
    };
    
    contentDiv.appendChild(showMoreBtn);
    
    const button = document.createElement('button');
    button.style.cssText = 'width: 100%; padding: 8px; background: #6366f1; color: white; border: none; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.2s;';
    button.textContent = '🗺️ Open in Google Maps';
    button.onmouseover = () => button.style.background = '#4f46e5';
    button.onmouseout = () => button.style.background = '#6366f1';
    button.onclick = () => {
        if (place.latitude && place.longitude) {
            window.open(`https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`, '_blank');
        } else {
            window.open(`https://www.google.com/maps/search/${encodeURIComponent(place.name + ' ' + userLocation.name)}`, '_blank');
        }
    };
    contentDiv.appendChild(button);
    
    popupContent.appendChild(contentDiv);
    
    // Unbind any existing popup first, then bind fresh popup and open it
    marker.unbindPopup();
    marker.bindPopup(popupContent, {
        maxWidth: 300,
        className: 'custom-popup'
    });
    marker.openPopup();
    
    // Load image asynchronously in background
    loadPlaceImage(place, imageDiv, number);
}

// Load image for place (async)
async function loadPlaceImage(place, imageDiv, number) {
    try {
        // Check cache first
        const cachedImage = getCachedImage(place.name);
        if (cachedImage) {
            console.log('✅ Using cached image for:', place.name);
            if (cachedImage === 'FALLBACK') {
                useFallbackIcon(imageDiv, number);
            } else {
                imageDiv.style.backgroundImage = `url(${cachedImage})`;
                imageDiv.style.backgroundSize = 'cover';
                imageDiv.style.backgroundPosition = 'center';
                imageDiv.innerHTML = '';
            }
            return;
        }
        
        console.log('🔍 Loading image for:', place.name);
        
        // METHOD 0: Try OSM image tag (but validate it's a usable URL)
        let imageUrl = null;
        if (place.imageUrl) {
            // Check if it's a valid image URL (not Google Photos or other restricted services)
            const url = place.imageUrl.toLowerCase();
            const isGooglePhotos = url.includes('photos.app.goo.gl') || url.includes('photos.google.com');
            const isValidImageUrl = url.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i);
            
            if (isGooglePhotos) {
                console.log(`⚠️ Skipping Google Photos link (requires auth): ${place.imageUrl}`);
            } else if (isValidImageUrl || url.includes('wikimedia') || url.includes('wikipedia')) {
                console.log(`🎯 Using OSM image URL`);
                imageUrl = place.imageUrl;
            } else {
                console.log(`⚠️ Skipping non-standard image URL: ${place.imageUrl}`);
            }
        }
        
        // METHOD 1: Try Google Places API (best for restaurants/cafes)
        if (!imageUrl && GOOGLE_PLACES_API_KEY && place.latitude && place.longitude) {
            imageUrl = await tryGooglePlacesImage(place);
        }
        
        // METHOD 2: Try OSM Wikipedia reference
        if (!imageUrl && place.wikipedia) {
            console.log(`🎯 Using OSM Wikipedia reference: ${place.wikipedia}`);
            const wikiTitle = place.wikipedia.includes(':') ? place.wikipedia.split(':')[1] : place.wikipedia;
            imageUrl = await tryWikipediaImage(wikiTitle);
        }
        
        // METHOD 3: Try Wikipedia with exact name
        if (!imageUrl) {
            imageUrl = await tryWikipediaImage(place.name);
        }
        
        // METHOD 4: Try with location appended
        if (!imageUrl && userLocation) {
            imageUrl = await tryWikipediaImage(`${place.name}, ${userLocation.name}`);
        }
        
        // METHOD 5: Try Wikimedia Commons search
        if (!imageUrl) {
            imageUrl = await tryWikimediaCommons(place.name, userLocation?.name);
        }
        
        // METHOD 6: Try Hugging Face image search/generation
        if (!imageUrl && HUGGINGFACE_API_KEY) {
            imageUrl = await tryHuggingFaceImage(place);
        }
        
        // METHOD 7: Try Unsplash for generic category images
        if (!imageUrl) {
            imageUrl = await tryUnsplashImage(place);
        }
        
        // If we found an image, display it and cache it
        if (imageUrl) {
            console.log('✅ Found image:', imageUrl);
            imageDiv.style.backgroundImage = `url(${imageUrl})`;
            imageDiv.style.backgroundSize = 'cover';
            imageDiv.style.backgroundPosition = 'center';
            imageDiv.innerHTML = '';
            setCachedImage(place.name, imageUrl);
            return;
        }
        
        // Fallback to gradient with icon and cache the fallback status
        console.log('ℹ️ No image found, using icon');
        useFallbackIcon(imageDiv, number);
        setCachedImage(place.name, 'FALLBACK');
        
    } catch (error) {
        console.error('❌ Error loading image:', error);
        useFallbackIcon(imageDiv, number);
        setCachedImage(place.name, 'FALLBACK');
    }
}

// Try to get image from Wikipedia - must be EXACT article match
async function tryWikipediaImage(title) {
    try {
        const response = await fetch(`https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages|info&piprop=original&titles=${encodeURIComponent(title)}&origin=*`);
        const data = await response.json();
        
        const pages = data.query?.pages;
        if (pages) {
            const pageId = Object.keys(pages)[0];
            const page = pages[pageId];
            
            // Only use if:
            // 1. Page exists (not -1)
            // 2. Has an image
            // 3. Title matches closely (avoid redirects to wrong places)
            if (pageId !== '-1' && page?.original?.source) {
                const pageTitle = page.title.toLowerCase();
                const searchTitle = title.toLowerCase();
                
                // Check if titles are similar enough (avoiding wrong matches)
                if (pageTitle.includes(searchTitle.split(',')[0]) || searchTitle.includes(pageTitle)) {
                    console.log(`✅ Wikipedia match: "${page.title}"`);
                    return page.original.source;
                } else {
                    console.log(`⚠️ Wikipedia redirect mismatch: searched "${title}" got "${page.title}"`);
                }
            }
        }
    } catch (error) {
        console.log('Wikipedia lookup failed:', error);
    }
    return null;
}

// Try to get image from Wikimedia Commons - with better filtering
async function tryWikimediaCommons(placeName, locationName) {
    try {
        // Only use very specific queries (avoid generic matches)
        const searchQueries = [
            `${placeName} ${locationName || ''}`.trim()
        ];
        
        // If location name exists, prioritize it
        if (locationName) {
            searchQueries.unshift(`"${placeName}" ${locationName}`);
        }
        
        for (const query of searchQueries) {
            console.log('🔍 Searching Commons for:', query);
            const searchResponse = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&srlimit=5&origin=*`);
            const searchData = await searchResponse.json();
            
            if (searchData.query?.search?.length > 0) {
                // Check multiple results for better match
                for (const result of searchData.query.search.slice(0, 3)) {
                    const imageTitle = result.title;
                    const snippet = result.snippet?.toLowerCase() || '';
                    const titleLower = imageTitle.toLowerCase();
                    
                    // Verify the result is relevant to our place
                    const placeWords = placeName.toLowerCase().split(/\s+/);
                    const matchCount = placeWords.filter(word => 
                        word.length > 3 && (titleLower.includes(word) || snippet.includes(word))
                    ).length;
                    
                    // Require at least half the words to match
                    if (matchCount < placeWords.length * 0.5) {
                        console.log(`⚠️ Skipping weak match: "${imageTitle}"`);
                        continue;
                    }
                    
                    // Good match - fetch the image
                    console.log(`✅ Good match: "${imageTitle}"`);
                    const imageResponse = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url&titles=${encodeURIComponent(imageTitle)}&origin=*`);
                    const imageData = await imageResponse.json();
                    
                    const pages = imageData.query?.pages;
                    if (pages) {
                        const pageId = Object.keys(pages)[0];
                        const imageUrl = pages[pageId]?.imageinfo?.[0]?.url;
                        if (imageUrl) {
                            console.log('✅ Found Commons image');
                            return imageUrl;
                        }
                    }
                }
            }
            
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    } catch (error) {
        console.log('Commons search failed:', error);
    }
    return null;
}

// Try to get image from Google Places API
async function tryGooglePlacesImage(place) {
    try {
        console.log('🔍 Searching Google Places...');
        
        // First, find the place
        const searchResponse = await fetch(
            `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?` +
            `input=${encodeURIComponent(place.name)}&` +
            `inputtype=textquery&` +
            `locationbias=point:${place.latitude},${place.longitude}&` +
            `fields=place_id,photos&` +
            `key=${GOOGLE_PLACES_API_KEY}`
        );
        
        const searchData = await searchResponse.json();
        
        if (searchData.candidates && searchData.candidates.length > 0) {
            const placeId = searchData.candidates[0].place_id;
            const photos = searchData.candidates[0].photos;
            
            if (photos && photos.length > 0) {
                const photoReference = photos[0].photo_reference;
                const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoReference}&key=${GOOGLE_PLACES_API_KEY}`;
                console.log('✅ Found Google Places image');
                return photoUrl;
            }
        }
    } catch (error) {
        console.log('Google Places search failed:', error);
    }
    return null;
}

// Try to get image from Hugging Face - using image search model
async function tryHuggingFaceImage(place) {
    try {
        console.log(`🤖 Searching Hugging Face for image of: ${place.name}`);
        
        // Create a descriptive prompt for the place
        const prompt = `A high quality photograph of ${place.name} in ${userLocation?.name || 'the city'}, ${place.osmType}, beautiful lighting, professional photography`;
        
        // Option 1: Use Stable Diffusion for generating realistic images
        // Note: This generates new images, not searches existing ones
        const response = await fetch(
            'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-1',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    inputs: prompt,
                    parameters: {
                        negative_prompt: 'blurry, low quality, distorted, text, watermark',
                        num_inference_steps: 30,
                        guidance_scale: 7.5
                    }
                })
            }
        );
        
        if (response.ok) {
            const blob = await response.blob();
            const imageUrl = URL.createObjectURL(blob);
            console.log('✅ Generated Hugging Face image');
            return imageUrl;
        } else {
            const error = await response.text();
            console.log('Hugging Face API error:', error);
        }
    } catch (error) {
        console.log('Hugging Face search failed:', error);
    }
    return null;
}

// Try to get a generic category image from Unsplash
async function tryUnsplashImage(place) {
    try {
        // Map OSM types to search terms
        const searchTerms = {
            restaurant: 'restaurant,food,dining',
            cafe: 'cafe,coffee',
            museum: 'museum,art,gallery',
            park: 'park,nature,trees',
            bar: 'bar,pub,drinks',
            pub: 'pub,beer',
            nightclub: 'nightclub,party',
            theatre: 'theatre,stage',
            cinema: 'cinema,movie',
            hotel: 'hotel,resort',
            attraction: 'landmark,architecture',
            monument: 'monument,statue',
            viewpoint: 'landscape,scenic,view',
            beach: 'beach,ocean',
            gallery: 'art,gallery,paintings'
        };
        
        const searchTerm = searchTerms[place.osmType] || 'landmark';
        
        console.log(`�️ Using Unsplash for: ${searchTerm}`);
        
        // Use Unsplash Source API - direct URL, no fetch needed (bypasses CORS)
        // This returns a direct image URL that can be used in <img> or background-image
        const imageUrl = `https://source.unsplash.com/400x300/?${searchTerm}`;
        console.log('✅ Generated Unsplash image URL');
        return imageUrl;
    } catch (error) {
        console.log('Unsplash failed:', error);
    }
    return null;
}

// Use fallback icon with gradient
function useFallbackIcon(imageDiv, number) {
    const colors = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a'];
    const icons = ['🏛️', '🍽️', '☕', '🖼️', '🌳'];
    imageDiv.style.background = `linear-gradient(135deg, ${colors[number % colors.length]} 0%, ${colors[(number + 1) % colors.length]} 100%)`;
    imageDiv.innerHTML = icons[number % icons.length];
}

// Loading overlay
function showLoading(message = 'Loading...') {
    loadingText.textContent = message;
    loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    loadingOverlay.classList.add('hidden');
}

// Cache management - disabled per user request
function loadCacheFromStorage() {
    // Caching disabled
}

function saveCacheToStorage() {
    // Caching disabled
}

function isCacheValid(timestamp) {
    return false; // Caching disabled
}

// Cache functions disabled per user request
function getCachedRecommendations(category, location) {
    return null; // Caching disabled
}

function setCachedRecommendations(category, location, data) {
    // Caching disabled
}

function getCachedImage(placeName) {
    return null; // Caching disabled
}

function setCachedImage(placeName, imageUrl) {
    // Caching disabled
}

function getCachedGeocode(query) {
    return null; // Caching disabled
}

function setCachedGeocode(query, lat, lon) {
    // Caching disabled
}

// Check server health
async function checkServerHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        const data = await response.json();
        console.log('Server status:', data.status);
    } catch (error) {
        console.error('Server not responding. Make sure to run: py app.py');
    }
}

// Helper function to clear cache (call from console if needed)
function clearCache() {
    localStorage.removeItem('locationAppCache');
    cache.recommendations = {};
    cache.images = {};
    cache.geocoding = {};
    console.log('✅ Cache cleared! Refresh the page.');
}

// Expose to window for console access
window.clearCache = clearCache;
