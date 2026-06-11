import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, unwrap } from "../lib/api";

const GENRE_ROWS = [
  { label: "fiction", query: "Fiction" },
  { label: "historical fiction", query: "Historical Fiction" },
  { label: "mystery & thriller", query: "Mystery" },
  { label: "romance", query: "Romance" },
  { label: "fantasy", query: "Fantasy" },
  { label: "science fiction", query: "Science Fiction" },
];

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
  const coverStyle = {
    display: "block",
    width: "100%",
    aspectRatio: "2/3",
    objectFit: "cover",
    borderRadius: "4px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
  };
  const fallbackStyle = {
    ...coverStyle,
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
        <img src={book.image_url} alt={book.title} style={coverStyle} />
      ) : (
        <div style={fallbackStyle}>
          <span>{book.title}</span>
          {!small && <span style={{ fontWeight: "normal", opacity: 0.75, fontSize: "9px" }}>{book.author}</span>}
        </div>
      )}
    </Link>
  );
}

function SkeletonCover() {
  return (
    <div
      style={{
        width: "100%",
        aspectRatio: "2/3",
        borderRadius: "4px",
        backgroundColor: "#e5e0d5",
      }}
    />
  );
}

export default function NewReleases() {
  const [rows, setRows] = useState(
    GENRE_ROWS.map((g) => ({ ...g, books: [], loading: true }))
  );
  const [error, setError] = useState("");

  const currentMonth = new Date().toLocaleString("default", { month: "long", year: "numeric" });

  useEffect(() => {
    GENRE_ROWS.forEach((row, i) => {
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
        })
        .catch((err) => {
          setError(err.message);
          setRows((prev) => {
            const next = [...prev];
            next[i] = { ...next[i], loading: false };
            return next;
          });
        });
    });
  }, []);

  const allBooks = rows.flatMap((r) => r.books);
  const sidebarBooks = [...allBooks]
    .sort((a, b) => b.ratings_count - a.ratings_count)
    .slice(0, 15);

  return (
    <div
      className="p-6 max-w-7xl mx-auto"
      style={{ fontFamily: "'Georgia', serif", backgroundColor: "#fcfbf7", color: "#333333" }}
    >
      <header className="mb-6">
        <h1 className="text-2xl font-serif text-amber-950 font-bold">
          New Releases for {currentMonth}
        </h1>
      </header>

      {error && (
        <p style={{ color: "#c0392b", marginBottom: "1rem", fontSize: "0.9rem" }}>{error}</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <main className="lg:col-span-3">
          <div className="space-y-8">
            {rows.map((row) => (
              <div key={row.query} className="grid grid-cols-6 items-center gap-4">
                <div className="col-span-1 text-right italic text-gray-600 font-serif pr-4 text-sm">
                  {row.label}
                </div>
                <div className="col-span-5 grid grid-cols-5 gap-2">
                  {row.loading
                    ? Array.from({ length: 5 }).map((_, j) => <SkeletonCover key={j} />)
                    : row.books.length > 0
                    ? row.books.map((book) => <BookThumb key={book.id} book={book} />)
                    : Array.from({ length: 5 }).map((_, j) => (
                        <div
                          key={j}
                          style={{
                            width: "100%",
                            aspectRatio: "2/3",
                            borderRadius: "4px",
                            backgroundColor: "#f0ebe0",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "10px",
                            color: "#999",
                          }}
                        >
                          no data
                        </div>
                      ))}
                </div>
              </div>
            ))}
          </div>
        </main>

        <aside
          className="lg:col-span-1 lg:border-l lg:border-gray-200 lg:pl-6"
          style={{ fontFamily: "'Arial', sans-serif" }}
        >
          <div>
            <h3 className="text-xs font-bold tracking-wider uppercase text-amber-900 border-b border-gray-300 pb-1 mb-3">
              Popular New Releases
            </h3>
            {sidebarBooks.length === 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 9 }).map((_, i) => <SkeletonCover key={i} />)}
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
                to="/browse?mode=popular"
                className="text-xs text-cyan-700 hover:underline font-semibold"
              >
                more popular books »
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
