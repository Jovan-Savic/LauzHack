# Generative AI Backend with Together.ai

A Flask-based backend API for generating AI responses using Together.ai's powerful language models.

## Features

- 🚀 RESTful API endpoints for AI text generation
- 🔄 Streaming response support for real-time generation
- 🎯 Multiple model options (Mixtral, Llama 3, Mistral, Qwen)
- 🔒 Environment variable configuration
- 🌐 CORS enabled for frontend integration
- ⚡ Simple and easy to deploy

## Prerequisites

- Python 3.8 or higher
- A Together.ai API key (get one at [https://api.together.xyz/](https://api.together.xyz/))

## Setup Instructions

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure Environment Variables

Copy the example environment file and add your Together.ai API key:

```bash
copy .env.example .env
```

Then edit `.env` and replace `your_together_api_key_here` with your actual Together.ai API key:

```
TOGETHER_API_KEY=your_actual_api_key_here
```

### 3. Run the Server

```bash
python app.py
```

The server will start on `http://localhost:5000`

## API Endpoints

### Health Check

**GET** `/health`

Check if the server is running.

**Response:**
```json
{
  "status": "healthy",
  "message": "Backend is running"
}
```

### Generate AI Response

**POST** `/api/generate`

Generate a complete AI response.

**Request Body:**
```json
{
  "prompt": "Explain quantum computing in simple terms",
  "model": "mistralai/Mixtral-8x7B-Instruct-v0.1",
  "max_tokens": 512,
  "temperature": 0.7
}
```

**Parameters:**
- `prompt` (required): The text prompt for the AI
- `model` (optional): Model ID to use (default: Mixtral-8x7B)
- `max_tokens` (optional): Maximum tokens to generate (default: 512)
- `temperature` (optional): Sampling temperature 0-1 (default: 0.7)

**Response:**
```json
{
  "success": true,
  "response": "Quantum computing is...",
  "model": "mistralai/Mixtral-8x7B-Instruct-v0.1"
}
```

### Stream AI Response

**POST** `/api/stream-generate`

Stream AI response in real-time (returns plain text stream).

**Request Body:** Same as `/api/generate`

**Response:** Plain text stream of generated content

### Get Available Models

**GET** `/api/models`

Get a list of available Together.ai models.

**Response:**
```json
{
  "models": [
    {
      "id": "mistralai/Mixtral-8x7B-Instruct-v0.1",
      "name": "Mixtral 8x7B Instruct",
      "description": "High-quality mixture of experts model"
    },
    ...
  ]
}
```

## Example Usage

### Using cURL

```bash
# Generate a response
curl -X POST http://localhost:5000/api/generate \
  -H "Content-Type: application/json" \
  -d "{\"prompt\": \"Write a haiku about coding\"}"

# Get available models
curl http://localhost:5000/api/models
```

### Using Python

```python
import requests

response = requests.post(
    "http://localhost:5000/api/generate",
    json={
        "prompt": "What is the meaning of life?",
        "max_tokens": 256,
        "temperature": 0.8
    }
)

print(response.json()["response"])
```

### Using JavaScript (Fetch)

```javascript
fetch('http://localhost:5000/api/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    prompt: 'Explain machine learning',
    max_tokens: 300
  })
})
.then(response => response.json())
.then(data => console.log(data.response));
```

## Available Models

The backend supports various Together.ai models:

- **Mixtral 8x7B Instruct** - High-quality mixture of experts
- **Llama 3 70B Chat** - Meta's powerful chat model
- **Llama 3 8B Chat** - Faster, smaller Llama 3
- **Mistral 7B Instruct** - Efficient 7B parameter model
- **Qwen 2 72B Instruct** - Powerful multilingual model

## Error Handling

The API returns appropriate HTTP status codes:

- `200` - Success
- `400` - Bad request (missing prompt)
- `500` - Server error (API issues, etc.)

Error responses include details:
```json
{
  "success": false,
  "error": "Error message here"
}
```

## Development

To run in development mode with auto-reload, the app is already configured with `debug=True`. Just run:

```bash
python app.py
```

## License

MIT License - feel free to use this in your projects!
