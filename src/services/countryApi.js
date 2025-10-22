import { API_PATHS, COUNTRIES_ENDPOINT } from '../config';
import { request } from './httpClient';

const RESOURCE_PATH = API_PATHS.countries;

export async function fetchCountries({ signal } = {}) {
  return request(RESOURCE_PATH, { signal });
}

export async function fetchCountry(id, { signal } = {}) {
  return request(`${RESOURCE_PATH}/${id}`, { signal });
}

export async function createCountry(payload) {
  return request(RESOURCE_PATH, { method: 'POST', body: payload });
}

export async function updateCountry(id, payload) {
  return request(`${RESOURCE_PATH}/${id}`, { method: 'PUT', body: payload });
}

export async function deleteCountry(id) {
  return request(`${RESOURCE_PATH}/${id}`, { method: 'DELETE' });
}

export const API_BASE = COUNTRIES_ENDPOINT;
