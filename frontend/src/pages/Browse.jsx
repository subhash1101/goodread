import React from "react";
import { Search, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api, unwrap } from "../lib/api";

const GENRES = [
  "Fiction", "Fantasy", "Romance", "Mystery",
  "Young Adult", "Classics", "Science Fiction", "Historical",
];

const RELEASE_GENRES = [
  { label: "fiction",             query: "Fiction" },
  { label: "historical fiction",  query: "Historical Fiction" },
  { label: "mystery & thriller",  query: "Mystery" },
  { label: "romance",             query: "Romance" },
  { label: "fantasy",             query: "Fantasy" },
  { label: "science fiction",     query: "Science Fiction" },
];

function fmtCount(n) {
  const num = Number(n || 0);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}m`;
  if (num >= 1_000)     return `${(num / 1_000).toFixed(1)}k`;
  return String(num);
}

// ── Vertical book card ────────────────────────────────────────────────────
function BrowseCard({ book }) {
  return (
    <Link to={`/books/${book.id}`} className="brw-card">
      <div className="brw-card-cover">
        {book.image_url
          ? <img src={book.image_url} alt={book.title} />
          : <div className="brw-card-fallback">{book.title?.[0]}</div>}
      </div>
      <div className="brw-card-info">
        <span className="brw-card-title">{book.title}</span>
        <span className="brw-card-author">{book.author}</span>
        <span className="brw-card-rating">
          <Star size={11} fill="currentColor" />
          {Number(book.avg_rating || 0).toFixed(2)}
          <span className="brw-card-count">· {fmtCount(book.ratings_count)}</span>
        </span>
      </div>
    </Link>
  );
}

// ── Small thumbnail (genre rows) ──────────────────────────────────────────
function Thumb({ book }) {
  return (
    <Link to={`/books/${book.id}`} className="brw-thumb" title={book.title}>
      {book.image_url
        ? <img src={book.image_url} alt={book.title} />
        : <div className="brw-thumb-fallback">{book.title?.[0]}</div>}
    </Link>
  );
}

// ── Skeleton placeholder ──────────────────────────────────────────────────
function Skeleton() {
  return <div className="brw-skeleton" />;
}

// ── Genre row: label + 5 book covers ─────────────────────────────────────
function GenreRow({ label, books, loading }) {
  return (
    <div className="brw-genre-row">
      <span className="brw-genre-label">{label}</span>
      <div className="brw-genre-books">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} />)
          : books.map((b) => <Thumb key={b.id} book={b} />)}
      </div>
    </div>
  );
}

// ── Sidebar (top-rated or popular new) ───────────────────────────────────
function Sidebar({ books, heading, linkTo, linkLabel }) {
  return (
    <aside className="brw-sidebar">
      <h3 className="brw-sidebar-heading">{heading}</h3>
      <div className="brw-sidebar-grid">
        {books.length === 0
          ? Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} />)
          : books.slice(0, 12).map((b) => (
            <Link key={b.id} to={`/books/${b.id}`} className="brw-sidebar-thumb" title={b.title}>
              {b.image_url
                ? <img src={b.image_url} alt={b.title} />
                : <div className="brw-thumb-fallback">{b.title?.[0]}</div>}
            </Link>
          ))}
      </div>
      <Link to={linkTo} className="brw-sidebar-more">{linkLabel} »</Link>
    </aside>
  );
}

// ── Popular Books view ────────────────────────────────────────────────────
function PopularView() {
  const [groups, setGroups]   = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/books/popular/")
      .then((payload) => {
        const books = unwrap(payload);
        const map = new Map();
        for (const b of books) {
          const g = (b.genres && b.genres[0]) || "Other";
          if (!map.has(g)) map.set(g, []);
          if (map.get(g).length < 5) map.get(g).push(b);
        }
        setGroups([...map.entries()]);
        setTopRated([...books].sort((a, b) => b.avg_rating - a.avg_rating).slice(0, 12));
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="brw-split">
      <main className="brw-split-main">
        {loading
          ? [1,2,3,4,5].map((i) => <GenreRow key={i} label="…" books={[]} loading />)
          : groups.map(([genre, books]) => (
            <GenreRow key={genre} label={genre.toLowerCase()} books={books} loading={false} />
          ))}
      </main>
      <Sidebar
        books={topRated}
        heading="Top Rated"
        linkTo="/browse?mode=new"
        linkLabel="New Releases"
      />
    </div>
  );
}

// ── New Releases view ─────────────────────────────────────────────────────
function NewReleasesView() {
  const [rows, setRows]     = useState(RELEASE_GENRES.map((g) => ({ ...g, books: [], loading: true })));
  const [popular, setPopular] = useState([]);
  const month = new Date().toLocaleString("default", { month: "long", year: "numeric" });

  useEffect(() => {
    RELEASE_GENRES.forEach((row, i) => {
      api(`/books/?genre=${encodeURIComponent(row.query)}`)
        .then((payload) => {
          const sorted = unwrap(payload)
            .sort((a, b) => (b.original_publication_year || 0) - (a.original_publication_year || 0))
            .slice(0, 5);
          setRows((prev) => {
            const next = [...prev];
            next[i] = { ...next[i], books: sorted, loading: false };
            return next;
          });
          setPopular((prev) =>
            [...prev, ...sorted].sort((a, b) => b.ratings_count - a.ratings_count).slice(0, 12)
          );
        })
        .catch(() =>
          setRows((prev) => {
            const next = [...prev];
            next[i] = { ...next[i], loading: false };
            return next;
          })
        );
    });
  }, []);

  return (
    <div className="brw-split">
      <main className="brw-split-main">
        <p className="brw-sub-label">New releases · {month}</p>
        {rows.map((row) => (
          <GenreRow key={row.query} label={row.label} books={row.books} loading={row.loading} />
        ))}
      </main>
      <Sidebar
        books={popular}
        heading="Popular New Releases"
        linkTo="/browse?mode=popular"
        linkLabel="All Popular"
      />
    </div>
  );
}

// ── Main Browse page ──────────────────────────────────────────────────────
const MODES = [
  { key: "search",  label: "All Books" },
  { key: "popular", label: "Popular" },
  { key: "new",     label: "New Releases" },
];

export default function Browse() {
  const location = useLocation();
  const params   = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const mode     = params.get("mode") || "search";

  const [books,       setBooks]       = useState([]);
  const [query,       setQuery]       = useState(params.get("search") || "");
  const [activeGenre, setActiveGenre] = useState(params.get("genre") || "");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");

  async function load(q = query, g = activeGenre) {
    setError(""); setLoading(true);
    const qs = new URLSearchParams();
    if (q) qs.set("search", q);
    if (g) qs.set("genre",  g);
    qs.set("page_size", "50");
    try {
      const payload = await api(`/books/?${qs.toString()}`);
      setBooks(unwrap(payload));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (mode !== "search") return;
    const q = params.get("search") || "";
    const g = params.get("genre")  || "";
    setQuery(q); setActiveGenre(g);
    load(q, g);
  }, [location.search]);

  function submit(e) { e.preventDefault(); load(); }

  function pickGenre(name) {
    const next = activeGenre === name ? "" : name;
    setActiveGenre(next);
    load(query, next);
  }

  function clearAll() { setQuery(""); setActiveGenre(""); load("", ""); }

  return (
    <div className="brw-page">

      {/* ── Page header ──────────────────────────── */}
      <div className="brw-page-header">
        <div>
          <h1 className="brw-page-title">Browse Books</h1>
          <p className="brw-page-sub">Discover your next great read</p>
        </div>
      </div>

      {/* ── Mode tabs ────────────────────────────── */}
      <div className="brw-nav-bar">
        <div className="brw-mode-tabs">
          {MODES.map(({ key, label }) => (
            <Link
              key={key}
              to={key === "search" ? "/browse" : `/browse?mode=${key}`}
              className={`brw-mode-tab${mode === key ? " active" : ""}`}
            >
              {label}
            </Link>
          ))}
        </div>

        {mode === "search" && (
          <form className="brw-searchbar" onSubmit={submit}>
            <Search size={15} className="brw-searchbar-icon" />
            <input
              className="brw-searchbar-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Title, author…"
            />
            {query && (
              <button type="button" className="brw-clear" onClick={clearAll} title="Clear">✕</button>
            )}
            <button type="submit" className="brw-search-btn">Search</button>
          </form>
        )}
      </div>

      {/* ── Genre chips (search mode) ─────────────── */}
      {mode === "search" && (
        <div className="brw-chips">
          <button className={`brw-chip${!activeGenre ? " active" : ""}`} onClick={() => pickGenre("")}>
            All
          </button>
          {GENRES.map((name) => (
            <button
              key={name}
              className={`brw-chip${activeGenre === name ? " active" : ""}`}
              onClick={() => pickGenre(name)}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {/* ── Error ───────────────────────────────── */}
      {error && <p className="brw-error">{error}</p>}

      {/* ── Routed content ─────────────────────── */}
      {mode === "popular" && <PopularView />}
      {mode === "new"     && <NewReleasesView />}

      {mode === "search" && (
        <>
          {loading && (
            <div className="brw-grid">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="brw-card-skeleton" />
              ))}
            </div>
          )}

          {!loading && books.length > 0 && (() => {
            const NO_COVER = "https://s.gr-assets.com/assets/nophoto/book/111x148-bcc042a9c91a29c1d680899eff700a03.png";
            const visible = books.filter((b) => b.image_url !== NO_COVER).slice(0, 35);
            return (
              <>
                <p className="brw-result-meta">
                  {visible.length} books{activeGenre ? ` in ${activeGenre}` : ""}
                  {query ? ` matching "${query}"` : ""}
                </p>
                <div className="brw-grid">
                  {visible.map((book) => <BrowseCard book={book} key={book.id} />)}
                </div>
              </>
            );
          })()}

          {!loading && books.length === 0 && (query || activeGenre) && !error && (
            <div className="brw-empty-state">
              <p className="brw-empty-msg">No books match your search.</p>
              <button className="primary-button" onClick={clearAll}>Clear filters</button>
            </div>
          )}

          {!loading && !query && !activeGenre && books.length === 0 && !error && (
            <div className="brw-empty-state">
              <p className="brw-empty-msg">Search for a title, author, or pick a genre above.</p>
            </div>
          )}
        </>
      )}

    </div>
  );
}
