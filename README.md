# Goodreads-Style Reading Platform

A production-oriented Goodreads-like app built with Django, Django REST Framework, React hooks, PostgreSQL, and Redis.

## Features

- JWT register/login with protected write APIs.
- Goodreads-style navigation: Home, My Books, Browse, Community, with hover dropdowns.
- CSV ingestion for `goodreads_works.csv` and `goodreads_review.csv`.
- Normalized models for users, books, reviews, shelves, feed events, notifications, comments, and likes.
- Book catalog search by title, author, and genre using PostgreSQL full-text search.
- Book detail pages with cover, rating summary, rating distribution, reviews, shelves, and similar books.
- Shelves with one book per user and move-between-shelves behavior.
- Add/edit/delete reviews, like reviews, and simulated comments.
- Follow/unfollow users, followers/following lists, and cached friend activity feed.
- Redis caching for feed and popular books.
- Pagination and database indexes for common lookup paths.

## Project Structure

```text
backend/
  config/          Django settings and root URLs
  goodreads/       Domain app, API, models, importer
frontend/
  src/             React application
data/              Place required CSV files here
```

## Local Setup

1. Create an environment file:

```bash
cp .env.example .env
```

2. Start PostgreSQL and Redis:

```bash
docker compose up -d
```

3. Install backend dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

4. Run migrations:

```bash
python manage.py migrate
```

5. Put the required files in `data/`:

```text
data/goodreads_works.csv
data/goodreads_review.csv
data/goodreads_data_dictionary.csv
```

6. Import the dataset:

```bash
python manage.py import_goodreads --data-dir data
```

Use `--limit 1000` for a quick smoke import.

7. Start the backend:

```bash
python manage.py runserver 0.0.0.0:8000
```

8. Start the frontend:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## API Highlights

- `POST /api/auth/register/`
- `POST /api/auth/login/`
- `GET /api/books/?search=&genre=`
- `GET /api/books/popular/`
- `GET /api/books/recommendations/`
- `GET /api/books/:id/similar/`
- `GET|POST /api/reviews/`
- `POST /api/reviews/:id/like/`
- `POST /api/reviews/:id/comment/`
- `GET|POST /api/shelves/`
- `GET /api/feed/`
- `POST /api/users/:id/follow/`
- `POST /api/users/:id/unfollow/`
