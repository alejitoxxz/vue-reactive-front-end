import { COUNTRIES_ENDPOINT } from '../config';

export const API_BASE = COUNTRIES_ENDPOINT;

export function subscribeToCountryEvents(onMessage, { onError, onOpen } = {}) {
  const eventSource = new EventSource(`${API_BASE}/events`, {
    withCredentials: false,
  });

  if (typeof onOpen === 'function') {
    eventSource.onopen = () => onOpen();
  }

  eventSource.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      onMessage?.(payload);
    } catch (err) {
      console.error('No se pudo parsear el evento', err);
    }
  };

  eventSource.onerror = (err) => {
    console.error('Stream SSE falló', err);
    onError?.(err);
  };

  return () => eventSource.close();
}
