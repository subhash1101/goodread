import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import BookCard from "../components/BookCard.jsx";
import { api, unwrap } from "../lib/api";

const shelves = [
  ["want_to_read", "Want to Read"],
  ["reading", "Currently Reading"],
  ["read", "Read"],
];

export default function MyBooks() {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const status = params.get("status") || "want_to_read";

  async function load() {
    const payload = await api(`/shelves/?status=${status}`);
    setItems(unwrap(payload));
  }

  useEffect(() => {
    load();
  }, [status]);

  return (
    <section className="content-panel">
      <h1>My Books</h1>
      <div className="tabs">
        {shelves.map(([value, label]) => (
          <button className={status === value ? "active" : ""} onClick={() => setParams({ status: value })} key={value}>
            {label}
          </button>
        ))}
      </div>
      <div className="book-grid">
        {items.map((shelf) => <BookCard book={shelf.book} key={shelf.id} onShelved={load} />)}
      </div>
      {items.length === 0 && <p className="muted">This shelf is empty.</p>}
    </section>
  );
}
