// config.js — loaded before supabaseClient.js and login.js
// The backend URL is not a secret, safe to commit. Update these two
// values once you know your real deployed URLs.

// const API_BASE_URL =
//   window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
//     ? "http://localhost:8000"
//     : "https://YOUR-BACKEND-URL.onrender.com"; // <-- replace after deploying backend

// frontend/config.js
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8000'
  : ''; // Blank relative string uses current domain on Render