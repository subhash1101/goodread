import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, unwrap } from "../lib/api";

/* ── Static data ─────────────────────────────────────────────────────────── */
const GENRE_COLUMNS = [
  ["Art", "Biography", "Business", "Children's", "Christian", "Classics", "Comics", "Cookbooks"],
  ["Ebooks", "Fantasy", "Fiction", "Graphic Novels", "Historical Fiction", "History", "Horror", "Memoir"],
  ["Music", "Mystery", "Nonfiction", "Poetry", "Psychology", "Romance", "Science", "Science Fiction"],
  ["Self Help", "Sports", "Thriller", "Travel", "Young Adult", "More genres"],
];

const AWARD_LINKS = [
  "Readers' Favorite 2025",            "Readers' Favorite Fiction",
  "Readers' Favorite Historical Fiction","Readers' Favorite Mystery & Thriller",
  "Readers' Favorite Romance",          "Readers' Favorite Romantasy",
  "Readers' Favorite Fantasy",          "Readers' Favorite Science Fiction",
  "Readers' Favorite Horror",           "Readers' Favorite Debut Novel",
  "Readers' Favorite Audiobook",        "Readers' Favorite Young Adult Fantasy",
  "Readers' Favorite Nonfiction",       "Readers' Favorite Memoir",
];

const QUOTE = {
  text: "I'm selfish, impatient and a little insecure. I make mistakes, I am out of control and at times hard to handle. But if you can't handle me at my worst, then you sure as hell don't deserve me at my best.",
  author: "Marilyn Monroe",
};

const QUOTE_LINKS = ["Best quotes","Love quotes","Inspirational quotes","Funny quotes","Motivational quotes","Life quotes","More quotes"];

const LOVE_LISTS = [
  { title: "Best for Book Clubs",           stats: "13,326 books · 19,636 votes",  color: "#78350f" },
  { title: "Best Crime & Mystery Books",    stats: "7,464 books · 14,240 votes",   color: "#0f172a" },
  { title: "Best Books of the 20th Century",stats: "7,827 books · 49,525 votes",   color: "#27272a" },
];

const FALLBACK_COLORS = [
  "#134e4a","#991b1b","#1e3a8a","#6b21a8",
  "#b45309","#14532d","#44403c","#0f172a","#7c2d12","#1e40af",
];

export default function Landing() {
  const navigate  = useNavigate();
  const [books, setBooks] = useState([]);
  const [searchQ, setSearchQ] = useState("");

  useEffect(() => {
    api("/books/popular/").then((d) => setBooks(unwrap(d))).catch(() => {});
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    navigate(searchQ.trim() ? `/browse?search=${encodeURIComponent(searchQ.trim())}` : "/browse");
  }

  return (
    <div className="lp-root">

      {/* ══ HERO BANNER ════════════════════════════════════════════════════════ */}
      <section className="lp-hero">
        <div className="lp-hero-inner">

          {/* Left: copy */}
          <div className="lp-hero-copy">
            <h1 className="lp-hero-h1">
              The Big Books<br />
              <em>of Summer</em>{" "}
              <span className="lp-hero-sub">(and Beyond!)</span>
            </h1>
            <button className="lp-hero-cta" onClick={() => navigate("/browse")}>
              Discover more
            </button>
          </div>


        </div>
      </section>

      {/* ══ MAIN LAYOUT ════════════════════════════════════════════════════════ */}
      <div className="lp-main-grid">

        {/* ── Left column (3/4) ─────────────────────────────────────────────── */}
        <main className="lp-main">

          {/* Tagline pair */}
          <div className="lp-tagline-row">
            <div>
              <h3 className="lp-sm-heading">Deciding what to read next?</h3>
              <p className="lp-body-text">
                You're in the right place. Tell us what titles or genres you've enjoyed
                in the past, and we'll give you surprisingly insightful recommendations.
              </p>
            </div>
            <div>
              <h3 className="lp-sm-heading">What are your friends reading?</h3>
              <p className="lp-body-text">
                Chances are your friends are discussing their favorite (and least
                favorite) books on Goodreads.
              </p>
            </div>
          </div>

          {/* Discover — built from real book data */}
          {books.length >= 10 && (
            <div className="lp-discover-wrap">
              <h3 className="lp-sm-heading">What will you discover?</h3>
              <div className="lp-discover-box">
                {[0, 1].map((rowIdx) => {
                  const offset  = rowIdx * 5;
                  const spines  = books.slice(offset, offset + 4);
                  const result  = books[offset + 4];
                  return (
                    <div key={rowIdx} className="lp-discover-row">

                      <div className="lp-disc-left">
                        <span className="lp-because">Because you might like…</span>
                        <div className="lp-spines">
                          {spines.map((b, i) => (
                            <Link key={b.id} to={`/books/${b.id}`} className="lp-spine-link" title={b.title}>
                              {b.image_url
                                ? <img src={b.image_url} alt={b.title} className="lp-spine-img" />
                                : (
                                  <div
                                    className="lp-spine"
                                    style={{ background: FALLBACK_COLORS[(offset + i) % FALLBACK_COLORS.length], color: "#fff" }}
                                  >
                                    {b.title?.[0]}
                                  </div>
                                )}
                            </Link>
                          ))}
                        </div>
                      </div>

                      <span className="lp-arrow">➔</span>

                      <div className="lp-disc-right">
                        <Link to={`/books/${result.id}`} className="lp-spine-link" title={result.title}>
                          {result.image_url
                            ? <img src={result.image_url} alt={result.title} className="lp-spine-img lp-spine-result" />
                            : (
                              <div
                                className="lp-spine lp-spine-result"
                                style={{ background: FALLBACK_COLORS[(offset + 4) % FALLBACK_COLORS.length], color: "#fff" }}
                              >
                                {result.title?.[0]}
                              </div>
                            )}
                        </Link>
                        <div>
                          <span className="lp-disc-label">You might discover:</span>
                          <span className="lp-disc-title">{result.title}</span>
                          <span className="lp-disc-genre">{result.author}</span>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search & Browse genres */}
          <div className="lp-section">
            <h3 className="lp-sm-heading">Search and browse books</h3>
            <form className="lp-search-form" onSubmit={handleSearch}>
              <input
                className="lp-search-input"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Title / Author / ISBN"
              />
              <button type="submit" className="lp-search-icon">🔍</button>
            </form>
            <div className="lp-genre-grid">
              {GENRE_COLUMNS.map((col, ci) => (
                <div key={ci} className="lp-genre-col">
                  {col.map((g, gi) => (
                    <Link
                      key={g}
                      to={`/browse?genre=${encodeURIComponent(g)}`}
                      className={`lp-genre-link${gi === col.length - 1 && g === "More genres" ? " lp-genre-more" : ""}`}
                    >
                      {g}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Quotes */}
          <div className="lp-section">
            <h3 className="lp-sm-heading">Quotes</h3>
            <div className="lp-quotes-layout">
              <div className="lp-quote-left">
                <div className="lp-quote-avatar">MM</div>
                <p className="lp-quote-text">
                  &ldquo;{QUOTE.text}&rdquo;
                  <span className="lp-quote-attr">— {QUOTE.author}</span>
                </p>
              </div>
              <div className="lp-quote-links">
                {QUOTE_LINKS.map((l) => (
                  <Link key={l} to="/browse" className="lp-qlink">{l}</Link>
                ))}
              </div>
            </div>
          </div>

          {/* Choice Awards */}
          <div className="lp-section">
            <h3 className="lp-sm-heading">Goodreads Choice Awards: Readers' Favorite Books 2025</h3>
            <div className="lp-awards-layout">
              <div className="lp-awards-badge">
                <span className="lp-badge-line lp-badge-gr">goodreads</span>
                <span className="lp-badge-line lp-badge-ch">Choice</span>
                <span className="lp-badge-line lp-badge-aw">Awards</span>
              </div>
              <div className="lp-awards-grid">
                {AWARD_LINKS.map((l) => (
                  <Link key={l} to="/browse" className="lp-award-link">{l}</Link>
                ))}
              </div>
            </div>
          </div>

        </main>

        {/* ── Right sidebar (1/4) ───────────────────────────────────────────── */}
        <aside className="lp-sidebar">

          {/* News */}
          <div className="lp-sb-section">
            <h4 className="lp-sb-heading">News &amp; Interviews</h4>
            <Link to="/browse" className="lp-news-title">
              51 Popular New Young Adult Books to Read Right Now
            </Link>
            <div className="lp-news-banner">YOUNG ADULT LANDSCAPE 2026</div>
            <span className="lp-news-meta">46 items</span>
          </div>

          {/* Love Lists */}
          <div className="lp-sb-section">
            <h4 className="lp-sb-heading">Love lists?</h4>
            {LOVE_LISTS.map((list) => (
              <div key={list.title} className="lp-list-row">
                <div className="lp-list-info">
                  <Link to="/browse" className="lp-list-name">{list.title}</Link>
                  <span className="lp-list-stats">{list.stats}</span>
                </div>
                <div className="lp-list-chip" style={{ background: list.color }}>
                  {list.title.split(" ").slice(-1)[0].substring(0, 4).toUpperCase()}
                </div>
              </div>
            ))}
            <Link to="/browse" className="lp-more-link">More book lists</Link>
          </div>

          {/* Author program */}
          <div className="lp-sb-section lp-sb-border-top">
            <h4 className="lp-sb-h-dark">Are you an author or a publisher?</h4>
            <p className="lp-sb-body">
              Gain access to a massive audience of book lovers. Goodreads is a great
              place to promote your books.
            </p>
            <div className="lp-author-btns">
              <button className="lp-author-btn">Author program</button>
              <button className="lp-author-btn">Advertise</button>
            </div>
          </div>

        </aside>
      </div>

    </div>
  );
}
