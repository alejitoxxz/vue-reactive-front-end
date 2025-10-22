<template>
  <div class="home">
    <h1>Actualización de eventos</h1>
    <h3>{{ numeroEventos }}</h3>
    <h2>{{ mensaje }}</h2>
    <button @click="actualizarEventos">Actualizar eventos</button>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const numeroEventos = ref(0);
const mensaje = ref('');

const actualizarEventos = () => {
  numeroEventos.value = numeroEventos.value + 20;
  // CORRECCIÓN: usar .value para leer la ref
  mensaje.value = 'el valor es ' + numeroEventos.value;
}
</script>

<style scoped>
.home { text-align:center; padding:20px; }
button { margin-top:10px; padding:8px 12px; }
</style>