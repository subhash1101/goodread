import React, { useEffect, useState } from "react";
import { BookMarked, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { api, unwrap } from "../lib/api";
import { useAuth } from "../lib/auth.jsx";

export default function BookCard({ book, onShelved, initialShelfId = null, initialStatus = "" }) {
  const auth = useAuth();
  const [shelfRecord, setShelfRecord] = useState(
    initialStatus ? { id: initialShelfId, status: initialStatus } : null
  );

  useEffect(() => {
    setShelfRecord(initialStatus ? { id: initialShelfId, status: initialStatus } : null);
  }, [initialShelfId, initialStatus, book.id]);

  useEffect(() => {
    let cancelled = false;
    async function loadShelf() {
      if (!auth.isAuthenticated || initialStatus) return;
      const payload = await api(`/shelves/?book=${book.id}`);
      const current = unwrap(payload)[0] || null;
      if (!cancelled) setShelfRecord(current ? { id: current.id, status: current.status } : null);
    }
    loadShelf().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [auth.isAuthenticated, book.id, initialStatus]);

  async function toggleShelf(status) {
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
    <article className="book-card">
      <Link to={`/books/${book.id}`} className="cover-link">
        {book.image_url ? <img src={book.image_url} alt="" /> : <div className="cover-fallback">{book.title?.[0]}</div>}
      </Link>
      <div className="book-card-body">
        <Link to={`/books/${book.id}`} className="book-title">
          {book.title}
        </Link>
        <p className="muted">{book.author}</p>
        <div className="rating-line">
          <Star size={16} fill="currentColor" />
          <span>{book.avg_rating}</span>
          <span className="muted">{Number(book.ratings_count || 0).toLocaleString()} ratings</span>
        </div>
        <div className="genre-row">
          {(book.genres || []).slice(0, 3).map((genre) => (
            <span key={genre}>{genre}</span>
          ))}
        </div>
        <div className="shelf-buttons">
          <button
            className={shelfRecord?.status === "want_to_read" ? "is-active" : ""}
            title="Want to Read"
            onClick={() => toggleShelf("want_to_read")}
          >
            <BookMarked size={16} />
            Want
          </button>
          <button
            className={shelfRecord?.status === "reading" ? "is-active" : ""}
            title="Currently Reading"
            onClick={() => toggleShelf("reading")}
          >
            Reading
          </button>
          <button className={shelfRecord?.status === "read" ? "is-active" : ""} title="Read" onClick={() => toggleShelf("read")}>
            Read
          </button>
        </div>
      </div>
    </article>
  );
}
