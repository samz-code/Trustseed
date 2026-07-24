// src/utils/navigation.ts
export const navigateTo = (page: string) => {
  window.dispatchEvent(new CustomEvent('navigate', { detail: page }));
};