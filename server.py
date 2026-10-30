#!/usr/bin/env python3
"""KhetBazaar - Farmer Marketplace backend. REST API + static hosting.
Stdlib only (http.server + sqlite3). Run:  python3 server.py   ->  http://localhost:8000"""
import base64, calendar, hashlib, hmac, json, mimetypes, os, re, secrets, sqlite3, time, traceback
from contextlib import closing, contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

BASE = os.path.dirname(os.path.abspath(__file__))
DB = os.environ.get('DB_PATH', os.path.join(BASE, 'marketplace.db'))
STATIC = os.path.join(BASE, 'static')
CATS = ['Vegetables', 'Fruits', 'Grains', 'Dairy', 'Spices']
UNITS = ['kg', 'dozen', 'litre', 'piece']
TABLES = {'farmer': ('farmers', 'farmer_id'), 'customer': ('customers', 'customer_id')}
NEXT = {'Pending': {'Confirmed', 'Cancelled'}, 'Confirmed': {'Delivered', 'Cancelled'}}

SECRET_FILE = os.path.join(BASE, '.secret')
if not os.path.exists(SECRET_FILE):
    open(SECRET_FILE, 'w').write(secrets.token_hex(32))
SECRET = open(SECRET_FILE).read().strip().encode()


class Err(Exception):
    def __init__(self, code, msg):
        self.code, self.msg = code, msg


# ---------- database / security helpers ----------
def conn():
    c = sqlite3.connect(DB, timeout=10, isolation_level=None)
    c.row_factory = sqlite3.Row
    c.execute('PRAGMA foreign_keys=ON')
    return c


@contextmanager
def tx(c):
    c.execute('BEGIN IMMEDIATE')
    try:
        yield
        c.execute('COMMIT')
    except BaseException:
        c.execute('ROLLBACK')
        raise


def hp(pw, salt=None):
    salt = salt or secrets.token_hex(8)
    return salt + '$' + hashlib.pbkdf2_hmac('sha256', pw.encode(), salt.encode(), 100000).hex()


def vp(pw, h):
    return hmac.compare_digest(hp(pw, h.split('$')[0]), h)


def mk(role, uid):
    b = base64.urlsafe_b64encode(json.dumps({'r': role, 'i': uid, 'e': int(time.time()) + 7 * 86400}).encode()).decode()
    return b + '.' + hmac.new(SECRET, b.encode(), 'sha256').hexdigest()


def chk(tok):
    try:
        b, sig = tok.split('.')
        if not hmac.compare_digest(sig, hmac.new(SECRET, b.encode(), 'sha256').hexdigest()):
            return None
        d = json.loads(base64.urlsafe_b64decode(b))
        return d if d['e'] > time.time() else None
    except Exception:
        return None


def init_db():
    new = not os.path.exists(DB)
    with closing(conn()) as c:
        c.executescript(open(os.path.join(BASE, 'database', 'schema.sqlite.sql'), encoding='utf-8').read())
        if new or not c.execute('SELECT 1 FROM admin').fetchone():
            seed(c)


def seed(c):
    pw = hp('123456')
    c.execute("INSERT INTO admin(username,password) VALUES('admin',?)", (hp('admin123'),))
    for n, ph, e, ad in [('Ramesh Kumar', '9876543210', 'farmer@example.com', 'Odisha'),
                         ('Sita Devi', '9822012345', 'sita@example.com', 'Nashik, Maharashtra')]:
        c.execute('INSERT INTO farmers(name,phone,email,address,password) VALUES(?,?,?,?,?)', (n, ph, e, ad, pw))
    c.execute('INSERT INTO customers(name,phone,email,address,password) VALUES(?,?,?,?,?)',
              ('Rahul Das', '9876501234', 'customer@example.com', 'Bhubaneswar', pw))
    P = [(1, 'Tomato', 'Vegetables', 40, 100, '🍅', 'kg', 'Fresh organic tomatoes'),
         (1, 'Potato', 'Vegetables', 30, 150, '🥔', 'kg', 'Farm fresh potatoes'),
         (1, 'Mango', 'Fruits', 80, 50, '🥭', 'kg', 'Sweet Alphonso mangoes'),
         (2, 'Spinach', 'Vegetables', 25, 40, '🥬', 'kg', 'Tender leaves, harvested this morning'),
         (2, 'Banana', 'Fruits', 60, 80, '🍌', 'dozen', 'Naturally ripened Robusta bananas'),
         (1, 'Basmati Rice', 'Grains', 95, 200, '🌾', 'kg', 'Aged long-grain basmati'),
         (2, 'Fresh Milk', 'Dairy', 60, 30, '🥛', 'litre', 'Pure cow milk, delivered same day'),
         (2, 'Turmeric Powder', 'Spices', 220, 8, '🧂', 'kg', 'Stone-ground, high curcumin'),
         (2, 'Onion', 'Vegetables', 35, 120, '🧅', 'kg', 'Nashik red onions'),
         (1, 'Pomegranate', 'Fruits', 140, 0, '🍎', 'kg', 'Ruby red, juicy arils')]
    for f, n, cat, pr, q, em, u, d in P:
        c.execute('INSERT INTO products(farmer_id,product_name,category,price,quantity,image,unit,description) VALUES(?,?,?,?,?,?,?,?)',
                  (f, n, cat, pr, q, em, u, d))
    c.execute("INSERT INTO orders(customer_id,order_date,total_amount,status,address) VALUES(1,datetime('now','-6 days'),140,'Delivered','Bhubaneswar')")
    c.execute('INSERT INTO order_items(order_id,product_id,quantity,price) VALUES(1,1,2,40),(1,2,2,30)')


# ---------- validation ----------
def s(b, k, n=200):
    v = b.get(k, '')
    return v.strip()[:n] if isinstance(v, str) else ''


def num(b, k):
    try:
        return float(b.get(k))
    except Exception:
        return None


def need(a, *roles):
    if not a:
        raise Err(401, 'Please log in first')
    if roles and a['r'] not in roles:
        raise Err(403, 'You are not allowed to do that')


def pv(b):
    name, price, qty = s(b, 'name', 100), num(b, 'price'), num(b, 'qty')
    if not name: raise Err(400, 'Product name is required')
    if price is None or not 0 < price <= 1000000: raise Err(400, 'Enter a valid price')
    if qty is None or not 0 <= qty <= 1000000 or qty != int(qty): raise Err(400, 'Stock must be a whole number')
    if s(b, 'cat') not in CATS: raise Err(400, 'Invalid category')
    if s(b, 'unit') not in UNITS: raise Err(400, 'Invalid unit')
    return (name, s(b, 'cat'), round(price, 2), int(qty), s(b, 'emoji', 8) or '🥕', s(b, 'unit'), s(b, 'desc', 300))


# ---------- read models ----------
def ts(v):
    return calendar.timegm(time.strptime(v, '%Y-%m-%d %H:%M:%S')) * 1000


def orders_for(c, a):
    r, uid = (a['r'], a['i']) if a else (None, None)
    if r == 'customer':
        rows = c.execute('SELECT * FROM orders WHERE customer_id=? ORDER BY order_id', (uid,)).fetchall()
    elif r == 'farmer':
        rows = c.execute('''SELECT DISTINCT o.* FROM orders o JOIN order_items i ON i.order_id=o.order_id
            JOIN products p ON p.product_id=i.product_id WHERE p.farmer_id=? ORDER BY o.order_id''', (uid,)).fetchall()
    elif r == 'admin':
        rows = c.execute('SELECT * FROM orders ORDER BY order_id').fetchall()
    else:
        return []
    out = []
    for o in rows:
        sql = '''SELECT i.product_id pid,p.farmer_id fid,p.product_name name,p.image emoji,p.unit unit,
                 i.quantity qty,i.price price FROM order_items i JOIN products p ON p.product_id=i.product_id WHERE i.order_id=?'''
        args = [o['order_id']]
        if r == 'farmer':
            sql += ' AND p.farmer_id=?'; args.append(uid)
        items = [dict(x) for x in c.execute(sql, args)]
        if items:
            out.append({'id': o['order_id'], 'cid': o['customer_id'], 'ts': ts(o['order_date']), 'status': o['status'],
                        'addr': o['address'], 'total': o['total_amount'], 'items': items})
    return out


def state(c, a):
    r, uid = (a['r'], a['i']) if a else (None, None)
    P = [{'id': x['product_id'], 'fid': x['farmer_id'], 'name': x['product_name'], 'cat': x['category'], 'price': x['price'],
          'qty': x['quantity'], 'emoji': x['image'], 'unit': x['unit'], 'desc': x['description']}
         for x in c.execute('SELECT * FROM products ORDER BY product_id')]
    fr = [dict(x) for x in c.execute('SELECT farmer_id id,name,address,phone,email FROM farmers')]
    cu = [dict(x) for x in c.execute('SELECT customer_id id,name,address,phone,email FROM customers')]
    stats = {'farmers': len(fr), 'customers': len(cu), 'products': len(P),
             'orders': c.execute('SELECT COUNT(*) FROM orders').fetchone()[0]}
    ords, me = orders_for(c, a), None
    pub = lambda x: {'id': x['id'], 'name': x['name'], 'address': x['address']}
    if r == 'admin':
        if c.execute('SELECT 1 FROM admin WHERE admin_id=?', (uid,)).fetchone(): me = {'role': 'admin', 'id': uid}
        farmers, customers = fr, cu
    else:
        farmers = [pub(x) for x in fr]
        customers = []
        if r == 'farmer' and any(x['id'] == uid for x in fr): me = {'role': 'farmer', 'id': uid}
        if r == 'customer':
            customers = [x for x in cu if x['id'] == uid]
            if customers: me = {'role': 'customer', 'id': uid}
        if r == 'farmer':
            ids = {o['cid'] for o in ords}
            customers = [{'id': x['id'], 'name': x['name'], 'phone': x['phone'], 'address': x['address']} for x in cu if x['id'] in ids]
    return {'me': me, 'products': P, 'farmers': farmers, 'customers': customers, 'orders': ords, 'stats': stats}


# ---------- write actions ----------
def auth(c, mode, b):
    role = b.get('role')
    pw = b.get('pw') if isinstance(b.get('pw'), str) else ''
    uid = s(b, 'uid', 100)
    if mode == 'login':
        if role == 'admin':
            row = c.execute('SELECT * FROM admin WHERE username=?', (uid,)).fetchone()
            if row and vp(pw, row['password']):
                return {'token': mk('admin', row['admin_id']), 'user': {'id': row['admin_id'], 'role': 'admin'}}
        elif role in TABLES:
            t, k = TABLES[role]
            row = c.execute(f'SELECT * FROM {t} WHERE lower(email)=lower(?)', (uid,)).fetchone()
            if row and vp(pw, row['password']):
                return {'token': mk(role, row[k]), 'user': {'id': row[k], 'role': role}}
        raise Err(401, 'Invalid credentials for a %s account' % (role if role in ('admin', 'farmer', 'customer') else 'user'))
    if role not in TABLES: raise Err(400, 'Choose customer or farmer')
    name, phone, addr = s(b, 'name', 100), s(b, 'phone', 15), s(b, 'address', 300)
    if not name or not addr: raise Err(400, 'Name and address are required')
    if not re.fullmatch(r'\d{10}', phone): raise Err(400, 'Phone must be a 10-digit number')
    if not re.fullmatch(r'[^@\s]+@[^@\s]+\.[^@\s]+', uid): raise Err(400, 'Enter a valid email')
    if len(pw) < 6: raise Err(400, 'Password must be at least 6 characters')
    t, k = TABLES[role]
    with tx(c):
        for tt in ('farmers', 'customers'):
            if c.execute(f'SELECT 1 FROM {tt} WHERE lower(email)=lower(?)', (uid,)).fetchone():
                raise Err(409, 'That email is already registered')
        nid = c.execute(f'INSERT INTO {t}(name,phone,email,address,password) VALUES(?,?,?,?,?)',
                        (name, phone, uid.lower(), addr, hp(pw))).lastrowid
    return {'token': mk(role, nid), 'user': {'id': nid, 'role': role}}


def cleanup(c):
    c.execute('DELETE FROM orders WHERE order_id NOT IN (SELECT DISTINCT order_id FROM order_items)')


def make_order(c, a, b):
    need(a, 'customer')
    addr = s(b, 'address', 300)
    if len(addr) < 5: raise Err(400, 'Please enter a full delivery address')
    items = {}
    for it in b.get('items') or []:
        try:
            pid, qn = int(it['product_id']), int(it['quantity'])
        except Exception:
            raise Err(400, 'Invalid cart')
        if qn < 1: raise Err(400, 'Invalid quantity')
        items[pid] = items.get(pid, 0) + qn
    if not items: raise Err(400, 'Your cart is empty')
    with tx(c):
        if not c.execute('SELECT 1 FROM customers WHERE customer_id=?', (a['i'],)).fetchone(): raise Err(401, 'Account not found')
        rows, total = [], 0
        for pid, qn in items.items():
            p = c.execute('SELECT * FROM products WHERE product_id=?', (pid,)).fetchone()
            if not p: raise Err(404, 'A product in your cart is no longer available')
            if p['quantity'] < qn: raise Err(409, f"Only {p['quantity']} {p['unit']} of {p['product_name']} left")
            rows.append((p, qn)); total += p['price'] * qn
        oid = c.execute('INSERT INTO orders(customer_id,total_amount,address) VALUES(?,?,?)', (a['i'], round(total, 2), addr)).lastrowid
        for p, qn in rows:
            c.execute('UPDATE products SET quantity=quantity-? WHERE product_id=?', (qn, p['product_id']))
            c.execute('INSERT INTO order_items(order_id,product_id,quantity,price) VALUES(?,?,?,?)', (oid, p['product_id'], qn, p['price']))
    return {'id': oid}


def set_status(c, a, oid, b):
    need(a, 'customer', 'farmer', 'admin')
    st = s(b, 'status')
    with tx(c):
        o = c.execute('SELECT * FROM orders WHERE order_id=?', (oid,)).fetchone()
        if not o: raise Err(404, 'Order not found')
        if a['r'] == 'customer' and (o['customer_id'] != a['i'] or st != 'Cancelled' or o['status'] != 'Pending'):
            raise Err(403, 'You can only cancel your own pending orders')
        if a['r'] == 'farmer' and not c.execute('''SELECT 1 FROM order_items i JOIN products p ON p.product_id=i.product_id
                WHERE i.order_id=? AND p.farmer_id=?''', (oid, a['i'])).fetchone():
            raise Err(403, 'This order has none of your products')
        if st not in NEXT.get(o['status'], ()): raise Err(409, f"Cannot change an order from {o['status']} to {st or '(none)'}")
        if st == 'Cancelled':
            c.execute('UPDATE products SET quantity=quantity+(SELECT quantity FROM order_items WHERE order_id=? AND product_id=products.product_id) '
                      'WHERE product_id IN (SELECT product_id FROM order_items WHERE order_id=?)', (oid, oid))
        c.execute('UPDATE orders SET status=? WHERE order_id=?', (st, oid))
    return {'ok': True}


def route(m, p, b, a):
    with closing(conn()) as c:
        if m == 'GET' and p == '/state': return state(c, a)
        if m == 'POST' and p in ('/auth/login', '/auth/register'): return auth(c, p[6:], b)
        if m == 'POST' and p == '/products':
            need(a, 'farmer')
            with tx(c):
                if not c.execute('SELECT 1 FROM farmers WHERE farmer_id=?', (a['i'],)).fetchone(): raise Err(401, 'Account not found')
                n, cat, pr, q, em, u, d = pv(b)
                pid = c.execute('INSERT INTO products(farmer_id,product_name,category,price,quantity,image,unit,description) VALUES(?,?,?,?,?,?,?,?)',
                                (a['i'], n, cat, pr, q, em, u, d)).lastrowid
            return {'id': pid}
        mm = re.fullmatch(r'/products/(\d+)', p)
        if mm and m == 'PUT':
            need(a, 'farmer')
            n, cat, pr, q, em, u, d = pv(b)
            with tx(c):
                cur = c.execute('UPDATE products SET product_name=?,category=?,price=?,quantity=?,image=?,unit=?,description=? WHERE product_id=? AND farmer_id=?',
                                (n, cat, pr, q, em, u, d, int(mm[1]), a['i']))
                if not cur.rowcount: raise Err(404, 'Product not found in your farm')
            return {'ok': True}
        if mm and m == 'DELETE':
            need(a, 'farmer', 'admin')
            with tx(c):
                cur = c.execute('DELETE FROM products WHERE product_id=?' + (' AND farmer_id=?' if a['r'] == 'farmer' else ''),
                                (int(mm[1]),) + ((a['i'],) if a['r'] == 'farmer' else ()))
                if not cur.rowcount: raise Err(404, 'Product not found')
                cleanup(c)
            return {'ok': True}
        if m == 'POST' and p == '/orders': return make_order(c, a, b)
        mm = re.fullmatch(r'/orders/(\d+)', p)
        if mm and m == 'PATCH': return set_status(c, a, int(mm[1]), b)
        mm = re.fullmatch(r'/users/(farmer|customer)/(\d+)', p)
        if mm and m == 'DELETE':
            need(a, 'admin')
            t, k = TABLES[mm[1]]
            with tx(c):
                if not c.execute(f'DELETE FROM {t} WHERE {k}=?', (int(mm[2]),)).rowcount: raise Err(404, 'User not found')
                cleanup(c)
            return {'ok': True}
    raise Err(404, 'Unknown endpoint')


# ---------- HTTP ----------
class H(BaseHTTPRequestHandler):
    def log_message(self, f, *a):
        if os.environ.get('VERBOSE'): super().log_message(f, *a)

    def out(self, code, body, ctype='application/json'):
        if not isinstance(body, bytes): body = json.dumps(body).encode()
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(body)

    def handle_any(self, m):
        path = urlparse(self.path).path
        if path.startswith('/api/'):
            try:
                n = int(self.headers.get('Content-Length') or 0)
                if n > 100000: raise Err(413, 'Request too large')
                try:
                    body = json.loads(self.rfile.read(n)) if n else {}
                    if not isinstance(body, dict): raise ValueError
                except ValueError:
                    raise Err(400, 'Invalid JSON')
                h = self.headers.get('Authorization', '')
                self.out(200, route(m, path[4:], body, chk(h[7:]) if h.startswith('Bearer ') else None))
            except Err as e:
                self.out(e.code, {'error': e.msg})
            except Exception:
                traceback.print_exc()
                self.out(500, {'error': 'Server error'})
            return
        if m != 'GET': return self.out(405, {'error': 'Method not allowed'})
        f = os.path.realpath(os.path.join(STATIC, 'index.html' if path == '/' else path.lstrip('/')))
        if not f.startswith(STATIC + os.sep) or not os.path.isfile(f): f = os.path.join(STATIC, 'index.html')
        self.out(200, open(f, 'rb').read(), (mimetypes.guess_type(f)[0] or 'text/plain') + '; charset=utf-8')

    do_GET = lambda s_: s_.handle_any('GET')
    do_POST = lambda s_: s_.handle_any('POST')
    do_PUT = lambda s_: s_.handle_any('PUT')
    do_PATCH = lambda s_: s_.handle_any('PATCH')
    do_DELETE = lambda s_: s_.handle_any('DELETE')


if __name__ == '__main__':
    init_db()
    port = int(os.environ.get('PORT', 8000))
    print(f'🌾 KhetBazaar running at http://localhost:{port}')
    ThreadingHTTPServer(('0.0.0.0', port), H).serve_forever()
