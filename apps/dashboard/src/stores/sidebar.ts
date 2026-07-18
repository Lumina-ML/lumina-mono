import { defineStore } from "pinia";
import { ref } from "vue";

export const useSidebarStore = defineStore("sidebar", () => {
  const collapsed = ref(false);
  const mobileOpen = ref(false);

  function toggle() {
    collapsed.value = !collapsed.value;
  }

  function setCollapsed(value: boolean) {
    collapsed.value = value;
  }

  function toggleMobile() {
    mobileOpen.value = !mobileOpen.value;
  }

  function setMobileOpen(value: boolean) {
    mobileOpen.value = value;
  }

  return {
    collapsed,
    mobileOpen,
    toggle,
    setCollapsed,
    toggleMobile,
    setMobileOpen,
  };
});
