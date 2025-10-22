import { COUNTRIES_ENDPOINT } from '../config';

const API_BASE = COUNTRIES_ENDPOINT;

async function handleResponse(response) {
  const payloadText = await response.text();

  if (!response.ok) {
    let message = `HTTP ${response.status}`;

    if (payloadText) {
      try {
        const data = JSON.parse(payloadText);
        message = data?.message || data?.error || payloadText;
      } catch (err) {
        message = payloadText;
      }
    }

    throw new Error(message);
  }

  if (!payloadText) {
    return null;
  }

  try {
    return JSON.parse(payloadText);
  } catch (err) {
    return payloadText;
  }
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
