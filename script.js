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

// State
let isGenerating = false;
let conversationHistory = [];
let userLocation = null;
let imageMode = false;

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
            locationStatus.textContent = 'Location set';
            locationStatus.classList.add('active');
            locationBtn.classList.add('active');
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
            userLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            };

            coordinates.textContent = `${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)}`;
            locationInfo.classList.remove('hidden');
            locationStatus.textContent = 'Location detected';
            locationStatus.classList.add('active');
            locationBtn.classList.add('active');

            // Get location name using reverse geocoding (approximate)
            await getLocationName(userLocation.latitude, userLocation.longitude);
            
            updateStatus('Location detected successfully', 'success');
        },
        (error) => {
            let errorMessage = 'Unable to get location';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = 'Location permission denied';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = 'Location information unavailable';
                    break;
                case error.TIMEOUT:
                    errorMessage = 'Location request timeout';
                    break;
            }
            locationStatus.textContent = errorMessage;
            updateStatus(errorMessage, 'error');
        }
    );
}

// Get location name (using a free API)
async function getLocationName(lat, lon) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`);
        const data = await response.json();
        
        if (data.address) {
            const city = data.address.city || data.address.town || data.address.village || data.address.county;
            const country = data.address.country;
            locationName.textContent = city ? `${city}, ${country}` : country;
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
    let imagePrompt = '';

    switch(action) {
        case 'landmarks':
            prompt = `I'm currently in ${locationStr}. Can you recommend the top 5-7 must-see landmarks and historical sites in this area? Please provide brief descriptions and why they're worth visiting.`;
            imagePrompt = `Beautiful scenic view of the most famous landmark in ${locationStr}, professional travel photography, golden hour, stunning architecture`;
            break;
        case 'restaurants':
            prompt = `I'm in ${locationStr}. What are the best local restaurants and food experiences I should try? Include different cuisines and price ranges.`;
            imagePrompt = `Delicious local cuisine and traditional dishes from ${locationStr}, food photography, vibrant colors, appetizing presentation`;
            break;
        case 'activities':
            prompt = `I'm visiting ${locationStr}. What are the most popular activities, attractions, and things to do here? Include both tourist favorites and local gems.`;
            imagePrompt = `Popular tourist attractions and activities in ${locationStr}, vibrant city life, people enjoying activities, professional photography`;
            break;
        case 'nature':
            prompt = `I'm in ${locationStr}. Can you suggest beautiful nature spots, parks, hiking trails, or outdoor areas nearby worth exploring?`;
            imagePrompt = `Breathtaking natural landscape near ${locationStr}, beautiful nature scenery, hiking trails, lush greenery, scenic vista`;
            break;
        case 'shopping':
            prompt = `I'm in ${locationStr}. Where are the best places to shop? Include local markets, shopping districts, and unique stores.`;
            imagePrompt = `Bustling shopping district and local market in ${locationStr}, colorful market stalls, shopping atmosphere, vibrant scene`;
            break;
        case 'nightlife':
            prompt = `I'm in ${locationStr}. What's the nightlife scene like? Recommend bars, clubs, live music venues, or evening entertainment options.`;
            imagePrompt = `Vibrant nightlife scene in ${locationStr}, city lights at night, entertainment district, atmospheric evening lighting`;
            break;
    }

    locationPanel.classList.add('hidden');

    // First, generate the image
    addMessage(prompt, 'user');
    conversationHistory.push({ role: 'user', content: prompt });
    
    isGenerating = true;
    sendBtn.disabled = true;
    userInput.disabled = true;

    try {
        // Generate image first
        updateStatus('Generating location image...', 'warning');
        await handleImageGeneration(imagePrompt, true);
        
        // Then get text recommendations
        updateStatus('Getting recommendations...', 'warning');
        const settings = {
            prompt: prompt,
            model: modelSelect.value,
            max_tokens: parseInt(maxTokensSlider.value),
            temperature: parseFloat(temperatureSlider.value)
        };

        if (streamModeCheckbox.checked) {
            await handleStreamResponse(settings);
        } else {
            await handleNormalResponse(settings);
        }
    } catch (error) {
        console.error('Error:', error);
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

// Handle normal (non-streaming) response
async function handleNormalResponse(settings) {
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
        } else {
            addMessage(`Error: ${data.error}`, 'ai', true);
            updateStatus('Error in response', 'error');
        }
    } catch (error) {
        removeTypingIndicator(typingId);
        throw error;
    }
}

// Handle streaming response
async function handleStreamResponse(settings) {
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
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Export functions for potential external use
window.chatApp = {
    sendMessage: handleSendMessage,
    clearChat: () => {
        conversationHistory = [];
        chatContainer.innerHTML = '';
    }
};
