import React from "react";
import { Filter, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import BookCard from "../components/BookCard.jsx";
import { api, unwrap } from "../lib/api";

const genreSeeds = ["Fiction", "Fantasy", "Romance", "Mystery", "Young Adult", "Classics", "Science Fiction", "Historical"];

export default function Browse() {
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const [books, setBooks] = useState([]);
  const [query, setQuery] = useState(params.get("search") || "");
  const [genre, setGenre] = useState(params.get("genre") || "");
  const [error, setError] = useState("");

  async function load(nextQuery = query, nextGenre = genre) {
    setError("");
    const search = new URLSearchParams();
    if (nextQuery) search.set("search", nextQuery);
    if (nextGenre) search.set("genre", nextGenre);
    try {
      const payload = params.get("mode") === "popular" && !nextQuery && !nextGenre
        ? await api("/books/popular/")
        : await api(`/books/?${search.toString()}`);
      setBooks(unwrap(payload));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    const nextQuery = params.get("search") || "";
    const nextGenre = params.get("genre") || "";
    setQuery(nextQuery);
    setGenre(nextGenre);
    load(nextQuery, nextGenre);
  }, [location.search]);

  function submit(event) {
    event.preventDefault();
    load();
  }

  return (
    <section className="content-panel">
      <div className="section-head">
        <div>
          <h1>Browse</h1>
          <p className="muted">Search the imported catalog by title, author, or genre.</p>
        </div>
      </div>
      <form className="filters" onSubmit={submit}>
        <label>
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title or author" />
        </label>
        <label>
          <Filter size={16} />
          <input value={genre} onChange={(event) => setGenre(event.target.value)} placeholder="Genre" />
        </label>
        <button className="primary-button">Search</button>
      </form>
      <div className="chip-row">
        {genreSeeds.map((name) => (
          <button key={name} onClick={() => { setGenre(name); load(query, name); }}>
            {name}
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <div className="book-grid">
        {books.map((book) => <BookCard book={book} key={book.id} />)}
      </div>
    </section>
  );
}
