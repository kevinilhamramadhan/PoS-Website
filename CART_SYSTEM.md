# Chatbot Cart System

## Overview

Sistem cart telah diimplementasikan untuk memungkinkan user menambahkan beberapa item sebelum konfirmasi pesanan. Setiap session memiliki keranjang dan history percakapan yang terpisah.

## Fitur Utama

✅ **Multi-item ordering**: User bisa pesan beberapa item dalam satu session
✅ **Conversation history**: AI tahu konteks percakapan sebelumnya
✅ **Cart state tracking**: Keranjang tersimpan per session
✅ **Explicit confirmation**: Order hanya dibuat setelah user konfirmasi eksplisit
✅ **Auto-cleanup**: Session otomatis expire setelah 30 menit tidak aktif

## Alur Pemesanan

**Sebelum (LAMA):**
```
User: "Saya mau pesan 1 red velvet"
AI: [langsung panggil create_order] ✅ Order dibuat #ORD001

User: "Saya mau pesan 1 kue lapis lagi"  
AI: [langsung panggil create_order] ✅ Order dibuat #ORD002
❌ MASALAH: Jadi 2 order terpisah!
```

**Sekarang (BARU):**
```
User: "Saya mau pesan 1 red velvet"
AI: [panggil add_to_cart] 
    "1x Red Velvet Cake ditambahkan ke keranjang!
    
    🛒 Keranjang Anda:
    • 1x Red Velvet Cake - Rp 75.000
    
    Total: Rp 75.000
    
    Mau tambah yang lain atau ketik 'konfirmasi pesanan' untuk checkout?"

User: "Saya mau pesan 1 kue lapis lagi"
AI: [panggil add_to_cart lagi]
    "1x Kue Lapis ditambahkan ke keranjang!
    
    🛒 Keranjang Anda:
    • 1x Red Velvet Cake - Rp 75.000
    • 1x Kue Lapis - Rp 40.000
    
    Total: Rp 115.000
    
    Mau tambah yang lain atau ketik 'konfirmasi pesanan' untuk checkout?"

User: "Konfirmasi pesanan"
AI: [panggil confirm_order → create_order API]
    "✅ Pesanan berhasil dibuat!
    Nomor: ORD003
    Total: Rp 115.000
    
    Terima kasih sudah berbelanja di Bakery PoS! 🧁"
```

## Komponen Sistem

### 1. Session Store (`src/chatbot/sessionStore.js`)
In-memory storage untuk:
- **Cart**: Array of `{product_name, quantity, price}`
- **History**: Array of `{role, content}` untuk conversation context
- **Session timeout**: 30 menit auto-expire

**API:**
```javascript
sessionStore.addToCart(sessionId, productName, quantity, price)
sessionStore.removeFromCart(sessionId, productName)
sessionStore.getCart(sessionId)
sessionStore.clearCart(sessionId)
sessionStore.addMessage(sessionId, role, content)
sessionStore.getHistory(sessionId)
sessionStore.clearSession(sessionId)
```

### 2. Controller Update (`src/chatbot/controllers/ollamaChatbotController.js`)
**Perubahan:**
- Sekarang mengirim **full conversation history + cart state** ke Python service
- Handle cart actions dari Python (add/remove/clear)
- Format respons dengan cart info
- Strip markdown untuk plain text display

**Flow:**
```
1. Terima user message
2. Simpan ke history
3. Ambil cart + history dari session store  
4. Kirim ke Python: {messages: [...], cart: [...], session_id}
5. Terima response + cart_action dari Python
6. Update cart di session store
7. Simpan AI response ke history
8. Return response + updated cart ke frontend
```

### 3. Python Tools Update (`python-chatbot/tools/bakery_tools.py`)
**Tools LAMA:**
- `get_menu()` ✅ Tetap
- `check_availability()` ✅ Tetap
- `create_order()` ❌ Dihapus

**Tools BARU:**
- `get_menu()` - Get daftar produk
- `check_availability(product_name, quantity)` - Cek stock
- `add_to_cart(product_name, quantity)` - Tambah item ke cart (validasi product exists)
- `view_cart()` - Lihat isi keranjang
- `remove_from_cart(product_name)` - Hapus item dari cart
- `confirm_order(customer_name)` - Konfirmasi dan buat order dari cart

**Note:** Tools return `cart_action` signals yang di-handle oleh Node.js controller untuk update session state.

### 4. Python Chain Update (`python-chatbot/chains/chatbot_chain.py`)
**Perubahan:**
- Menerima `cart` dan `messages` dari Node.js
- Include **current cart contents** dalam AI prompts
- AI tahu apa yang sudah ada di keranjang
- `confirm_order` tool → langsung panggil create_order API jika cart tidak kosong
- Return `cart_action` untuk update session state

**Prompt updates:**
```python
FUNCTION_DETECTION_PROMPT = """
...
CURRENT CART: {cart_info}

RULES:
1. "pesan/beli/mau" → add_to_cart(), BUKAN confirm_order()
2. "konfirmasi/checkout/jadi" → confirm_order()
...
"""

DIALOG_GENERATION_PROMPT = """
...
STATUS KERANJANG SAAT INI: {cart_info}

- Jika item ditambahkan: konfirmasi + tunjukkan cart + tanya mau tambah atau konfirmasi
...
"""
```

## API Endpoints

### POST /api/ollama-chat/chat
**Request:**
```json
{
  "sessionId": "session_1234_abcd",
  "message": "saya mau pesan 1 red velvet"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "response": "1x Red Velvet Cake ditambahkan ke keranjang!\n...",
    "toolUsed": true,
    "cart": [
      {
        "product_name": "Red Velvet Cake",
        "quantity": 1,
        "price": "75000"
      }
    ]
  }
}
```

### GET /api/ollama-chat/cart/:sessionId
Get current cart contents.

### POST /api/ollama-chat/clear-session
Clear session history and cart.

## Session Management

- **Storage**: In-memory (production: ganti dengan Redis/database)
- **Timeout**: 30 menit inactivity
- **Cleanup**: Auto cleanup setiap 5 menit
- **Session ID**: Generated di frontend (format: `session_<timestamp>_<random>`)

## Testing Flow

### Test 1: Multi-item order
```
1. "lihat menu" 
   → Shows all products
   
2. "saya mau pesan 1 brownies cokelat"
   → "1x Brownies Cokelat ditambahkan..."
   → Cart: [Brownies Cokelat x1]
   
3. "tambah 2 red velvet juga"
   → "2x Red Velvet Cake ditambahkan..."
   → Cart: [Brownies Cokelat x1, Red Velvet Cake x2]
   
4. "lihat keranjang"
   → Shows full cart with total
   
5. "konfirmasi pesanan"
   → Order created with all 3 items
   → Cart cleared
```

### Test 2: Remove item
```
1. "pesan 1 red velvet dan 1 brownies"
   → Cart: [Red Velvet x1, Brownies x1]
   
2. "hapus brownies"
   → Cart: [Red Velvet x1]
   
3. "konfirmasi"
   → Order created with just Red Velvet
```

### Test 3: Cart state persistence
```
1. "pesan 1 kue lapis"
   → Cart: [Kue Lapis x1]
   
2. "berapa harga cheese cake?"
   → AI masih ingat cart ada Kue Lapis
   → Answers question
   
3. "oke tambah cheese cake juga"
   → Cart: [Kue Lapis x1, Cheese Cake x1]
```

## Production Recommendations

1. **Replace in-memory session store** dengan Redis:
   ```javascript
   const redis = require('redis');
   const client = redis.createClient();
   ```

2. **Add session persistence** ke database untuk audit trail

3. **Add cart expiry notifications** to frontend

4. **Implement customer email collection** sebelum confirm (saat ini hardcoded "guest@bakery.com")

5. **Add cart validation** before confirm (cek stock availability lagi)

## Files Modified

- ✅ `src/chatbot/sessionStore.js` (NEW)
- ✅ `src/chatbot/controllers/ollamaChatbotController.js` (MAJOR REWRITE)
- ✅ `src/chatbot/routes/ollamaChatbot.js` (Added cart endpoint)
- ✅ `python-chatbot/tools/bakery_tools.py` (Changed tools)
- ✅ `python-chatbot/chains/chatbot_chain.py` (Cart-aware chain)

## Restart Services

Setelah perubahan ini, restart kedua services:

```bash
# Terminal 1: Node.js backend
npm run dev

# Terminal 2: Python chatbot service  
npm run dev:python
```

## Troubleshooting

**Q: Cart tidak tersimpan antar pesan?**
A: Pastikan `sessionId` yang sama digunakan untuk semua pesan dalam satu conversation. Frontend harus save sessionId ke sessionStorage.

**Q: Order langsung dibuat tanpa konfirmasi?**
A: Cek prompts - pastikan model tidak salah detect "pesan" sebagai "konfirmasi". Kata kunci konfirmasi: "konfirmasi", "checkout", "jadi", "oke lanjut".

**Q: Cart tidak clear setelah order dibuat?**
A: Python chain mengirim `cart_action: {type: "clear"}` setelah confirm_order success. Cek logs untuk cart_action di Node.js.

---

**Status**: ✅ Ready to test
**Next**: Restart services dan test dengan scenario di atas
