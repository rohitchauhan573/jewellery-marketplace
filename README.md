# Jewellery Wala

Jewellery Wala is a multi-vendor jewellery marketplace. Local jewellery shops list their pieces, and customers can browse, check whether a price is fair against the gold rate, try items on virtually with their webcam, and place orders.

Built as a full-stack project: HTML, CSS and JavaScript frontend, a Node.js and Express backend, and an SQLite database.

## Features

**Customer**
- Browse by category (earrings, necklaces, chains, pendants, rings, bangles, anklets and more) and filter by metal, purity, gender, occasion and price
- Search, product pages with specifications and live stock ("Only 2 left")
- **Fair price meter**: compares the asking price with an estimate built from the current gold rate, weight, purity and making charges, and shows Good deal, Fair or Overpriced
- **Virtual try-on** for earrings, necklaces, chains, pendants, nose pins and maang tikka, using the webcam and the shop's own product photo
- Cart, checkout with cash on delivery, order history and cancellation

**Shop owner**
- Register a shop and wait for admin approval
- Add, edit and delete only their own jewellery, with photo upload
- Live inventory: stock goes down when an order is placed and returns if it is cancelled
- Manage orders: confirm, pack, cancel

**Admin**
- Approve or reject shops
- Set the daily gold rate
- Mark products as Verified
- See all orders

**Delivery (basic)**
- Delivery partner accounts, assignment of orders, a step-by-step tracking timeline, and a 4-digit code the customer gives to complete a delivery

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript (no framework) |
| Try-on | MediaPipe Face Landmarker (runs in the browser) |
| Backend | Node.js, Express |
| Database | SQLite (built-in `node:sqlite`) |
| Security | bcrypt password hashing, JWT login, role checks |

## Project structure

```
jewellery wala/
  backend/      Express API (routes, middleware, config, utils)
  frontend/     HTML, CSS and JavaScript pages
  database/     schema.sql and seed.sql (the .db file is created automatically)
  README.md
```

## How to run

Requirements: a recent Node.js (22.13 or newer, tested on v25) and an internet connection for the try-on model.

1. Install the backend packages:

```
cd backend
npm install
```

2. Create `backend/.env`:

```
PORT=5000
JWT_SECRET=put-a-long-random-text-here
```

Generate a secret with:
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

3. Create demo data and an admin:

```
node demo-setup.js
node create-admin.js "Admin" admin@example.com YourOwnPassword
node set-gold-rate.js 14312 13119 10734
```

The numbers in the last command are example gold rates per gram for 24K, 22K and 18K. Enter the current local rate.

4. Start the backend:

```
npm run dev
```

5. In a second terminal, start the frontend from the project folder:

```
npx live-server frontend --port=5500
```

6. Open http://127.0.0.1:5500/index.html

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Customer | test@example.com | test1234 |
| Shop owner | jeweller@example.com | jeweller123 |
| Delivery partner | rider@example.com | rider1234 |
| Admin | the email you created in step 3 | the password you chose |

## How the fair price works

```
metal value = rate per gram (for the purity) x weight
estimated   = metal value + making charges + GST
GST         = 3% on metal value + 5% on making charges (assumed)
```

If the asking price is 5% or more below the estimate it is a Good deal, within 10% above it is Fair, and more than 10% above is Overpriced. The admin enters the gold rate by hand.

## Virtual try-on

The browser finds face points with MediaPipe and draws the product on them. If the shop uploaded a photo, that exact photo is used (its plain background is removed automatically). Without a photo, a preview matching the product's style, metal and stone is drawn. The fit is approximate.

## Database tables

users, shops, categories, products, product_images, cart_items, orders, order_items, order_events, gold_rates, custom_requests, quotes

## Security

- Passwords are hashed with bcrypt
- JWT login with role checks on every protected route
- A shop owner can only change their own products and orders (checked on the server)
- Parameterised SQL queries
- Secrets are kept in `.env`, which is not uploaded to GitHub
- Delivery codes lock an order after 5 wrong tries

## Test cases

| # | Feature | Steps | Expected result |
|---|---|---|---|
| 1 | Register | Register a new customer | Account created and logged in |
| 2 | Duplicate email | Register with the same email again | "This email is already registered" |
| 3 | Login | Log in with a wrong password | "Wrong email or password" |
| 4 | Roles | Customer opens the admin page | Redirected to login |
| 5 | Shop approval | New shop owner creates a shop | Status is pending, no product form |
| 6 | Approve | Admin approves the shop | Shop owner can now add jewellery |
| 7 | Add product | Shop owner adds a product with a photo | It appears on the home page with its photo |
| 8 | Ownership | One shop owner tries to edit another's product | Request is refused (403) |
| 9 | Category | Click Rings on the home page | Only rings are shown |
| 10 | Filters | Filter by 22K and a price range | Only matching items are shown |
| 11 | Fair price | Open a gold product | Verdict, estimate and gold rate are shown |
| 12 | Gold rate | Admin changes the gold rate | Verdicts change |
| 13 | Cart | Add two items, change quantity | Total updates correctly |
| 14 | Order | Place an order | Order is pending, stock goes down |
| 15 | Too many | Order more than the stock | "Only X left" message |
| 16 | Cancel | Customer cancels a pending order | Stock is returned |
| 17 | Zero stock | Shop owner sets stock to 0 | Product disappears from the home page |
| 18 | Try-on | Open try-on for earrings and start the camera | Earrings appear on both ears |
| 19 | Try-on product | Open try-on for two different products | Each shows its own design |
| 20 | Unsupported | Open a ring product | No try-on button |
| 21 | Delivery code | Enter a wrong delivery code | "Wrong code" with tries left |

## Known limitations

- Runs on one computer; there is no hosted version
- SQLite is a single file, which suits a demo but not many users
- Payment is cash on delivery only
- Anyone can register as a delivery partner (a real system would verify them)
- No live GPS tracking; delivery partners get Google Maps links
- Try-on works only for jewellery worn on the face and neck
- The gold rate is entered manually

## Future scope

Hosted deployment with a cloud database, online payments, live GPS tracking, reviews and wishlist, custom design requests with quotes from shops, try-on for rings and bangles, and verification of delivery partners.

## Screenshots

Add images in `docs/screenshots/` and link them here.