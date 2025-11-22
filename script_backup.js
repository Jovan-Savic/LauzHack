// Configuration
const API_BASE_URL = 'http://localhost:5000';
const DEFAULT_MODEL = 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo';

// State
let userLocation = null;
let map = null;
let markers = [];
let currentPlaces = [];

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

// Detect location with GPS
function handleDetectLocation() {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser');
        return;
    }
    
    showLoading('Detecting your location...');
    
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            
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
                console.error('Error reverse geocoding:', error);
                alert('Could not determine location name');
            }
        },
        (error) => {
            hideLoading();
            let message = 'Unable to get location';
            if (error.code === error.PERMISSION_DENIED) {
                message = 'Location permission denied. Please enter location manually.';
            }
            alert(message);
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
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
    
    showLoading(`Finding ${category} near you...`);
    
    // Build prompt for AI
    const prompts = {
        landmarks: `List exactly 8 famous landmarks and monuments in ${userLocation.name}. Format each as: **Name** - Brief description (1-2 sentences).`,
        restaurants: `List exactly 8 popular restaurants in ${userLocation.name}. Format each as: **Name** - Cuisine type and brief description.`,
        cafes: `List exactly 8 popular cafés and coffee shops in ${userLocation.name}. Format each as: **Name** - Type and atmosphere description.`,
        museums: `List exactly 8 museums and art galleries in ${userLocation.name}. Format each as: **Name** - Type of museum and what it features.`,
        parks: `List exactly 8 parks and green spaces in ${userLocation.name}. Format each as: **Name** - Description of the park.`,
        shopping: `List exactly 8 shopping centers and markets in ${userLocation.name}. Format each as: **Name** - Type of shopping and what you can find.`,
        nightlife: `List exactly 8 nightlife venues and bars in ${userLocation.name}. Format each as: **Name** - Type of venue and atmosphere.`,
        entertainment: `List exactly 8 entertainment venues (theaters, cinemas, venues) in ${userLocation.name}. Format each as: **Name** - Type and description.`,
        hotels: `List exactly 8 notable hotels in ${userLocation.name}. Format each as: **Name** - Star rating and brief description.`,
        beaches: `List exactly 8 beaches and waterfront areas in or near ${userLocation.name}. Format each as: **Name** - Description and features.`,
        viewpoints: `List exactly 8 viewpoints and scenic spots in ${userLocation.name}. Format each as: **Name** - What you can see from there.`,
        historical: `List exactly 8 historical sites and buildings in ${userLocation.name}. Format each as: **Name** - Historical significance and description.`
    };
    
    const prompt = prompts[category] || prompts.landmarks;
    
    try {
        // Get recommendations from AI
        const response = await fetch(`${API_BASE_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: prompt,
                model: DEFAULT_MODEL,
                max_tokens: 1024,
                temperature: 0.7
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const places = parseAttractions(data.response);
            displayPlacesOnMap(places, category);
            hideLoading();
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
    
    // Geocode each place and add marker
    for (let i = 0; i < places.length; i++) {
        const place = places[i];
        const query = `${place.name}, ${userLocation.name}`;
        
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`, {
                headers: { 'User-Agent': 'LocalDiscoveryApp/1.0' }
            });
            const data = await response.json();
            
            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);
                
                place.latitude = lat;
                place.longitude = lon;
                
                // Create custom marker
                const marker = L.marker([lat, lon], {
                    icon: L.divIcon({
                        className: 'custom-marker',
                        html: `<div class="custom-marker">${i + 1}</div>`,
                        iconSize: [40, 40]
                    })
                }).addTo(map);
                
                // Add click event to show details
                marker.on('click', () => showPlaceDetails(place, i + 1));
                
                // Add popup
                marker.bindPopup(`<b>${place.name}</b><br>${place.description.substring(0, 100)}...`);
                
                markers.push(marker);
            }
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
            console.error(`Error geocoding ${place.name}:`, error);
        }
    }
    
    hideLoading();
    
    // Fit map to show all markers
    if (markers.length > 0) {
        const group = new L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

// Show place details in side panel
function showPlaceDetails(place, number) {
    detailsTitle.textContent = `${number}. ${place.name}`;
    detailsDescription.textContent = place.description;
    
    // Load image
    const seed = encodeURIComponent(place.name.replace(/\s+/g, '-').toLowerCase());
    const imageUrl = `https://picsum.photos/seed/${seed}/400/250`;
    detailsImage.style.backgroundImage = `url(${imageUrl})`;
    
    // Set directions button
    directionsBtn.onclick = () => {
        if (place.latitude && place.longitude) {
            window.open(`https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`, '_blank');
        } else {
            window.open(`https://www.google.com/maps/search/${encodeURIComponent(place.name + ' ' + userLocation.name)}`, '_blank');
        }
    };
    
    detailsPanel.classList.add('active');
}

// Loading overlay
function showLoading(message = 'Loading...') {
    loadingText.textContent = message;
    loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    loadingOverlay.classList.add('hidden');
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
