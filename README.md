# KhetBazaar – Farmer Marketplace (full stack)
Farmers list produce, customers order directly, admin oversees everything.

## Run (no installs needed – Python 3.8+)
    python3 server.py          # then open http://localhost:8000
Optional: `PORT=5000 python3 server.py`. The SQLite database (`marketplace.db`) is created and seeded on first start; delete it to reset.

## Demo logins
Customer `customer@example.com` / `123456` · Farmer `farmer@example.com` / `123456` · Admin `admin` / `admin123`

## Structure
- `server.py` – REST API + static hosting (PBKDF2 password hashing, HMAC-signed tokens, role checks, transactional orders)
- `static/` – frontend (index.html, style.css, app.js)
- `database/schema.sqlite.sql` – schema in use; `database/original_mysql_schema.sql` – your original MySQL schema

## API (JSON, `Authorization: Bearer <token>`)
| Method | Path | Who |
|---|---|---|
| POST | /api/auth/register, /api/auth/login | public |
| GET | /api/state (products, scoped orders/users) | public / any role |
| POST/PUT/DELETE | /api/products[/id] | farmer (owner); admin may DELETE |
| POST | /api/orders | customer |
| PATCH | /api/orders/id `{status}` | customer (cancel own pending), farmer (own orders), admin |
| DELETE | /api/users/farmer\|customer/id | admin |
