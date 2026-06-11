import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, unwrap } from "../lib/api";
import { useAuth } from "../lib/auth.jsx";

const shelfLinks = [
  ["want_to_read", "to-read"],
  ["reading", "currently-reading"],
  ["read", "read"],
  ["did_not_finish", "did-not-finish"],
];

export default function Profile() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [shelves, setShelves] = useState({ all: [], want_to_read: [], reading: [], read: [] });
  const [reviews, setReviews] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const [allPayload, wantPayload, readingPayload, readPayload, reviewsPayload] = await Promise.all([
        api("/shelves/"),
        api("/shelves/?status=want_to_read"),
        api("/shelves/?status=reading"),
        api("/shelves/?status=read"),
        api("/reviews/?mine=true"),
      ]);
      setShelves({
        all: unwrap(allPayload),
        want_to_read: unwrap(wantPayload),
        reading: unwrap(readingPayload),
        read: unwrap(readPayload),
      });
      setReviews(unwrap(reviewsPayload));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const username = auth.username || "Reader";
  const savedFirstName = localStorage.getItem("profile_firstName");
  const savedLastName  = localStorage.getItem("profile_lastName");
  const savedPhoto     = localStorage.getItem("profile_photo");
  const savedCountry   = localStorage.getItem("profile_country");
  const savedCity      = localStorage.getItem("profile_city");

  const rawDisplayName = savedFirstName
    ? [savedFirstName, savedLastName].filter(Boolean).join(" ")
    : username;
  const displayName = titleCase(rawDisplayName);
  const recentShelves = shelves.all.slice(0, 2);
  const readCount = shelves.read.length;
  const challengeGoal = 15;
  const progress = Math.min(100, Math.round((readCount / challengeGoal) * 100));
  const averageRating = useMemo(() => {
    if (!reviews.length) return "0.0";
    const total = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0);
    return (total / reviews.length).toFixed(1);
  }, [reviews]);

  function signOut() {
    auth.logout();
    navigate("/login");
  }

  return (
    <div className="profile-page">
      <main>
        <section className="profile-header-panel">
          <div className="profile-avatar-container">
            <div className="profile-avatar-placeholder">
              {savedPhoto ? (
                <img
                  src={savedPhoto}
                  alt="Profile"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              ) : (
                <svg viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              )}
            </div>
            <div className="profile-avatar-stats">
              <Link to="/my-reviews">{reviews.length} ratings ({averageRating} avg)</Link><br />
              <Link to="/my-reviews">{reviews.filter((review) => review.review_text).length} reviews</Link><br />
              <Link to="/profile">more photos (0)</Link>
            </div>
          </div>

          <div className="profile-info">
            <h1>{displayName}</h1>
            <span>(<Link to="/account-settings">edit profile</Link>)</span>
            <button type="button" onClick={signOut}>Sign out</button>
            <table>
              <tbody>
                <tr>
                  <td>Details</td>
                  <td>{[savedCity, savedCountry].filter(Boolean).join(", ") || "India"}</td>
                </tr>
                <tr>
                  <td>Activity</td>
                  <td>Joined in June 2026</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {error && <p className="error">{error}</p>}

        <section>
          <div className="profile-section-header">
            <span>{displayName}&apos;s Bookshelves</span>
            <span><Link to="/recommendations">Stats</Link> | <Link to="/my-books">More...</Link></span>
          </div>
          <div className="profile-bookshelves-list">
            {shelfLinks.map(([status, label]) => (
              <Link to={`/my-books?status=${status}`} key={status}>
                {label} ({shelves[status]?.length || 0})
              </Link>
            ))}
          </div>
        </section>

        <section>
          <div className="profile-section-header">
            <span>{displayName}&apos;s Recent Updates</span>
            <span>rss</span>
          </div>

          {recentShelves.map((shelf, index) => (
            <UpdateItem displayName={displayName} shelf={shelf} key={shelf.id} index={index} />
          ))}

          {recentShelves.length === 0 && (
            <article className="profile-update-item">
              <div className="profile-update-cover profile-challenge-cover">2026 Challenge</div>
              <div className="profile-update-details">
                <strong><Link to="/profile">{displayName}</Link></strong> wants to read {challengeGoal} books in the{" "}
                <strong><Link to="/recommendations">2026 Reading Challenge</Link></strong>
                <div className="profile-update-meta">just now · <Link to="/profile">like</Link> · <Link to="/profile">comment</Link></div>
              </div>
              <button type="button" className="profile-dismiss">x</button>
            </article>
          )}

          <div className="profile-more-books">
            <Link to="/my-books">More of {displayName}&apos;s books...</Link>
          </div>
        </section>
      </main>

      <aside>
        <section className="profile-sidebar-box">
          <div className="profile-section-header">2026 Reading Challenge</div>
          <div className="profile-challenge-widget">
            <div className="profile-challenge-badge">
              2026
              <small>Reading Challenge</small>
            </div>
            <div className="profile-challenge-progress">
              <div>You have read {readCount} of {challengeGoal} books.</div>
              <div className="profile-progress-bar">
                <div style={{ width: `${progress}%` }} />
              </div>
              <div>{progress}%</div>
              <p>{Math.max(0, challengeGoal - readCount)} books behind schedule</p>
            </div>
          </div>
          <Link className="profile-challenge-btn" to="/recommendations">View Challenge</Link>
        </section>

        <section className="profile-sidebar-box">
          <div className="profile-section-header">{displayName}&apos;s Year In Books</div>
          <div className="profile-year-books">
            <div>📅</div>
            <section>
              <strong><Link to="/my-books?status=read">Your 2025 Year in Books</Link></strong>
              <p>Enjoy a look back at the books you read this year, including some fun facts about your reading.</p>
              <Link to="/my-books?status=read">Go to Your 2025 Year in Books</Link>
            </section>
          </div>
        </section>

        <section className="profile-sidebar-box">
          <div className="profile-section-header">{displayName}&apos;s Friends</div>
          <Link to="/friends">Invite your friends »</Link>
        </section>

        <section className="profile-sidebar-box">
          <div className="profile-section-header">Listopia Votes</div>
          <p>You haven&apos;t voted on any lists yet.</p>
          <Link to="/browse">Vote on the Best Books Ever list »</Link>
        </section>

        <section className="profile-sidebar-box">
          <div className="profile-section-header">
            <span>Favorite Genres</span>
            <span><Link to="/browse">edit</Link></span>
          </div>
          <p>
            <Link to="/browse?genre=Comics">Comics</Link>, <Link to="/browse?genre=Fantasy">Fantasy</Link>,{" "}
            <Link to="/browse?genre=Manga">Manga</Link>, <Link to="/browse?genre=Science Fiction">Science fiction</Link>, and{" "}
            <Link to="/browse?genre=Young Adult">Young-adult</Link>
          </p>
          <div className="profile-small-links">
            <Link to="/community">Polls voted on by {displayName}</Link>
            <Link to="/browse">Lists liked by {displayName}</Link>
          </div>
        </section>
      </aside>
    </div>
  );
}

function UpdateItem({ displayName, shelf, index }) {
  const book = shelf.book;

  return (
    <article className="profile-update-item">
      <Link to={`/books/${book.id}`} className={`profile-update-cover ${index % 2 ? "profile-cover-sirens" : "profile-cover-whistler"}`}>
        {book.image_url ? <img src={book.image_url} alt="" /> : book.title}
      </Link>
      <div className="profile-update-details">
        <strong><Link to="/profile">{displayName}</Link></strong> wants to read <br />
        <strong><Link to={`/books/${book.id}`}>{book.title}</Link></strong><br />
        <span>by <Link to={`/browse?search=${encodeURIComponent(book.author)}`}>{book.author}</Link></span>
        <div className="profile-update-meta">5 hours, 59 min ago · <Link to="/profile">like</Link> · <Link to="/profile">comment</Link></div>
      </div>
      <div className="profile-action-container">
        <div className="profile-wtr-group">
          <div>Want to Read</div>
          <div>▼</div>
        </div>
        <span>Rate this book</span>
        <div>☆☆☆☆☆</div>
      </div>
      <button type="button" className="profile-dismiss">x</button>
    </article>
  );
}

function titleCase(value) {
  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
