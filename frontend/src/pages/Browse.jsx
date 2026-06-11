import React from "react";
import { Filter, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import BookCard from "../components/BookCard.jsx";
import { api, unwrap } from "../lib/api";
import NewReleases from "./NewReleases.jsx";

const genreSeeds = ["Fiction", "Fantasy", "Romance", "Mystery", "Young Adult", "Classics", "Science Fiction", "Historical"];

const PALETTES = [
  { bg: "#1e3a5f", text: "#e8f0fe" },
  { bg: "#8b1a1a", text: "#fce8e8" },
  { bg: "#2d5016", text: "#d8f3dc" },
  { bg: "#4a1942", text: "#f3e5f5" },
  { bg: "#7b4f1a", text: "#fef3cd" },
  { bg: "#1a4e6b", text: "#e3f2fd" },
  { bg: "#5c4033", text: "#efebe9" },
  { bg: "#1b5e20", text: "#f1f8e9" },
  { bg: "#0d47a1", text: "#e3f2fd" },
  { bg: "#880e4f", text: "#fce4ec" },
];

function palette(id) {
  return PALETTES[id % PALETTES.length];
}

function BookThumb({ book, small = false }) {
  const { bg, text } = palette(book.id);
  const base = {
    display: "block",
    width: "100%",
    aspectRatio: "2/3",
    borderRadius: "4px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
    objectFit: "cover",
  };
  const fallback = {
    ...base,
    backgroundColor: bg,
    color: text,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: small ? "3px" : "6px",
    textAlign: "center",
    fontSize: small ? "8px" : "10px",
    fontWeight: "bold",
    lineHeight: 1.3,
    gap: "2px",
  };
  return (
    <Link to={`/books/${book.id}`} title={`${book.title} by ${book.author}`} style={{ display: "block" }}>
      {book.image_url ? (
        <img src={book.image_url} alt={book.title} style={base} />
      ) : (
        <div style={fallback}>
          <span>{book.title}</span>
          {!small && <span style={{ fontWeight: "normal", opacity: 0.75, fontSize: "9px" }}>{book.author}</span>}
        </div>
      )}
    </Link>
  );
}

function groupByGenre(books) {
  const map = new Map();
  for (const book of books) {
    const genre = (book.genres && book.genres[0]) || "Other";
    if (!map.has(genre)) map.set(genre, []);
    if (map.get(genre).length < 5) map.get(genre).push(book);
  }
  return [...map.entries()];
}

function PopularBooksView({ books, error }) {
  const groups = groupByGenre(books);
  const sidebarBooks = [...books].sort((a, b) => b.avg_rating - a.avg_rating).slice(0, 15);

  return (
    <div
      className="p-6 max-w-7xl mx-auto"
      style={{ fontFamily: "'Georgia', serif", backgroundColor: "#fcfbf7", color: "#333333" }}
    >
      <header className="mb-6">
        <h1 className="text-2xl font-serif text-amber-950 font-bold">Popular Books</h1>
        <p className="text-sm text-gray-500 mt-1" style={{ fontFamily: "'Arial', sans-serif" }}>
          Most rated books across all genres
        </p>
      </header>

      {error && (
        <p style={{ color: "#c0392b", marginBottom: "1rem", fontSize: "0.9rem" }}>{error}</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <main className="lg:col-span-3">
          {books.length === 0 && !error ? (
            <div className="space-y-8">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="grid grid-cols-6 items-center gap-4">
                  <div className="col-span-1" />
                  <div className="col-span-5 grid grid-cols-5 gap-2">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <div
                        key={j}
                        style={{ width: "100%", aspectRatio: "2/3", borderRadius: "4px", backgroundColor: "#e5e0d5" }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-8">
              {groups.map(([genre, genreBooks]) => (
                <div key={genre} className="grid grid-cols-6 items-center gap-4">
                  <div className="col-span-1 text-right italic text-gray-600 font-serif pr-4 text-sm">
                    {genre.toLowerCase()}
                  </div>
                  <div className="col-span-5 grid grid-cols-5 gap-2">
                    {genreBooks.map((book) => (
                      <BookThumb key={book.id} book={book} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        <aside
          className="lg:col-span-1 lg:border-l lg:border-gray-200 lg:pl-6"
          style={{ fontFamily: "'Arial', sans-serif" }}
        >
          <div>
            <h3 className="text-xs font-bold tracking-wider uppercase text-amber-900 border-b border-gray-300 pb-1 mb-3">
              Top Rated
            </h3>
            {sidebarBooks.length === 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div
                    key={i}
                    style={{ width: "100%", aspectRatio: "2/3", borderRadius: "4px", backgroundColor: "#e5e0d5" }}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {sidebarBooks.map((book) => (
                  <BookThumb key={book.id} book={book} small />
                ))}
              </div>
            )}
            <div className="mt-4 text-center">
              <Link
                to="/browse?mode=new"
                className="text-xs text-cyan-700 hover:underline font-semibold"
              >
                new releases »
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

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
    if (params.get("mode") === "new") return;
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

  if (params.get("mode") === "new") {
    return <NewReleases />;
  }

  if (params.get("mode") === "popular") {
    return <PopularBooksView books={books} error={error} />;
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
