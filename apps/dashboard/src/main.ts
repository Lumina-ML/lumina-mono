import { createApp } from "vue";
import { createPinia } from "pinia";
import { VueQueryPlugin } from "@tanstack/vue-query";

import App from "./app/App.vue";
import { router } from "./app/router";
import { useAuthStore } from "./stores/auth";
import "./styles/index.css";
import "@lumina/ui/style.css";
import "./widgets/registry";

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(VueQueryPlugin);

// Pull the user record eagerly if a key is already in storage so the
// topbar / workspace context can show real data on first paint. Fire
// and forget — the router guard already handles unauthenticated cases.
const auth = useAuthStore();
if (auth.apiKey) {
  void auth.fetchCurrentUser();
}

app.mount("#app");
