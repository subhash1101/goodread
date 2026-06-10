import React from "react";
import { MessageSquare, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, unwrap } from "../lib/api";

export default function MyReviews() {
  const [reviews, setReviews] = useState([]);

  async function load() {
    const payload = await api("/reviews/?mine=true");
    setReviews(unwrap(payload));
  }

  async function remove(id) {
    await api(`/reviews/${id}/`, { method: "DELETE" });
    load();
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="content-panel">
      <h1>My Reviews</h1>
      <div className="review-list">
        {reviews.map((review) => (
          <article className="review-row" key={review.id}>
            <div>
              <Link to={`/books/${review.book.id}`}>{review.book.title}</Link>
              <p>{review.review_text || "Rated without text."}</p>
              <span className="muted">{review.rating} stars</span>
            </div>
            <button className="icon-button danger" title="Delete review" onClick={() => remove(review.id)}>
              <Trash2 size={17} />
            </button>
          </article>
        ))}
      </div>
      {reviews.length === 0 && (
        <p className="muted"><MessageSquare size={16} /> No reviews yet.</p>
      )}
    </section>
  );
}
