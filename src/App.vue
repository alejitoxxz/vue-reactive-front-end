<template>
  <div class="page">
    <header class="page__header">
      <h1 class="page__title">Countries dashboard</h1>
      <div class="status" :data-state="connectionState">
        <span class="status__indicator" aria-hidden="true"></span>
        <span class="status__text">{{ connectionMessage }}</span>
      </div>
    </header>

    <main class="page__content">
      <section class="panel">
        <div class="panel__header">
          <h2>Listado en tiempo real</h2>
          <button class="panel__refresh" type="button" @click="loadCountries" :disabled="loading">
            {{ loading ? 'Cargando…' : 'Recargar' }}
          </button>
        </div>

        <p v-if="loadError" class="panel__error">
          {{ loadError }}
        </p>

        <p v-if="!loading && !countries.length && !loadError" class="panel__empty">
          Aún no hay países registrados.
        </p>

        <div class="table-wrapper" v-if="countries.length">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Código telefónico</th>
                <th>Código ISO</th>
                <th>Estado</th>
                <th class="data-table__actions">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="country in countries" :key="country.id">
                <td>{{ country.id }}</td>
                <td>{{ country.name ?? '—' }}</td>
                <td>{{ country.dialingCountryCode ?? country.dialingCode ?? '—' }}</td>
                <td>{{ country.isoCountryCode ?? country.isoCode ?? '—' }}</td>
                <td>{{ country.enabled === false ? 'Inactivo' : 'Activo' }}</td>
                <td class="data-table__actions">
                  <button type="button" class="link" @click="removeCountry(country.id)">
                    Eliminar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="showReconnectWarning" class="panel__warning">
          No se pudo reconectar al stream después de varios intentos. Revisa el backend o refresca la página.
        </div>
      </section>

      <section class="panel form-panel">
        <h2>Crear o habilitar país</h2>
        <form class="form" @submit.prevent="submit">
          <label class="form__field">
            <span>Nombre</span>
            <input v-model="form.name" type="text" placeholder="México" required />
          </label>
          <label class="form__field">
            <span>Código telefónico</span>
            <input v-model="form.dialingCountryCode" type="text" placeholder="+52" required />
          </label>
          <label class="form__field">
            <span>Código ISO</span>
            <input v-model="form.isoCountryCode" type="text" placeholder="MX" maxlength="3" required />
          </label>
          <label class="form__field form__field--checkbox">
            <input v-model="form.enabled" type="checkbox" />
            <span>País habilitado</span>
          </label>

          <button class="primary" type="submit" :disabled="creating">
            {{ creating ? 'Enviando…' : 'Crear país' }}
          </button>
          <p v-if="createError" class="form__error">{{ createError }}</p>
          <p v-if="lastCreated" class="form__success">País {{ lastCreated.name }} sincronizado correctamente.</p>
        </form>
      </section>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { createCountry, deleteCountry, fetchCountries } from './services/countryApi';
import { subscribeToCountryEvents } from './services/countryStream';

const countries = ref([]);
const loading = ref(false);
const loadError = ref('');
const creating = ref(false);
const createError = ref('');
const lastCreated = ref(null);
const connectionState = ref('connecting');
const consecutiveErrors = ref(0);
const errorTimeout = ref();
let unsubscribe = null;

const form = reactive({
  name: '',
  dialingCountryCode: '',
  isoCountryCode: '',
  enabled: true,
});

const connectionMessage = computed(() => {
  switch (connectionState.value) {
    case 'connected':
      return 'Stream conectado';
    case 'reconnecting':
      return 'Reconectando al stream…';
    case 'disconnected':
      return 'Sin conexión al stream';
    default:
      return 'Conectando al stream…';
  }
});

const showReconnectWarning = computed(
  () => consecutiveErrors.value >= 3 && connectionState.value !== 'connected',
);

async function loadCountries() {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await fetchCountries();
    countries.value = Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('No se pudo cargar el catálogo', err);
    loadError.value = 'No se pudo cargar la lista de países. Verifica el backend y vuelve a intentarlo.';
  } finally {
    loading.value = false;
  }
}

async function submit() {
  createError.value = '';
  lastCreated.value = null;
  creating.value = true;
  try {
    const payload = {
      name: form.name.trim(),
      dialingCountryCode: form.dialingCountryCode.trim(),
      isoCountryCode: form.isoCountryCode.trim(),
      enabled: Boolean(form.enabled),
    };
    if (!payload.name || !payload.dialingCountryCode || !payload.isoCountryCode) {
      throw new Error('Completa todos los campos obligatorios.');
    }
    if (!payload.dialingCountryCode.startsWith('+')) {
      payload.dialingCountryCode = `+${payload.dialingCountryCode.replace(/^\+?/, '')}`;
    }
    payload.isoCountryCode = payload.isoCountryCode.toUpperCase();
    const created = await createCountry(payload);
    lastCreated.value = created;
    form.name = '';
    form.dialingCountryCode = '';
    form.isoCountryCode = '';
    form.enabled = true;
  } catch (err) {
    console.error('No se pudo crear el país', err);
    createError.value = err?.message || 'Ocurrió un error al crear el país.';
  } finally {
    creating.value = false;
  }
}

async function removeCountry(id) {
  if (!id) return;
  try {
    await deleteCountry(id);
  } catch (err) {
    console.error('No se pudo eliminar el país', err);
    loadError.value = 'No se pudo eliminar el país. Intenta nuevamente.';
  }
}

function handleEventStream(event) {
  const { countryEntity, event: type } = event || {};
  if (!countryEntity || countryEntity.id == null) return;

  const currentIndex = countries.value.findIndex((country) => country.id === countryEntity.id);

  switch (type) {
    case 'CREATED': {
      if (currentIndex === -1) {
        countries.value = [...countries.value, countryEntity];
      } else {
        countries.value = countries.value.map((country, index) =>
          index === currentIndex ? countryEntity : country,
        );
      }
      break;
    }
    case 'UPDATED':
      if (currentIndex === -1) {
        countries.value = [...countries.value, countryEntity];
      } else {
        countries.value = countries.value.map((country, index) =>
          index === currentIndex ? countryEntity : country,
        );
      }
      break;
    case 'DELETED':
      if (currentIndex !== -1) {
        countries.value = countries.value.filter((_, index) => index !== currentIndex);
      }
      break;
    default:
      if (currentIndex === -1) {
        countries.value = [...countries.value, countryEntity];
      } else {
        countries.value = countries.value.map((country, index) =>
          index === currentIndex ? countryEntity : country,
        );
      }
  }
}

onMounted(async () => {
  await loadCountries();

  unsubscribe = subscribeToCountryEvents(handleEventStream, {
    onOpen: () => {
      connectionState.value = 'connected';
      consecutiveErrors.value = 0;
      if (errorTimeout.value) {
        clearTimeout(errorTimeout.value);
        errorTimeout.value = undefined;
      }
    },
    onError: (err) => {
      connectionState.value = 'reconnecting';
      consecutiveErrors.value += 1;
      if (errorTimeout.value) {
        clearTimeout(errorTimeout.value);
      }
      errorTimeout.value = setTimeout(() => {
        if (connectionState.value !== 'connected') {
          connectionState.value = 'disconnected';
        }
      }, 7000);
      console.error('SSE error', err);
    },
  });
});

onUnmounted(() => {
  if (errorTimeout.value) {
    clearTimeout(errorTimeout.value);
  }
  if (typeof unsubscribe === 'function') {
    unsubscribe();
  }
});
</script>

<style scoped>
:global(body) {
  margin: 0;
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #0f172a;
  color: #f8fafc;
}

.page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  padding: 2rem 1.5rem 3rem;
  max-width: 1100px;
  margin: 0 auto;
}

.page__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.page__title {
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.16);
  border: 1px solid rgba(148, 163, 184, 0.3);
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.status__indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #f97316;
  box-shadow: 0 0 8px rgba(249, 115, 22, 0.8);
}

.status[data-state='connected'] .status__indicator {
  background: #22c55e;
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.8);
}

.status[data-state='reconnecting'] .status__indicator {
  background: #eab308;
  box-shadow: 0 0 8px rgba(234, 179, 8, 0.8);
}

.status[data-state='disconnected'] .status__indicator {
  background: #ef4444;
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.8);
}

.page__content {
  display: grid;
  gap: 2rem;
}

@media (min-width: 900px) {
  .page__content {
    grid-template-columns: 2fr 1fr;
  }
}

.panel {
  background: rgba(15, 23, 42, 0.6);
  border-radius: 1.25rem;
  padding: 1.5rem;
  backdrop-filter: blur(12px);
  border: 1px solid rgba(148, 163, 184, 0.2);
  box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.5);
}

.panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.panel__header h2 {
  margin: 0;
  font-size: 1.5rem;
}

.panel__refresh {
  background: transparent;
  border: 1px solid rgba(148, 163, 184, 0.4);
  color: #f8fafc;
  padding: 0.45rem 1rem;
  border-radius: 999px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.panel__refresh:disabled {
  opacity: 0.6;
  cursor: progress;
}

.panel__refresh:not(:disabled):hover {
  background: rgba(148, 163, 184, 0.15);
}

.panel__empty {
  margin: 0;
  color: #cbd5f5;
}

.panel__error,
.panel__warning {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #fecaca;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
}

.panel__warning {
  margin-top: 1rem;
}

.form__field--checkbox {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.95rem;
}

.form__field--checkbox input {
  width: 1.1rem;
  height: 1.1rem;
}

.table-wrapper {
  overflow-x: auto;
  border-radius: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 480px;
}

.data-table th,
.data-table td {
  padding: 0.75rem 1rem;
  text-align: left;
  border-bottom: 1px solid rgba(148, 163, 184, 0.08);
}

.data-table thead {
  background: rgba(15, 23, 42, 0.8);
  font-size: 0.85rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.data-table tbody tr:hover {
  background: rgba(148, 163, 184, 0.1);
}

.data-table__actions {
  text-align: right;
  width: 110px;
}

.link {
  background: none;
  border: none;
  color: #f97316;
  cursor: pointer;
  font-weight: 600;
  padding: 0;
}

.link:hover {
  text-decoration: underline;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form__field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.9rem;
}

.form__field input {
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 0.65rem;
  padding: 0.6rem 0.85rem;
  color: inherit;
}

.form__field input:focus {
  outline: 2px solid rgba(59, 130, 246, 0.7);
  outline-offset: 2px;
}

.primary {
  padding: 0.65rem 1.4rem;
  border-radius: 999px;
  border: none;
  cursor: pointer;
  font-weight: 600;
  color: #0f172a;
  background: linear-gradient(135deg, #22d3ee, #6366f1);
  transition: filter 0.2s ease;
}

.primary:disabled {
  opacity: 0.6;
  cursor: progress;
}

.primary:not(:disabled):hover {
  filter: brightness(1.1);
}

.form__error {
  margin: 0;
  color: #fecaca;
}

.form__success {
  margin: 0;
  color: #bbf7d0;
}
</style>
