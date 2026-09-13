import unittest
import json
from app import app
from database import get_db, init_db

class TestGurudattaShopSystem(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        init_db()

    def test_01_get_products(self):
        """Test retrieving products and searching"""
        res = self.client.get('/api/products?q=Atta')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(len(data['products']) >= 1)
        self.assertIn('Atta', data['products'][0]['name'])

    def test_02_add_and_update_product(self):
        """Test adding and updating an inventory item"""
        new_prod = {
            "name": "Tata Sampann Chana Dal 1kg",
            "category": "Pulses & Dal",
            "unit": "kg",
            "purchase_price": 95.0,
            "selling_price": 115.0,
            "stock_quantity": 25.0,
            "min_stock_alert": 5.0
        }
        res = self.client.post('/api/products', json=new_prod)
        self.assertEqual(res.status_code, 201)
        prod_id = res.get_json()['id']

        # Update it
        new_prod['selling_price'] = 120.0
        res_up = self.client.put(f'/api/products/{prod_id}', json=new_prod)
        self.assertEqual(res_up.status_code, 200)

        # Verify update
        with get_db() as conn:
            row = conn.execute("SELECT selling_price FROM products WHERE id = ?", (prod_id,)).fetchone()
            self.assertEqual(row['selling_price'], 120.0)

    def test_03_billing_and_stock_deduction(self):
        """Test checkout transaction and automatic stock reduction"""
        with get_db() as conn:
            prod_before = conn.execute("SELECT id, stock_quantity, selling_price FROM products WHERE id = 1").fetchone()
            initial_stock = prod_before['stock_quantity']
            sell_price = prod_before['selling_price']

        bill_payload = {
            "customer_id": None,
            "payment_mode": "cash",
            "discount": 10.0,
            "items": [
                {
                    "product_id": 1,
                    "quantity": 2.0,
                    "selling_price": sell_price
                }
            ]
        }

        res = self.client.post('/api/billing/checkout', json=bill_payload)
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertTrue(data['invoice']['invoice_no'].startswith('GK-'))
        self.assertEqual(data['invoice']['discount'], 10.0)

        # Check stock deduction
        with get_db() as conn:
            prod_after = conn.execute("SELECT stock_quantity FROM products WHERE id = 1").fetchone()
            self.assertEqual(prod_after['stock_quantity'], initial_stock - 2.0)

    def test_04_customer_and_udhaar_credit(self):
        """Test Udhaar credit purchase and payment tracking"""
        # 1. Add customer
        cust_payload = {
            "name": "Vikas Jadhav",
            "phone": "9422001122",
            "address": "Galli No. 3, Shivaji Chowk"
        }
        res_cust = self.client.post('/api/customers', json=cust_payload)
        self.assertEqual(res_cust.status_code, 201)
        cust_id = res_cust.get_json()['id']

        # 2. Make an Udhaar sale of ₹500
        bill_payload = {
            "customer_id": cust_id,
            "payment_mode": "credit",
            "discount": 0,
            "items": [
                {
                    "product_id": 2,
                    "quantity": 2,
                    "selling_price": 250.0
                }
            ]
        }
        res_bill = self.client.post('/api/billing/checkout', json=bill_payload)
        self.assertEqual(res_bill.status_code, 201)

        # 3. Check ledger balance
        res_ledger = self.client.get(f'/api/customers/{cust_id}/ledger')
        ledger_data = res_ledger.get_json()
        self.assertEqual(ledger_data['customer']['balance'], 500.0)

        # 4. Record partial repayment of ₹200
        repay_payload = {
            "amount": 200.0,
            "notes": "Paid via Google Pay"
        }
        res_repay = self.client.post(f'/api/customers/{cust_id}/payment', json=repay_payload)
        self.assertEqual(res_repay.status_code, 200)

        # 5. Check remaining balance (should be ₹300)
        res_ledger2 = self.client.get(f'/api/customers/{cust_id}/ledger')
        self.assertEqual(res_ledger2.get_json()['customer']['balance'], 300.0)

    def test_05_sales_reports_and_profit(self):
        """Test daily sales, profit calculation, and top products"""
        res = self.client.get('/api/reports')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertGreater(data['today_sales'], 0)
        self.assertGreater(data['today_bills'], 0)
        self.assertGreater(data['total_profit'], 0)
        self.assertTrue(len(data['top_products']) >= 1)

if __name__ == '__main__':
    unittest.main()
