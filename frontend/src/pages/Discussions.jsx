import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";

const discussions = [
  {
    id: 1,
    title: "What book changed your life?",
    author: "reader_emma",
    replies: 243,
    category: "General",
    time: "2 hours ago",
    preview: "I'd love to hear everyone's picks — fiction or non-fiction, anything goes!",
  },
  {
    id: 2,
    title: "Best fantasy series to start with in 2026",
    author: "fantasyFan99",
    replies: 87,
    category: "Fantasy",
    time: "5 hours ago",
    preview: "Looking for something with great world-building but not too intimidating for a newcomer.",
  },
  {
    id: 3,
    title: "Monthly read-along: The Name of the Wind",
    author: "bookclub_host",
    replies: 152,
    category: "Book Club",
    time: "1 day ago",
    preview: "Chapters 1–10 discussion thread. Please use spoiler tags for anything beyond!",
  },
  {
    id: 4,
    title: "Recommend a mystery that kept you up all night",
    author: "mystery_lover",
    replies: 64,
    category: "Mystery",
    time: "1 day ago",
    preview: "I finished Gone Girl in one sitting and need something equally gripping.",
  },
  {
    id: 5,
    title: "Classic literature: overrated or underrated?",
    author: "literary_critic",
    replies: 311,
    category: "Classics",
    time: "2 days ago",
    preview: "Hot take: most classics are assigned too early in school before readers are ready for them.",
  },
  {
    id: 6,
    title: "Romance novels that don't rely on tropes",
    author: "romancereader",
    replies: 98,
    category: "Romance",
    time: "3 days ago",
    preview: "Tired of enemies-to-lovers and fake dating. What romance novels actually surprised you?",
  },
  {
    id: 7,
    title: "Science fiction predictions that came true",
    author: "scifi_nerd",
    replies: 175,
    category: "Science Fiction",
    time: "4 days ago",
    preview: "1984, Brave New World, Neuromancer — what else should be on this list?",
  },
  {
    id: 8,
    title: "Young Adult books worth reading as an adult",
    author: "ya_forever",
    replies: 52,
    category: "Young Adult",
    time: "5 days ago",
    preview: "The Harry Potter debate aside, what YA holds up when you re-read it as a grown-up?",
  },
];

const categories = ["All", "General", "Fantasy", "Mystery", "Romance", "Classics", "Science Fiction", "Young Adult", "Book Club"];

export default function Discussions() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const filtered = useMemo(() => {
    return discussions.filter((d) => {
      const matchesCategory = category === "All" || d.category === category;
      const normalized = query.trim().toLowerCase();
      const matchesQuery =
        !normalized ||
        d.title.toLowerCase().includes(normalized) ||
        d.preview.toLowerCase().includes(normalized) ||
        d.author.toLowerCase().includes(normalized);
      return matchesCategory && matchesQuery;
    });
  }, [query, category]);

  return (
    <section className="content-panel">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <h1>Discussions</h1>
        <Link className="primary-button" to="/community">Browse Groups</Link>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <form
          onSubmit={(e) => e.preventDefault()}
          style={{ display: "flex", gap: "0.5rem", flex: 1, minWidth: "200px" }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search discussions..."
            style={{ flex: 1 }}
          />
        </form>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="chip-row" style={{ marginBottom: "1rem" }}>
        {categories.slice(1).map((c) => (
          <button
            key={c}
            className={category === c ? "is-active" : ""}
            onClick={() => setCategory(category === c ? "All" : c)}
          >
            {c}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="muted">No discussions match your search.</p>
      )}

      <div className="review-list">
        {filtered.map((d) => (
          <article key={d.id} className="review-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "0.3rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "flex-start" }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>{d.title}</p>
                <p className="muted" style={{ margin: "0.1rem 0 0.3rem", fontSize: "0.8rem" }}>
                  by {d.author} · {d.time} · <span style={{ background: "#f0ebe0", padding: "1px 6px", borderRadius: "3px" }}>{d.category}</span>
                </p>
              </div>
              <span className="muted" style={{ fontSize: "0.8rem", whiteSpace: "nowrap", marginLeft: "1rem" }}>
                {d.replies} replies
              </span>
            </div>
            <p style={{ margin: 0, color: "#555", fontSize: "0.9rem" }}>{d.preview}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
