"""
Bakery Tools for LangChain Chatbot
Calls Node.js Backend API endpoints

Tools:
- get_menu: Get all available products
- check_availability: Check if a product is in stock
- add_to_cart: Add item to cart (managed by Node.js)
- view_cart: View current cart contents
- remove_from_cart: Remove item from cart
- confirm_order: Confirm and create the final order
"""

import json
import httpx
from langchain_core.tools import tool
from utils.config import config

# HTTP client for backend API
http_client = httpx.Client(
    base_url=config.NODEJS_BACKEND_URL,
    timeout=30.0
)


@tool
def get_menu() -> str:
    """Get the bakery menu with all available products and prices."""
    try:
        response = http_client.get("/api/chatbot/menu")
        data = response.json()

        if data.get("success"):
            menu = data["data"]["menu"]
            return json.dumps({
                "success": True,
                "menu": [
                    {"name": item["name"], "price": item["price"], "description": item.get("description", "")}
                    for item in menu
                ],
                "total_items": data["data"]["total_products"]
            }, ensure_ascii=False)
        else:
            return json.dumps({"success": False, "error": data.get("error", "Unknown error")})
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})


@tool
def check_availability(product_name: str, quantity: int = 1) -> str:
    """Check if a specific product is available and has enough ingredient stock.

    Args:
        product_name: Name of the product to check
        quantity: Number of units to check availability for
    """
    try:
        response = http_client.post("/api/chatbot/check-availability", json={
            "products": [{"product_name": product_name, "quantity": quantity}]
        })
        data = response.json()

        if data.get("success"):
            products = data["data"]["products"]
            if not products:
                return json.dumps({"success": True, "available": False, "message": f"Produk '{product_name}' tidak ditemukan"}, ensure_ascii=False)

            product = products[0]
            return json.dumps({
                "success": True,
                "available": product["available"],
                "product_name": product.get("product_name", product_name),
                "price": product.get("price"),
                "message": product.get("message", "")
            }, ensure_ascii=False)
        else:
            return json.dumps({"success": False, "error": data.get("error", "Unknown error")})
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})


@tool
def add_to_cart(product_name: str, quantity: int = 1) -> str:
    """Add a product to the customer's shopping cart. Use this when a customer wants to order something.
    The item will be added to their cart. They can add more items before confirming the order.

    Args:
        product_name: Name of the product to add
        quantity: Number of units to add (default: 1)
    """
    # First check if the product exists and get price
    try:
        response = http_client.get("/api/chatbot/menu")
        data = response.json()

        if data.get("success"):
            menu = data["data"]["menu"]
            # Find the product (case-insensitive partial match)
            found = None
            for item in menu:
                if product_name.lower() in item["name"].lower() or item["name"].lower() in product_name.lower():
                    found = item
                    break

            if not found:
                return json.dumps({
                    "success": False,
                    "error": f"Produk '{product_name}' tidak ditemukan di menu. Gunakan get_menu() untuk melihat menu."
                }, ensure_ascii=False)

            return json.dumps({
                "success": True,
                "cart_action": {
                    "type": "add",
                    "items": [{"product_name": found["name"], "quantity": quantity, "price": found["price"]}]
                },
                "message": f"{quantity}x {found['name']} (Rp {int(float(found['price'])):,}) ditambahkan ke keranjang.".replace(",", ".")
            }, ensure_ascii=False)
        else:
            return json.dumps({"success": False, "error": "Gagal mengambil menu"})
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})


@tool
def view_cart() -> str:
    """View the current contents of the customer's shopping cart.
    Use this when the customer asks what's in their cart or wants to review before ordering.
    """
    # Cart state is managed by Node.js; return a signal for the controller to handle
    return json.dumps({
        "success": True,
        "cart_updated": True,
        "message": "Menampilkan isi keranjang."
    }, ensure_ascii=False)


@tool
def remove_from_cart(product_name: str) -> str:
    """Remove a product from the customer's shopping cart.

    Args:
        product_name: Name of the product to remove
    """
    return json.dumps({
        "success": True,
        "cart_action": {
            "type": "remove",
            "items": [{"product_name": product_name}]
        },
        "message": f"{product_name} dihapus dari keranjang."
    }, ensure_ascii=False)


@tool
def confirm_order(customer_name: str = "Guest Customer") -> str:
    """Confirm and create the final order from the current cart contents.
    Only call this when the customer explicitly confirms they want to place the order.

    Args:
        customer_name: Name of the customer placing the order
    """
    # This is a signal - the actual order creation happens in Node.js controller
    # because it needs the cart data from session store
    return json.dumps({
        "success": True,
        "confirm_order": True,
        "customer_name": customer_name,
        "message": "Pesanan dikonfirmasi. Memproses order..."
    }, ensure_ascii=False)


# Export tools list for LangChain
bakery_tools = [get_menu, check_availability, add_to_cart, view_cart, remove_from_cart, confirm_order]
