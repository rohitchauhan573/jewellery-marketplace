# Jewellery Marketplace

A multi-vendor jewellery marketplace where shop owners sell jewellery and customers browse, try on pieces virtually and request custom designs.

**Tech stack:** HTML, CSS, JavaScript · Node.js + Express · PostgreSQL (Neon)

## How to run

1. Install dependencies:

```
cd backend
npm install
```

2. Create a file named `.env` inside the `backend` folder with these lines:

```
PORT=5000
JWT_SECRET=your_long_random_secret
DATABASE_URL=your_neon_connection_string
```

3. In the Neon SQL Editor, run `database/schema.sql` and then `database/seed.sql`.

4. Start the server:

```
npm run dev
```

5. Open `http://localhost:5000/` in your browser. You should see a message saying the API is running.

After editing `.env`, type `rs` in the terminal and press Enter to restart the server.

## Project structure

```
backend/    Express API
frontend/   HTML, CSS, JavaScript pages
database/   schema.sql and seed.sql
```

## Notes

Never upload the `.env` file to GitHub. It contains secrets.