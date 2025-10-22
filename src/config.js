const rawBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

function sanitizeBase(url) {
  if (!url) return '';
  try {
    const normalized = new URL(url, window.location.origin);
    return normalized.origin + normalized.pathname.replace(/\/$/, '');
  } catch (err) {
    console.warn('[config] URL de API inválida, usando el valor por defecto', err);
    return '';
  }
}

const providedBase = sanitizeBase(rawBaseUrl);

let fallbackBase = '';
if (typeof window !== 'undefined' && window.location) {
  const { origin } = window.location;
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    fallbackBase = 'http://localhost:8080';
  } else {
    fallbackBase = origin;
  }
}

function trimTrailingSlash(value = '') {
  return value.replace(/\/$/, '');
}

export const API_BASE_URL = trimTrailingSlash(providedBase || fallbackBase || 'http://localhost:8080');

export const API_PATHS = {
  countries: '/api/v1/countries',
};

export const COUNTRIES_ENDPOINT = `${API_BASE_URL}${API_PATHS.countries}`;
