<template>
  <v-main class="pa-4">
    <v-row no-gutters>
      <v-col cols="6" class="pr-2">
        <v-number-input
          v-model="volumes.master"
          label="Master Volume"
          control-variant="stacked"
          variant="solo"
          :min="0"
          :max="100"
          density="compact"
          tile
          hide-details
        />
      </v-col>

      <v-col cols="6" class="pl-2">
        <v-number-input
          v-model="volumes.music"
          label="Music Volume"
          control-variant="stacked"
          variant="solo"
          :min="0"
          :max="100"
          density="compact"
          tile
          hide-details
        />
      </v-col>
    </v-row>

    <v-row class="mt-2" no-gutters>
      <v-col cols="6" class="pr-2">
        <v-number-input
          v-model="volumes.sound"
          label="Sound Volume"
          control-variant="stacked"
          variant="solo"
          :min="0"
          :max="100"
          density="compact"
          tile
          hide-details
        />
      </v-col>

      <v-col cols="6" class="pl-2">
        <v-number-input
          v-model="volumes.blip"
          label="Blip Volume"
          control-variant="stacked"
          variant="solo"
          :min="0"
          :max="100"
          density="compact"
          tile
          hide-details
        />
      </v-col>
    </v-row>

    <v-btn class="mt-4" @click="handleGoToMain" block> Back </v-btn>
  </v-main>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const volumes = ref({
  master: 100,
  music: 75,
  sound: 75,
  blip: 22,
});

const { push } = useRouter();

const saveSettings = () => {
  if (window.electronAPI) {
    // Create a plain object without reactivity
    const settingsToSave = {
      volumes: {
        master: volumes.value.master,
        music: volumes.value.music,
        sound: volumes.value.sound,
        blip: volumes.value.blip,
      },
    };

    window.electronAPI.saveSettings(settingsToSave);
  }
};

const handleGoToMain = async () => {
  saveSettings();

  push('/');
};

onMounted(async () => {
  if (window.electronAPI) {
    try {
      const settings = await window.electronAPI.loadSettings();

      if (settings) {
        volumes.value = settings.volumes;
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }
});
</script>

<style scoped></style>
