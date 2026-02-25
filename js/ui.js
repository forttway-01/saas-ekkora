// ===========================
// Ekkora • ui.js
// ===========================
export function moneyBRL(value) {
  const n = Number(value || 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function toast(msg, type = "info") {
  const el = document.getElementById("toast");
  if (!el) return;

  el.textContent = msg;
  el.classList.add("show");

  // Ajuste rápido por tipo (só texto, simples)
  if (type === "error") el.style.borderColor = "rgba(255,77,77,.35)";
  else if (type === "success") el.style.borderColor = "rgba(25,195,125,.35)";
  else el.style.borderColor = "rgba(255,255,255,.12)";

  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

export function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("ekkora_theme", theme);
}

export function initThemeToggle(btnId = "btnTheme") {
  const saved = localStorage.getItem("ekkora_theme") || "dark";
  setTheme(saved);

  const btn = document.getElementById(btnId);
  if (!btn) return;

  btn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    setTheme(current === "dark" ? "light" : "dark");
  });
}

export function yyyyMmDdToDate(yyyyMmDd) {
  // yyyy-mm-dd (input date)
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function dateToYyyyMmDd(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}