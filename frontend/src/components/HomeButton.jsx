import React from 'react';
import { Link } from 'react-router-dom';

// Glassy home button used in every page header to get back to the Hub
export default function HomeButton({ style }) {
  return (
    <Link to="/" className="home-glass" title="Back to the Hub" aria-label="Back to the Hub" style={style}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 10.75 12 3l9 7.75" />
        <path d="M5.2 9.9V19a1.6 1.6 0 0 0 1.6 1.6h3.1v-5.4a1 1 0 0 1 1-1h2.2a1 1 0 0 1 1 1v5.4h3.1A1.6 1.6 0 0 0 18.8 19V9.9" />
      </svg>
    </Link>
  );
}
