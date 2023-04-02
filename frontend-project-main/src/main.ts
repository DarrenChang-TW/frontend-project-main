import { createApp } from 'vue'
import App from './App.vue'
import router from "@/router";
import PrimeVue from 'primevue/config';
import 'primevue/resources/themes/bootstrap4-light-blue/theme.css';
import 'primevue/resources/primevue.min.css';
import 'primeicons/primeicons.css';
import './assets/styles/tailwind.css';

export const app = createApp(App)
    .use(router)
    .use(PrimeVue)

app.mount('#app');