-- ============================================
-- Point of Sale (PoS) Database Schema
-- For Bakery Shop Application
-- Database: Supabase (PostgreSQL)
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. USERS TABLE
-- Stores admin and customer accounts
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL, -- hashed with bcrypt
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'customer')),
    phone VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster email lookups during login
CREATE INDEX idx_users_email ON users(email);

-- ============================================
-- 2. INGREDIENTS TABLE (Bahan Baku)
-- Stores raw materials for making cakes
-- ============================================
CREATE TABLE ingredients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    unit VARCHAR(50) NOT NULL, -- gram, ml, pcs, etc.
    stock_quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
    min_stock_threshold DECIMAL(10, 2) NOT NULL DEFAULT 0, -- for low stock alerts
    unit_price DECIMAL(12, 2) NOT NULL DEFAULT 0, -- price per unit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for low stock queries
CREATE INDEX idx_ingredients_low_stock ON ingredients(stock_quantity, min_stock_threshold);

-- ============================================
-- 3. PRODUCTS TABLE (Produk Kue)
-- Stores cake products for sale
-- ============================================
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    selling_price DECIMAL(12, 2) NOT NULL,
    cost_price DECIMAL(12, 2) NOT NULL DEFAULT 0, -- auto-calculated from recipe
    image_url VARCHAR(500),
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for available products (commonly queried)
CREATE INDEX idx_products_available ON products(is_available);

-- ============================================
-- 4. RECIPES TABLE
-- Many-to-many relationship between products and ingredients
-- Defines how much of each ingredient is needed for a product
-- ============================================
CREATE TABLE recipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    quantity_needed DECIMAL(10, 2) NOT NULL, -- amount of ingredient needed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicate product-ingredient combinations
    UNIQUE(product_id, ingredient_id)
);

-- Indexes for faster recipe lookups
CREATE INDEX idx_recipes_product ON recipes(product_id);
CREATE INDEX idx_recipes_ingredient ON recipes(ingredient_id);

-- ============================================
-- 5. ORDERS TABLE
-- Customer orders
-- ============================================
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    order_number VARCHAR(50) UNIQUE NOT NULL, -- Format: ORD-YYYYMMDD-XXX
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for order queries
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_order_number ON orders(order_number);

-- ============================================
-- 6. ORDER_ITEMS TABLE
-- Individual items within an order
-- ============================================
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(12, 2) NOT NULL, -- price at time of order
    subtotal DECIMAL(12, 2) NOT NULL, -- quantity * unit_price
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for order item lookups
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- ============================================
-- 7. ORDER_REVISIONS TABLE
-- Tracks all changes made to orders
-- ============================================
CREATE TABLE order_revisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    revised_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    revision_type VARCHAR(30) NOT NULL 
        CHECK (revision_type IN ('add_item', 'remove_item', 'update_quantity', 'cancel_order', 'update_status')),
    old_value JSONB, -- previous state
    new_value JSONB, -- new state
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for revision history lookups
CREATE INDEX idx_order_revisions_order ON order_revisions(order_id);
CREATE INDEX idx_order_revisions_created_at ON order_revisions(created_at DESC);

-- ============================================
-- 8. STOCK_MOVEMENTS TABLE
-- Tracks all stock changes for ingredients
-- ============================================
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment')),
    quantity DECIMAL(10, 2) NOT NULL, -- positive for in, negative for out
    reference_type VARCHAR(50) NOT NULL, -- 'order', 'purchase', 'manual', 'order_cancel'
    reference_id UUID, -- ID of the related order/purchase
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for stock movement queries
CREATE INDEX idx_stock_movements_ingredient ON stock_movements(ingredient_id);
CREATE INDEX idx_stock_movements_reference ON stock_movements(reference_type, reference_id);
CREATE INDEX idx_stock_movements_created_at ON stock_movements(created_at DESC);

-- ============================================
-- TRIGGER FUNCTIONS
-- ============================================

-- Function to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at column
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ingredients_updated_at
    BEFORE UPDATE ON ingredients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER FUNCTION: Generate Order Number
-- Format: ORD-YYYYMMDD-XXX
-- ============================================
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS VARCHAR AS $$
DECLARE
    today_date VARCHAR;
    order_count INTEGER;
    new_order_number VARCHAR;
BEGIN
    today_date := TO_CHAR(NOW(), 'YYYYMMDD');
    
    -- Count orders created today
    SELECT COUNT(*) + 1 INTO order_count
    FROM orders
    WHERE order_number LIKE 'ORD-' || today_date || '-%';
    
    -- Generate order number with padded sequence
    new_order_number := 'ORD-' || today_date || '-' || LPAD(order_count::TEXT, 3, '0');
    
    RETURN new_order_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEW: Low Stock Ingredients
-- Quick access to ingredients below threshold
-- ============================================
CREATE OR REPLACE VIEW v_low_stock_ingredients AS
SELECT 
    id,
    name,
    unit,
    stock_quantity,
    min_stock_threshold,
    unit_price,
    (min_stock_threshold - stock_quantity) AS shortage_amount
FROM ingredients
WHERE stock_quantity <= min_stock_threshold
ORDER BY (min_stock_threshold - stock_quantity) DESC;

-- ============================================
-- VIEW: Product with Cost Breakdown
-- Shows product with calculated cost from recipe
-- ============================================
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
-- SAMPLE DATA (Optional - for testing)
-- Uncomment to insert sample data
-- ============================================

/*
-- Insert sample admin user (password: admin123)
INSERT INTO users (email, password, full_name, role, phone) VALUES
('admin@bakery.com', '$2a$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'Admin Toko', 'admin', '08123456789');

-- Insert sample customer (password: customer123)  
INSERT INTO users (email, password, full_name, role, phone) VALUES
('customer@example.com', '$2a$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'John Doe', 'customer', '08198765432');

-- Insert sample ingredients
INSERT INTO ingredients (name, unit, stock_quantity, min_stock_threshold, unit_price) VALUES
('Tepung Terigu', 'gram', 5000, 1000, 0.015),
('Gula Pasir', 'gram', 3000, 500, 0.018),
('Telur', 'pcs', 50, 10, 2500),
('Mentega', 'gram', 2000, 500, 0.12),
('Susu Cair', 'ml', 5000, 1000, 0.025),
('Cokelat Bubuk', 'gram', 1000, 200, 0.15),
('Vanilla Extract', 'ml', 500, 100, 0.50),
('Keju Parmesan', 'gram', 500, 100, 0.35);

-- Insert sample products
INSERT INTO products (name, description, selling_price, cost_price, is_available) VALUES
('Brownies Cokelat', 'Brownies cokelat lembut dengan topping keju', 45000, 25000, TRUE),
('Cheese Cake', 'Cheese cake lembut dengan topping strawberry', 55000, 30000, TRUE),
('Kue Lapis', 'Kue lapis tradisional dengan rasa legit', 40000, 20000, TRUE),
('Red Velvet Cake', 'Kue red velvet dengan cream cheese frosting', 75000, 40000, TRUE);

-- Insert sample recipes (for Brownies Cokelat)
-- Note: Run this after inserting products and ingredients
-- INSERT INTO recipes (product_id, ingredient_id, quantity_needed) VALUES
-- ((SELECT id FROM products WHERE name = 'Brownies Cokelat'), (SELECT id FROM ingredients WHERE name = 'Tepung Terigu'), 200),
-- ((SELECT id FROM products WHERE name = 'Brownies Cokelat'), (SELECT id FROM ingredients WHERE name = 'Gula Pasir'), 150),
-- ((SELECT id FROM products WHERE name = 'Brownies Cokelat'), (SELECT id FROM ingredients WHERE name = 'Telur'), 3),
-- ((SELECT id FROM products WHERE name = 'Brownies Cokelat'), (SELECT id FROM ingredients WHERE name = 'Mentega'), 100),
-- ((SELECT id FROM products WHERE name = 'Brownies Cokelat'), (SELECT id FROM ingredients WHERE name = 'Cokelat Bubuk'), 50);
*/

-- ============================================
-- ROW LEVEL SECURITY (RLS) - Optional
-- Enable for production environment
-- ============================================

/*
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- Example policies (customize based on your auth setup)
-- Allow all authenticated users to read products
CREATE POLICY "Products are viewable by everyone" ON products
    FOR SELECT USING (true);

-- Allow admins to manage products
CREATE POLICY "Admins can manage products" ON products
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Customers can only view their own orders
CREATE POLICY "Customers can view own orders" ON orders
    FOR SELECT USING (
        customer_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );
*/
