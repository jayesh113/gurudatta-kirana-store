-- ==========================================================
-- GURUDATTA KIRANA AND GENERAL STORES - DATABASE SCHEMA
-- Compatible with SQLite 3 and easily adaptable to MySQL
-- ==========================================================

-- 1. Products Inventory Table
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',
    unit TEXT NOT NULL DEFAULT 'packet',  -- kg, g, packet, piece, liter, box
    purchase_price REAL NOT NULL DEFAULT 0.0,
    selling_price REAL NOT NULL DEFAULT 0.0,
    stock_quantity REAL NOT NULL DEFAULT 0.0,
    min_stock_alert REAL NOT NULL DEFAULT 5.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast product search by name and category
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- 2. Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- 3. Sales / Bills Table
CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_no TEXT UNIQUE NOT NULL,
    customer_id INTEGER,
    subtotal REAL NOT NULL,
    discount REAL NOT NULL DEFAULT 0.0,
    total_amount REAL NOT NULL,
    payment_mode TEXT NOT NULL DEFAULT 'cash', -- 'cash', 'upi', 'credit'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice_no);
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);

-- 4. Sale Items Table (Stores line items of each bill)
CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    unit TEXT NOT NULL,
    purchase_price REAL NOT NULL,
    selling_price REAL NOT NULL,
    quantity REAL NOT NULL,
    item_total REAL NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);

-- 5. Udhaar / Credit Ledger Table (Tracks debts and payments)
CREATE TABLE IF NOT EXISTS udhaar_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    sale_id INTEGER,
    entry_type TEXT NOT NULL, -- 'credit' (amount owed) or 'payment' (amount paid)
    amount REAL NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_udhaar_customer ON udhaar_ledger(customer_id);
