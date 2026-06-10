import React from "react";
import { BookMarked, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

export default function BookCard({ book, onShelved }) {
  async function addShelf(status) {
    await api("/shelves/", {
      method: "POST",
      body: JSON.stringify({ book_id: book.id, status }),
    });
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
          <button title="Want to Read" onClick={() => addShelf("want_to_read")}>
            <BookMarked size={16} />
            Want
          </button>
          <button title="Currently Reading" onClick={() => addShelf("reading")}>
            Reading
          </button>
          <button title="Read" onClick={() => addShelf("read")}>
            Read
          </button>
        </div>
      </div>
    </article>
  );
}
