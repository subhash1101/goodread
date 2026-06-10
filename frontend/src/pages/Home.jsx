import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, unwrap } from "../lib/api";
import { useAuth } from "../lib/auth.jsx";

const shelfLabels = {
  want_to_read: "Want to Read",
  reading: "Currently Reading",
  read: "Read",
};

export default function Home() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [feed, setFeed] = useState([]);
  const [popular, setPopular] = useState([]);
  const [shelves, setShelves] = useState({
    want_to_read: [],
    reading: [],
    read: [],
  });
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const popularPayload = await api("/books/popular/");
      setPopular(unwrap(popularPayload));

      if (!auth.isAuthenticated) {
        setFeed([]);
        setShelves({ want_to_read: [], reading: [], read: [] });
        return;
      }

      const [feedPayload, wantPayload, readingPayload, readPayload] = await Promise.all([
        api("/feed/"),
        api("/shelves/?status=want_to_read"),
        api("/shelves/?status=reading"),
        api("/shelves/?status=read"),
      ]);

      setFeed(unwrap(feedPayload));
      setShelves({
        want_to_read: unwrap(wantPayload),
        reading: unwrap(readingPayload),
        read: unwrap(readPayload),
      });
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, [auth.isAuthenticated]);

  const featuredBook = useMemo(() => popular[0], [popular]);
  const wantBook = shelves.want_to_read[0]?.book || popular[1] || popular[0];
  const readCount = shelves.read.length;
  const challengeGoal = 15;
  const challengePercent = Math.min(100, Math.round((readCount / challengeGoal) * 100));
  const ratedCount = feed.filter((event) => event.review?.rating).length;
  const recommendationPercent = Math.min(100, Math.round((ratedCount / 20) * 100));

  function submitSearch(event) {
    event.preventDefault();
    if (search.trim()) navigate(`/browse?search=${encodeURIComponent(search.trim())}`);
  }

  return (
    <>
      <div className="goodreads-home">
        <aside className="goodreads-column">
          <section className="gr-card">
            <h2 className="gr-card-title">Currently Reading</h2>
            <div className="gr-profile-box">
              <div className="gr-avatar" aria-hidden="true" />
              <form onSubmit={submitSearch}>
                <p>What are you reading?</p>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search books"
                />
              </form>
            </div>
            <div className="gr-tiny-links">
              <Link to="/recommendations">Recommendations</Link>
              <span>·</span>
              <Link to="/my-books?status=reading">General update</Link>
            </div>
          </section>

          <section className="gr-card gr-card-flush">
            <div className="gr-challenge">
              <p className="gr-overline">2026 Reading Challenge</p>
              <strong>2026</strong>
              <p>{readCount} books completed</p>
              <span>{challengeGoal - readCount} books to go</span>
              <div className="gr-progress-track">
                <div className="gr-progress-fill" style={{ width: `${challengePercent}%` }} />
              </div>
              <span>
                {readCount}/{challengeGoal} ({challengePercent}%)
              </span>
            </div>
          </section>

          <section className="gr-card">
            <h2 className="gr-card-title">Want to Read</h2>
            {wantBook ? <MiniBook book={wantBook} /> : <p className="gr-muted">Add your first book.</p>}
            <Link className="gr-small-link" to="/my-books?status=want_to_read">
              View all books
            </Link>
          </section>

          <section className="gr-card">
            <h2 className="gr-card-title">Bookshelves</h2>
            <ul className="gr-shelves">
              {Object.entries(shelfLabels).map(([status, label]) => (
                <li key={status}>
                  <Link to={`/my-books?status=${status}`}>{label}</Link>
                  <span>{shelves[status].length}</span>
                </li>
              ))}
              <li>
                <Link to="/my-books">Did Not Finish</Link>
                <span>0</span>
              </li>
            </ul>
          </section>
        </aside>

        <section className="goodreads-feed">
          <div className="gr-banner">
            <div>
              <h1>Find your next favorite book</h1>
              <p>Explore popular reads from your imported Goodreads library.</p>
            </div>
            <Link to="/browse" aria-label="Browse books">
              &rsaquo;
            </Link>
          </div>

          <section className="gr-card gr-welcome">
            <p>Welcome to Goodreads</p>
            <span>Meet your favorite book, find your reading community, and manage your reading life.</span>
          </section>

          <section className="gr-card">
            <div className="gr-card-title gr-title-row">
              <span>Updates</span>
              <button type="button" onClick={load}>
                Customize
              </button>
            </div>
            {error && <p className="error">{error}</p>}
            <p className="gr-trend">Trending this week from your imported catalog</p>
            {featuredBook ? (
              <FeaturedUpdate book={featuredBook} onShelved={load} />
            ) : (
              <p className="gr-muted">No books are available yet.</p>
            )}
          </section>

          {auth.isAuthenticated && feed.length > 0 && (
            <section className="gr-card">
              <div className="gr-card-title gr-title-row">
                <span>Friend Activity</span>
                <Link to="/community">Find readers</Link>
              </div>
              <div className="gr-activity-list">
                {feed.slice(0, 3).map((event) => (
                  <article key={event.id} className="gr-activity">
                    <strong>{event.user.username}</strong>
                    <span> {labelFor(event.type, event.shelf_status)} </span>
                    <Link to={`/books/${event.book.id}`}>{event.book.title}</Link>
                  </article>
                ))}
              </div>
            </section>
          )}

          {!auth.isAuthenticated && (
            <p className="gr-no-more">
              <Link to="/login">Sign in</Link> to see friend activity
            </p>
          )}
          {auth.isAuthenticated && feed.length === 0 && <p className="gr-no-more">No More Updates</p>}
        </section>

        <aside className="goodreads-column">
          <section className="gr-card">
            <h2 className="gr-card-title">News & Interviews</h2>
            <Link className="gr-news-title" to="/browse?mode=popular">
              Count to 10: Books with Numerical Titles
            </Link>
            <div className="gr-news-grid">
              {popular.slice(0, 6).map((book) => (
                <Link to={`/books/${book.id}`} key={book.id}>
                  {book.image_url ? <img src={book.image_url} alt="" /> : <span>{book.title?.[0]}</span>}
                </Link>
              ))}
            </div>
            <p className="gr-muted">23 Likes</p>
          </section>

          <section className="gr-card">
            <h2 className="gr-card-title">Improve Recommendations</h2>
            <p className="gr-card-copy">
              Rating at least 20 books improves your recommendations. You have rated {ratedCount}.
            </p>
            <div className="gr-progress-track gr-light-track">
              <div className="gr-progress-fill gr-gray-fill" style={{ width: `${recommendationPercent}%` }} />
            </div>
            <p className="gr-muted">
              {ratedCount} / 20 ({recommendationPercent}%)
            </p>
            <Link className="gr-small-link" to="/browse">
              Rate more books
            </Link>
          </section>

          <section className="gr-awards">
            <p className="gr-overline">Goodreads Choice Awards</p>
            <h2>Announcing Readers&apos; Favorite Books of 2025</h2>
            <span>7,516,397 Votes Cast</span>
          </section>
        </aside>
      </div>

      <footer className="gr-footer">
        <div>
          <section>
            <h2>Company</h2>
            <Link to="/community">About us</Link>
            <Link to="/browse">Careers</Link>
            <Link to="/login">Terms</Link>
            <Link to="/login">Privacy</Link>
          </section>
          <section>
            <h2>Work With Us</h2>
            <Link to="/community">Authors</Link>
            <Link to="/browse">Advertise</Link>
            <Link to="/browse">Authors & ads blog</Link>
          </section>
          <section>
            <h2>Connect</h2>
            <p>Social links</p>
          </section>
          <section>
            <h2>Download App</h2>
            <span>App Store</span>
            <span>Google Play</span>
          </section>
        </div>
        <p>© 2026 Goodreads LLC, an amazon company</p>
      </footer>
    </>
  );
}

function MiniBook({ book }) {
  return (
    <div className="gr-mini-book">
      <Link to={`/books/${book.id}`} className="gr-mini-cover">
        {book.image_url ? <img src={book.image_url} alt="" /> : <span>{book.title?.[0]}</span>}
      </Link>
      <div>
        <Link to={`/books/${book.id}`}>{book.title}</Link>
        <p>by {book.author}</p>
      </div>
    </div>
  );
}

function FeaturedUpdate({ book, onShelved }) {
  const auth = useAuth();
  const [shelfRecord, setShelfRecord] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function loadShelf() {
      if (!auth.isAuthenticated) {
        setShelfRecord(null);
        return;
      }
      const payload = await api(`/shelves/?book=${book.id}`);
      const current = unwrap(payload)[0] || null;
      if (!cancelled) setShelfRecord(current ? { id: current.id, status: current.status } : null);
    }
    loadShelf().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [auth.isAuthenticated, book.id]);

  async function addShelf(status) {
    if (shelfRecord?.status === status) {
      if (shelfRecord.id) await api(`/shelves/${shelfRecord.id}/`, { method: "DELETE" });
      setShelfRecord(null);
      onShelved?.();
      return;
    }

    const saved = await api("/shelves/", {
      method: "POST",
      body: JSON.stringify({ book_id: book.id, status }),
    });
    setShelfRecord({ id: saved.id, status: saved.status });
    onShelved?.();
  }

  return (
    <article className="gr-update">
      <Link to={`/books/${book.id}`} className="gr-update-cover">
        {book.image_url ? <img src={book.image_url} alt="" /> : <span>{book.title?.[0]}</span>}
      </Link>
      <div className="gr-update-details">
        <Link to={`/books/${book.id}`} className="gr-update-title">
          {book.title}
        </Link>
        <p>by {book.author}</p>
        <div className="gr-update-actions">
          <button
            className={shelfRecord?.status === "want_to_read" ? "is-active" : ""}
            type="button"
            onClick={() => addShelf("want_to_read")}
          >
            Want to Read
          </button>
          <button
            className={shelfRecord?.status === "reading" ? "is-active" : ""}
            type="button"
            aria-label="More shelf options"
            onClick={() => addShelf("reading")}
          >
            ▾
          </button>
          <span>Rate it:</span>
          <div aria-label={`${book.avg_rating} average rating`}>☆☆☆☆☆</div>
        </div>
        <p className="gr-description">
          {(book.description || `${book.title} is a popular book in the Goodreads catalog.`).slice(0, 220)}
          {(book.description || "").length > 220 ? "... " : " "}
          <Link to={`/books/${book.id}`}>Continue reading</Link>
        </p>
        <Link className="gr-small-link" to={`/books/${book.id}`}>
          Preview Book
        </Link>
      </div>
    </article>
  );
}

function labelFor(type, shelfStatus) {
  if (type === "REVIEW") return "reviewed";
  if (type === "RATE") return "rated";
  if (type === "ADD_SHELF") return `added to ${shelfStatus?.replaceAll("_", " ") || "a shelf"}`;
  return "updated";
}
