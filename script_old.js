// Configuration
const API_BASE_URL = 'http://localhost:5000';

// DOM Elements
const chatContainer = document.getElementById('chatContainer');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const modelSelect = document.getElementById('modelSelect');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const locationBtn = document.getElementById('locationBtn');
const locationPanel = document.getElementById('locationPanel');
const locationStatus = document.getElementById('locationStatus');
const locationInfo = document.getElementById('locationInfo');
const coordinates = document.getElementById('coordinates');
const locationName = document.getElementById('locationName');
const manualLocation = document.getElementById('manualLocation');
const setLocationBtn = document.getElementById('setLocationBtn');
const maxTokensSlider = document.getElementById('maxTokens');
const maxTokensValue = document.getElementById('maxTokensValue');
const temperatureSlider = document.getElementById('temperature');
const temperatureValue = document.getElementById('temperatureValue');
const streamModeCheckbox = document.getElementById('streamMode');
const charCount = document.getElementById('charCount');
const statusBar = document.getElementById('statusBar');
const statusText = document.getElementById('statusText');
const imageToggleBtn = document.getElementById('imageToggleBtn');
const mapBtn = document.getElementById('mapBtn');
const mapPanel = document.getElementById('mapPanel');
const closeMapBtn = document.getElementById('closeMapBtn');
const mapLocationName = document.getElementById('mapLocationName');

// State
let isGenerating = false;
let conversationHistory = [];
let userLocation = null;
let imageMode = false;
let map = null;
let mapMarkers = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    checkServerHealth();
    autoResizeTextarea();
});

// Event Listeners
function setupEventListeners() {
    sendBtn.addEventListener('click', handleSendMessage);
    
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    userInput.addEventListener('input', () => {
        autoResizeTextarea();
        updateCharCount();
    });

    locationBtn.addEventListener('click', () => {
        locationPanel.classList.toggle('hidden');
        settingsPanel.classList.add('hidden');
        
        if (!locationPanel.classList.contains('hidden') && !userLocation) {
            getLocation();
        }
    });

    setLocationBtn.addEventListener('click', () => {
        const location = manualLocation.value.trim();
        if (location) {
            userLocation = { manual: true, name: location };
            locationName.textContent = location;
            locationInfo.classList.remove('hidden');
            locationStatus.textContent = '✓ Location set';
            locationStatus.classList.add('active');
            locationBtn.classList.add('active');
            locationBtn.title = `Location: ${location}`;
            updateStatus(`Location set to ${location}`, 'success');
        } else {
            updateStatus('Please enter a location', 'warning');
        }
    });

    manualLocation.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            setLocationBtn.click();
        }
    });

    settingsBtn.addEventListener('click', () => {
        settingsPanel.classList.toggle('hidden');
        locationPanel.classList.add('hidden');
    });

    maxTokensSlider.addEventListener('input', (e) => {
        maxTokensValue.textContent = e.target.value;
    });

    temperatureSlider.addEventListener('input', (e) => {
        temperatureValue.textContent = e.target.value;
    });

    imageToggleBtn.addEventListener('click', () => {
        imageMode = !imageMode;
        imageToggleBtn.textContent = imageMode ? '🎨' : '💬';
        imageToggleBtn.classList.toggle('active');
        userInput.placeholder = imageMode ? 
            'Describe the image you want to generate...' : 
            'Type your message here... (Shift+Enter for new line)';
        updateStatus(imageMode ? 'Image generation mode' : 'Chat mode', 'success');
    });

    mapBtn.addEventListener('click', () => {
        mapPanel.classList.toggle('hidden');
        locationPanel.classList.add('hidden');
        settingsPanel.classList.add('hidden');
        
        if (!mapPanel.classList.contains('hidden')) {
            mapBtn.classList.add('active');
            setTimeout(() => {
                if (!map) {
                    initializeMap();
                } else {
                    map.invalidateSize();
                }
                if (userLocation && !userLocation.manual) {
                    centerMapOnLocation(userLocation.latitude, userLocation.longitude);
                }
            }, 100);
        } else {
            mapBtn.classList.remove('active');
        }
    });

    closeMapBtn.addEventListener('click', () => {
        mapPanel.classList.add('hidden');
        mapBtn.classList.remove('active');
    });

    // Example prompts
    document.querySelectorAll('.example-prompt').forEach(btn => {
        btn.addEventListener('click', () => {
            const isImagePrompt = btn.dataset.type === 'image';
            if (isImagePrompt && !imageMode) {
                imageMode = true;
                imageToggleBtn.textContent = '🎨';
                imageToggleBtn.classList.add('active');
                userInput.placeholder = 'Describe the image you want to generate...';
            }
            userInput.value = btn.dataset.prompt;
            autoResizeTextarea();
            updateCharCount();
            handleSendMessage();
        });
    });

    // Location action buttons
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            if (userLocation) {
                generateLocationBasedPrompt(action);
            } else {
                updateStatus('Please set your location first (enter manually or allow GPS)', 'warning');
                manualLocation.focus();
            }
        });
    });
}

// Get user location
function getLocation() {
    if (!navigator.geolocation) {
        locationStatus.textContent = 'Geolocation not supported';
        updateStatus('Geolocation is not supported by your browser', 'error');
        return;
    }

    locationStatus.textContent = 'Detecting...';
    updateStatus('Getting your location...', 'warning');

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;

            // Get location name first using reverse geocoding
            locationStatus.textContent = 'Getting location name...';
            await getLocationName(lat, lon);
            
            // Set userLocation in the same format as manual input
            userLocation = {
                manual: true,  // Treat it like manual input for consistency
                name: locationName.textContent,
                latitude: lat,
                longitude: lon
            };

            coordinates.textContent = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
            locationInfo.classList.remove('hidden');
            locationStatus.textContent = '✓ Location detected';
            locationStatus.classList.add('active');
            locationBtn.classList.add('active');
            locationBtn.title = `Location: ${userLocation.name}`;
            
            // Initialize and center map on location
            if (!map) {
                initializeMap();
            }
            centerMapOnLocation(lat, lon);
            
            updateStatus(`Location detected: ${userLocation.name}`, 'success');
        },
        (error) => {
            let errorMessage = 'Location unavailable';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = 'Location permission denied - Please use manual input';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = 'Location unavailable - Please use manual input';
                    break;
                case error.TIMEOUT:
                    errorMessage = 'Location timeout - Please use manual input';
                    break;
            }
            locationStatus.textContent = errorMessage;
            updateStatus(errorMessage + ' below', 'error');
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

// Get location name (using a free API)
async function getLocationName(lat, lon) {
    try {
        // Add user agent to comply with Nominatim usage policy
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`, {
            headers: {
                'User-Agent': 'TravelAIApp/1.0'
            }
        });
        const data = await response.json();
        
        if (data && data.address) {
            const city = data.address.city || data.address.town || data.address.village || data.address.county || data.address.state;
            const country = data.address.country;
            
            if (city && country) {
                locationName.textContent = `${city}, ${country}`;
            } else if (city) {
                locationName.textContent = city;
            } else if (country) {
                locationName.textContent = country;
            } else {
                locationName.textContent = `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
            }
        } else {
            locationName.textContent = `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
        }
    } catch (error) {
        console.error('Error getting location name:', error);
        locationName.textContent = `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
    }
}

// Generate location-based prompt
async function generateLocationBasedPrompt(action) {
    const locationStr = userLocation.manual ? userLocation.name : locationName.textContent;
    let prompt = '';
    let categoryName = '';

    switch(action) {
        case 'landmarks':
            prompt = `I'm currently in ${locationStr}. List exactly 5 must-see landmarks and historical sites. Format each as: **Name** - Brief description (1-2 sentences) and why it's worth visiting.`;
            categoryName = 'Landmarks';
            break;
        case 'restaurants':
            prompt = `I'm in ${locationStr}. List exactly 5 best local restaurants. Format each as: **Name** - Cuisine type, brief description, and what to try.`;
            categoryName = 'Restaurants';
            break;
        case 'activities':
            prompt = `I'm visiting ${locationStr}. List exactly 5 popular activities and attractions. Format each as: **Name** - Brief description and what makes it special.`;
            categoryName = 'Activities';
            break;
        case 'nature':
            prompt = `I'm in ${locationStr}. List exactly 5 beautiful nature spots and parks. Format each as: **Name** - Brief description and what you can do there.`;
            categoryName = 'Nature Spots';
            break;
        case 'shopping':
            prompt = `I'm in ${locationStr}. List exactly 5 best shopping places. Format each as: **Name** - Type of shopping and what you can find.`;
            categoryName = 'Shopping';
            break;
        case 'nightlife':
            prompt = `I'm in ${locationStr}. List exactly 5 nightlife venues. Format each as: **Name** - Type of venue and what makes it special.`;
            categoryName = 'Nightlife';
            break;
    }

    locationPanel.classList.add('hidden');
    // Don't show user message in chat for category buttons
    conversationHistory.push({ role: 'user', content: prompt });
    
    isGenerating = true;
    sendBtn.disabled = true;
    userInput.disabled = false;

    try {
        // Get text recommendations first (without showing in chat)
        updateStatus('Getting recommendations...', 'warning');
        console.log('Getting recommendations for:', locationStr, 'Category:', categoryName);
        
        const settings = {
            prompt: prompt,
            model: modelSelect.value,
            max_tokens: parseInt(maxTokensSlider.value),
            temperature: parseFloat(temperatureSlider.value)
        };

        let response;
        // Use non-streaming for cleaner response parsing
        response = await handleSilentResponse(settings);
        console.log('Got response:', response ? 'Success' : 'No response');
        
        // Parse attractions and generate cards with images (no text shown)
        if (response) {
            const attractions = parseAttractionsFromResponse(response);
            console.log('Parsed attractions:', attractions.length, attractions);
            
            if (attractions.length > 0) {
                console.log('Generating cards...');
                await generateAttractionCards(attractions, locationStr, categoryName);
                
                // Show map and add landmarks if location is available
                if (userLocation && userLocation.latitude) {
                    if (mapPanel.classList.contains('hidden')) {
                        mapBtn.click();
                    }
                    await addLandmarkMarkers(attractions.map(a => a.name), userLocation.latitude, userLocation.longitude);
                }
            } else {
                console.log('No attractions found in response');
                updateStatus('No recommendations found. Try again or check server logs.', 'warning');
            }
        } else {
            console.log('Empty response from AI');
            updateStatus('No response from AI. Check if server is running.', 'error');
        }
    } catch (error) {
        console.error('Error in generateLocationBasedPrompt:', error);
        addMessage('Sorry, there was an error generating the recommendations.', 'ai', true);
        updateStatus('Error generating recommendations', 'error');
    } finally {
        isGenerating = false;
        sendBtn.disabled = false;
        userInput.disabled = false;
    }
}

// Auto-resize textarea
function autoResizeTextarea() {
    userInput.style.height = 'auto';
    userInput.style.height = userInput.scrollHeight + 'px';
}

// Update character count
function updateCharCount() {
    const count = userInput.value.length;
    charCount.textContent = `${count} character${count !== 1 ? 's' : ''}`;
}

// Check server health
async function checkServerHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        const data = await response.json();
        
        if (data.status === 'healthy') {
            updateStatus('Connected to server', 'success');
        } else {
            updateStatus('Server connection issue', 'warning');
        }
    } catch (error) {
        updateStatus('Server not responding - Please start the backend', 'error');
        console.error('Health check failed:', error);
    }
}

// Update status bar
function updateStatus(message, type = 'success') {
    statusText.textContent = message;
    const indicator = statusBar.querySelector('.status-indicator');
    indicator.className = 'status-indicator';
    if (type === 'error') indicator.classList.add('error');
    if (type === 'warning') indicator.classList.add('warning');
}

// Handle send message
async function handleSendMessage() {
    const message = userInput.value.trim();
    
    if (!message || isGenerating) return;

    // Remove welcome message if exists
    const welcomeMessage = chatContainer.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }

    // Add user message to chat
    addMessage(message, 'user');
    conversationHistory.push({ role: 'user', content: message });

    // Clear input
    userInput.value = '';
    autoResizeTextarea();
    updateCharCount();

    // Disable input while generating
    isGenerating = true;
    sendBtn.disabled = true;
    userInput.disabled = true;

    // Get settings
    const settings = {
        prompt: message,
        model: modelSelect.value,
        max_tokens: parseInt(maxTokensSlider.value),
        temperature: parseFloat(temperatureSlider.value)
    };

    try {
        if (imageMode) {
            await handleImageGeneration(message);
        } else if (streamModeCheckbox.checked) {
            await handleStreamResponse(settings);
        } else {
            await handleNormalResponse(settings);
        }
    } catch (error) {
        console.error('Error:', error);
        addMessage('Sorry, there was an error generating the response. Please make sure the backend server is running.', 'ai', true);
        updateStatus('Error generating response', 'error');
    } finally {
        isGenerating = false;
        sendBtn.disabled = false;
        userInput.disabled = false;
        userInput.focus();
    }
}

// Handle silent response (no display in chat, used for card generation)
async function handleSilentResponse(settings) {
    updateStatus('Getting recommendations...', 'warning');

    try {
        const response = await fetch(`${API_BASE_URL}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(settings)
        });

        const data = await response.json();

        if (data.success) {
            conversationHistory.push({ role: 'assistant', content: data.response });
            return data.response;
        } else {
            addMessage(`Error: ${data.error}`, 'ai', true);
            updateStatus('Error in response', 'error');
            return null;
        }
    } catch (error) {
        throw error;
    }
}

// Handle normal (non-streaming) response
async function handleNormalResponse(settings, returnResponse = false) {
    // Show typing indicator
    const typingId = addTypingIndicator();
    updateStatus('Generating response...', 'warning');

    try {
        const response = await fetch(`${API_BASE_URL}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(settings)
        });

        const data = await response.json();

        // Remove typing indicator
        removeTypingIndicator(typingId);

        if (data.success) {
            addMessage(data.response, 'ai');
            conversationHistory.push({ role: 'assistant', content: data.response });
            updateStatus('Response generated', 'success');
            return returnResponse ? data.response : null;
        } else {
            addMessage(`Error: ${data.error}`, 'ai', true);
            updateStatus('Error in response', 'error');
            return null;
        }
    } catch (error) {
        removeTypingIndicator(typingId);
        throw error;
    }
}

// Handle streaming response
async function handleStreamResponse(settings, returnResponse = false) {
    updateStatus('Streaming response...', 'warning');

    try {
        const response = await fetch(`${API_BASE_URL}/api/stream-generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(settings)
        });

        if (!response.ok) {
            throw new Error('Stream request failed');
        }

        // Create message element for streaming
        const messageElement = createMessageElement('', 'ai');
        chatContainer.appendChild(messageElement);
        scrollToBottom();

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';

        while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;

            const chunk = decoder.decode(value);
            fullResponse += chunk;

            // Update message content with formatted HTML
            const contentElement = messageElement.querySelector('.message-content');
            contentElement.innerHTML = formatMessage(fullResponse);
            scrollToBottom();
        }

        conversationHistory.push({ role: 'assistant', content: fullResponse });
        updateStatus('Response completed', 'success');
        return returnResponse ? fullResponse : null;
    } catch (error) {
        throw error;
    }
}

// Add message to chat
function addMessage(content, sender, isError = false) {
    const messageElement = createMessageElement(content, sender, isError);
    chatContainer.appendChild(messageElement);
    scrollToBottom();
}

// Create message element
function createMessageElement(content, sender, isError = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = sender === 'user' ? '👤' : '🤖';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    if (isError) {
        contentDiv.classList.add('error-message');
    }
    
    // Format content (basic markdown-like formatting)
    contentDiv.innerHTML = formatMessage(content);

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);

    return messageDiv;
}

// Format message content with enhanced markdown
function formatMessage(text) {
    if (!text) return '';
    
    // Escape HTML first
    let formatted = text.replace(/&/g, '&amp;')
                       .replace(/</g, '&lt;')
                       .replace(/>/g, '&gt;');

    // Format code blocks with language support (protect from further formatting)
    formatted = formatted.replace(/```(\w+)?\n?([\s\S]+?)```/g, (match, lang, code) => {
        const language = lang ? ` class="language-${lang}"` : '';
        return `<pre><code${language}>${code.trim()}</code></pre>`;
    });

    // Format inline code (protect from further formatting)
    formatted = formatted.replace(/`([^`\n]+)`/g, '<code>$1</code>');

    // Format headers (must be at start of line)
    formatted = formatted.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    formatted = formatted.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    formatted = formatted.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Format bold (avoid ** in middle of words)
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Format italic (single asterisk or underscore)
    formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');
    formatted = formatted.replace(/_(.+?)_/g, '<em>$1</em>');

    // Format numbered lists (must be at start of line)
    formatted = formatted.replace(/^\d+\.\s+(.+)$/gm, '<li class="ordered-item">$1</li>');
    
    // Format bullet lists (- or * at start of line)
    formatted = formatted.replace(/^[-•]\s+(.+)$/gm, '<li class="unordered-item">$1</li>');
    
    // Wrap consecutive ordered list items
    formatted = formatted.replace(/(<li class="ordered-item">.*?<\/li>\n?)+/g, (match) => {
        return '<ol>' + match + '</ol>';
    });
    
    // Wrap consecutive unordered list items
    formatted = formatted.replace(/(<li class="unordered-item">.*?<\/li>\n?)+/g, (match) => {
        return '<ul>' + match + '</ul>';
    });

    // Format blockquotes
    formatted = formatted.replace(/^&gt;\s*(.+)$/gm, '<blockquote>$1</blockquote>');

    // Format line breaks, but preserve structure
    formatted = formatted.replace(/\n\n/g, '<br><br>');
    formatted = formatted.replace(/\n/g, '<br>');
    
    // Clean up extra breaks around block elements
    formatted = formatted.replace(/<br><br>(<h[1-3]>)/g, '$1');
    formatted = formatted.replace(/<\/h[1-3]><br>/g, '</h$1>');
    formatted = formatted.replace(/<br>(<[ou]l>)/g, '$1');
    formatted = formatted.replace(/(<\/[ou]l>)<br>/g, '$1');
    formatted = formatted.replace(/<br>(<pre>)/g, '$1');
    formatted = formatted.replace(/(<\/pre>)<br>/g, '$1');

    // Check if response seems cut off and add continuation indicator
    if (isResponseCutOff(text)) {
        formatted += '<div class="continuation-indicator">📝 Response may be truncated. You can ask me to continue...</div>';
    }

    return formatted;
}

// Check if response appears to be cut off
function isResponseCutOff(text) {
    const lastChars = text.slice(-50).trim();
    
    // Check for incomplete sentences or code blocks
    const incompleteMarkers = [
        /[^.!?]\s*$/,  // Doesn't end with punctuation
        /```[^`]*$/,    // Unclosed code block
        /\*\*[^*]*$/,   // Unclosed bold
        /\([^)]*$/,     // Unclosed parenthesis
        /\[[^\]]*$/,    // Unclosed bracket
    ];
    
    return incompleteMarkers.some(marker => marker.test(lastChars));
}

// Add typing indicator
function addTypingIndicator() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ai';
    messageDiv.id = 'typing-indicator';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = '🤖';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    typingDiv.innerHTML = '<span></span><span></span><span></span>';
    
    contentDiv.appendChild(typingDiv);
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);

    chatContainer.appendChild(messageDiv);
    scrollToBottom();

    return 'typing-indicator';
}

// Remove typing indicator
function removeTypingIndicator(id) {
    const indicator = document.getElementById(id);
    if (indicator) {
        indicator.remove();
    }
}

// Handle image generation
async function handleImageGeneration(prompt, skipTyping = false) {
    let typingId = null;
    if (!skipTyping) {
        typingId = addTypingIndicator();
    }
    updateStatus('Generating image...', 'warning');

    try {
        const response = await fetch(`${API_BASE_URL}/api/generate-image`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt })
        });

        const data = await response.json();
        if (typingId) {
            removeTypingIndicator(typingId);
        }

        if (data.success && data.image_url) {
            addImageMessage(data.image_url, prompt);
            conversationHistory.push({ role: 'assistant', content: `[Generated image: ${prompt}]` });
            updateStatus('Image generated successfully', 'success');
        } else {
            addMessage(`Error: ${data.error || 'Failed to generate image'}`, 'ai', true);
            updateStatus('Error generating image', 'error');
        }
    } catch (error) {
        if (typingId) {
            removeTypingIndicator(typingId);
        }
        throw error;
    }
}

// Add image message to chat
function addImageMessage(imageUrl, prompt) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ai';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = '🤖';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content image-content';
    
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = prompt;
    img.className = 'generated-image';
    img.loading = 'lazy';
    
    // Make image clickable to open in new tab
    img.onclick = () => window.open(imageUrl, '_blank');
    
    const caption = document.createElement('p');
    caption.className = 'image-caption';
    caption.textContent = prompt;
    
    contentDiv.appendChild(img);
    contentDiv.appendChild(caption);
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);

    chatContainer.appendChild(messageDiv);
    scrollToBottom();
}

// Scroll to bottom of chat
function scrollToBottom() {
    // Scroll to the bottom of the page smoothly
    window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'smooth'
    });
}

// Initialize map
function initializeMap() {
    if (map) return;
    
    // Default to world view
    map = L.map('map').setView([20, 0], 2);
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
    
    updateStatus('Map initialized', 'success');
}

// Center map on location
function centerMapOnLocation(lat, lon) {
    if (!map) {
        initializeMap();
    }
    
    map.setView([lat, lon], 13);
    
    // Clear existing markers
    mapMarkers.forEach(marker => map.removeLayer(marker));
    mapMarkers = [];
    
    // Add user location marker
    const userMarker = L.marker([lat, lon], {
        icon: L.divIcon({
            className: 'custom-marker user-marker',
            html: '<div style="background: #3b82f6; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 16px;">📍</div>',
            iconSize: [30, 30]
        })
    }).addTo(map);
    
    userMarker.bindPopup('<b>Your Location</b>').openPopup();
    mapMarkers.push(userMarker);
    
    const locationText = userLocation.manual ? userLocation.name : locationName.textContent;
    mapLocationName.textContent = locationText;
}

// Add landmark markers to map
async function addLandmarkMarkers(landmarks, centerLat, centerLon) {
    if (!map) {
        initializeMap();
    }
    
    // Remove old landmark markers (keep user marker)
    mapMarkers.slice(1).forEach(marker => map.removeLayer(marker));
    mapMarkers = mapMarkers.slice(0, 1);
    
    for (let i = 0; i < landmarks.length; i++) {
        const landmark = landmarks[i];
        try {
            // Search for landmark location
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(landmark)}&limit=1`
            );
            const data = await response.json();
            
            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);
                
                const marker = L.marker([lat, lon], {
                    icon: L.divIcon({
                        className: 'custom-marker landmark-marker',
                        html: `<div style="background: linear-gradient(135deg, #8b5cf6, #7c3aed); width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 14px; color: white; font-weight: bold;">${i + 1}</div>`,
                        iconSize: [30, 30]
                    })
                }).addTo(map);
                
                marker.bindPopup(`<b>${i + 1}. ${landmark}</b>`);
                mapMarkers.push(marker);
            }
            
            // Delay to respect API rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.error(`Error adding marker for ${landmark}:`, error);
        }
    }
    
    updateStatus(`Added ${mapMarkers.length - 1} landmarks to map`, 'success');
}

// Parse landmarks from AI response
function parseLandmarksFromResponse(text) {
    const landmarks = [];
    
    // Try to find numbered lists or bullet points with landmark names
    const patterns = [
        /\d+\.\s*\*\*([^*]+)\*\*/g,  // Numbered with bold
        /\d+\.\s*([^:\n-]+)[:\-]/g,   // Numbered with colon or dash
        /[-•]\s*\*\*([^*]+)\*\*/g,     // Bullet with bold
        /[-•]\s*([^:\n-]+)[:\-]/g,     // Bullet with colon or dash
    ];
    
    for (const pattern of patterns) {
        const matches = [...text.matchAll(pattern)];
        if (matches.length > 0) {
            matches.forEach(match => {
                const landmarkName = match[1].trim();
                if (landmarkName.length > 3 && landmarkName.length < 100) {
                    landmarks.push(landmarkName);
                }
            });
            break;
        }
    }
    
    return landmarks.slice(0, 10); // Limit to 10 landmarks
}

// Parse attractions with descriptions from AI response
function parseAttractionsFromResponse(text) {
    const attractions = [];
    
    // Match pattern: **Name** - Description or **Name**: Description
    const pattern = /\d+\.\s*\*\*([^*]+)\*\*[\s:-]+([^\n]+)/g;
    const matches = [...text.matchAll(pattern)];
    
    matches.forEach(match => {
        const name = match[1].trim();
        const description = match[2].trim();
        if (name.length > 2 && description.length > 10) {
            attractions.push({ name, description });
        }
    });
    
    return attractions.slice(0, 5); // Limit to 5 attractions
}

// Generate attraction cards with images
async function generateAttractionCards(attractions, location, category) {
    updateStatus('Searching for attraction images...', 'warning');
    
    // Create container for cards
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'attractions-container';
    
    const header = document.createElement('h3');
    header.className = 'attractions-header';
    header.innerHTML = `🎯 ${category} in ${location}`;
    cardsContainer.appendChild(header);
    
    const grid = document.createElement('div');
    grid.className = 'attractions-grid';
    
    // Create placeholder cards first
    attractions.forEach((attraction, index) => {
        const card = createAttractionCard(attraction, index + 1, null);
        grid.appendChild(card);
    });
    
    cardsContainer.appendChild(grid);
    
    // Add to chat
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ai';
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = '🤖';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.appendChild(cardsContainer);
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    chatContainer.appendChild(messageDiv);
    scrollToBottom();
    
    // Search for real images of each attraction
    try {
        attractions.forEach((attraction, index) => {
            const card = grid.children[index];
            const img = card.querySelector('.card-image-placeholder');
            if (!img) return;
            
            // Use Lorem Picsum for reliable placeholder images
            // Seed with attraction name for consistency
            const seed = encodeURIComponent(attraction.name.replace(/\s+/g, '-').toLowerCase());
            const imageUrl = `https://picsum.photos/seed/${seed}/800/600`;
            
            // Set image with error handling
            const testImg = new Image();
            testImg.onload = () => {
                img.style.backgroundImage = `url(${imageUrl})`;
                img.classList.remove('loading');
            };
            testImg.onerror = () => {
                // Fallback to colorful gradient
                const colors = [
                    ['#667eea', '#764ba2'],
                    ['#f093fb', '#f5576c'],
                    ['#4facfe', '#00f2fe'],
                    ['#43e97b', '#38f9d7'],
                    ['#fa709a', '#fee140']
                ];
                const colorPair = colors[index % colors.length];
                img.style.background = `linear-gradient(135deg, ${colorPair[0]} 0%, ${colorPair[1]} 100%)`;
                img.classList.remove('loading');
            };
            testImg.src = imageUrl;
        });
        
        // Give images time to load
        setTimeout(() => {
            updateStatus('Attraction cards ready', 'success');
        }, 1000);
    } catch (error) {
        console.error('Error loading images:', error);
        updateStatus('Cards created (images loading)', 'warning');
    }
}

// Create single attraction card
function createAttractionCard(attraction, number, imageUrl) {
    const card = document.createElement('div');
    card.className = 'attraction-card';
    card.onclick = () => {
        // Search for the attraction on Google Maps
        const searchQuery = encodeURIComponent(attraction.name);
        window.open(`https://www.google.com/maps/search/${searchQuery}`, '_blank');
    };
    
    const imageDiv = document.createElement('div');
    imageDiv.className = 'card-image-placeholder loading';
    if (imageUrl) {
        imageDiv.style.backgroundImage = `url(${imageUrl})`;
        imageDiv.classList.remove('loading');
    }
    
    const numberBadge = document.createElement('div');
    numberBadge.className = 'card-number';
    numberBadge.textContent = number;
    imageDiv.appendChild(numberBadge);
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'card-content';
    
    const title = document.createElement('h4');
    title.className = 'card-title';
    title.textContent = attraction.name;
    
    const description = document.createElement('p');
    description.className = 'card-description';
    description.textContent = attraction.description;
    
    const clickHint = document.createElement('div');
    clickHint.className = 'card-click-hint';
    clickHint.innerHTML = '🗺️ Click to view on map';
    
    contentDiv.appendChild(title);
    contentDiv.appendChild(description);
    contentDiv.appendChild(clickHint);
    
    card.appendChild(imageDiv);
    card.appendChild(contentDiv);
    
    return card;
}

// Export functions for potential external use
window.chatApp = {
    sendMessage: handleSendMessage,
    clearChat: () => {
        conversationHistory = [];
        chatContainer.innerHTML = '';
    },
    showMap: () => {
        mapBtn.click();
    }
};
