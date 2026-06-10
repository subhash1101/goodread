import React, { useEffect, useState } from "react";
import BookCard from "../components/BookCard.jsx";
import { api, unwrap } from "../lib/api";

export default function Recommendations() {
  const [books, setBooks] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/books/recommendations/")
      .then((payload) => setBooks(unwrap(payload)))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <section className="content-panel">
      <h1>Recommendations</h1>
      <p className="muted">Based on your shelves, ratings, favorite genres, and similar book links.</p>
      {error && <p className="error">{error}</p>}
      <div className="book-grid">{books.map((book) => <BookCard book={book} key={book.id} />)}</div>
    </section>
  );
}
