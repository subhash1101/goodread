import React from "react";
import { Send, Star } from "lucide-react";
import { useState } from "react";
import { api } from "../lib/api";

export default function ReviewEditor({ bookId, onSaved }) {
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      await api("/reviews/", {
        method: "POST",
        body: JSON.stringify({ book_id: bookId, rating, review_text: reviewText }),
      });
      setReviewText("");
      onSaved?.();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="review-editor" onSubmit={submit}>
      <div className="rating-picker">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            type="button"
            title={`${value} stars`}
            className={value <= rating ? "active" : ""}
            onClick={() => setRating(value)}
            key={value}
          >
            <Star size={18} fill="currentColor" />
          </button>
        ))}
      </div>
      <textarea value={reviewText} onChange={(event) => setReviewText(event.target.value)} placeholder="Write a review" />
      {error && <p className="error">{error}</p>}
      <button className="primary-button" type="submit">
        <Send size={16} />
        Post review
      </button>
    </form>
  );
}
