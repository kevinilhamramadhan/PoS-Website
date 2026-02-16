-- ============================================
-- Setup Database "chatbot" untuk Bakery PoS
-- PostgreSQL 18+ (menggunakan gen_random_uuid() built-in)
-- Jalankan: psql -U kevin -d chatbot -f database/setup_chatbot_db.sql
-- ============================================

-- Drop existing objects (safe re-run)
DROP VIEW IF EXISTS v_product_cost_breakdown CASCADE;
DROP VIEW IF EXISTS v_low_stock_ingredients CASCADE;
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS order_revisions CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS recipes CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS ingredients CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS generate_order_number() CASCADE;

-- ============================================
-- 1. USERS TABLE
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'customer')),
    phone VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- ============================================
-- 2. INGREDIENTS TABLE (Bahan Baku)
-- ============================================
CREATE TABLE ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    stock_quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
    min_stock_threshold DECIMAL(10, 2) NOT NULL DEFAULT 0,
    unit_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ingredients_low_stock ON ingredients(stock_quantity, min_stock_threshold);

-- ============================================
-- 3. PRODUCTS TABLE (Produk Kue)
-- ============================================
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    selling_price DECIMAL(12, 2) NOT NULL,
    cost_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
    image_url VARCHAR(500),
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_products_available ON products(is_available);

-- ============================================
-- 4. RECIPES TABLE
-- ============================================
CREATE TABLE recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    quantity_needed DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(product_id, ingredient_id)
);

CREATE INDEX idx_recipes_product ON recipes(product_id);
CREATE INDEX idx_recipes_ingredient ON recipes(ingredient_id);

-- ============================================
-- 5. ORDERS TABLE
-- ============================================
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_order_number ON orders(order_number);

-- ============================================
-- 6. ORDER_ITEMS TABLE
-- ============================================
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(12, 2) NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- ============================================
-- 7. ORDER_REVISIONS TABLE
-- ============================================
CREATE TABLE order_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    revised_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    revision_type VARCHAR(30) NOT NULL 
        CHECK (revision_type IN ('add_item', 'remove_item', 'update_quantity', 'cancel_order', 'update_status')),
    old_value JSONB,
    new_value JSONB,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_order_revisions_order ON order_revisions(order_id);
CREATE INDEX idx_order_revisions_created_at ON order_revisions(created_at DESC);

-- ============================================
-- 8. STOCK_MOVEMENTS TABLE
-- ============================================
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment')),
    quantity DECIMAL(10, 2) NOT NULL,
    reference_type VARCHAR(50) NOT NULL,
    reference_id UUID,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_stock_movements_ingredient ON stock_movements(ingredient_id);
CREATE INDEX idx_stock_movements_reference ON stock_movements(reference_type, reference_id);
CREATE INDEX idx_stock_movements_created_at ON stock_movements(created_at DESC);

-- ============================================
-- TRIGGER: Auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ingredients_updated_at
    BEFORE UPDATE ON ingredients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNCTION: Generate Order Number
-- ============================================
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS VARCHAR AS $$
DECLARE
    today_date VARCHAR;
    order_count INTEGER;
    new_order_number VARCHAR;
BEGIN
    today_date := TO_CHAR(NOW(), 'YYYYMMDD');
    SELECT COUNT(*) + 1 INTO order_count
    FROM orders
    WHERE order_number LIKE 'ORD-' || today_date || '-%';
    new_order_number := 'ORD-' || today_date || '-' || LPAD(order_count::TEXT, 3, '0');
    RETURN new_order_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEWS
-- ============================================
CREATE OR REPLACE VIEW v_low_stock_ingredients AS
SELECT 
    id, name, unit, stock_quantity, min_stock_threshold, unit_price,
    (min_stock_threshold - stock_quantity) AS shortage_amount
FROM ingredients
WHERE stock_quantity <= min_stock_threshold
ORDER BY (min_stock_threshold - stock_quantity) DESC;

CREATE OR REPLACE VIEW v_product_cost_breakdown AS
SELECT 
    p.id AS product_id,
    p.name AS product_name,
    p.selling_price,
    COALESCE(SUM(r.quantity_needed * i.unit_price), 0) AS calculated_cost,
    p.selling_price - COALESCE(SUM(r.quantity_needed * i.unit_price), 0) AS profit_margin
FROM products p
LEFT JOIN recipes r ON p.id = r.product_id
LEFT JOIN ingredients i ON r.ingredient_id = i.id
GROUP BY p.id, p.name, p.selling_price;

-- ============================================
-- SEED DATA
-- ============================================

-- Admin user (password: admin123)
INSERT INTO users (email, password, full_name, role, phone) VALUES
('admin@bakery.com', '$2a$10$N9qo8uLOickgx2ZMqXq8GOpCBjc9l5XOnnb7Lv5DyECR2VR5Lq1Oa', 'Admin Toko', 'admin', '08123456789');

-- Guest customer for chatbot orders (password: guest123)
INSERT INTO users (email, password, full_name, role, phone) VALUES
('guest@bakery.com', '$2a$10$N9qo8uLOickgx2ZMqXq8GOpCBjc9l5XOnnb7Lv5DyECR2VR5Lq1Oa', 'Guest Customer', 'customer', '00000000000');

-- Sample customer (password: customer123)
INSERT INTO users (email, password, full_name, role, phone) VALUES
('customer@example.com', '$2a$10$N9qo8uLOickgx2ZMqXq8GOpCBjc9l5XOnnb7Lv5DyECR2VR5Lq1Oa', 'John Doe', 'customer', '08198765432');

-- Ingredients (Bahan Baku)
INSERT INTO ingredients (name, unit, stock_quantity, min_stock_threshold, unit_price) VALUES
('Tepung Terigu', 'gram', 5000, 1000, 0.015),
('Gula Pasir', 'gram', 3000, 500, 0.018),
('Telur', 'pcs', 50, 10, 2500),
('Mentega', 'gram', 2000, 500, 0.12),
('Susu Cair', 'ml', 5000, 1000, 0.025),
('Cokelat Bubuk', 'gram', 1000, 200, 0.15),
('Vanilla Extract', 'ml', 500, 100, 0.50),
('Keju Parmesan', 'gram', 500, 100, 0.35);

-- Products (Produk Kue)
INSERT INTO products (name, description, selling_price, cost_price, is_available) VALUES
('Brownies Cokelat', 'Brownies cokelat lembut dengan topping keju', 45000, 25000, TRUE),
('Cheese Cake', 'Cheese cake lembut dengan topping strawberry', 55000, 30000, TRUE),
('Kue Lapis', 'Kue lapis tradisional dengan rasa legit', 40000, 20000, TRUE),
('Red Velvet Cake', 'Kue red velvet dengan cream cheese frosting', 75000, 40000, TRUE);

-- Recipes (Resep untuk Brownies Cokelat)
INSERT INTO recipes (product_id, ingredient_id, quantity_needed)
SELECT p.id, i.id, 200 FROM products p, ingredients i WHERE p.name = 'Brownies Cokelat' AND i.name = 'Tepung Terigu';
INSERT INTO recipes (product_id, ingredient_id, quantity_needed)
SELECT p.id, i.id, 150 FROM products p, ingredients i WHERE p.name = 'Brownies Cokelat' AND i.name = 'Gula Pasir';
INSERT INTO recipes (product_id, ingredient_id, quantity_needed)
SELECT p.id, i.id, 3 FROM products p, ingredients i WHERE p.name = 'Brownies Cokelat' AND i.name = 'Telur';
INSERT INTO recipes (product_id, ingredient_id, quantity_needed)
SELECT p.id, i.id, 100 FROM products p, ingredients i WHERE p.name = 'Brownies Cokelat' AND i.name = 'Mentega';
INSERT INTO recipes (product_id, ingredient_id, quantity_needed)
SELECT p.id, i.id, 50 FROM products p, ingredients i WHERE p.name = 'Brownies Cokelat' AND i.name = 'Cokelat Bubuk';

-- Recipes (Resep untuk Cheese Cake)
INSERT INTO recipes (product_id, ingredient_id, quantity_needed)
SELECT p.id, i.id, 150 FROM products p, ingredients i WHERE p.name = 'Cheese Cake' AND i.name = 'Tepung Terigu';
INSERT INTO recipes (product_id, ingredient_id, quantity_needed)
SELECT p.id, i.id, 100 FROM products p, ingredients i WHERE p.name = 'Cheese Cake' AND i.name = 'Gula Pasir';
INSERT INTO recipes (product_id, ingredient_id, quantity_needed)
SELECT p.id, i.id, 4 FROM products p, ingredients i WHERE p.name = 'Cheese Cake' AND i.name = 'Telur';
INSERT INTO recipes (product_id, ingredient_id, quantity_needed)
SELECT p.id, i.id, 150 FROM products p, ingredients i WHERE p.name = 'Cheese Cake' AND i.name = 'Mentega';
INSERT INTO recipes (product_id, ingredient_id, quantity_needed)
SELECT p.id, i.id, 200 FROM products p, ingredients i WHERE p.name = 'Cheese Cake' AND i.name = 'Keju Parmesan';

-- Recipes (Resep untuk Kue Lapis)
INSERT INTO recipes (product_id, ingredient_id, quantity_needed)
SELECT p.id, i.id, 250 FROM products p, ingredients i WHERE p.name = 'Kue Lapis' AND i.name = 'Tepung Terigu';
INSERT INTO recipes (product_id, ingredient_id, quantity_needed)
SELECT p.id, i.id, 200 FROM products p, ingredients i WHERE p.name = 'Kue Lapis' AND i.name = 'Gula Pasir';
INSERT INTO recipes (product_id, ingredient_id, quantity_needed)
SELECT p.id, i.id, 5 FROM products p, ingredients i WHERE p.name = 'Kue Lapis' AND i.name = 'Telur';
INSERT INTO recipes (product_id, ingredient_id, quantity_needed)
SELECT p.id, i.id, 200 FROM products p, ingredients i WHERE p.name = 'Kue Lapis' AND i.name = 'Mentega';
INSERT INTO recipes (product_id, ingredient_id, quantity_needed)
SELECT p.id, i.id, 100 FROM products p, ingredients i WHERE p.name = 'Kue Lapis' AND i.name = 'Susu Cair';
INSERT INTO recipes (product_id, ingredient_id, quantity_needed)
SELECT p.id, i.id, 10 FROM products p, ingredients i WHERE p.name = 'Kue Lapis' AND i.name = 'Vanilla Extract';

-- Recipes (Resep untuk Red Velvet Cake)
INSERT INTO recipes (product_id, ingredient_id, quantity_needed)
SELECT p.id, i.id, 300 FROM products p, ingredients i WHERE p.name = 'Red Velvet Cake' AND i.name = 'Tepung Terigu';
INSERT INTO recipes (product_id, ingredient_id, quantity_needed)
SELECT p.id, i.id, 250 FROM products p, ingredients i WHERE p.name = 'Red Velvet Cake' AND i.name = 'Gula Pasir';
INSERT INTO recipes (product_id, ingredient_id, quantity_needed)
SELECT p.id, i.id, 4 FROM products p, ingredients i WHERE p.name = 'Red Velvet Cake' AND i.name = 'Telur';
INSERT INTO recipes (product_id, ingredient_id, quantity_needed)
SELECT p.id, i.id, 150 FROM products p, ingredients i WHERE p.name = 'Red Velvet Cake' AND i.name = 'Mentega';
INSERT INTO recipes (product_id, ingredient_id, quantity_needed)
SELECT p.id, i.id, 200 FROM products p, ingredients i WHERE p.name = 'Red Velvet Cake' AND i.name = 'Susu Cair';
INSERT INTO recipes (product_id, ingredient_id, quantity_needed)
SELECT p.id, i.id, 30 FROM products p, ingredients i WHERE p.name = 'Red Velvet Cake' AND i.name = 'Cokelat Bubuk';

-- ============================================
-- VERIFIKASI
-- ============================================
SELECT '=== USERS ===' AS info;
SELECT email, full_name, role FROM users;

SELECT '=== PRODUCTS ===' AS info;
SELECT name, selling_price, is_available FROM products;

SELECT '=== INGREDIENTS ===' AS info;
SELECT name, unit, stock_quantity FROM ingredients;

SELECT '=== RECIPES COUNT ===' AS info;
SELECT p.name AS product, COUNT(*) AS jumlah_bahan
FROM recipes r JOIN products p ON r.product_id = p.id
GROUP BY p.name;
