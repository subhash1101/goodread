import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import BookCard from "../components/BookCard.jsx";
import { api, unwrap } from "../lib/api";
import { useAuth } from "../lib/auth.jsx";

export default function Recommendations() {
  const { isAuthenticated } = useAuth();
  const [books, setBooks] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAuthenticated) return;
    api("/books/recommendations/")
      .then((payload) => setBooks(unwrap(payload)))
      .catch((err) => setError(err.message));
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <section className="content-panel">
        <h1>Recommendations</h1>
        <p className="muted">
          <Link to="/login">Sign in</Link> to see personalised recommendations.
        </p>
      </section>
    );
  }

  return (
    <section className="content-panel">
      <h1>Recommendations</h1>
      <p className="muted">Based on your shelves, ratings, favourite genres, and similar book links.</p>
      {error && <p className="error">{error}</p>}
      <div className="book-grid">{books.map((book) => <BookCard book={book} key={book.id} />)}</div>
    </section>
  );
}
