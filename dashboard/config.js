// frontend/config.js
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// If served directly by FastAPI (same host and port), an empty string '' uses relative endpoints like /api/login
const API_BASE_URL = isLocal ? '' : '';

window.API_BASE_URL = API_BASE_URL;