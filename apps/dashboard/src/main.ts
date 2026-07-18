import { createApp } from "vue";
import { createPinia } from "pinia";
import { VueQueryPlugin } from "@tanstack/vue-query";
import { Toaster } from "vue-sonner";

import App from "./app/App.vue";
import { router } from "./app/router";
import "./styles/index.css";

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(VueQueryPlugin);
app.component("Toaster", Toaster);

app.mount("#app");
