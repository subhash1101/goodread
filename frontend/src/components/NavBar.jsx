import React from "react";
import { Search } from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../lib/auth.jsx";

const menus = [
  {
    label: "Home",
    to: "/",
    items: [],
  },
  {
    label: "My Books",
    to: "/my-books",
    items: [
      ["Want to Read", "/my-books?status=want_to_read"],
      ["Currently Reading", "/my-books?status=reading"],
      ["Read", "/my-books?status=read"],
    ],
  },
  {
    label: "Browse",
    to: "/browse",
    items: [
      ["Popular Books", "/browse?mode=popular"],
      ["New Releases", "/browse?mode=new"],
    ],
  },
  {
    label: "Community",
    to: "/community",
    items: [
      ["Groups", "/community?tab=groups"],
      ["Discussions", "/discussions"],
    ],
  },
];

export default function NavBar() {
  const [query, setQuery] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const navigate = useNavigate();
  const auth = useAuth();

  function submitSearch(event) {
    event.preventDefault();
    if (query.trim()) navigate(`/browse?search=${encodeURIComponent(query.trim())}`);
   }

  function signOut() {
    setProfileOpen(false);
    auth.logout();
    navigate("/login");
    }

  return (
    <header className="topbar">
      <Link className="brand" to="/">
        <span className="brand-mark">g</span>
        <span>goodreads</span>
      </Link>

      <nav className="main-nav">
        {menus.map(({ label, to, items }) => (
          <div className="nav-menu" key={label}>
            <NavLink to={to} className="nav-link">
              <span>{label}</span>
            </NavLink>
            {items.length > 0 && (
              <div className="dropdown">
                {items.map(([item, href]) => (
                  <Link to={href} key={item}>
                    {item}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <form className="searchbox" onSubmit={submitSearch}>
        <Search size={17} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search books"
        />
      </form>

      <div className="auth-actions">
        {auth.isAuthenticated ? (
          <div className="header-icon-container">
            <Link className="header-nav-icon" title="Notifications" to="/notifications">
              <svg width="19" height="19" viewBox="0 0 24 24">
                <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 4.36 6 6.92 6 10v5l-2 2v1h16v-1l-2-2z" />
              </svg>
            </Link>

            <Link className="header-nav-icon" title="Discussions" to="/discussions">
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z" />
              </svg>
            </Link>

            <Link className="header-nav-icon" title="Messages" to="/messages">
              <svg width="19" height="19" viewBox="0 0 24 24">
                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
              </svg>
            </Link>

            <Link className="header-nav-icon" title="Friends" to="/friends">
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
              </svg>
            </Link>

            <div className="profile-menu-wrap">
              <button
                className="header-profile-icon"
                title="Profile"
                type="button"
                onClick={() => setProfileOpen((open) => !open)}
                aria-expanded={profileOpen}
                aria-haspopup="menu"
              >
                <svg width="23" height="23" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  <path d="M12 18l-3-1.5-4 1.5V22l4-1.5 3 1.5 3-1.5 4 1.5V18l-4-1.5-3 1.5z" className="profile-book-mark" />
                </svg>
                </button>
              {profileOpen && (
                <div className="profile-dropdown" role="menu">
                  <div className="profile-dropdown-name">{auth.username || "Reader"}</div>
                  <Link to="/profile" onClick={() => setProfileOpen(false)}>Profile</Link>
                  <Link to="/my-reviews" onClick={() => setProfileOpen(false)}>Comments</Link>
                  <Link to="/login" onClick={() => setProfileOpen(false)}>Account settings</Link>
                  <button type="button" onClick={signOut}>Sign out</button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <Link className="primary-button" to="/login">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
