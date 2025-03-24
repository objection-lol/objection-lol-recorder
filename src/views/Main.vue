<template>
  <v-main class="pa-4">
    <v-alert
      v-if="errorMessage"
      class="mb-2"
      color="error"
      variant="tonal"
      density="compact"
      icon="mdi-alert-circle-outline"
      @click="showErrorDialog"
      style="cursor: pointer"
    >
      <div class="error-text">{{ errorMessage }}</div>
    </v-alert>

    <v-text-field
      v-model="url"
      label="Objection ID"
      placeholder="E.g. https://objection.lol/objection/1 or 1"
      hide-details
      :disabled="disabled"
    />

    <v-number-input
      v-model="fps"
      label="FPS"
      control-variant="stacked"
      :min="1"
      :max="60"
      tile
      hide-details
      :disabled="disabled"
    />

    <v-number-input
      v-model="appendSeconds"
      label="Append Seconds"
      control-variant="stacked"
      :min="0"
      tile
      hide-details
      :disabled="disabled"
    />

    <v-progress-linear
      v-if="isConverting"
      height="36"
      color="primary"
      class="mt-4"
      :model-value="progressValue"
      :max="100"
    >
      <template v-slot:default="{ value }">
        <span v-if="progressValue > 0">Converting: {{ Math.ceil(value) }}%</span>
      </template>
    </v-progress-linear>

    <v-row v-if="!isConverting" class="mt-4" no-gutters>
      <v-col cols="6" class="pr-2">
        <v-btn
          :color="isRecording ? 'error' : 'primary'"
          @click="isRecording ? handleStopRecording() : handleStartRecording()"
          :disabled="startedRecording"
          block
        >
          {{ isRecording ? 'Stop Recording' : 'Record' }}
        </v-btn>
      </v-col>

      <v-col cols="6" class="pl-2">
        <v-btn @click="handleGoToSettings" :disabled="startedRecording" block> Settings </v-btn>
      </v-col>
    </v-row>
  </v-main>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

const url = ref('');
const fps = ref(30);
const appendSeconds = ref(0);
const errorMessage = ref('');

const startedRecording = ref(false);
const isRecording = ref(false);
const progressValue = ref(null);

const disabled = computed(() => isRecording.value || startedRecording.value || progressValue.value > 0);
const isConverting = computed(() => progressValue.value !== null);

const { push } = useRouter();

// Watch error message changes to adjust window height
watch(errorMessage, (newValue) => {
  if (window.electronAPI) {
    // Send message to main process to adjust window height
    window.electronAPI.adjustWindowHeight(newValue ? true : false);
  }
});

// Watch for fps or appendSeconds changes and save settings
watch(
  [fps, appendSeconds],
  () => {
    if (!startedRecording.value && !isRecording.value) {
      saveSettings();
    }
  },
  { deep: true }
);

const showErrorDialog = () => {
  if (errorMessage.value && window.electronAPI) {
    window.electronAPI.showErrorDialog('Error', errorMessage.value);
  }
};

const handleStartRecording = async () => {
  // get numbers only from objection url
  const urlRegex = /(\d+)/g;
  const match = url.value.match(urlRegex);

  if (!match || match.length < 1) {
    errorMessage.value = 'Please provide a valid objection url.';
    return;
  }

  if (url.value.includes('/case')) {
    errorMessage.value = 'Cannot record cases.';
    return;
  }

  if (!window.electronAPI) {
    errorMessage.value = 'ElectronAPI not available.';
    return;
  }

  startedRecording.value = true;
  errorMessage.value = '';
  progressValue.value = null;

  try {
    // Check for audio device availability before proceeding
    const { proceed, audioAvailable } = await window.electronAPI.checkAudioDevice();

    if (!proceed) {
      // User chose to download or cancel
      startedRecording.value = false;
      return;
    }

    // First, show save dialog to get output path
    const outputPath = await window.electronAPI.showSaveDialog();

    if (!outputPath) {
      // User canceled the save dialog
      startedRecording.value = false;
      return;
    }

    await saveSettings();

    window.electronAPI.loadObjectionRecord({
      id: parseInt(match[0]),
      fps: parseInt(fps.value || 30),
      appendSeconds: parseInt(appendSeconds.value || 0),
      outputPath: outputPath,
      hasAudio: audioAvailable,
    });
  } catch (error) {
    errorMessage.value = `Error: ${error.message || 'Failed to start recording'}`;
    startedRecording.value = false;
  }
};

const handleStopRecording = () => {
  if (window.electronAPI) {
    window.electronAPI.stopRecording();
  }
};

const handleRecordingStarted = () => {
  isRecording.value = true;
  startedRecording.value = false;
};

const handleRecordingFinished = () => {
  isRecording.value = false;
  progressValue.value = null;
};

/**
 * @param {string} message - Error message from the recording process
 */
const handleRecordingFailed = (message) => {
  isRecording.value = false;
  progressValue.value = null;
  errorMessage.value = `Recording failed: ${message}`;
};

const handleRecordingCancelled = () => {
  isRecording.value = false;
  progressValue.value = null;
};

const handleConversionProgress = (progress) => {
  progressValue.value = progress;

  // Once conversion is done
  if (progress >= 100) {
    setTimeout(() => {
      progressValue.value = null;
    }, 500); // Small delay to show 100% before hiding the progress
  }
};

const handleGoToSettings = () => {
  push('/settings');
};

const saveSettings = async () => {
  if (!window.electronAPI) return;

  try {
    await window.electronAPI.saveSettings({
      fps: parseInt(fps.value || 30),
      appendSeconds: parseInt(appendSeconds.value || 0),
    });
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
};

const loadSettings = async () => {
  if (!window.electronAPI) return;

  try {
    const settings = await window.electronAPI.loadSettings();

    if (settings) {
      fps.value = settings.fps;
      appendSeconds.value = settings.appendSeconds;
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
};

onMounted(() => {
  if (window.electronAPI) {
    window.electronAPI.onRecordingStarted(handleRecordingStarted);
    window.electronAPI.onRecordingFinished(handleRecordingFinished);
    window.electronAPI.onRecordingFailed(handleRecordingFailed);
    window.electronAPI.onRecordingCancelled(handleRecordingCancelled);
    window.electronAPI.onConversionProgress(handleConversionProgress);

    loadSettings();
  }
});

onUnmounted(() => {});
</script>

<style scoped>
.error-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  display: block;
}
</style>
