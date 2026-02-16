# Python Chatbot Service - LangServe

LangServe chatbot service dengan hybrid FunctionGemma + Qwen3 approach untuk Bakery PoS.

## Architecture

Service ini menggunakan **hybrid model approach**:
- **FunctionGemma:270m**: Mendeteksi function calls dari user input (ringan & cepat)
- **Gemma3:1b**: Menghasilkan dialog natural dan memformat hasil tool execution (ringan & cepat)

## Setup

### 1. Install Python 3.10+
```bash
python3 --version  # Should be 3.10 or higher
```

### 2. Create Virtual Environment
```bash
cd python-chatbot
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# atau
venv\Scripts\activate  # Windows
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure Environment
Edit `.env` file jika perlu (default values sudah di-set):
```bash
OLLAMA_BASE_URL=http://localhost:11434
FUNCTION_MODEL=functiongemma:270m
DIALOG_MODEL=gemma3:1b
NODEJS_BACKEND_URL=http://localhost:3000
PYTHON_SERVICE_PORT=8001
```

### 5. Pull Ollama Models
```bash
# Pull FunctionGemma if not already pulled
ollama pull functiongemma

# Pull Gemma3:1b if not already pulled
ollama pull gemma3:1b

# Verify models
ollama list  # Should show functiongemma and gemma3:1b
```

## Running the Service

### Development Mode (with auto-reload)
```bash
source venv/bin/activate
uvicorn main:app --reload --port 8001
```

### Production Mode
```bash
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8001
```

## API Endpoints

### Health Check
```bash
curl http://localhost:8001/health
```

### Chat Invoke (Single Request)
```bash
curl -X POST http://localhost:8001/chat/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "messages": [
        {"role": "user", "content": "Lihat menu dong"}
      ]
    }
  }'
```

### LangServe Playground
Open in browser: `http://localhost:8001/chat/playground/`

Interactive UI untuk testing chatbot dengan input/output visual.

## Tools Available

1. **get_menu**: Menampilkan daftar menu produk
2. **check_availability**: Cek ketersediaan produk spesifik
3. **create_order**: Membuat order baru (tanpa autentikasi)

## Hybrid Flow

```
User Input
    ↓
FunctionGemma Analyze
    ↓
Tool Needed? ─── No ──→ Gemma3:1b (Natural Dialog)
    ↓ Yes                      ↓
Execute Tool                   Output
    ↓
Gemma3:1b (Format Response)
    ↓
Natural Output
```

## Integration dengan Node.js

Python service ini memanggil Node.js backend API untuk eksekusi tools:
- `GET /api/chatbot/menu`
- `POST /api/chatbot/check-availability`
- `POST /api/chatbot/create-order`

**Pastikan Node.js backend berjalan di `http://localhost:3000`**

## Troubleshooting

### Error: Module not found
```bash
# Make sure virtual environment is activated
source venv/bin/activate
pip install -r requirements.txt
```

### Error: Connection refused (Ollama)
```bash
# Start Ollama service
ollama serve

# Verify models are available
ollama list
```

### Error: Connection refused (Node.js backend)
```bash
# Make sure Node.js backend is running
cd ..
npm run dev
```
