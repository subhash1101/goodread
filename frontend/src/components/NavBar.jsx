import React from "react";
import { Search } from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../lib/auth.jsx";

const menus = [
  {
    label: "Home",
    to: "/",
    items: [
      ["Friend Activity", "/"],
      ["Recommendations", "/recommendations"],
    ],
  },
  {
    label: "My Books",
    to: "/my-books",
    items: [
      ["Want to Read", "/my-books?status=want_to_read"],
      ["Currently Reading", "/my-books?status=reading"],
      ["Read", "/my-books?status=read"],
      ["My Reviews", "/my-reviews"],
    ],
  },
  {
    label: "Browse",
    to: "/browse",
    items: [
      ["Genres", "/browse?mode=genres"],
      ["Popular Books", "/browse?mode=popular"],
      ["New Releases", "/browse?mode=new"],
    ],
  },
  {
    label: "Community",
    to: "/community",
    items: [
      ["Users", "/community"],
      ["Groups", "/community?tab=groups"],
      ["Discussions", "/community?tab=discussions"],
    ],
  },
];

export default function NavBar() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const auth = useAuth();

  function submitSearch(event) {
    event.preventDefault();
    if (query.trim()) navigate(`/browse?search=${encodeURIComponent(query.trim())}`);
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
            <div className="dropdown">
              {items.map(([item, href]) => (
                <Link to={href} key={item}>
                  {item}
                </Link>
              ))}
            </div>
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
          <button className="ghost-button" onClick={auth.logout}>
            Sign out
          </button>
        ) : (
          <Link className="primary-button" to="/login">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
