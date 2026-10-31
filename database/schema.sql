CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'customer'
    CHECK (role IN ('customer', 'shop_owner', 'admin')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE shops (
  id SERIAL PRIMARY KEY,
  owner_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  city VARCHAR(100),
  licence_no VARCHAR(100),
  logo TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  parent_id INT REFERENCES categories(id) ON DELETE SET NULL,
  supports_try_on BOOLEAN DEFAULT FALSE
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  shop_id INT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  category_id INT NOT NULL REFERENCES categories(id),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  metal VARCHAR(30),
  purity VARCHAR(10),
  weight_g NUMERIC(8,2),
  making_charges NUMERIC(10,2) DEFAULT 0,
  price NUMERIC(12,2) NOT NULL,
  stock INT DEFAULT 1,
  gender VARCHAR(10) DEFAULT 'women',
  occasion VARCHAR(50),
  stone VARCHAR(50),
  attributes JSONB DEFAULT '{}',
  is_verified BOOLEAN DEFAULT FALSE,
  try_on_png TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE product_images (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL
);

CREATE TABLE cart_items (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 1,
  UNIQUE (user_id, product_id)
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  total NUMERIC(12,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id),
  shop_id INT NOT NULL REFERENCES shops(id),
  quantity INT NOT NULL,
  price NUMERIC(12,2) NOT NULL
);

CREATE TABLE gold_rates (
  id SERIAL PRIMARY KEY,
  rate_date DATE UNIQUE NOT NULL,
  rate_24k NUMERIC(10,2),
  rate_22k NUMERIC(10,2),
  rate_18k NUMERIC(10,2)
);

CREATE TABLE custom_requests (
  id SERIAL PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  metal VARCHAR(30),
  budget NUMERIC(12,2),
  deadline DATE,
  reference_image TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE quotes (
  id SERIAL PRIMARY KEY,
  request_id INT NOT NULL REFERENCES custom_requests(id) ON DELETE CASCADE,
  shop_id INT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  price NUMERIC(12,2) NOT NULL,
  days_to_make INT,
  message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);