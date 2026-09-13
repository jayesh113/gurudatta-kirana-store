import unittest
import json
from app import app
from database import get_db, init_db, clear_all_data

import database

class TestGurudattaShopSystem(unittest.TestCase):
    def setUp(self):
        database.DB_PATH = 'test_gurudatta.db'
        self.client = app.test_client()
        init_db()
        clear_all_data()

    def tearDown(self):
        database.DB_PATH = database.BUNDLED_DB

    def test_01_product_lifecycle(self):
        """Test creating, fetching, and searching a product"""
        prod_payload = {
            "name": "Tata Salt 1kg",
            "category": "Spices & Salt",
            "unit": "packet",
            "purchase_price": 20.0,
            "selling_price": 28.0,
            "stock_quantity": 50.0,
            "min_stock_alert": 10.0
        }
        res_create = self.client.post('/api/products', json=prod_payload)
        self.assertEqual(res_create.status_code, 201)
        prod_id = res_create.get_json()['id']

        # Search for it
        res_search = self.client.get('/api/products?q=Salt')
        self.assertEqual(res_search.status_code, 200)
        data = res_search.get_json()
        self.assertEqual(len(data['products']), 1)
        self.assertEqual(data['products'][0]['id'], prod_id)

    def test_02_billing_and_stock_deduction(self):
        """Test cash checkout and automatic stock reduction"""
        # 1. Create product
        prod_payload = {
            "name": "Fortune Sunflower Oil 1L",
            "category": "Oil & Ghee",
            "unit": "packet",
            "purchase_price": 110.0,
            "selling_price": 135.0,
            "stock_quantity": 20.0,
            "min_stock_alert": 5.0
        }
        res_p = self.client.post('/api/products', json=prod_payload)
        prod_id = res_p.get_json()['id']

        # 2. Checkout 2 packets
        bill_payload = {
            "customer_id": None,
            "payment_mode": "cash",
            "discount": 5.0,
            "items": [
                {
                    "product_id": prod_id,
                    "quantity": 2.0,
                    "selling_price": 135.0
                }
            ]
        }
        res_bill = self.client.post('/api/billing/checkout', json=bill_payload)
        self.assertEqual(res_bill.status_code, 201)
        inv = res_bill.get_json()['invoice']
        self.assertTrue(inv['invoice_no'].startswith('GK-'))
        self.assertEqual(inv['total_amount'], 265.0) # (135 * 2) - 5

        # 3. Verify stock deducted (20 - 2 = 18)
        with get_db() as conn:
            row = conn.execute("SELECT stock_quantity FROM products WHERE id = ?", (prod_id,)).fetchone()
            self.assertEqual(row['stock_quantity'], 18.0)

    def test_03_customer_and_udhaar_credit(self):
        """Test Udhaar credit purchase and payment tracking"""
        # 1. Create Product
        res_p = self.client.post('/api/products', json={
            "name": "Madhur Pure Sugar 1kg",
            "category": "Sugar",
            "unit": "kg",
            "purchase_price": 38.0,
            "selling_price": 46.0,
            "stock_quantity": 50.0,
            "min_stock_alert": 10.0
        })
        prod_id = res_p.get_json()['id']

        # 2. Add customer
        res_cust = self.client.post('/api/customers', json={
            "name": "Anil Patil",
            "phone": "9811223344",
            "address": "Market Yard"
        })
        self.assertEqual(res_cust.status_code, 201)
        cust_id = res_cust.get_json()['id']

        # 3. Make Udhaar sale of 5 kg = ₹230
        res_bill = self.client.post('/api/billing/checkout', json={
            "customer_id": cust_id,
            "payment_mode": "credit",
            "discount": 0,
            "items": [{"product_id": prod_id, "quantity": 5.0, "selling_price": 46.0}]
        })
        self.assertEqual(res_bill.status_code, 201)

        # 4. Check ledger balance
        res_ledger = self.client.get(f'/api/customers/{cust_id}/ledger')
        self.assertEqual(res_ledger.get_json()['customer']['balance'], 230.0)

        # 5. Record partial repayment of ₹100
        res_repay = self.client.post(f'/api/customers/{cust_id}/payment', json={"amount": 100.0, "notes": "Cash"})
        self.assertEqual(res_repay.status_code, 200)

        # 6. Check remaining balance (₹130)
        res_ledger2 = self.client.get(f'/api/customers/{cust_id}/ledger')
        self.assertEqual(res_ledger2.get_json()['customer']['balance'], 130.0)

    def test_04_reports_and_profit(self):
        """Test profit calculation and analytics"""
        # Add product and sale
        res_p = self.client.post('/api/products', json={
            "name": "Aashirvaad Atta 5kg",
            "category": "Flour",
            "unit": "packet",
            "purchase_price": 200.0,
            "selling_price": 250.0,
            "stock_quantity": 10.0,
            "min_stock_alert": 2.0
        })
        prod_id = res_p.get_json()['id']

        self.client.post('/api/billing/checkout', json={
            "customer_id": None,
            "payment_mode": "cash",
            "discount": 0,
            "items": [{"product_id": prod_id, "quantity": 2.0, "selling_price": 250.0}]
        })

        res_rep = self.client.get('/api/reports')
        self.assertEqual(res_rep.status_code, 200)
        data = res_rep.get_json()
        self.assertEqual(data['today_sales'], 500.0)
        # Profit = (250 - 200) * 2 = 100
        self.assertEqual(data['total_profit'], 100.0)

    def tearDown(self):
        clear_all_data()

if __name__ == '__main__':
    unittest.main()
