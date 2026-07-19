import { defineStore } from "pinia";
import { ref } from "vue";
import { realtime, type ConnectionStatus } from "@/services/ws";

export const useWsStore = defineStore("ws", () => {
  const status = ref<ConnectionStatus>(realtime.getStatus());
  let bound = false;

  function ensureBound() {
    if (bound) return;
    bound = true;
    realtime.onStatus((s) => {
      status.value = s;
    });
  }

  ensureBound();

  return {
    status,
    isOpen: () => status.value === "open",
  };
});