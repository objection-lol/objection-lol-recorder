import { createVuetify } from 'vuetify';
import 'vuetify/styles';

import { VNumberInput } from 'vuetify/labs/VNumberInput';

import '@mdi/font/css/materialdesignicons.css';

export default createVuetify({
  theme: {
    defaultTheme: 'dark',
  },
  components: {
    VNumberInput,
  },
  icons: {
    defaultSet: 'mdi',
  },
});
