import React, { useEffect, useMemo, useState } from "react";
import { Grid2X2, List, Search, X } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, unwrap } from "../lib/api";

const shelves = [
  ["all", "All"],
  ["want_to_read", "Want to Read"],
  ["reading", "Currently Reading"],
  ["read", "Read"],
  ["did_not_finish", "Did Not Finish"],
];

const shelfCopy = {
  all: "All",
  want_to_read: "Want to Read",
  reading: "Currently Reading",
  read: "Read",
  did_not_finish: "Did Not Finish",
};

export default function MyBooks() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const status = params.get("status") || "all";
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({ all: 0, want_to_read: 0, reading: 0, read: 0, did_not_finish: 0 });
  const [addQuery, setAddQuery] = useState("");
  const [sortBy, setSortBy] = useState("date_added");
  const [perPage, setPerPage] = useState("10");
  const [descending, setDescending] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const [allPayload, wantPayload, readingPayload, readPayload] = await Promise.all([
        api("/shelves/"),
        api("/shelves/?status=want_to_read"),
        api("/shelves/?status=reading"),
        api("/shelves/?status=read"),
      ]);

      const allItems = unwrap(allPayload);
      const nextCounts = {
        all: allPayload.count ?? allItems.length,
        want_to_read: wantPayload.count ?? unwrap(wantPayload).length,
        reading: readingPayload.count ?? unwrap(readingPayload).length,
        read: readPayload.count ?? unwrap(readPayload).length,
        did_not_finish: 0,
      };

      setCounts(nextCounts);
      if (status === "all") {
        setItems(allItems);
      } else if (status === "want_to_read") {
        setItems(unwrap(wantPayload));
      } else if (status === "reading") {
        setItems(unwrap(readingPayload));
      } else if (status === "read") {
        setItems(unwrap(readPayload));
      } else {
        setItems([]);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, [status]);

  const visibleItems = useMemo(() => {
    const sorted = [...items].sort((first, second) => {
      if (sortBy === "title") return first.book.title.localeCompare(second.book.title);
      if (sortBy === "author") return first.book.author.localeCompare(second.book.author);
      if (sortBy === "rating") return Number(second.book.avg_rating || 0) - Number(first.book.avg_rating || 0);
      return new Date(second.created_at) - new Date(first.created_at);
    });
    return descending ? sorted : sorted.reverse();
  }, [items, sortBy, descending]);

  function changeShelf(nextStatus) {
    if (nextStatus === "all") setParams({});
    else setParams({ status: nextStatus });
  }

  function addBooks(event) {
    event.preventDefault();
    navigate(addQuery.trim() ? `/browse?search=${encodeURIComponent(addQuery.trim())}` : "/browse");
  }

  async function removeShelf(shelfId) {
    await api(`/shelves/${shelfId}/`, { method: "DELETE" });
    load();
  }

  return (
    <>
      <div className="mybooks-page">
        <aside className="mybooks-sidebar">
          <section>
            <h2>
              Bookshelves <button type="button">(Edit)</button>
            </h2>
            <nav>
              {shelves.map(([value, label]) => (
                <button
                  className={status === value ? "active" : ""}
                  key={value}
                  type="button"
                  onClick={() => changeShelf(value)}
                >
                  {label} <span>({counts[value] || 0})</span>
                </button>
              ))}
            </nav>
            <button className="mybooks-add-shelf" type="button">Add shelf</button>
          </section>

          <section>
            <h2>Your reading activity</h2>
            <Link to="/my-reviews">Review Drafts</Link>
            <Link to="/my-reviews">Kindle Notes & Highlights</Link>
            <Link to="/recommendations">Reading Challenge</Link>
            <Link to="/my-books?status=read">Year in Books</Link>
            <Link to="/recommendations">Reading stats</Link>
          </section>

          <section>
            <h2>Add books</h2>
            <Link to="/recommendations">Recommendations</Link>
            <Link to="/browse">Explore</Link>
          </section>

          <section>
            <h2>Tools</h2>
            <Link to="/my-books">Find duplicates</Link>
            <Link to="/my-books">Widgets</Link>
            <Link to="/my-books">Import and export</Link>
          </section>
        </aside>

        <main className="mybooks-main">
          <div className="mybooks-heading-row">
            <h1>My Books</h1>
            <form className="mybooks-add-search" onSubmit={addBooks}>
              <input value={addQuery} onChange={(event) => setAddQuery(event.target.value)} placeholder="Search and add books" />
              <button type="submit" aria-label="Search and add books"><Search size={17} /></button>
            </form>
            <div className="mybooks-tools">
              <button type="button">Batch Edit</button>
              <button type="button">Settings</button>
              <button type="button">Stats</button>
              <button type="button">Print</button>
              <span />
              <button className="active" type="button" aria-label="List view"><List size={17} /></button>
              <button type="button" aria-label="Grid view"><Grid2X2 size={15} /></button>
            </div>
          </div>

          {error && <p className="error">{error}</p>}

          <div className="mybooks-table-wrap">
            <table className="mybooks-table">
              <thead>
                <tr>
                  <th>cover</th>
                  <th>title</th>
                  <th>author</th>
                  <th>avg rating</th>
                  <th>rating</th>
                  <th>shelves</th>
                  <th>review</th>
                  <th>date read</th>
                  <th>date added</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((shelf) => (
                  <ShelfRow item={shelf} key={shelf.id} onRemove={removeShelf} />
                ))}
              </tbody>
            </table>
          </div>

          {visibleItems.length === 0 && <p className="mybooks-empty">This shelf is empty.</p>}

          <div className="mybooks-table-controls">
            <label>
              <span>per page</span>
              <select value={perPage} onChange={(event) => setPerPage(event.target.value)}>
                <option>10</option>
                <option>20</option>
                <option>50</option>
              </select>
            </label>
            <label>
              <span>sort</span>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="date_added">Date added</option>
                <option value="title">Title</option>
                <option value="author">Author</option>
                <option value="rating">Average rating</option>
              </select>
            </label>
            <label>
              <input type="radio" checked={!descending} onChange={() => setDescending(false)} />
              asc.
            </label>
            <label>
              <input type="radio" checked={descending} onChange={() => setDescending(true)} />
              desc.
            </label>
            <span className="mybooks-rss">RSS</span>
          </div>
        </main>
      </div>

      <footer className="mybooks-footer">
        <div>
          <section>
            <h2>Company</h2>
            <Link to="/community">About us</Link>
            <Link to="/community">Careers</Link>
            <Link to="/login">Terms</Link>
            <Link to="/login">Privacy</Link>
            <Link to="/login">Help</Link>
          </section>
          <section>
            <h2>Work With Us</h2>
            <Link to="/community">Authors</Link>
            <Link to="/browse">Advertise</Link>
            <Link to="/browse">Authors & ads blog</Link>
          </section>
          <section>
            <h2>Connect</h2>
            <div className="mybooks-socials">
              <span>f</span><span>t</span><span>ig</span><span>in</span>
            </div>
          </section>
          <section>
            <div className="mybooks-store-row">
              <span>Download on the<br />App Store</span>
              <span>Get it on<br />Google Play</span>
            </div>
            <p>Mobile version</p>
            <p>© 2026 Goodreads LLC</p>
            <p>an amazon company</p>
          </section>
        </div>
      </footer>
    </>
  );
}

function ShelfRow({ item, onRemove }) {
  const { book } = item;

  return (
    <tr>
      <td>
        <Link className="mybooks-cover" to={`/books/${book.id}`}>
          {book.image_url ? <img src={book.image_url} alt="" /> : <span>{book.title?.[0]}</span>}
        </Link>
      </td>
      <td>
        <Link className="mybooks-book-title" to={`/books/${book.id}`}>{book.title}</Link>
      </td>
      <td>
        <Link to={`/browse?search=${encodeURIComponent(book.author)}`}>{shortAuthor(book.author)}</Link>
      </td>
      <td>{book.avg_rating}</td>
      <td><span className="mybooks-stars">☆☆☆☆☆</span></td>
      <td>
        <Link to={`/my-books?status=${item.status}`}>{shelfCopy[item.status] || item.status}</Link>
        <button type="button">[edit]</button>
      </td>
      <td><Link to={`/books/${book.id}`}>Write a review</Link></td>
      <td>
        <span className="muted">not set</span>
        <button type="button">[edit]</button>
      </td>
      <td>{formatDate(item.created_at)}</td>
      <td className="mybooks-row-actions">
        <button type="button">edit view »</button>
        <button type="button" aria-label={`Remove ${book.title}`} onClick={() => onRemove(item.id)}>
          <X size={16} />
        </button>
      </td>
    </tr>
  );
}

function shortAuthor(author = "") {
  const parts = author.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return author;
  return `${parts.at(-1)}, ${parts.slice(0, -1).join(" ")}`;
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}
