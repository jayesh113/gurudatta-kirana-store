import sqlite3
import os
from contextlib import contextmanager

# On Vercel / serverless platforms, write to /tmp directory
if os.environ.get('VERCEL'):
    DB_PATH = '/tmp/gurudatta_store.db'
else:
    DB_PATH = os.path.join(os.path.dirname(__file__), 'gurudatta_store.db')

def init_db():
    schema_path = os.path.join(os.path.dirname(__file__), 'schema.sql')
    with open(schema_path, 'r', encoding='utf-8') as f:
        schema_sql = f.read()

    conn = sqlite3.connect(DB_PATH)
    try:
        conn.executescript(schema_sql)
        conn.commit()
    finally:
        conn.close()

@contextmanager
def get_db():
    if not os.path.exists(DB_PATH):
        init_db()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    try:
        yield conn
    finally:
        conn.close()

def clear_all_data():
    """Wipes all product, customer, sale, and udhaar data completely for a clean start."""
    with get_db() as conn:
        conn.execute("DELETE FROM sale_items")
        conn.execute("DELETE FROM sales")
        conn.execute("DELETE FROM udhaar_ledger")
        conn.execute("DELETE FROM customers")
        conn.execute("DELETE FROM products")
        try:
            conn.execute("DELETE FROM sqlite_sequence")
        except sqlite3.OperationalError:
            pass
        conn.commit()
    print("All sample and fake data cleared successfully! Database is completely empty and clean.")

if __name__ == '__main__':
    init_db()
    print(f"Database initialized cleanly at: {DB_PATH}")
