// ======================================
// Ekkora • onboard.js (MVP estável)
// - Protege rota (precisa estar logado)
// - Carrega igreja e preferências
// - Salva nome/cidade/estado da igreja
// - Salva meta mensal no users/{uid}.monthlyTarget
// ======================================
import { auth } from "../firebase.js";
import {
  userRef, churchRef,
  getDoc, updateDoc,
  serverTimestamp
} from "../db.js";

import { toast, initThemeToggle } from "../ui.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

async function boot(user) {
  // tema + logout
  initThemeToggle("btnTheme");

  document.getElementById("btnLogout")?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "./index.html";
  });

  // pega user doc
  const uSnap = await getDoc(userRef(user.uid));
  const u = uSnap.data();

  if (!u?.churchId) {
    // se não tem churchId, manda pro index (onde tem onboarding/login)
    window.location.href = "./index.html";
    return;
  }

  const churchId = u.churchId;

  // carrega igreja
  const cSnap = await getDoc(churchRef(churchId));
  const c = cSnap.data() || {};

  // Preenche campos
  const churchNameEl = document.getElementById("churchName");
  const churchCityEl = document.getElementById("churchCity");
  const churchStateEl = document.getElementById("churchState");

  if (churchNameEl) churchNameEl.value = c.name || "";
  if (churchCityEl) churchCityEl.value = c.city || "";
  if (churchStateEl) churchStateEl.value = c.state || "";

  // Preferências
  const targetEl = document.getElementById("monthlyTarget");
  const currencyEl = document.getElementById("currency");

  if (targetEl) targetEl.value = Number(u.monthlyTarget || 0);
  if (currencyEl) currencyEl.value = u.currency || "BRL";

  // SALVAR IGREJA
  document.getElementById("formOnboard")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = (churchNameEl?.value || "").trim();
    const city = (churchCityEl?.value || "").trim();
    const state = (churchStateEl?.value || "").trim();

    if (!name) return toast("Informe o nome da igreja.", "error");

    try {
      await updateDoc(churchRef(churchId), {
        name,
        city,
        state,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid
      });

      toast("Igreja atualizada!", "success");
    } catch (err) {
      console.error(err);
      toast(err?.message || "Erro ao salvar igreja.", "error");
    }
  });

  // SALVAR PREFERÊNCIAS
  document.getElementById("formPrefs")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const monthlyTarget = Number(targetEl?.value || 0);
    const currency = currencyEl?.value || "BRL";

    try {
      await updateDoc(userRef(user.uid), {
        monthlyTarget,
        currency,
        updatedAt: serverTimestamp()
      });

      toast("Preferências salvas!", "success");
    } catch (err) {
      console.error(err);
      toast(err?.message || "Erro ao salvar preferências.", "error");
    }
  });
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "./index.html";
    return;
  }
  boot(user);
});