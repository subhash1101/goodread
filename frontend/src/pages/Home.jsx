import React from "react";
import { RefreshCw, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import BookCard from "../components/BookCard.jsx";
import { api, unwrap } from "../lib/api";
import { useAuth } from "../lib/auth.jsx";

export default function Home() {
  const auth = useAuth();
  const [feed, setFeed] = useState([]);
  const [popular, setPopular] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const popularPayload = await api("/books/popular/");
      setPopular(unwrap(popularPayload));
      if (auth.isAuthenticated) {
        const feedPayload = await api("/feed/");
        setFeed(unwrap(feedPayload));
      }
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, [auth.isAuthenticated]);

  return (
    <div className="two-column">
      <section className="content-panel">
        <div className="section-head">
          <div>
            <h1>Friend Activity</h1>
            <p className="muted">Ratings, reviews, and shelf updates from people you follow.</p>
          </div>
          <button className="icon-button" title="Refresh feed" onClick={load}>
            <RefreshCw size={18} />
          </button>
        </div>
        {error && <p className="error">{error}</p>}
        {!auth.isAuthenticated && (
          <div className="empty-state">
            <p>Sign in to see your social reading feed.</p>
            <Link className="primary-button" to="/login">Sign in</Link>
          </div>
        )}
        {auth.isAuthenticated && feed.length === 0 && <p className="muted">No activity yet. Follow readers from Community.</p>}
        <div className="feed-list">
          {feed.map((event) => (
            <article className="feed-item" key={event.id}>
              <div>
                <strong>{event.user.username}</strong>
                <span> {labelFor(event.type, event.shelf_status)} </span>
                <Link to={`/books/${event.book.id}`}>{event.book.title}</Link>
              </div>
              {event.review?.rating && (
                <div className="rating-line">
                  <Star size={15} fill="currentColor" />
                  <span>{event.review.rating}</span>
                </div>
              )}
              {event.review?.review_text && <p>{event.review.review_text}</p>}
            </article>
          ))}
        </div>
      </section>

      <aside className="side-panel">
        <h2>Popular Books</h2>
        <div className="compact-list">
          {popular.slice(0, 6).map((book) => (
            <BookCard book={book} key={book.id} onShelved={load} />
          ))}
        </div>
      </aside>
    </div>
  );
}

function labelFor(type, shelfStatus) {
  if (type === "REVIEW") return "reviewed";
  if (type === "RATE") return "rated";
  if (type === "ADD_SHELF") return `added to ${shelfStatus?.replaceAll("_", " ") || "a shelf"}`;
  return "updated";
}
