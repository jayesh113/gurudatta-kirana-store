import datetime
import sqlite3
import socket
import os
import json
from flask import Flask, render_template, request, jsonify, send_from_directory
from database import get_db, init_db

base_dir = os.path.dirname(os.path.abspath(__file__))
template_dir = os.path.join(base_dir, 'templates')
static_dir = os.path.join(base_dir, 'static')

app = Flask(__name__, template_folder=template_dir, static_folder=static_dir)

# Ensure tables exist
init_db()

@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

@app.route('/static/<path:filename>')
def serve_static(filename):
    return send_from_directory(static_dir, filename)

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

def dict_from_row(row):
    return dict(row) if row else None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/server-info', methods=['GET'])
def get_server_info():
    ip = get_local_ip()
    port = 5000
    return jsonify({
        "status": "success",
        "local_ip": ip,
        "port": port,
        "mobile_url": f"http://{ip}:{port}",
        "laptop_url": f"http://127.0.0.1:{port}"
    })

ADMIN_PIN = "1234"

@app.route('/api/admin/verify', methods=['POST'])
def verify_admin():
    data = request.json or {}
    pin = str(data.get('pin', '')).strip()
    if pin == ADMIN_PIN:
        return jsonify({"status": "success", "message": "Admin unlocked successfully", "is_admin": True})
    return jsonify({"status": "error", "message": "Incorrect Owner PIN (Default is 1234)"}), 401

@app.route('/api/admin/change-pin', methods=['POST'])
def change_admin_pin():
    global ADMIN_PIN
    data = request.json or {}
    current_pin = str(data.get('current_pin', '')).strip()
    new_pin = str(data.get('new_pin', '')).strip()
    if current_pin != ADMIN_PIN:
        return jsonify({"status": "error", "message": "Current PIN is incorrect"}), 400
    if len(new_pin) < 4:
        return jsonify({"status": "error", "message": "New PIN must be at least 4 digits"}), 400
    ADMIN_PIN = new_pin
    return jsonify({"status": "success", "message": "Owner PIN updated successfully"})

@app.route('/api/admin/export-data', methods=['GET'])
def export_data():
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM products")
        products = [dict_from_row(r) for r in cur.fetchall()]
        cur.execute("SELECT * FROM customers")
        customers = [dict_from_row(r) for r in cur.fetchall()]
    return jsonify({"status": "success", "products": products, "customers": customers})

@app.route('/api/admin/import-data', methods=['POST'])
def import_data():
    payload = request.json or {}
    products = payload.get('products', [])
    customers = payload.get('customers', [])
    
    with get_db() as conn:
        cur = conn.cursor()
        for p in products:
            if not p.get('name'):
                continue
            if p.get('id'):
                cur.execute("""
                    INSERT OR REPLACE INTO products (id, name, category, unit, purchase_price, selling_price, stock_quantity, min_stock_alert)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    p.get('id'), p.get('name'), p.get('category', 'General'), p.get('unit', 'packet'),
                    float(p.get('purchase_price', 0.0)), float(p.get('selling_price', 0.0)),
                    float(p.get('stock_quantity', 0.0)), float(p.get('min_stock_alert', 5.0))
                ))
            else:
                cur.execute("""
                    INSERT INTO products (name, category, unit, purchase_price, selling_price, stock_quantity, min_stock_alert)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    p.get('name'), p.get('category', 'General'), p.get('unit', 'packet'),
                    float(p.get('purchase_price', 0.0)), float(p.get('selling_price', 0.0)),
                    float(p.get('stock_quantity', 0.0)), float(p.get('min_stock_alert', 5.0))
                ))
        for c in customers:
            if not c.get('name'):
                continue
            if c.get('id'):
                cur.execute("""
                    INSERT OR REPLACE INTO customers (id, name, phone, address)
                    VALUES (?, ?, ?, ?)
                """, (c.get('id'), c.get('name'), c.get('phone'), c.get('address')))
            else:
                cur.execute("""
                    INSERT INTO customers (name, phone, address)
                    VALUES (?, ?, ?)
                """, (c.get('name'), c.get('phone'), c.get('address')))
        conn.commit()
    return jsonify({"status": "success", "message": f"Successfully synced {len(products)} products and {len(customers)} customers!"})

# ==========================================
# 1. PRODUCT INVENTORY APIs
# ==========================================

@app.route('/api/products', methods=['GET'])
def get_products():
    search = request.args.get('q', '').strip()
    category = request.args.get('category', '').strip()
    low_stock_only = request.args.get('low_stock', '').lower() == 'true'

    query = "SELECT * FROM products WHERE 1=1"
    params = []

    if search:
        query += " AND (name LIKE ? OR category LIKE ?)"
        wildcard = f"%{search}%"
        params.extend([wildcard, wildcard])

    if category and category != 'All':
        query += " AND category = ?"
        params.append(category)

    if low_stock_only:
        query += " AND stock_quantity <= min_stock_alert"

    query += " ORDER BY name ASC"

    with get_db() as conn:
        cursor = conn.execute(query, params)
        products = [dict(row) for row in cursor.fetchall()]

    return jsonify({"status": "success", "products": products})

@app.route('/api/products', methods=['POST'])
def add_product():
    data = request.json or {}
    name = data.get('name', '').strip()
    category = data.get('category', 'General').strip()
    unit = data.get('unit', 'packet').strip()
    
    try:
        purchase_price = float(data.get('purchase_price', 0))
        selling_price = float(data.get('selling_price', 0))
        stock_quantity = float(data.get('stock_quantity', 0))
        min_stock_alert = float(data.get('min_stock_alert', 5))
    except (ValueError, TypeError):
        return jsonify({"status": "error", "message": "Invalid numeric values provided"}), 400

    if not name:
        return jsonify({"status": "error", "message": "Product name is required"}), 400

    with get_db() as conn:
        cursor = conn.execute("""
            INSERT INTO products (name, category, unit, purchase_price, selling_price, stock_quantity, min_stock_alert)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (name, category, unit, purchase_price, selling_price, stock_quantity, min_stock_alert))
        conn.commit()
        new_id = cursor.lastrowid

    return jsonify({"status": "success", "message": "Product added successfully", "id": new_id}), 201

@app.route('/api/products/<int:product_id>', methods=['PUT'])
def update_product(product_id):
    data = request.json or {}
    name = data.get('name', '').strip()
    category = data.get('category', 'General').strip()
    unit = data.get('unit', 'packet').strip()

    try:
        purchase_price = float(data.get('purchase_price', 0))
        selling_price = float(data.get('selling_price', 0))
        stock_quantity = float(data.get('stock_quantity', 0))
        min_stock_alert = float(data.get('min_stock_alert', 5))
    except (ValueError, TypeError):
        return jsonify({"status": "error", "message": "Invalid numeric values provided"}), 400

    if not name:
        return jsonify({"status": "error", "message": "Product name is required"}), 400

    with get_db() as conn:
        conn.execute("""
            UPDATE products
            SET name = ?, category = ?, unit = ?, purchase_price = ?, selling_price = ?,
                stock_quantity = ?, min_stock_alert = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (name, category, unit, purchase_price, selling_price, stock_quantity, min_stock_alert, product_id))
        conn.commit()

    return jsonify({"status": "success", "message": "Product updated successfully"})

@app.route('/api/products/<int:product_id>', methods=['DELETE'])
def delete_product(product_id):
    with get_db() as conn:
        conn.execute("DELETE FROM products WHERE id = ?", (product_id,))
        conn.commit()
    return jsonify({"status": "success", "message": "Product deleted successfully"})

@app.route('/api/products/<int:product_id>/quick-stock', methods=['POST'])
def quick_restock(product_id):
    data = request.json or {}
    try:
        add_quantity = float(data.get('add_quantity', 0))
    except (ValueError, TypeError):
        return jsonify({"status": "error", "message": "Invalid quantity"}), 400

    if add_quantity <= 0:
        return jsonify({"status": "error", "message": "Quantity must be greater than 0"}), 400

    with get_db() as conn:
        conn.execute("""
            UPDATE products 
            SET stock_quantity = stock_quantity + ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        """, (add_quantity, product_id))
        conn.commit()

    return jsonify({"status": "success", "message": f"Added {add_quantity} to stock"})

# ==========================================
# 2. CUSTOMER & UDHAAR (CREDIT) APIs
# ==========================================

@app.route('/api/customers', methods=['GET'])
def get_customers():
    search = request.args.get('q', '').strip()
    query = """
        SELECT 
            c.id, c.name, c.phone, c.address, c.created_at,
            COALESCE(SUM(CASE WHEN u.entry_type = 'credit' THEN u.amount ELSE 0 END), 0) -
            COALESCE(SUM(CASE WHEN u.entry_type = 'payment' THEN u.amount ELSE 0 END), 0) AS udhaar_balance
        FROM customers c
        LEFT JOIN udhaar_ledger u ON c.id = u.customer_id
        WHERE 1=1
    """
    params = []
    if search:
        query += " AND (c.name LIKE ? OR c.phone LIKE ?)"
        wildcard = f"%{search}%"
        params.extend([wildcard, wildcard])

    query += " GROUP BY c.id ORDER BY c.name ASC"

    with get_db() as conn:
        cursor = conn.execute(query, params)
        customers = [dict(row) for row in cursor.fetchall()]

    return jsonify({"status": "success", "customers": customers})

@app.route('/api/customers', methods=['POST'])
def add_customer():
    data = request.json or {}
    name = data.get('name', '').strip()
    phone = data.get('phone', '').strip()
    address = data.get('address', '').strip()

    if not name:
        return jsonify({"status": "error", "message": "Customer name is required"}), 400

    with get_db() as conn:
        cursor = conn.execute("""
            INSERT INTO customers (name, phone, address)
            VALUES (?, ?, ?)
        """, (name, phone, address))
        conn.commit()
        customer_id = cursor.lastrowid

    return jsonify({"status": "success", "message": "Customer added", "id": customer_id}), 201

@app.route('/api/customers/<int:customer_id>', methods=['PUT'])
def update_customer(customer_id):
    data = request.json or {}
    name = data.get('name', '').strip()
    phone = data.get('phone', '').strip()
    address = data.get('address', '').strip()

    if not name:
        return jsonify({"status": "error", "message": "Customer name is required"}), 400

    with get_db() as conn:
        conn.execute("""
            UPDATE customers SET name = ?, phone = ?, address = ? WHERE id = ?
        """, (name, phone, address, customer_id))
        conn.commit()

    return jsonify({"status": "success", "message": "Customer details updated"})

@app.route('/api/customers/<int:customer_id>', methods=['DELETE'])
def delete_customer(customer_id):
    with get_db() as conn:
        conn.execute("DELETE FROM customers WHERE id = ?", (customer_id,))
        conn.commit()
    return jsonify({"status": "success", "message": "Customer deleted successfully"})

@app.route('/api/customers/<int:customer_id>/ledger', methods=['GET'])
def get_customer_ledger(customer_id):
    with get_db() as conn:
        # Customer Info
        cust_row = conn.execute("SELECT * FROM customers WHERE id = ?", (customer_id,)).fetchone()
        if not cust_row:
            return jsonify({"status": "error", "message": "Customer not found"}), 404

        customer = dict(cust_row)

        # Ledger entries
        ledger_cursor = conn.execute("""
            SELECT u.*, s.invoice_no
            FROM udhaar_ledger u
            LEFT JOIN sales s ON u.sale_id = s.id
            WHERE u.customer_id = ?
            ORDER BY u.created_at DESC
        """, (customer_id,))
        entries = [dict(row) for row in ledger_cursor.fetchall()]

        # Balance
        total_credit = sum(e['amount'] for e in entries if e['entry_type'] == 'credit')
        total_paid = sum(e['amount'] for e in entries if e['entry_type'] == 'payment')
        customer['total_credit'] = total_credit
        customer['total_paid'] = total_paid
        customer['balance'] = total_credit - total_paid

    return jsonify({"status": "success", "customer": customer, "entries": entries})

@app.route('/api/customers/<int:customer_id>/payment', methods=['POST'])
def record_udhaar_payment(customer_id):
    data = request.json or {}
    try:
        amount = float(data.get('amount', 0))
    except (ValueError, TypeError):
        return jsonify({"status": "error", "message": "Invalid payment amount"}), 400

    if amount <= 0:
        return jsonify({"status": "error", "message": "Amount must be greater than 0"}), 400

    notes = data.get('notes', 'Repayment recorded').strip()

    with get_db() as conn:
        conn.execute("""
            INSERT INTO udhaar_ledger (customer_id, sale_id, entry_type, amount, notes)
            VALUES (?, NULL, 'payment', ?, ?)
        """, (customer_id, amount, notes))
        conn.commit()

    return jsonify({"status": "success", "message": f"Payment of ₹{amount:.2f} recorded successfully"})

# ==========================================
# 3. BILLING & SALES APIs
# ==========================================

@app.route('/api/billing/checkout', methods=['POST'])
def checkout():
    data = request.json or {}
    customer_id = data.get('customer_id')
    items = data.get('items', [])
    payment_mode = data.get('payment_mode', 'cash').lower() # cash, upi, credit
    discount = float(data.get('discount', 0))

    if not items:
        return jsonify({"status": "error", "message": "Cart is empty"}), 400

    if payment_mode == 'credit' and not customer_id:
        return jsonify({"status": "error", "message": "Please select a registered customer for Udhaar (Credit) billing"}), 400

    # Generate Unique Invoice Number: GK-YYYYMMDD-XXXX
    now = datetime.datetime.now()
    timestamp_prefix = now.strftime('%Y%m%d')
    
    with get_db() as conn:
        try:
            # Determine invoice sequence
            cur = conn.execute("SELECT COUNT(*) as count FROM sales WHERE invoice_no LIKE ?", (f"GK-{timestamp_prefix}-%",))
            seq = cur.fetchone()['count'] + 1
            invoice_no = f"GK-{timestamp_prefix}-{seq:04d}"

            # Calculate item totals and verify stock
            subtotal = 0.0
            prepared_items = []

            for item in items:
                p_id = item.get('product_id')
                qty = float(item.get('quantity', 1))
                if qty <= 0:
                    continue

                prod = conn.execute("SELECT * FROM products WHERE id = ?", (p_id,)).fetchone()
                if not prod:
                    return jsonify({"status": "error", "message": f"Product ID {p_id} not found"}), 400

                prod_dict = dict(prod)
                price = float(item.get('selling_price', prod_dict['selling_price']))
                item_total = price * qty
                subtotal += item_total

                prepared_items.append({
                    'product_id': prod_dict['id'],
                    'product_name': prod_dict['name'],
                    'unit': prod_dict['unit'],
                    'purchase_price': prod_dict['purchase_price'],
                    'selling_price': price,
                    'quantity': qty,
                    'item_total': item_total
                })

            total_amount = max(0.0, subtotal - discount)

            # 1. Insert Sales Record
            cur_sale = conn.execute("""
                INSERT INTO sales (invoice_no, customer_id, subtotal, discount, total_amount, payment_mode)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (invoice_no, customer_id, subtotal, discount, total_amount, payment_mode))
            sale_id = cur_sale.lastrowid

            # 2. Insert Sale Items and Deduct Stock
            for it in prepared_items:
                conn.execute("""
                    INSERT INTO sale_items (sale_id, product_id, product_name, unit, purchase_price, selling_price, quantity, item_total)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (sale_id, it['product_id'], it['product_name'], it['unit'], it['purchase_price'], it['selling_price'], it['quantity'], it['item_total']))

                # Auto-deduct stock
                conn.execute("""
                    UPDATE products 
                    SET stock_quantity = stock_quantity - ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                """, (it['quantity'], it['product_id']))

            # 3. If Udhaar/Credit, record in Udhaar Ledger
            if payment_mode == 'credit' and customer_id:
                conn.execute("""
                    INSERT INTO udhaar_ledger (customer_id, sale_id, entry_type, amount, notes)
                    VALUES (?, ?, 'credit', ?, ?)
                """, (customer_id, sale_id, total_amount, f"Credit Sale Bill {invoice_no}"))

            conn.commit()

            # Return invoice payload for immediate thermal/A4 receipt printing
            cust_name = "Walk-in Customer"
            cust_phone = ""
            if customer_id:
                c_row = conn.execute("SELECT name, phone FROM customers WHERE id = ?", (customer_id,)).fetchone()
                if c_row:
                    cust_name = c_row['name']
                    cust_phone = c_row['phone'] or ""

            invoice_data = {
                "invoice_no": invoice_no,
                "date": now.strftime('%d-%m-%Y %I:%M %p'),
                "customer_name": cust_name,
                "customer_phone": cust_phone,
                "payment_mode": payment_mode.upper(),
                "items": prepared_items,
                "subtotal": subtotal,
                "discount": discount,
                "total_amount": total_amount
            }

            return jsonify({
                "status": "success", 
                "message": "Sale completed successfully", 
                "invoice": invoice_data
            }), 201

        except Exception as e:
            conn.rollback()
            return jsonify({"status": "error", "message": f"Checkout failed: {str(e)}"}), 500

@app.route('/api/billing/invoices/<invoice_no>', methods=['GET'])
def get_invoice(invoice_no):
    with get_db() as conn:
        sale = conn.execute("""
            SELECT s.*, c.name as customer_name, c.phone as customer_phone
            FROM sales s
            LEFT JOIN customers c ON s.customer_id = c.id
            WHERE s.invoice_no = ?
        """, (invoice_no,)).fetchone()

        if not sale:
            return jsonify({"status": "error", "message": "Invoice not found"}), 404

        sale_dict = dict(sale)
        items_cur = conn.execute("SELECT * FROM sale_items WHERE sale_id = ?", (sale_dict['id'],))
        items = [dict(row) for row in items_cur.fetchall()]
        sale_dict['items'] = items

    return jsonify({"status": "success", "invoice": sale_dict})

@app.route('/api/billing/recent', methods=['GET'])
def get_recent_sales():
    with get_db() as conn:
        cursor = conn.execute("""
            SELECT s.*, COALESCE(c.name, 'Walk-in Customer') as customer_name
            FROM sales s
            LEFT JOIN customers c ON s.customer_id = c.id
            ORDER BY s.created_at DESC
            LIMIT 25
        """)
        sales = [dict(row) for row in cursor.fetchall()]

    return jsonify({"status": "success", "sales": sales})

# ==========================================
# 4. SALES REPORTS & PROFIT ANALYTICS
# ==========================================

@app.route('/api/reports', methods=['GET'])
def get_reports():
    with get_db() as conn:
        # Today's Sales
        today_row = conn.execute("""
            SELECT 
                COALESCE(SUM(total_amount), 0) as total_sales,
                COUNT(*) as bill_count
            FROM sales
            WHERE date(created_at, 'localtime') = date('now', 'localtime')
        """).fetchone()

        # Weekly Sales (last 7 days)
        week_row = conn.execute("""
            SELECT 
                COALESCE(SUM(total_amount), 0) as total_sales,
                COUNT(*) as bill_count
            FROM sales
            WHERE date(created_at, 'localtime') >= date('now', 'localtime', '-7 days')
        """).fetchone()

        # Monthly Sales (current calendar month)
        month_row = conn.execute("""
            SELECT 
                COALESCE(SUM(total_amount), 0) as total_sales,
                COUNT(*) as bill_count
            FROM sales
            WHERE strftime('%Y-%m', created_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime')
        """).fetchone()

        # Total Estimated Profit across all sales
        # Profit = SUM((Selling Price - Purchase Price) * Quantity) - SUM(discounts)
        profit_row = conn.execute("""
            SELECT 
                COALESCE(SUM(si.quantity * (si.selling_price - si.purchase_price)), 0) -
                COALESCE((SELECT SUM(discount) FROM sales), 0) as total_profit
            FROM sale_items si
        """).fetchone()

        # Best-Selling Products (Top 5 by quantity sold)
        top_items_cur = conn.execute("""
            SELECT 
                si.product_name,
                SUM(si.quantity) as total_quantity_sold,
                si.unit,
                SUM(si.item_total) as total_revenue,
                SUM(si.quantity * (si.selling_price - si.purchase_price)) as item_profit
            FROM sale_items si
            GROUP BY si.product_name, si.unit
            ORDER BY total_quantity_sold DESC
            LIMIT 5
        """)
        top_products = [dict(row) for row in top_items_cur.fetchall()]

        # Payment Mode breakdown
        payment_modes_cur = conn.execute("""
            SELECT payment_mode, COUNT(*) as count, SUM(total_amount) as total
            FROM sales
            GROUP BY payment_mode
        """)
        payment_breakdown = [dict(row) for row in payment_modes_cur.fetchall()]

        # Low stock count
        low_stock_count = conn.execute("""
            SELECT COUNT(*) as count FROM products WHERE stock_quantity <= min_stock_alert
        """).fetchone()['count']

        # Total Products count
        total_products = conn.execute("SELECT COUNT(*) as count FROM products").fetchone()['count']

        # Total Outstanding Udhaar
        udhaar_row = conn.execute("""
            SELECT 
                COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE 0 END), 0) -
                COALESCE(SUM(CASE WHEN entry_type = 'payment' THEN amount ELSE 0 END), 0) as total_udhaar
            FROM udhaar_ledger
        """).fetchone()

    return jsonify({
        "status": "success",
        "today_sales": float(today_row['total_sales']),
        "today_bills": int(today_row['bill_count']),
        "weekly_sales": float(week_row['total_sales']),
        "weekly_bills": int(week_row['bill_count']),
        "monthly_sales": float(month_row['total_sales']),
        "monthly_bills": int(month_row['bill_count']),
        "total_profit": float(profit_row['total_profit']),
        "top_products": top_products,
        "payment_breakdown": payment_breakdown,
        "low_stock_count": int(low_stock_count),
        "total_products": int(total_products),
        "total_outstanding_udhaar": float(udhaar_row['total_udhaar'])
    })

if __name__ == '__main__':
    try:
        import sys
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    ip = get_local_ip()
    port = 5000
    print("=" * 65)
    print("  GURUDATTA KIRANA AND GENERAL STORES - SERVER ACTIVE")
    print("=" * 65)
    print(f"  [LAPTOP / PC] Address : http://127.0.0.1:{port}")
    print(f"  [MOBILE PHONE] Address: http://{ip}:{port}")
    print("=" * 65)
    print("  HOW TO USE ON MOBILE:")
    print("  1. Connect your phone to the same Wi-Fi network as this laptop.")
    print(f"  2. Open Chrome/Safari on your phone and open: http://{ip}:{port}")
    print("=" * 65)
    app.run(host='0.0.0.0', port=port, debug=False)


