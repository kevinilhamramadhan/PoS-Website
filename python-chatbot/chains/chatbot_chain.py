"""
Hybrid Chatbot Chain with LangChain
Cart-aware chatbot with conversation history

Flow:
1. User input → Model detects if tools are needed
2. If tools needed → Execute tools → Format response naturally
3. If no tools → Generate natural dialog response
4. Cart state is passed from Node.js and included in context

Uses LangChain components:
- ChatOllama for Ollama integration
- Tool binding and execution
- Message history management
- Cart state management
"""

import json
import httpx
from typing import Dict, List, Any
from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough, RunnableLambda
from tools.bakery_tools import bakery_tools
from utils.config import config

# Initialize model
gemma_model = ChatOllama(
    model=config.DIALOG_MODEL,
    base_url=config.OLLAMA_BASE_URL,
    temperature=0.1,
)

# Bind tools to model
gemma_with_tools = gemma_model.bind_tools(bakery_tools)

FUNCTION_DETECTION_PROMPT = """You are a TOOL CALLER for a bakery shop chatbot. You CALL TOOLS based on user intent.

Available tools:
- get_menu(): Get the list of available products and prices
- check_availability(product_name, quantity): Check if a product is in stock
- add_to_cart(product_name, quantity): Add item to cart when customer wants to order
- view_cart(): Show current cart contents
- remove_from_cart(product_name): Remove item from cart
- confirm_order(customer_name): Create the final order from cart

CURRENT CART: {cart_info}

RULES:
1. "menu", "lihat menu", "apa saja", "daftar produk" → get_menu()
2. "pesan", "beli", "order", "mau X", "tambah X" → add_to_cart(product_name, quantity)
3. "hapus", "batal item", "remove" → remove_from_cart(product_name)
4. "lihat keranjang", "cart", "isi pesanan" → view_cart()
5. "konfirmasi", "checkout", "selesai pesan", "ok pesan", "jadi" → confirm_order()
6. "ada", "tersedia", "stock" → check_availability(product_name)
7. JIKA user mau pesan tapi tidak bilang konfirmasi → add_to_cart(), BUKAN confirm_order()
8. confirm_order() HANYA dipanggil jika user sudah EKSPLISIT bilang konfirmasi/checkout/jadi

DO NOT respond with text. CALL THE TOOL."""

DIALOG_GENERATION_PROMPT = """Anda adalah asisten toko kue "Bakery PoS" yang ramah dan profesional.

TUGAS: Baca "Tool results" dan buat respons natural untuk customer.

STATUS KERANJANG SAAT INI: {cart_info}

ATURAN:
- Gunakan bahasa yang sama dengan customer
- Format harga: Rp XX.XXX
- JANGAN gunakan markdown (**, *, _, #). Teks biasa saja.
- Jika ada menu: tampilkan dalam format bullet point (gunakan karakter •)
- Jika item ditambahkan ke keranjang: konfirmasi item yang ditambahkan, lalu tunjukkan isi keranjang saat ini, dan tanya "Mau tambah yang lain atau konfirmasi pesanan?"
- Jika keranjang ditampilkan: tunjukkan semua item dengan harga dan total
- Jika order dikonfirmasi: tampilkan detail order dan ucapkan terima kasih
- JANGAN langsung buat order saat user bilang "mau pesan". Tambahkan ke keranjang dulu.

CONTOH respons setelah add_to_cart:
"1x Red Velvet Cake ditambahkan ke keranjang!

Keranjang Anda:
• 1x Red Velvet Cake - Rp 75.000

Total: Rp 75.000

Mau tambah yang lain atau ketik 'konfirmasi pesanan' untuk checkout?"

PENTING: JANGAN memberikan respons kosong."""


class HybridChatbotChain:
    """Hybrid chain with cart awareness"""
    
    def __init__(self):
        self.model_with_tools = gemma_with_tools
        self.dialog_model = gemma_model
        
    def invoke(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process user input through hybrid chain
        
        Args:
            inputs: Dict with 'messages', 'cart', 'session_id' keys
            
        Returns:
            Dict with 'output', 'tool_used', 'tool_results', 'cart_action' keys
        """
        messages = inputs.get("messages", [])
        cart = inputs.get("cart", [])
        session_id = inputs.get("session_id", "")
        
        if not messages:
            return {"output": "Maaf, tidak ada pesan yang diterima."}
        
        # Get the latest user message
        user_message = messages[-1].get("content", "") if isinstance(messages[-1], dict) else str(messages[-1])
        
        # Build conversation history for context
        history = self._build_history(messages[:-1])
        
        # Format cart info for prompts
        cart_info = self._format_cart_info(cart)
        
        # Step 1: Use model to detect if tools are needed
        detection_prompt = FUNCTION_DETECTION_PROMPT.format(cart_info=cart_info)
        detection_messages = [
            SystemMessage(content=detection_prompt),
            *history,
            HumanMessage(content=user_message)
        ]
        
        function_response = self.model_with_tools.invoke(detection_messages)
        
        # Step 2: Check if tools were called
        if hasattr(function_response, 'tool_calls') and function_response.tool_calls:
            # Execute tools
            tool_results = self._execute_tools(function_response.tool_calls)
            
            # Extract cart actions from tool results
            cart_action = self._extract_cart_action(tool_results)
            
            # Check if this is a confirm_order action
            confirm_order_data = self._check_confirm_order(tool_results, cart)
            if confirm_order_data:
                # Actually create the order via API
                order_result = self._create_order(cart, confirm_order_data.get("customer_name", "Guest Customer"))
                if order_result:
                    tool_results.append({
                        "tool": "create_order_actual",
                        "success": True,
                        "data": order_result
                    })
                    cart_action = {"type": "clear"}
            
            # Update cart_info with any additions from this turn
            updated_cart_info = cart_info
            if cart_action and cart_action.get("type") == "add":
                # Build what the cart will look like after the action
                updated_cart = list(cart)
                for item in cart_action.get("items", []):
                    existing = next((c for c in updated_cart if c.get("product_name", "").lower() == item["product_name"].lower()), None)
                    if existing:
                        existing["quantity"] = existing.get("quantity", 1) + item.get("quantity", 1)
                        if item.get("price"):
                            existing["price"] = item["price"]
                    else:
                        updated_cart.append(item)
                updated_cart_info = self._format_cart_info(updated_cart)
            
            # Step 3: Format response
            dialog_prompt = DIALOG_GENERATION_PROMPT.format(cart_info=updated_cart_info)
            dialog_messages = [
                SystemMessage(content=dialog_prompt),
                *history,
                HumanMessage(content=user_message),
                AIMessage(content=f"Tool results: {json.dumps(tool_results, ensure_ascii=False)}")
            ]
            
            final_response = self.dialog_model.invoke(dialog_messages)
            
            return {
                "output": final_response.content,
                "tool_used": True,
                "tool_results": tool_results,
                "cart_action": cart_action
            }
        else:
            # No tools needed, natural dialog
            dialog_prompt = DIALOG_GENERATION_PROMPT.format(cart_info=cart_info)
            dialog_messages = [
                SystemMessage(content=dialog_prompt),
                *history,
                HumanMessage(content=user_message)
            ]
            
            final_response = self.dialog_model.invoke(dialog_messages)
            
            return {
                "output": final_response.content,
                "tool_used": False
            }
    
    def _format_cart_info(self, cart: List) -> str:
        """Format cart contents for inclusion in prompts"""
        if not cart:
            return "Kosong (belum ada item)"
        
        items = []
        total = 0
        for item in cart:
            qty = item.get("quantity", 1)
            name = item.get("product_name", "Unknown")
            price = item.get("price")
            line = f"• {qty}x {name}"
            if price:
                subtotal = float(price) * qty
                total += subtotal
                line += f" - Rp {int(subtotal):,}".replace(",", ".")
            items.append(line)
        
        result = "\n".join(items)
        if total > 0:
            result += f"\nTotal: Rp {int(total):,}".replace(",", ".")
        return result
    
    def _build_history(self, messages: List) -> List:
        """Convert message history to LangChain message objects"""
        history = []
        for msg in messages:
            if isinstance(msg, dict):
                role = msg.get("role", "user")
                content = msg.get("content", "")
                
                if role == "user":
                    history.append(HumanMessage(content=content))
                elif role == "assistant":
                    history.append(AIMessage(content=content))
                elif role == "system":
                    history.append(SystemMessage(content=content))
            else:
                history.append(msg)
        
        # Limit history to last 10 messages to avoid context overflow
        return history[-10:]
    
    def _execute_tools(self, tool_calls: List) -> List[Dict[str, Any]]:
        """Execute tool calls and return results"""
        results = []
        
        for tool_call in tool_calls:
            tool_name = tool_call.get("name")
            tool_args = tool_call.get("args", {})
            
            # Find and execute the tool
            for tool in bakery_tools:
                if tool.name == tool_name:
                    try:
                        result = tool.invoke(tool_args)
                        result_data = json.loads(result) if isinstance(result, str) else result
                        results.append({
                            "tool": tool_name,
                            "success": True,
                            "data": result_data
                        })
                    except Exception as e:
                        results.append({
                            "tool": tool_name,
                            "success": False,
                            "error": str(e)
                        })
                    break
        
        return results
    
    def _extract_cart_action(self, tool_results: List[Dict]) -> dict | None:
        """Extract cart action from tool results"""
        for tr in tool_results:
            data = tr.get("data", {})
            if isinstance(data, dict) and "cart_action" in data:
                return data["cart_action"]
        return None
    
    def _check_confirm_order(self, tool_results: List[Dict], cart: List) -> dict | None:
        """Check if confirm_order tool was called"""
        for tr in tool_results:
            data = tr.get("data", {})
            if isinstance(data, dict) and data.get("confirm_order"):
                if not cart:
                    return None  # Can't confirm empty cart
                return data
        return None
    
    def _create_order(self, cart: List, customer_name: str) -> dict | None:
        """Actually create the order via Node.js backend API"""
        try:
            items = [{"product_name": item["product_name"], "quantity": item.get("quantity", 1)} for item in cart]
            payload = {
                "customer_email": "guest@bakery.com",
                "customer_name": customer_name,
                "items": items,
                "notes": f"Order by {customer_name} via chatbot"
            }
            
            response = httpx.Client(base_url=config.NODEJS_BACKEND_URL, timeout=30.0).post(
                "/api/chatbot/create-order", json=payload
            )
            data = response.json()
            
            if data.get("success"):
                order = data["data"]
                return {
                    "success": True,
                    "order": {
                        "order_number": order["order_number"],
                        "total_amount": order["total"],
                        "formatted_total": order["formatted_total"],
                        "items": order["items"]
                    },
                    "message": data.get("message", f"Pesanan berhasil! No: {order['order_number']}")
                }
            else:
                return {"success": False, "error": data.get("error", "Gagal membuat pesanan")}
        except Exception as e:
            return {"success": False, "error": str(e)}



# Create singleton instance
_chatbot_chain_impl = HybridChatbotChain()

# Wrap with RunnableLambda to make it compatible with LangServe
chatbot_chain = RunnableLambda(_chatbot_chain_impl.invoke)
