// Configuration
const API_BASE_URL = 'http://localhost:5000';
const DEFAULT_MODEL = 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo';
const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes

// State
let userLocation = null;
let map = null;
let markers = [];
let currentPlaces = [];

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
    
    // Check cache first
    const cached = getCachedRecommendations(category, userLocation.name);
    if (cached) {
        displayPlacesOnMap(cached, category);
        return;
    }
    
    showLoading(`Finding ${category} near you...`);
    
    // Build simplified prompt for just place names
    const prompts = {
        landmarks: `List exactly 8 famous landmarks and monuments in ${userLocation.name}. Format: 1. Name\n2. Name\n etc.`,
        restaurants: `List exactly 8 popular restaurants in ${userLocation.name}. Format: 1. Name\n2. Name\n etc.`,
        cafes: `List exactly 8 popular cafés and coffee shops in ${userLocation.name}. Format: 1. Name\n2. Name\n etc.`,
        museums: `List exactly 8 museums and art galleries in ${userLocation.name}. Format: 1. Name\n2. Name\n etc.`,
        parks: `List exactly 8 parks and green spaces in ${userLocation.name}. Format: 1. Name\n2. Name\n etc.`,
        shopping: `List exactly 8 shopping centers and markets in ${userLocation.name}. Format: 1. Name\n2. Name\n etc.`,
        nightlife: `List exactly 8 nightlife venues and bars in ${userLocation.name}. Format: 1. Name\n2. Name\n etc.`,
        entertainment: `List exactly 8 entertainment venues in ${userLocation.name}. Format: 1. Name\n2. Name\n etc.`,
        hotels: `List exactly 8 notable hotels in ${userLocation.name}. Format: 1. Name\n2. Name\n etc.`,
        beaches: `List exactly 8 beaches and waterfront areas in or near ${userLocation.name}. Format: 1. Name\n2. Name\n etc.`,
        viewpoints: `List exactly 8 viewpoints and scenic spots in ${userLocation.name}. Format: 1. Name\n2. Name\n etc.`,
        historical: `List exactly 8 historical sites and buildings in ${userLocation.name}. Format: 1. Name\n2. Name\n etc.`
    };
    
    const prompt = prompts[category] || prompts.landmarks;
    
    try {
        // Get place names from AI
        const response = await fetch(`${API_BASE_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: prompt,
                model: DEFAULT_MODEL,
                max_tokens: 512,
                temperature: 0.7
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const placeNames = parseSimplePlaceNames(data.response);
            const places = placeNames.map(name => ({ 
                name, 
                description: 'Loading description...',
                descriptionLoaded: false
            }));
            
            setCachedRecommendations(category, userLocation.name, places);
            displayPlacesOnMap(places, category);
            hideLoading();
            
            // Load descriptions in background
            loadDescriptionsInBackground(places, category);
        } else {
            hideLoading();
            alert('Error getting recommendations. Please try again.');
        }
    } catch (error) {
        hideLoading();
        console.error('Error:', error);
        alert('Error connecting to server. Make sure the backend is running.');
    }
}

// Parse simple place names from AI response
function parseSimplePlaceNames(text) {
    const names = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
        // Match patterns like "1. Place Name" or "- Place Name" or "* Place Name"
        const match = line.match(/^[\d\-\*\•]+[\.\):\s]+(.+?)$/);
        if (match && match[1].trim()) {
            const name = match[1].trim()
                .replace(/\*\*/g, '') // Remove markdown bold
                .replace(/^["']|["']$/g, '') // Remove quotes
                .split(/[-–—:]/)[0] // Take only part before dash or colon
                .trim();
            if (name.length > 2 && name.length < 100) {
                names.push(name);
            }
        }
    }
    
    return names.slice(0, 8); // Ensure max 8 places
}

// Load descriptions for places in background
async function loadDescriptionsInBackground(places, category) {
    console.log('📝 Loading descriptions in background...');
    
    const descPrompts = {
        landmarks: (name) => `Describe ${name} in ${userLocation.name} in 2 sentences. Focus on what makes it special.`,
        restaurants: (name) => `Describe ${name} restaurant in ${userLocation.name} in 2 sentences. Include cuisine type.`,
        cafes: (name) => `Describe ${name} café in ${userLocation.name} in 2 sentences. Include atmosphere.`,
        museums: (name) => `Describe ${name} museum in ${userLocation.name} in 2 sentences. What does it feature?`,
        parks: (name) => `Describe ${name} park in ${userLocation.name} in 2 sentences.`,
        shopping: (name) => `Describe ${name} shopping in ${userLocation.name} in 2 sentences.`,
        nightlife: (name) => `Describe ${name} venue in ${userLocation.name} in 2 sentences.`,
        entertainment: (name) => `Describe ${name} entertainment venue in ${userLocation.name} in 2 sentences.`,
        hotels: (name) => `Describe ${name} hotel in ${userLocation.name} in 2 sentences.`,
        beaches: (name) => `Describe ${name} beach in ${userLocation.name} in 2 sentences.`,
        viewpoints: (name) => `Describe ${name} viewpoint in ${userLocation.name} in 2 sentences.`,
        historical: (name) => `Describe ${name} historical site in ${userLocation.name} in 2 sentences.`
    };
    
    const getPrompt = descPrompts[category] || descPrompts.landmarks;
    
    for (const place of places) {
        if (place.descriptionLoaded) continue;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: getPrompt(place.name),
                    model: DEFAULT_MODEL,
                    max_tokens: 150,
                    temperature: 0.7
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                place.description = data.response.trim();
                place.descriptionLoaded = true;
                console.log(`✅ Loaded description for: ${place.name}`);
            }
        } catch (error) {
            console.error(`❌ Failed to load description for ${place.name}:`, error);
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Update cache with descriptions
    setCachedRecommendations(category, userLocation.name, places);
    console.log('✅ All descriptions loaded');
}

// Parse attractions from AI response
function parseAttractions(text) {
    const attractions = [];
    const pattern = /\d+\.\s*\*\*([^*]+)\*\*[\s:-]+([^\n]+)/g;
    const matches = [...text.matchAll(pattern)];
    
    matches.forEach(match => {
        const name = match[1].trim();
        const description = match[2].trim();
        if (name.length > 2) {
            attractions.push({ name, description });
        }
    });
    
    return attractions;
}

// Display places on map with markers
async function displayPlacesOnMap(places, category) {
    // Clear existing markers
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    currentPlaces = places;
    
    showLoading('Adding markers to map...');
    
    const failedPlaces = [];
    
    // FIRST PASS: Try to geocode each place once
    for (let i = 0; i < places.length; i++) {
        const place = places[i];
        const query = `${place.name}, ${userLocation.name}`;
        
        console.log(`🔍 [Pass 1] ${i + 1}/${places.length}: ${place.name}`);
        
        // Check cache first
        let cachedGeocode = getCachedGeocode(query);
        
        if (cachedGeocode) {
            place.latitude = cachedGeocode.lat;
            place.longitude = cachedGeocode.lon;
            console.log(`✅ Used cache for: ${place.name}`);
        } else {
            // Try geocoding once with primary query
            const success = await tryGeocode(place, `${place.name}, ${userLocation.name}`, query);
            
            if (!success) {
                console.log(`⚠️ First attempt failed: ${place.name}`);
                failedPlaces.push(place);
            }
        }
        
        // Add marker if coordinates found
        if (place.latitude && place.longitude) {
            addMarkerToMap(place);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(`📊 First pass complete: ${markers.length}/${places.length} markers`);
    
    // SECOND PASS: Retry failed places with alternative queries
    if (failedPlaces.length > 0) {
        console.log(`🔄 Retrying ${failedPlaces.length} failed places...`);
        
        for (const place of failedPlaces) {
            console.log(`🔍 [Pass 2] Retrying: ${place.name}`);
            
            const query = `${place.name}, ${userLocation.name}`;
            
            // Try alternative query
            const success = await tryGeocode(place, place.name, query) || 
                           await tryGeocode(place, `${place.name} ${category}`, query);
            
            if (success && place.latitude && place.longitude) {
                addMarkerToMap(place);
            } else {
                console.log(`❌ Failed after retry: ${place.name}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }
    
    hideLoading();
    
    console.log(`✅ Total markers displayed: ${markers.length}/${places.length}`);
    
    // Fit map to show all markers
    if (markers.length > 0) {
        const group = new L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

// Try to geocode a place with a specific query
async function tryGeocode(place, searchQuery, cacheKey) {
    try {
        const lat = userLocation.latitude;
        const lon = userLocation.longitude;
        const radius = 0.5; // ~50km search radius
        const viewbox = `${lon - radius},${lat + radius},${lon + radius},${lat - radius}`;
        
        const url = `https://nominatim.openstreetmap.org/search?` +
            `format=json` +
            `&q=${encodeURIComponent(searchQuery)}` +
            `&limit=10` +
            `&viewbox=${viewbox}` +
            `&bounded=1` +
            `&lat=${lat}` +
            `&lon=${lon}`;
        
        const response = await fetch(url, {
            headers: { 'User-Agent': 'LocalDiscoveryApp/1.0' }
        });
        
        if (!response.ok) {
            console.log(`   ⚠️ HTTP ${response.status}`);
            return false;
        }
        
        const data = await response.json();
        
        if (data && data.length > 0) {
            // Find best match (prefer results closer to user location)
            let bestMatch = data[0];
            let minDistance = Infinity;
            
            for (const result of data) {
                const distance = Math.sqrt(
                    Math.pow(parseFloat(result.lat) - userLocation.latitude, 2) +
                    Math.pow(parseFloat(result.lon) - userLocation.longitude, 2)
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
                Math.pow((resultLat - userLocation.latitude) * 111, 2) +
                Math.pow((resultLon - userLocation.longitude) * 111, 2)
            );
            
            place.latitude = resultLat;
            place.longitude = resultLon;
            
            // Cache the result
            setCachedGeocode(cacheKey, resultLat, resultLon);
            console.log(`✅ Found: ${place.name} (${distanceKm.toFixed(1)}km away)`);
            return true;
        }
        
        return false;
    } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        return false;
    }
}

// Add a marker to the map for a place
function addMarkerToMap(place) {
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
    console.log(`📍 Marker ${markerNumber} added: ${place.name}`);
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
    title.style.cssText = 'margin: 0 0 8px 0; font-size: 16px; font-weight: 700;';
    title.textContent = `${number}. ${place.name}`;
    contentDiv.appendChild(title);
    
    const description = document.createElement('p');
    description.style.cssText = 'margin: 0 0 12px 0; font-size: 13px; line-height: 1.4; color: #94a3b8; max-height: 60px; overflow: hidden;';
    description.id = `desc-${number}`;
    
    // Show loading or actual description
    if (place.descriptionLoaded) {
        description.textContent = place.description.length > 120 ? place.description.substring(0, 120) + '...' : place.description;
    } else {
        description.textContent = 'Loading description...';
        description.style.fontStyle = 'italic';
        
        // Poll for description update
        const checkDescription = setInterval(() => {
            if (place.descriptionLoaded) {
                description.textContent = place.description.length > 120 ? place.description.substring(0, 120) + '...' : place.description;
                description.style.fontStyle = 'normal';
                clearInterval(checkDescription);
            }
        }, 500);
        
        // Stop checking after 30 seconds
        setTimeout(() => clearInterval(checkDescription), 30000);
    }
    
    contentDiv.appendChild(description);
    
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
    
    // Bind popup to marker and open it
    marker.bindPopup(popupContent, {
        maxWidth: 300,
        className: 'custom-popup'
    }).openPopup();
    
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
        
        // METHOD 1: Try Wikipedia with exact name
        let imageUrl = await tryWikipediaImage(place.name);
        
        // METHOD 2: Try with location appended
        if (!imageUrl && userLocation) {
            imageUrl = await tryWikipediaImage(`${place.name}, ${userLocation.name}`);
        }
        
        // METHOD 3: Try Wikimedia Commons search
        if (!imageUrl) {
            imageUrl = await tryWikimediaCommons(place.name, userLocation?.name);
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

// Try to get image from Wikipedia
async function tryWikipediaImage(title) {
    try {
        const response = await fetch(`https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=original&titles=${encodeURIComponent(title)}&origin=*`);
        const data = await response.json();
        
        const pages = data.query?.pages;
        if (pages) {
            const pageId = Object.keys(pages)[0];
            if (pageId !== '-1' && pages[pageId]?.original?.source) {
                return pages[pageId].original.source;
            }
        }
    } catch (error) {
        console.log('Wikipedia lookup failed:', error);
    }
    return null;
}

// Try to get image from Wikimedia Commons
async function tryWikimediaCommons(placeName, locationName) {
    try {
        // Search with different queries
        const searchQueries = [
            `${placeName} ${locationName || ''}`.trim(),
            placeName,
            `${placeName} landmark`,
            `${placeName} building`
        ];
        
        for (const query of searchQueries) {
            console.log('🔍 Searching Commons for:', query);
            const searchResponse = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&srlimit=3&origin=*`);
            const searchData = await searchResponse.json();
            
            if (searchData.query?.search?.length > 0) {
                // Try first result
                const imageTitle = searchData.query.search[0].title;
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
            
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    } catch (error) {
        console.log('Commons search failed:', error);
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

// Cache management
function loadCacheFromStorage() {
    try {
        const stored = localStorage.getItem('locationAppCache');
        if (stored) {
            const parsed = JSON.parse(stored);
            Object.assign(cache, parsed);
            console.log('✅ Cache loaded from storage');
        }
    } catch (error) {
        console.error('Failed to load cache:', error);
    }
}

function saveCacheToStorage() {
    try {
        localStorage.setItem('locationAppCache', JSON.stringify(cache));
    } catch (error) {
        console.error('Failed to save cache:', error);
    }
}

function isCacheValid(timestamp) {
    return Date.now() - timestamp < CACHE_EXPIRY;
}

function getCachedRecommendations(category, location) {
    const key = `${category}-${location}`;
    const cached = cache.recommendations[key];
    if (cached && isCacheValid(cached.timestamp)) {
        console.log('✅ Using cached recommendations for:', category);
        return cached.data;
    }
    return null;
}

function setCachedRecommendations(category, location, data) {
    const key = `${category}-${location}`;
    cache.recommendations[key] = {
        data: data,
        timestamp: Date.now()
    };
    saveCacheToStorage();
}

function getCachedImage(placeName) {
    return cache.images[placeName] || null;
}

function setCachedImage(placeName, imageUrl) {
    cache.images[placeName] = imageUrl;
    saveCacheToStorage();
}

function getCachedGeocode(query) {
    const cached = cache.geocoding[query];
    if (cached && isCacheValid(cached.timestamp)) {
        console.log('✅ Using cached geocode for:', query);
        return cached;
    }
    return null;
}

function setCachedGeocode(query, lat, lon) {
    cache.geocoding[query] = {
        lat: lat,
        lon: lon,
        timestamp: Date.now()
    };
    saveCacheToStorage();
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
