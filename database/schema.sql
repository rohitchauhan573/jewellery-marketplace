CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer'
    CHECK (role IN ('customer', 'shop_owner', 'admin')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  city TEXT,
  licence_no TEXT,
  logo TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  supports_try_on INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  title TEXT NOT NULL,
  description TEXT,
  metal TEXT,
  purity TEXT,
  weight_g REAL,
  making_charges REAL DEFAULT 0,
  price REAL NOT NULL,
  stock INTEGER DEFAULT 1,
  gender TEXT DEFAULT 'women',
  occasion TEXT,
  stone TEXT,
  attributes TEXT DEFAULT '{}',
  is_verified INTEGER DEFAULT 0,
  try_on_png TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cart_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  UNIQUE (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  total REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  address TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  shop_id INTEGER NOT NULL REFERENCES shops(id),
  quantity INTEGER NOT NULL,
  price REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS gold_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rate_date TEXT UNIQUE NOT NULL,
  rate_24k REAL,
  rate_22k REAL,
  rate_18k REAL
);

CREATE TABLE IF NOT EXISTS custom_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  metal TEXT,
  budget REAL,
  deadline TEXT,
  reference_image TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL REFERENCES custom_requests(id) ON DELETE CASCADE,
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  price REAL NOT NULL,
  days_to_make INTEGER,
  message TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);