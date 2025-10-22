# Countries reactive frontend

This demo Vue 3 + Vite application consumes the reactive countries API exposed by `http://localhost:8080/api/v1/countries`. It illustrates how to mix traditional REST requests with a Server-Sent Events (SSE) stream to keep the UI in sync in real time.

## Getting started

```sh
npm install
npm run dev
```

By default Vite runs on [http://localhost:5173](http://localhost:5173). Open that URL in your browser while your backend is available at `http://localhost:8080`.

> **Note**
> If you need to target a different backend, edit the `API_BASE` constant defined in `src/services/countryApi.js` and `src/services/countryStream.js`.

## Features

- Loads the initial country catalog with `GET /api/v1/countries`.
- Listens to SSE notifications published at `/api/v1/countries/events` and updates the UI for `CREATED`, `UPDATED`, and `DELETED` events.
- Displays the stream connection status and warns about extended outages.
- Includes a form to create new countries through the REST API (`POST /api/v1/countries`).
- Provides a quick delete shortcut that sends `DELETE /api/v1/countries/:id`.

## How the integration works

The client exposes two service layers:

- `src/services/countryApi.js` centralizes the REST helpers (fetch all, create, update, delete, fetch by id).
- `src/services/countryStream.js` wraps the browser `EventSource` to handle the SSE subscription. It supports optional `onOpen` and `onError` callbacks for connection status tracking.

`App.vue` orchestrates both layers:

1. On mount, it calls `fetchCountries()` to populate the table.
2. It subscribes to `subscribeToCountryEvents()` so each `countryEntity` arriving through the stream updates, inserts, or removes the matching row.
3. A connection badge reflects whether the stream is connected, reconnecting, or disconnected. After three failed retries the UI shows a warning suggesting manual intervention.
4. The creation form posts new countries and relies on the SSE stream to append them in real time.

## Backend requirements

To test the integration you need a backend that offers the following endpoints:

- `GET /api/v1/countries` → returns the current list of countries as JSON.
- `POST /api/v1/countries` → accepts a JSON payload `{ "name": string, "code": string, "capital"?: string }` and returns the created entity.
- `PUT /api/v1/countries/{id}` → updates the country identified by `id`.
- `DELETE /api/v1/countries/{id}` → removes a country.
- `GET /api/v1/countries/events` → exposes an SSE stream with messages shaped as `{ "countryEntity": { ... }, "event": "CREATED" | "UPDATED" | "DELETED" }`.

Make sure your backend enables CORS for the frontend origin (for example `http://localhost:5173`). If you require credentials, switch `withCredentials` to `true` in `countryStream.js` and add the appropriate headers on the backend.

### Manual stream testing

You can inspect the event feed without the UI by running:

```sh
curl -N http://localhost:8080/api/v1/countries/events
```

Trigger create/update/delete operations on the backend and you should see the payloads streaming in.

## Production build

```sh
npm run build
```

Vite outputs the compiled assets in the `dist/` directory, ready to be hosted behind any static file server or CDN.
