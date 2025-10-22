const API_BASE = 'http://localhost:8080/api/v1/countries';

async function handleResponse(response) {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

export async function fetchCountries({ signal } = {}) {
  const response = await fetch(API_BASE, { signal });
  return handleResponse(response);
}

export async function fetchCountry(id, { signal } = {}) {
  const response = await fetch(`${API_BASE}/${id}`, { signal });
  return handleResponse(response);
}

export async function createCountry(payload) {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function updateCountry(id, payload) {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function deleteCountry(id) {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
  });
  return handleResponse(response);
}

export { API_BASE };
