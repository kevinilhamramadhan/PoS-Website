# 🧁 Bakery Point of Sale (PoS) API

A complete Point of Sale system for bakery shops with robust API endpoints designed for chatbot integration.

## Tech Stack

- **Backend**: Node.js + Express.js (MVC architecture)
- **Frontend**: React + Vite
- **Database**: Supabase (PostgreSQL)
- **Authentication**: JWT-based

## Quick Start

### 1. Setup Database

Run the SQL migration in your Supabase SQL Editor:

```bash
# File: database/migrations.sql
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your Supabase credentials
```

### 3. Install & Run Backend

```bash
npm install
npm run dev
# Server runs on http://localhost:3000
```

### 4. Install & Run Frontend

```bash
cd client
npm install
npm run dev
# Frontend runs on http://localhost:5173
```

---

## API Endpoints

### Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Register new user | - |
| POST | `/api/auth/login` | Login & get JWT | - |
| GET | `/api/auth/me` | Get current user | ✅ |

### Products

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/products` | List all products | - |
| GET | `/api/products/:id` | Get product details | - |
| POST | `/api/products` | Create product | Admin |
| PUT | `/api/products/:id` | Update product | Admin |
| DELETE | `/api/products/:id` | Delete product | Admin |
| GET | `/api/products/:id/cost-breakdown` | Get cost breakdown | Admin |

### Ingredients

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/ingredients` | List all ingredients | ✅ |
| GET | `/api/ingredients/:id` | Get ingredient details | ✅ |
| POST | `/api/ingredients` | Create ingredient | Admin |
| PUT | `/api/ingredients/:id` | Update ingredient | Admin |
| DELETE | `/api/ingredients/:id` | Delete ingredient | Admin |
| GET | `/api/ingredients/low-stock` | Get low stock alerts | Admin |
| POST | `/api/ingredients/:id/adjust-stock` | Adjust stock | Admin |

### Recipes

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/recipes/product/:productId` | Get product recipe | Admin |
| POST | `/api/recipes` | Add recipe item | Admin |
| POST | `/api/recipes/bulk` | Bulk update recipe | Admin |
| DELETE | `/api/recipes/:id` | Delete recipe item | Admin |

### Orders

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/orders` | List orders | ✅ |
| GET | `/api/orders/:id` | Get order details | ✅ |
| POST | `/api/orders` | Create order | ✅ |
| PUT | `/api/orders/:id` | Update order | ✅ |
| PATCH | `/api/orders/:id/status` | Update status | Admin |
| DELETE | `/api/orders/:id` | Cancel order | ✅ |
| GET | `/api/orders/:id/revisions` | Get revision history | ✅ |

### Reports (Admin only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/dashboard` | Dashboard overview |
| GET | `/api/reports/sales-summary` | Sales summary |
| GET | `/api/reports/popular-products` | Best sellers |
| GET | `/api/reports/stock-alerts` | Low stock alerts |
| GET | `/api/reports/profit-margin` | Profit margins |

### Chatbot Integration

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chatbot/menu` | Get menu for chatbot |
| POST | `/api/chatbot/check-availability` | Check product availability |
| POST | `/api/chatbot/create-order` | Create order via chatbot |
| PUT | `/api/chatbot/update-order/:id` | Update order via chatbot |
| GET | `/api/chatbot/order-status/:id` | Get order status |

---

## API Examples

### Register User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@example.com",
    "password": "password123",
    "full_name": "John Doe",
    "phone": "08123456789"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Registrasi berhasil",
  "data": {
    "user": {
      "id": "uuid",
      "email": "customer@example.com",
      "full_name": "John Doe",
      "role": "customer"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@bakery.com",
    "password": "admin123"
  }'
```

### Create Product (Admin)

```bash
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "Brownies Cokelat",
    "description": "Brownies cokelat lembut",
    "selling_price": 45000,
    "is_available": true
  }'
```

### Create Ingredient (Admin)

```bash
curl -X POST http://localhost:3000/api/ingredients \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "Tepung Terigu",
    "unit": "gram",
    "stock_quantity": 5000,
    "min_stock_threshold": 1000,
    "unit_price": 0.015
  }'
```

### Add Recipe (Admin)

```bash
curl -X POST http://localhost:3000/api/recipes/bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "product_id": "<product_uuid>",
    "ingredients": [
      {"ingredient_id": "<ingredient_uuid>", "quantity_needed": 200},
      {"ingredient_id": "<ingredient_uuid>", "quantity_needed": 150}
    ]
  }'
```

### Create Order

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "items": [
      {"product_id": "<product_uuid>", "quantity": 2},
      {"product_id": "<product_uuid>", "quantity": 1}
    ],
    "notes": "Untuk ulang tahun"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Order berhasil dibuat",
  "data": {
    "order": {
      "id": "uuid",
      "order_number": "ORD-20240112-001",
      "total_amount": 120000,
      "status": "pending",
      "items": [...]
    }
  }
}
```

### Chatbot - Create Order

```bash
curl -X POST http://localhost:3000/api/chatbot/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "customer_email": "customer@example.com",
    "items": [
      {"product_name": "Brownies Cokelat", "quantity": 2},
      {"product_name": "Cheese Cake", "quantity": 1}
    ],
    "notes": "Order via chatbot"
  }'
```

### Adjust Stock (Admin)

```bash
curl -X POST http://localhost:3000/api/ingredients/<id>/adjust-stock \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "quantity": 1000,
    "movement_type": "in",
    "notes": "Pembelian stok"
  }'
```

---

## Business Logic

### Auto-Calculate Cost Price

When a recipe is added/updated, the product's `cost_price` is automatically recalculated:

```
cost_price = SUM(ingredient.unit_price × recipe.quantity_needed)
```

### Auto-Deduct Stock

When an order is created:
1. Check stock availability for all required ingredients
2. If insufficient, return error with details
3. Deduct stock from each ingredient
4. Record stock movements

### Stock Return on Cancel

When an order is cancelled:
1. Return stock for all ingredients
2. Record stock movements with reference

---

## Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Input validation failed |
| `UNAUTHORIZED` | No token or invalid token |
| `FORBIDDEN` | Insufficient role/permission |
| `NOT_FOUND` | Resource not found |
| `CONFLICT` | Duplicate entry |
| `INSUFFICIENT_STOCK` | Not enough stock |

---

## Project Structure

```
pos_website/
├── src/
│   ├── controllers/    # Request handlers
│   ├── models/         # Database operations
│   ├── routes/         # API routes
│   ├── services/       # Business logic
│   ├── middlewares/    # Auth, validation, errors
│   ├── utils/          # Helpers
│   └── app.js          # Express setup
├── client/             # React frontend
├── database/
│   └── migrations.sql  # Database schema
├── .env.example
├── package.json
└── README.md
```

---

## License

MIT
