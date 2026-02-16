# 🎓 Roadmap Pembelajaran - Chatbot Project

> **Panduan lengkap konsep, teknologi, dan sumber belajar untuk memahami project chatbot PoS ini**

---

## 📋 Daftar Isi

1. [Arsitektur & Flow](#1-arsitektur--flow)
2. [Python Fundamentals](#2-python-fundamentals)
3. [LangChain Framework](#3-langchain-framework)
4. [LLM & Ollama](#4-llm--ollama)
5. [API & HTTP Communication](#5-api--http-communication)
6. [Backend Integration](#6-backend-integration)
7. [State Management](#7-state-management)
8. [Tools & Function Calling](#8-tools--function-calling)
9. [Production Concepts](#9-production-concepts)
10. [Resources & Next Steps](#10-resources--next-steps)

---

## 1. Arsitektur & Flow

### 🎯 Konsep yang Perlu Dipelajari

#### **Microservices Architecture**
- **Apa itu:** Aplikasi dipecah jadi beberapa service kecil yang independen
- **Di project ini:**
  - `Python Chatbot Service` (Port 8000) → AI/LLM processing
  - `Node.js Backend` (Port 3000/5000) → Database, business logic
  - Kedua service berkomunikasi via HTTP REST API

#### **Request-Response Flow**
```
User → Frontend → Node.js → Python Chatbot → Ollama LLM
                      ↓                ↓
                  Database        Tool Execution
                      ↓                ↓
User ← Frontend ← Node.js ← Python ← Response
```

### 📚 Sumber Belajar
- 🔗 **Microservices Basics**: https://microservices.io/patterns/microservices.html
- 🎥 **YouTube**: "Microservices Architecture Explained"
- 📖 **Artikel**: Search "microservices vs monolithic architecture"

---

## 2. Python Fundamentals

### 🎯 Konsep yang Perlu Dipelajari

#### **Type Hints & Typing Module**
```python
from typing import Dict, List, Any

def process(data: Dict[str, Any]) -> List[str]:
    # Dict[str, Any] = dictionary dengan key string, value apa saja
    # List[str] = return list berisi string
    pass
```

**File terkait:** `chatbot_chain.py` line 20, 99-108

#### **Classes & OOP**
```python
class HybridChatbotChain:
    def __init__(self):
        self.model = gemma_model
    
    def invoke(self, inputs: Dict) -> Dict:
        pass
```

**File terkait:** `chatbot_chain.py` line 92-334

#### **Decorators**
```python
@tool
def get_menu() -> str:
    # @tool adalah decorator dari LangChain
    # Mengubah fungsi biasa jadi LangChain Tool
    pass
```

**File terkait:** `bakery_tools.py` line 26, 49, 82, dst

#### **Context Managers & Clients**
```python
http_client = httpx.Client(...)  # Persistent connection
# vs
with httpx.Client(...) as client:  # Auto cleanup
    client.get("/api")
```

**File terkait:** `bakery_tools.py` line 20-23

### 📚 Sumber Belajar
- 🔗 **Type Hints**: https://docs.python.org/3/library/typing.html
- 🔗 **OOP Python**: https://realpython.com/python3-object-oriented-programming/
- 🔗 **Decorators**: https://realpython.com/primer-on-python-decorators/
- 🎥 **YouTube**: "Python OOP Tutorial" by Corey Schafer

---

## 3. LangChain Framework

### 🎯 Konsep yang Perlu Dipelajari

#### **Chain Pattern**
- **Apa itu:** Menggabungkan beberapa langkah processing jadi satu alur
- **Di project ini:** Detection → Tool Execution → Response Generation

**File terkait:** `chatbot_chain.py` line 99-202

#### **Messages & Chat Models**
```python
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

# SystemMessage = instruksi untuk AI
# HumanMessage = pesan dari user
# AIMessage = response dari AI
```

**File terkait:** `chatbot_chain.py` line 22, 128-131

#### **Tools & Tool Binding**
```python
from langchain_core.tools import tool

# Bind tools ke model
gemma_with_tools = gemma_model.bind_tools(bakery_tools)
```

**File terkait:** `chatbot_chain.py` line 37

#### **Runnables**
```python
from langchain_core.runnables import RunnableLambda

# Wrapper untuk kompatibilitas dengan LangServe
chatbot_chain = RunnableLambda(my_function)
```

**File terkait:** `chatbot_chain.py` line 333

### 📚 Sumber Belajar
- 🔗 **LangChain Docs**: https://python.langchain.com/docs/get_started/introduction
- 🔗 **LangChain Tools**: https://python.langchain.com/docs/modules/agents/tools/
- 🔗 **Chat Models**: https://python.langchain.com/docs/modules/model_io/chat/
- 🎥 **YouTube**: "LangChain Crash Course" by FreeCodeCamp

---

## 4. LLM & Ollama

### 🎯 Konsep yang Perlu Dipelajari

#### **Large Language Models (LLM)**
- **Apa itu:** AI yang dilatih untuk memahami dan generate text
- **Di project ini:** Gemma 3 1B model via Ollama

#### **Ollama Integration**
```python
from langchain_ollama import ChatOllama

gemma_model = ChatOllama(
    model="gemma3:1b",           # Model name
    base_url="http://localhost:11434",  # Ollama server
    temperature=0.1              # Kreativitas (0-1)
)
```

**File terkait:** `chatbot_chain.py` line 30-34

#### **Temperature Parameter**
- `0.0` = Deterministik, selalu jawaban yang sama
- `0.1-0.3` = Konservatif (untuk chatbot bisnis)
- `0.7-1.0` = Kreatif (untuk cerita, ide)

#### **Tool Calling / Function Calling**
- **Apa itu:** LLM bisa "memanggil" fungsi Python berdasarkan input user
- **Contoh:** User: "lihat menu" → LLM panggil `get_menu()`

**File terkait:** `chatbot_chain.py` line 136-138

### 📚 Sumber Belajar
- 🔗 **Ollama**: https://ollama.com/
- 🔗 **Function Calling**: https://python.langchain.com/docs/modules/model_io/chat/function_calling/
- 🎥 **YouTube**: "What is Ollama" by NetworkChuck
- 📖 **Artikel**: "Understanding LLM Temperature"

---

## 5. API & HTTP Communication

### 🎯 Konsep yang Perlu Dipelajari

#### **REST API Basics**
- **GET**: Ambil data (contoh: `/api/chatbot/menu`)
- **POST**: Kirim data (contoh: `/api/chatbot/create-order`)

**File terkait:** `bakery_tools.py` line 30, 58, 93

#### **HTTP Client - HTTPX**
```python
import httpx

# Persistent client (recommended)
client = httpx.Client(
    base_url="http://localhost:3000",
    timeout=30.0
)

# GET request
response = client.get("/api/menu")

# POST request
response = client.post("/api/order", json={"items": [...]})
```

**File terkait:** `bakery_tools.py` line 20-23

#### **JSON Data Format**
```python
import json

# Python dict → JSON string
data = {"name": "Cake", "price": 50000}
json_string = json.dumps(data)

# JSON string → Python dict
python_dict = json.loads(json_string)
```

**File terkait:** `bakery_tools.py` line 14, 35-42

#### **HTTP Status Codes**
- `200 OK` = Sukses
- `404 Not Found` = Endpoint tidak ada
- `500 Internal Server Error` = Error di server

### 📚 Sumber Belajar
- 🔗 **HTTPX Docs**: https://www.python-httpx.org/
- 🔗 **REST API Tutorial**: https://restfulapi.net/
- 🔗 **JSON Guide**: https://www.json.org/json-en.html
- 🎥 **YouTube**: "REST API Crash Course" by Traversy Media

---

## 6. Backend Integration

### 🎯 Konsep yang Perlu Dipelajari

#### **FastAPI Framework**
```python
from fastapi import FastAPI
from langserve import add_routes

app = FastAPI()

# Add LangChain route
add_routes(app, chatbot_chain, path="/chatbot")
```

**File terkait:** `main.py`

#### **CORS (Cross-Origin Resource Sharing)**
- **Apa itu:** Izin frontend (domain lain) akses API
- **Kenapa perlu:** Frontend di `localhost:3000`, API di `localhost:8000`

#### **Environment Variables (.env)**
```bash
NODEJS_BACKEND_URL=http://localhost:3000
OLLAMA_BASE_URL=http://localhost:11434
DIALOG_MODEL=gemma3:1b
```

**File terkait:** `.env`, `utils/config.py`

### 📚 Sumber Belajar
- 🔗 **FastAPI**: https://fastapi.tiangolo.com/
- 🔗 **LangServe**: https://python.langchain.com/docs/langserve
- 🔗 **CORS Explained**: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
- 🎥 **YouTube**: "FastAPI Tutorial" by TechWithTim

---

## 7. State Management

### 🎯 Konsep yang Perlu Dipelajari

#### **Conversation History**
```python
# Menyimpan chat history untuk context
history = [
    HumanMessage("mau pesan kue"),
    AIMessage("Baik, mau pesan apa?"),
    HumanMessage("red velvet")
]
```

**File terkait:** `chatbot_chain.py` line 227-245

#### **Cart State Management**
- **Stateless Python Service:** Tidak menyimpan data user
- **Stateful Node.js Backend:** Menyimpan cart di session/database

```javascript
// Node.js Session Store (JavaScript)
sessions.set(sessionId, {
    cart: [{product_name: "Cake", quantity: 1}],
    history: [...]
})
```

**File terkait:** `sessionStore.js`

#### **Session ID**
- **Apa itu:** ID unik untuk setiap user/conversation
- **Fungsi:** Identifikasi user mana yang punya cart apa

### 📚 Sumber Belajar
- 🔗 **Session Management**: https://developer.mozilla.org/en-US/docs/Web/HTTP/Session_management
- 📖 **Artikel**: "Stateful vs Stateless Applications"

---

## 8. Tools & Function Calling

### 🎯 Konsep yang Perlu Dipelajari

#### **LangChain @tool Decorator**
```python
from langchain_core.tools import tool

@tool
def get_menu() -> str:
    """Get bakery menu.
    
    This docstring is IMPORTANT!
    LLM reads this to understand when to use this tool.
    """
    # Implementation
    pass
```

**File terkait:** `bakery_tools.py` line 26-46

#### **Tool Execution Flow**
1. User: "lihat menu"
2. LLM detects: "Butuh tool `get_menu()`"
3. Python executes: `get_menu()` → calls Node.js API
4. Returns JSON result
5. LLM formats: "Ini menu kami: ..."

**File terkait:** `chatbot_chain.py` line 247-274

#### **Tool Arguments**
```python
@tool
def check_availability(product_name: str, quantity: int = 1) -> str:
    """
    Args:
        product_name: Name of the product
        quantity: How many to check
    """
    pass
```

**File terkait:** `bakery_tools.py` line 50-79

### 📚 Sumber Belajar
- 🔗 **LangChain Tools Guide**: https://python.langchain.com/docs/modules/agents/tools/custom_tools
- 🔗 **Function Calling**: https://platform.openai.com/docs/guides/function-calling

---

## 9. Production Concepts

### 🎯 Konsep yang Perlu Dipelajari

#### **Error Handling**
```python
try:
    response = http_client.get("/api/menu")
    data = response.json()
    return data
except Exception as e:
    return {"success": False, "error": str(e)}
```

**File terkait:** `bakery_tools.py` line 45-46

#### **Timeout Management**
```python
http_client = httpx.Client(timeout=30.0)
# Jika request > 30 detik, otomatis error
```

**File terkait:** `bakery_tools.py` line 22

#### **Connection Pooling**
- **Apa itu:** Reuse koneksi HTTP instead of buat baru setiap request
- **Manfaat:** Lebih cepat, hemat resource

#### **Logging & Debugging**
```python
import logging

logger = logging.getLogger(__name__)
logger.info("Processing request...")
logger.error(f"Error: {e}")
```

### 📚 Sumber Belajar
- 🔗 **Error Handling Best Practices**: https://realpython.com/python-exceptions/
- 🔗 **Python Logging**: https://docs.python.org/3/library/logging.html
- 📖 **Artikel**: "Production-Ready Python Applications"

---

## 10. Resources & Next Steps

### 📖 Dokumentasi Official

| Technology | Link |
|-----------|------|
| Python | https://docs.python.org/3/ |
| LangChain | https://python.langchain.com/ |
| FastAPI | https://fastapi.tiangolo.com/ |
| HTTPX | https://www.python-httpx.org/ |
| Ollama | https://ollama.com/ |
| LangServe | https://python.langchain.com/docs/langserve |

### 🎥 Video Tutorials (Bahasa Indonesia)

- **Programmer Zaman Now**: Python OOP, FastAPI
- **Web Programming UNPAS**: Python Basics
- Search YouTube: "LangChain Indonesia", "Ollama Tutorial Indonesia"

### 🎓 Learning Path (Urutan Rekomendasi)

#### **Level 1: Pemula (1-2 Minggu)**
1. ✅ Python basics (variables, functions, classes)
2. ✅ JSON & REST API concepts
3. ✅ HTTP request/response

#### **Level 2: Intermediate (2-3 Minggu)**
4. ✅ FastAPI basics
5. ✅ LangChain fundamentals
6. ✅ Chat models & prompts

#### **Level 3: Advanced (3-4 Minggu)**
7. ✅ Tool calling & function execution
8. ✅ State management & sessions
9. ✅ Microservices architecture

#### **Level 4: Production (Ongoing)**
10. ✅ Error handling & logging
11. ✅ Performance optimization
12. ✅ Security & authentication

### 🛠️ Hands-On Practice

#### **Eksperimen 1: Buat Tool Sederhana**
```python
@tool
def greet(name: str) -> str:
    """Greet someone by name."""
    return f"Hello, {name}!"

# Test it
result = greet.invoke({"name": "Kevin"})
print(result)  # "Hello, Kevin!"
```

#### **Eksperimen 2: Test HTTP Client**
```python
import httpx

client = httpx.Client(base_url="https://jsonplaceholder.typicode.com")
response = client.get("/users/1")
print(response.json())
```

#### **Eksperimen 3: Modify Existing Tools**
- Tambahkan tool baru: `get_store_info()`
- Edit prompt untuk bahasa yang lebih casual
- Tambahkan logging di `bakery_tools.py`

### 📝 Project Files Cheat Sheet

| File | Purpose | What to Learn |
|------|---------|---------------|
| `main.py` | FastAPI app entry | FastAPI, LangServe |
| `chatbot_chain.py` | Core chatbot logic | LangChain, flow control |
| `bakery_tools.py` | Tool definitions | @tool decorator, API calls |
| `utils/config.py` | Configuration | Environment variables |
| `requirements.txt` | Dependencies | Python packages |

### 🔍 Debug Tips

#### **Jika chatbot tidak response:**
1. Check Ollama running: `ollama list`
2. Check Node.js backend: `curl http://localhost:3000/api/chatbot/menu`
3. Check Python logs: Terminal yang run `python main.py`

#### **Jika tool tidak dipanggil:**
1. Lihat `FUNCTION_DETECTION_PROMPT` di `chatbot_chain.py` line 39-61
2. Pastikan description di `@tool` jelas
3. Test dengan input eksplisit: "gunakan tool get_menu"

---

## 🎯 Next Steps

Setelah mempelajari konsep-konsep di atas, Anda bisa:

1. **Customize chatbot:**
   - Tambah tool baru (misal: `get_promotions()`)
   - Edit prompt untuk personality berbeda
   - Implementasi multi-language support

2. **Improve architecture:**
   - Tambah caching untuk menu
   - Implementasi proper logging
   - Add user authentication

3. **Deploy to production:**
   - Containerize dengan Docker
   - Setup reverse proxy (Nginx)
   - Monitor dengan logging service

---

## ❓ FAQ & Troubleshooting

**Q: Kenapa pakai Python DAN Node.js?**
- Python → Bagus untuk AI/ML (LangChain, Ollama)
- Node.js → Bagus untuk web backend (Express, MongoDB)

**Q: Apa bedanya LangChain dan Ollama?**
- Ollama → Running LLM locally
- LangChain → Framework untuk orchestrate LLM + tools

**Q: Kenapa ada 2 model di chatbot_chain.py?**
- `gemma_with_tools` → Untuk detect tool yang dibutuhkan
- `dialog_model` → Untuk generate natural response

**Q: Apa itu `ensure_ascii=False` di json.dumps()?**
- Supaya karakter Indonesia (ā, é, dll) tidak di-escape

---

**Dibuat untuk:** PoS Chatbot Project  
**Last Updated:** 2026-02-17  
**Maintainer:** Kevin  

📧 **Need help?** Review code comments, check logs, atau eksperimen dengan modifikasi kecil!
