# Bakery PoS - Chatbot LangServe Migration

## Setup Instructions

### Prerequisites
- Python 3.10+
- Node.js 16+
- Ollama with models: `functiongemma` and `gemma3:1b`

### Installation Steps

#### 1. Install Python Dependencies
```bash
cd python-chatbot
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
```

#### 2. Verify Ollama Models
```bash
ollama pull functiongemma
ollama pull gemma3:1b
ollama list  # Should show functiongemma and gemma3:1b
```

#### 3. Run Both Services
**Terminal 1 - Node.js Backend:**
```bash
npm run dev
```

**Terminal 2 - Python Chatbot Service:**
```bash
cd python-chatbot
source venv/bin/activate
uvicorn main:app --reload --port 8001
```

## Testing

### Health Check
```bash
# Python service
curl http://localhost:8001/health

# Node.js backend
curl http://localhost:3000/health
```

### Test Chat
```bash
curl -X POST http://localhost:3000/api/ollama-chat/chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-123",
    "message": "Lihat menu dong"
  }'
```

### LangServe Playground
Open browser: `http://localhost:8001/chat/playground/`

## Hybrid Model Flow

1. User input → FunctionGemma analyzes
2. If tool needed → Execute tool → Gemma3:1b formats natural response
3. If no tool → Gemma3:1b generates natural dialog

## Available Tools

- **get_menu**: Show all products
- **check_availability**: Check product stock
- **create_order**: Create order (no auth required)
