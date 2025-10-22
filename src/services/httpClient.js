import axios from 'axios';
import { API_BASE_URL } from '../config';

function joinUrl(base, path = '') {
  if (!path) return base;
  if (/^https?:/i.test(path)) {
    return path;
  }
  const normalizedBase = base.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

const http = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Accept: 'application/json',
  },
});

function normalizeError(error) {
  if (!axios.isAxiosError?.(error)) {
    return error instanceof Error ? error : new Error('Unexpected error');
  }

  if (error.name === 'AbortError') {
    return error;
  }

  if (!error.response) {
    error.message = 'No se pudo conectar con el servidor.';
    return error;
  }

  const { status, data } = error.response;
  let message = '';
  if (data && typeof data === 'object') {
    message = data.message || data.error || '';
  } else if (typeof data === 'string') {
    message = data;
  }

  if (!message) {
    message = status ? `HTTP ${status}` : error.message;
  }

  error.message = message;
  return error;
}

function shouldSendRaw(body) {
  return body instanceof FormData || body instanceof Blob || typeof body === 'string';
}

export async function request(
  path,
  { method = 'GET', headers = {}, body, signal, expectJson = true, params, withCredentials } = {},
) {
  const config = {
    url: path,
    method,
    headers: { ...headers },
    signal,
    params,
  };

  if (withCredentials != null) {
    config.withCredentials = Boolean(withCredentials);
  }

  if (!expectJson) {
    config.responseType = 'text';
  }

  if (body !== undefined) {
    if (shouldSendRaw(body)) {
      config.data = body;
    } else {
      config.data = body;
      config.headers = { ...config.headers, 'Content-Type': 'application/json' };
    }
  }

  try {
    const response = await http.request(config);
    if (expectJson) {
      return response.data ?? null;
    }
    return typeof response.data === 'string' ? response.data : response.data ?? '';
  } catch (err) {
    throw normalizeError(err);
  }
}

export function buildApiUrl(path = '') {
  return joinUrl(API_BASE_URL, path);
}

export function createAbortableRequest() {
  const controller = new AbortController();
  return { controller, signal: controller.signal };
}
