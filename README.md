# Gurudatta Kirana and General Stores - Shop Management System

A dedicated, fast, and simple Shop Management and Billing (POS) System created for **Gurudatta Kirana and General Stores**.

Built with **Python Flask** and **SQLite3**, it requires zero database server setup, works completely offline, and features an Indian Kirana-focused interface with fast billing, thermal/A4 receipt printing, low-stock alerts, customer credit (Udhaar) tracking, and profit analytics.

---

## 🚀 Quick Start on Windows

### Option 1: 1-Click Startup (Recommended)
Simply double-click the **`run.bat`** file inside this folder.
- It will automatically check Python, install requirements, verify the database, and launch your web browser at `http://127.0.0.1:5000`.

### Option 2: Manual Terminal Startup
1. Open PowerShell or Command Prompt in this folder:
   ```powershell
   cd C:\Users\JAYASH\.gemini\antigravity\scratch\gurudatta-kirana-store
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Initialize the database and sample Kirana products:
   ```bash
   python database.py
   ```
4. Start the application:
   ```bash
   python app.py
   ```
5. Open `http://127.0.0.1:5000` in Google Chrome, Edge, or Firefox.

---

## 🌟 The 5 Core Features

### 1. Product Inventory
- **Full CRUD**: Add, edit, delete, and view products in your store.
- **Product Fields**: Product Name, Category (Flours, Oil, Spices, Pulses, Biscuits, Dairy, etc.), Unit (kg, packet, piece, liter, gram, bag), Purchase Price (cost), Selling Price, Stock Quantity, and Low Stock Alert threshold.
- **Profit Margin Tracking**: Automatically displays your gross profit margin (₹ and %) for every product in your store.

### 2. Fast POS Billing System
- **Speed-Optimized Screen**: Type product name or category, or click items from the visual catalog to add directly to the cart.
- **Keyboard Shortcuts**:
  - `F2` -> Instantly focuses the product search bar.
  - `F8` -> Clears the current cart.
  - `F9` -> Completes checkout and triggers the printable receipt.
- **Payment Modes**: Cash, UPI / QR, and Udhaar (Credit).
- **Automatic Stock Deduction**: Whenever a sale is completed, stock counts decrement automatically in a safe database transaction.
- **Printable Receipts**: Formatted with the store name **"Gurudatta Kirana and General Stores"**, itemized list, rate, quantity, discount, total, and footer *"Thank you! Visit again!"*. Works with standard A4 printers and 80mm/58mm thermal receipt printers.

### 3. Stock Management & Low-Stock Alerts
- **Real-Time Visual Alerts**: Low-stock items are highlighted with warnings. A dynamic red badge appears in the top navigation bar whenever items fall below their minimum alert level.
- **Quick Restocking**: Enter the restock quantity (+10, +50, etc.) and restock items with a single click without opening editing forms.

### 4. Customer Records & Udhaar (Credit) Ledger
- **Customer Profiles**: Store customer name, phone number, and address.
- **Udhaar Ledger**: Automatically logs credit purchases when a customer buys on credit.
- **Real-Time Balances**: Shows total credit balance in red (`Payment Due`) or green (`All Clear`).
- **Repayment Tracking**: Record cash or UPI debt repayments with timestamped ledger notes and update outstanding balances instantly.

### 5. Sales Reports & Profit Analytics
- **Sales KPI Cards**: View Today's Sales, Last 7 Days (Weekly), and Current Month revenue along with total bill counts.
- **Total Profit Estimation**: Calculates `SUM(Quantity * (Selling Price - Purchase Price)) - Discounts` across all sales to give you an accurate view of actual store earnings.
- **Top Best-Selling Items**: Ranked by quantity sold, total revenue, and profit generated.
- **Recent Invoices**: Browse past bills and re-print receipts at any time.

---

## 🗄️ Database Architecture & SQL Code

### SQLite Schema (Default, Ready to Use)
The database file `gurudatta_store.db` is stored locally in the project directory.

```sql
-- 1. Products Table
CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',
    unit TEXT NOT NULL DEFAULT 'packet',
    purchase_price REAL NOT NULL DEFAULT 0.0,
    selling_price REAL NOT NULL DEFAULT 0.0,
    stock_quantity REAL NOT NULL DEFAULT 0.0,
    min_stock_alert REAL NOT NULL DEFAULT 5.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Customers Table
CREATE TABLE customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Sales Bills Table
CREATE TABLE sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_no TEXT UNIQUE NOT NULL,
    customer_id INTEGER,
    subtotal REAL NOT NULL,
    discount REAL NOT NULL DEFAULT 0.0,
    total_amount REAL NOT NULL,
    payment_mode TEXT NOT NULL DEFAULT 'cash',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

-- 4. Sale Items Table
CREATE TABLE sale_items (
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

-- 5. Udhaar Credit Ledger
CREATE TABLE udhaar_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    sale_id INTEGER,
    entry_type TEXT NOT NULL, -- 'credit' or 'payment'
    amount REAL NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL
);
```

### MySQL Equivalent (If Migrating to MySQL in Future)
If you ever want to connect multiple cash counters over a LAN to a central MySQL database server:

```sql
CREATE DATABASE IF NOT EXISTS gurudatta_store CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE gurudatta_store;

CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'General',
    unit VARCHAR(50) NOT NULL DEFAULT 'packet',
    purchase_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    selling_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    stock_quantity DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    min_stock_alert DECIMAL(10,2) NOT NULL DEFAULT 5.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_prod_name (name),
    INDEX idx_prod_cat (category)
);

CREATE TABLE customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_cust_phone (phone)
);

CREATE TABLE sales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_no VARCHAR(50) UNIQUE NOT NULL,
    customer_id INT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    discount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(10,2) NOT NULL,
    payment_mode ENUM('cash', 'upi', 'credit') NOT NULL DEFAULT 'cash',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    INDEX idx_sales_inv (invoice_no),
    INDEX idx_sales_created (created_at)
);

CREATE TABLE sale_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sale_id INT NOT NULL,
    product_id INT NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    purchase_price DECIMAL(10,2) NOT NULL,
    selling_price DECIMAL(10,2) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    item_total DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE udhaar_ledger (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    sale_id INT NULL,
    entry_type ENUM('credit', 'payment') NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    notes VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL
);
```

---

## 🖨️ Receipt & Thermal Printing Tips
- In the browser print preview dialog (press `Ctrl + P` or click **Print Bill**):
  - **Paper size**: Select **80mm Roll** or **58mm Roll** (for thermal POS printers) or **A4** (for standard inkjet/laser printers).
  - **Margins**: Set to **None** or **Minimum** for best thermal alignment.
  - **Options**: Uncheck "Headers and footers" to remove browser URL/date stamps from the receipt.
