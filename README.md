# Outreach Email Template Generator

Production-ready SaaS MVP for generating high-converting outreach emails from deterministic templates (no AI APIs).

## Stack
- Node.js + Express.js
- EJS server-rendered views
- MySQL + Sequelize ORM
- Vanilla JavaScript + plain CSS

## Features
- Secure auth (register/login/logout) with bcrypt password hashing
- Template browser with category + search and detailed template pages
- Protected generator dashboard with 3-column layout
- Live preview API with safe token rendering
- Favorites toggle (AJAX)
- Save/search/sort/delete generation history (soft delete)
- Follow-up sequence generation (#1 and #2)
- Security hardening: helmet, rate limiting, CSRF, validation/sanitization
- Session persistence in MySQL via `express-mysql-session`
- Centralized error handling and custom 404/500 pages
- 40 seeded templates across 8 categories

## Folder Structure
```text
.
|-- migrations/
|-- seeders/
|-- src/
|   |-- app.js
|   |-- server.js
|   |-- config/
|   |-- controllers/
|   |-- middleware/
|   |-- models/
|   |-- public/
|   |-- routes/
|   |-- services/
|   |-- utils/
|   `-- views/
|-- .env.example
|-- .sequelizerc
|-- package.json
`-- README.md
```

## Setup
1. Install dependencies:
```bash
npm install
```

2. Create MySQL database:
```sql
CREATE DATABASE outreach_generator;
```

3. Configure environment:
```bash
cp .env.example .env
```
Update `.env` values for your MySQL credentials and session secret.

4. Run migrations:
```bash
npm run db:migrate
```

5. Seed templates:
```bash
npm run db:seed
```

6. Start development server:
```bash
npm run dev
```

Open: `http://localhost:3000`

## Useful Scripts
- `npm run dev` - Start with nodemon
- `npm start` - Start production server
- `npm run db:migrate` - Apply migrations
- `npm run db:migrate:undo` - Undo last migration
- `npm run db:seed` - Seed all templates
- `npm run db:seed:undo` - Remove seeded data

## Required Environment Variables
```env
NODE_ENV=development
PORT=3000
SESSION_SECRET=replace_with_long_random_secret
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=outreach_generator
DB_USER=root
DB_PASSWORD=your_mysql_password
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=200
```

## Notes
- This app intentionally uses deterministic template rendering only.
- No LLM or external AI API calls are used.
- Anonymous users can view landing/templates, but generator/history/favorites require login.
