const KEY = "ekkora:theme";

function systemPref() {
  return window.matchMedia?.("(prefers-color-scheme: light)")?.matches ? "light" : "dark";
}

export function getTheme() {
  const saved = localStorage.getItem(KEY);
  return (saved === "light" || saved === "dark") ? saved : systemPref();
}

export function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(KEY, theme);
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || getTheme();
  setTheme(current === "dark" ? "light" : "dark");
}

export function initTheme() {
  setTheme(getTheme());
}