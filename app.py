from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv
from together import Together

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend requests

# Initialize Together.ai client
client = Together(api_key=os.environ.get("TOGETHER_API_KEY"))

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "message": "Backend is running"}), 200

@app.route('/api/generate', methods=['POST'])
def generate():
    """
    Generate AI response using Together.ai
    Expected JSON body:
    {
        "prompt": "Your prompt here",
        "model": "mistralai/Mixtral-8x7B-Instruct-v0.1" (optional),
        "max_tokens": 512 (optional),
        "temperature": 0.7 (optional)
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'prompt' not in data:
            return jsonify({"error": "Prompt is required"}), 400
        
        prompt = data['prompt']
        model = data.get('model', 'mistralai/Mixtral-8x7B-Instruct-v0.1')
        max_tokens = data.get('max_tokens', 512)
        temperature = data.get('temperature', 0.7)
        
        # Generate response using Together.ai
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
            temperature=temperature,
        )
        
        # Extract the generated text
        generated_text = response.choices[0].message.content
        
        return jsonify({
            "success": True,
            "response": generated_text,
            "model": model
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/stream-generate', methods=['POST'])
def stream_generate():
    """
    Stream AI response using Together.ai
    Expected JSON body:
    {
        "prompt": "Your prompt here",
        "model": "mistralai/Mixtral-8x7B-Instruct-v0.1" (optional),
        "max_tokens": 512 (optional),
        "temperature": 0.7 (optional)
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'prompt' not in data:
            return jsonify({"error": "Prompt is required"}), 400
        
        prompt = data['prompt']
        model = data.get('model', 'mistralai/Mixtral-8x7B-Instruct-v0.1')
        max_tokens = data.get('max_tokens', 512)
        temperature = data.get('temperature', 0.7)
        
        def generate_stream():
            stream = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=max_tokens,
                temperature=temperature,
                stream=True,
            )
            
            for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        
        return app.response_class(generate_stream(), mimetype='text/plain')
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/models', methods=['GET'])
def get_models():
    """Return a list of popular Together.ai models"""
    models = [
        {
            "id": "mistralai/Mixtral-8x7B-Instruct-v0.1",
            "name": "Mixtral 8x7B Instruct",
            "description": "High-quality mixture of experts model"
        },
        {
            "id": "meta-llama/Llama-3-70b-chat-hf",
            "name": "Llama 3 70B Chat",
            "description": "Meta's powerful chat model"
        },
        {
            "id": "meta-llama/Llama-3-8b-chat-hf",
            "name": "Llama 3 8B Chat",
            "description": "Smaller, faster Llama 3 model"
        },
        {
            "id": "mistralai/Mistral-7B-Instruct-v0.2",
            "name": "Mistral 7B Instruct",
            "description": "Efficient 7B parameter model"
        },
        {
            "id": "Qwen/Qwen2-72B-Instruct",
            "name": "Qwen 2 72B Instruct",
            "description": "Powerful multilingual model"
        }
    ]
    return jsonify({"models": models}), 200

if __name__ == '__main__':
    # Check if API key is set
    if not os.environ.get("TOGETHER_API_KEY"):
        print("Warning: TOGETHER_API_KEY not found in environment variables")
        print("Please set it in your .env file")
    
    # Run the Flask app
    app.run(debug=True, host='0.0.0.0', port=5000)
