import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Footer from "./components/Footer.jsx";
import NavBar from "./components/NavBar.jsx";
import AccountSettings from "./pages/AccountSettings.jsx";
import AddFriends from "./pages/AddFriends.jsx";
import BookDetails from "./pages/BookDetails.jsx";
import Browse from "./pages/Browse.jsx";
import Community from "./pages/Community.jsx";
import Discussions from "./pages/Discussions.jsx";
import Friends from "./pages/Friends.jsx";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import Messages from "./pages/Messages.jsx";
import MyBooks from "./pages/MyBooks.jsx";
import MyReviews from "./pages/MyReviews.jsx";
import Notifications from "./pages/Notifications.jsx";
import Profile from "./pages/Profile.jsx";
import Recommendations from "./pages/Recommendations.jsx";
import { useAuth } from "./lib/auth.jsx";

function Protected({ children }) {
  const auth = useAuth();
  return auth.isAuthenticated ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <>
      <NavBar />
      <main className="page-shell">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/recommendations" element={<Protected><Recommendations /></Protected>} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/books/:id" element={<BookDetails />} />
          <Route path="/my-books" element={<Protected><MyBooks /></Protected>} />
          <Route path="/my-reviews" element={<Protected><MyReviews /></Protected>} />
          <Route path="/profile" element={<Protected><Profile /></Protected>} />
          <Route path="/community" element={<Community />} />
          <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
          <Route path="/friends" element={<Protected><Friends /></Protected>} />
          <Route path="/add-friends" element={<Protected><AddFriends /></Protected>} />
          <Route path="/messages" element={<Protected><Messages /></Protected>} />
          <Route path="/discussions" element={<Discussions />} />
          <Route path="/account-settings" element={<Protected><AccountSettings /></Protected>} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
