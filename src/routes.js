import { createMemoryHistory, createRouter } from 'vue-router';

import MainView from './views/Main.vue';
import SettingsView from './views/Settings.vue';

const routes = [
  { path: '/', component: MainView },
  { path: '/settings', component: SettingsView },
];

const router = createRouter({
  history: createMemoryHistory(),
  routes,
});

export default router;
