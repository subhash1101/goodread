import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-columns">
        <div className="site-footer-column">
          <h3>Company</h3>
          <Link to="/community">About us</Link>
          <Link to="/community">Careers</Link>
          <Link to="/login">Terms</Link>
          <Link to="/login">Privacy</Link>
          <Link to="/login">Interest Based Ads</Link>
          <Link to="/login">Ad Preferences</Link>
          <Link to="/login">
            Your Ads Privacy Choices
            <span className="site-footer-privacy-icon">
              <svg width="24" height="12" viewBox="0 0 24 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="24" height="12" rx="6" fill="#2E16B1" />
                <circle cx="6" cy="6" r="4" fill="white" />
                <path d="M14 4L18 8M18 4L14 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
          </Link>
          <Link to="/login">Help</Link>
        </div>

        <div className="site-footer-column">
          <h3>Work with us</h3>
          <Link to="/community">Authors</Link>
          <Link to="/browse">Advertise</Link>
          <Link to="/browse">Authors & ads blog</Link>
        </div>

        <div className="site-footer-column">
          <h3>Connect</h3>
          <div className="site-footer-socials">
            <a href="#" aria-label="Facebook">f</a>
            <a href="#" aria-label="Twitter">t</a>
            <a href="#" aria-label="Instagram">i</a>
            <a href="#" aria-label="LinkedIn">in</a>
          </div>
        </div>
      </div>

      <div className="site-footer-right">
        <div className="site-footer-badges">
          <a href="#">
            <span>Download on the<br /><strong>App Store</strong></span>
          </a>
          <a href="#">
            <span>GET IT ON<br /><strong>Google Play</strong></span>
          </a>
        </div>

        <a href="#" className="site-footer-mobile">Mobile version</a>
        <div className="site-footer-copyright">© 2026 Goodreads LLC</div>
        <div className="site-footer-amazon">
          an <span>amazon</span> company
        </div>
      </div>
    </footer>
  );
}
