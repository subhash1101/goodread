import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";

const groups = [
  {
    name: "Read With Jenna (Official)",
    members: "32607",
    active: "Active 4 hours ago",
    description:
      "When anyone on the TODAY team is looking for a book recommendation, there is only one person to turn to: Jenna Bush Hager. Jenna will select a book and as you read along, we'll be posting updates ...",
    badge: "jenna",
  },
  {
    name: "Goodreads Librarians Group",
    members: "327076",
    active: "Active 2 minutes ago",
    description:
      "Goodreads Librarians are volunteers who help ensure the accuracy of information about books and authors in the Goodreads catalog. The Goodreads Librarians Group is the official group for requestin...",
    badge: "library",
  },
  {
    name: "Booktok 📚",
    members: "229116",
    active: "Active 9 minutes ago",
    description: "A place for booktokers to interact with each other and share the love",
    badge: "booktok",
  },
  {
    name: "Our Shared Shelf",
    members: "222798",
    active: "Active 2 days ago",
    description:
      "OUR SHARED SHELF IS CURRENTLY DORMANT AND NOT MANAGED BY EMMA AND HER TEAM. Dear Readers, As part of my work with UN Women, I have started reading as many books and essays about equality as I ca...",
    badge: "shelf",
  },
  {
    name: "Reese's Book Club x Hello Sunshine",
    members: "176230",
    active: "Active 2 hours ago",
    description:
      "Hey Y'all, We’ve been reading together for awhile and we don’t know about you, but we’re ready to hear your thoughts and opinions. This group is a place where we can discuss Reese’s Picks. After ...",
    badge: "reese",
  },
  {
    name: "What's the Name of That Book???",
    members: "121206",
    active: "Active 29 minutes ago",
    description:
      "Can't remember the title of a book you read? Come search our bookshelves and discussion posts. If you don’t find it there, post a description on our UNSOLVED message board. 1. GENRE and PLOT DETAI...",
    badge: "fox",
  },
];

const tags = [
  "bookclub",
  "fantasy",
  "romance",
  "fiction",
  "book-club",
  "young-adult",
  "books",
  "roleplay",
  "fun",
  "science-fiction",
  "mystery",
  "bookclub-any-type-of-book",
  "rp",
  "thriller",
  "ya",
  "horror",
];

export default function Community() {
  const [query, setQuery] = useState("");
  const [tagQuery, setTagQuery] = useState("");

  const filteredGroups = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return groups;
    return groups.filter((group) =>
      `${group.name} ${group.description}`.toLowerCase().includes(normalized)
    );
  }, [query]);

  const filteredTags = useMemo(() => {
    const normalized = tagQuery.trim().toLowerCase();
    if (!normalized) return tags;
    return tags.filter((tag) => tag.includes(normalized));
  }, [tagQuery]);

  return (
    <div className="community-groups-page">
      <main className="community-groups-main">
        <h1>Groups</h1>
        <form className="community-group-search" onSubmit={(event) => event.preventDefault()}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Group name, description"
          />
          <button type="submit">Search groups</button>
        </form>

        <section>
          <h2>Featured groups</h2>
          <div className="community-group-list">
            {filteredGroups.slice(0, 1).map((group) => (
              <GroupRow group={group} key={group.name} />
            ))}
          </div>
        </section>

        <section>
          <h2>Popular groups</h2>
          <div className="community-group-list">
            {filteredGroups.slice(1).map((group) => (
              <GroupRow group={group} key={group.name} />
            ))}
          </div>
          {filteredGroups.length === 0 && <p className="community-empty">No groups found.</p>}
        </section>
      </main>

      <aside className="community-groups-sidebar">
        <div className="community-ad">
          <p>ADVERTISEMENT</p>
          <div>
            <span>storite</span>
            <strong>Premium Laptop Backpack</strong>
          </div>
        </div>

        <section className="community-tags">
          <h2>Browse groups by tag</h2>
          <div>
            {filteredTags.map((tag) => (
              <Link to={`/community?tab=groups&tag=${encodeURIComponent(tag)}`} key={tag}>
                {tag}
              </Link>
            ))}
          </div>
          <form onSubmit={(event) => event.preventDefault()}>
            <input value={tagQuery} onChange={(event) => setTagQuery(event.target.value)} placeholder="Tag name" />
            <button type="submit">Search tags</button>
          </form>
        </section>

        <section className="community-more">
          <h2>More groups</h2>
          <p>
            <Link to="/community?tab=groups">Goodreads Librarians Group</Link>: request changes to book records
          </p>
          <Link to="/community?tab=groups">Create a group</Link>
        </section>
      </aside>
    </div>
  );
}

function GroupRow({ group }) {
  return (
    <article className="community-group-row">
      <div className={`community-group-thumb ${group.badge}`} aria-hidden="true">
        <span>{group.name.charAt(0)}</span>
      </div>
      <div>
        <Link to="/community?tab=groups" className="community-group-title">
          {group.name}
        </Link>
        <p className="community-group-meta">
          {Number(group.members).toLocaleString()} members · {group.active}
        </p>
        <p>{group.description}</p>
      </div>
    </article>
  );
}
