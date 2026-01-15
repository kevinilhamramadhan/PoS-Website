# API Examples (cURL)

Complete collection of cURL commands for testing the Bakery PoS API.

## Setup

```bash
# Set your token after login
export TOKEN="your_jwt_token_here"
export BASE_URL="http://localhost:3000/api"
```

---

## Authentication

### Register Customer
```bash
curl -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@example.com",
    "password": "password123",
    "full_name": "John Doe",
    "phone": "08123456789"
  }'
```

### Register Admin (requires admin token)
```bash
curl -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "email": "admin@bakery.com",
    "password": "admin123",
    "full_name": "Admin",
    "role": "admin"
  }'
```

### Login
```bash
curl -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@bakery.com",
    "password": "admin123"
  }'
```

### Get Current User
```bash
curl $BASE_URL/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

---

## Products

### List Products
```bash
curl "$BASE_URL/products"
curl "$BASE_URL/products?available_only=true"
curl "$BASE_URL/products?search=brownies"
curl "$BASE_URL/products?page=1&limit=10"
```

### Get Product
```bash
curl $BASE_URL/products/{id}
```

### Create Product (Admin)
```bash
curl -X POST $BASE_URL/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Brownies Cokelat",
    "description": "Brownies cokelat lembut dengan topping keju",
    "selling_price": 45000,
    "image_url": "https://example.com/brownies.jpg",
    "is_available": true
  }'
```

### Update Product (Admin)
```bash
curl -X PUT $BASE_URL/products/{id} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "selling_price": 50000,
    "is_available": false
  }'
```

### Delete Product (Admin)
```bash
curl -X DELETE $BASE_URL/products/{id} \
  -H "Authorization: Bearer $TOKEN"
```

### Get Cost Breakdown (Admin)
```bash
curl $BASE_URL/products/{id}/cost-breakdown \
  -H "Authorization: Bearer $TOKEN"
```

---

## Ingredients

### List Ingredients
```bash
curl $BASE_URL/ingredients \
  -H "Authorization: Bearer $TOKEN"
```

### Get Low Stock
```bash
curl $BASE_URL/ingredients/low-stock \
  -H "Authorization: Bearer $TOKEN"
```

### Create Ingredient (Admin)
```bash
curl -X POST $BASE_URL/ingredients \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Tepung Terigu",
    "unit": "gram",
    "stock_quantity": 5000,
    "min_stock_threshold": 1000,
    "unit_price": 0.015
  }'
```

### Update Ingredient (Admin)
```bash
curl -X PUT $BASE_URL/ingredients/{id} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "stock_quantity": 6000,
    "unit_price": 0.018
  }'
```

### Adjust Stock (Admin)
```bash
# Stock In (purchase)
curl -X POST $BASE_URL/ingredients/{id}/adjust-stock \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "quantity": 1000,
    "movement_type": "in",
    "notes": "Pembelian dari supplier"
  }'

# Stock Out (manual usage)
curl -X POST $BASE_URL/ingredients/{id}/adjust-stock \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "quantity": 100,
    "movement_type": "out",
    "notes": "Penggunaan untuk testing"
  }'

# Adjustment (correction)
curl -X POST $BASE_URL/ingredients/{id}/adjust-stock \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "quantity": -50,
    "movement_type": "adjustment",
    "notes": "Koreksi stok setelah stock opname"
  }'
```

### Get Stock History
```bash
curl "$BASE_URL/ingredients/{id}/history?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Recipes

### Get Recipe for Product
```bash
curl $BASE_URL/recipes/product/{productId} \
  -H "Authorization: Bearer $TOKEN"
```

### Add Single Recipe Item
```bash
curl -X POST $BASE_URL/recipes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "product_id": "{product_id}",
    "ingredient_id": "{ingredient_id}",
    "quantity_needed": 200
  }'
```

### Bulk Update Recipe
```bash
curl -X POST $BASE_URL/recipes/bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "product_id": "{product_id}",
    "ingredients": [
      {"ingredient_id": "{id1}", "quantity_needed": 200},
      {"ingredient_id": "{id2}", "quantity_needed": 150},
      {"ingredient_id": "{id3}", "quantity_needed": 3}
    ]
  }'
```

### Delete Recipe Item
```bash
curl -X DELETE $BASE_URL/recipes/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

## Orders

### List Orders
```bash
# All orders (admin) or own orders (customer)
curl $BASE_URL/orders \
  -H "Authorization: Bearer $TOKEN"

# Filter by status
curl "$BASE_URL/orders?status=pending" \
  -H "Authorization: Bearer $TOKEN"
```

### Get Order
```bash
curl $BASE_URL/orders/{id} \
  -H "Authorization: Bearer $TOKEN"
```

### Create Order
```bash
curl -X POST $BASE_URL/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "items": [
      {"product_id": "{product_id_1}", "quantity": 2},
      {"product_id": "{product_id_2}", "quantity": 1}
    ],
    "notes": "Untuk ulang tahun, topping extra"
  }'
```

### Update Order
```bash
curl -X PUT $BASE_URL/orders/{id} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "items": [
      {"product_id": "{product_id}", "quantity": 3}
    ],
    "notes": "Updated notes"
  }'
```

### Update Order Status (Admin)
```bash
curl -X PATCH $BASE_URL/orders/{id}/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status": "processing"}'

curl -X PATCH $BASE_URL/orders/{id}/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status": "completed"}'
```

### Cancel Order
```bash
curl -X DELETE $BASE_URL/orders/{id} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"reason": "Customer request"}'
```

### Get Order Revisions
```bash
curl $BASE_URL/orders/{id}/revisions \
  -H "Authorization: Bearer $TOKEN"
```

---

## Reports (Admin)

### Dashboard
```bash
curl $BASE_URL/reports/dashboard \
  -H "Authorization: Bearer $TOKEN"
```

### Sales Summary
```bash
# Default (today, this week, this month)
curl $BASE_URL/reports/sales-summary \
  -H "Authorization: Bearer $TOKEN"

# Custom date range
curl "$BASE_URL/reports/sales-summary?start_date=2024-01-01&end_date=2024-01-31" \
  -H "Authorization: Bearer $TOKEN"
```

### Popular Products
```bash
curl "$BASE_URL/reports/popular-products?limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

### Stock Alerts
```bash
curl $BASE_URL/reports/stock-alerts \
  -H "Authorization: Bearer $TOKEN"
```

### Profit Margin
```bash
curl $BASE_URL/reports/profit-margin \
  -H "Authorization: Bearer $TOKEN"
```

---

## Chatbot Integration

### Get Menu
```bash
curl $BASE_URL/chatbot/menu
```

### Check Availability
```bash
curl -X POST $BASE_URL/chatbot/check-availability \
  -H "Content-Type: application/json" \
  -d '{
    "products": [
      {"product_name": "Brownies Cokelat", "quantity": 5},
      {"product_name": "Cheese Cake", "quantity": 2}
    ]
  }'
```

### Create Order via Chatbot
```bash
curl -X POST $BASE_URL/chatbot/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "customer_email": "customer@example.com",
    "items": [
      {"product_name": "Brownies Cokelat", "quantity": 2},
      {"product_name": "Cheese Cake", "quantity": 1}
    ],
    "notes": "Dipesan via chatbot"
  }'
```

### Update Order via Chatbot
```bash
curl -X PUT $BASE_URL/chatbot/update-order/{order_id} \
  -H "Content-Type: application/json" \
  -d '{
    "customer_email": "customer@example.com",
    "items": [
      {"product_name": "Brownies Cokelat", "quantity": 3}
    ]
  }'

# Cancel via chatbot
curl -X PUT $BASE_URL/chatbot/update-order/{order_id} \
  -H "Content-Type: application/json" \
  -d '{
    "customer_email": "customer@example.com",
    "action": "cancel",
    "notes": "Customer changed mind"
  }'
```

### Get Order Status
```bash
# By ID or order number
curl $BASE_URL/chatbot/order-status/ORD-20240112-001
```

### Get Customer Orders
```bash
curl "$BASE_URL/chatbot/customer-orders/customer@example.com?limit=5"
```

---

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { }
}
```

### Common Error Codes

- `VALIDATION_ERROR` - Invalid input
- `UNAUTHORIZED` - Missing or invalid token
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `CONFLICT` - Duplicate entry
- `INSUFFICIENT_STOCK` - Not enough stock
