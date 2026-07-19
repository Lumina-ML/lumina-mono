import { createApp } from "vue";
import { createPinia } from "pinia";
import { VueQueryPlugin } from "@tanstack/vue-query";

import App from "./app/App.vue";
import { router } from "./app/router";
import "./styles/index.css";
import "@lumina/ui/dist/style.css";
import "./widgets/registry";

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(VueQueryPlugin);

app.mount("#app");
