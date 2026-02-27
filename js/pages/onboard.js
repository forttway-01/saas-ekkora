// ======================================
// Ekkora • onboard.js (MODO DUPLO - sem loop)
// - Se NÃO tem churchId: cria igreja (churchId = uid) + vira admin
// - Se JÁ tem churchId: permite editar dados da igreja e preferências
// ======================================

import { auth, db } from "../firebase.js";
import {
  userRef, churchRef,
  getDoc, setDoc, updateDoc,
  doc, serverTimestamp
} from "../db.js";

import { toast, initThemeToggle } from "../ui.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

function go(path) {
  const current = (window.location.pathname.split("/").pop() || "").toLowerCase();
  const target = path.replace("./", "").toLowerCase();
  if (current === target) return;
  window.location.replace(path);
}

// Cria igreja no padrão MVP: churchId = uid do dono
async function createChurchForUser(user, { name, city, state }) {
  const churchId = user.uid;

  // 1) cria igreja
  await setDoc(churchRef(churchId), {
    id: churchId,
    ownerUid: user.uid,
    name,
    city: city || "",
    state: state || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });

  // 2) seta churchId no user
  await updateDoc(userRef(user.uid), {
    churchId,
    updatedAt: serverTimestamp()
  });

  // 3) cria member admin (owner)
  await setDoc(doc(db, "churches", churchId, "members", user.uid), {
    uid: user.uid,
    email: (user.email || "").toLowerCase(),
    name: user.displayName || "Admin",
    role: "admin",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });

  return churchId;
}

async function boot(user) {
  initThemeToggle("btnTheme");

  document.getElementById("btnLogout")?.addEventListener("click", async () => {
    await signOut(auth);
    go("./index.html");
  });

  // pega user doc
  const uSnap = await getDoc(userRef(user.uid));
  const u = uSnap.data() || {};
  const hasChurch = !!u.churchId;

  // elementos
  const churchNameEl = document.getElementById("churchName");
  const churchCityEl = document.getElementById("churchCity");
  const churchStateEl = document.getElementById("churchState");

  const targetEl = document.getElementById("monthlyTarget");
  const currencyEl = document.getElementById("currency");

  // prefs defaults
  if (targetEl) targetEl.value = Number(u.monthlyTarget || 0);
  if (currencyEl) currencyEl.value = u.currency || "BRL";

  // Se já tem igreja, carrega igreja e preenche campos (modo edição)
  if (hasChurch) {
    try {
      const cSnap = await getDoc(churchRef(u.churchId));
      const c = cSnap.data() || {};

      if (churchNameEl) churchNameEl.value = c.name || "";
      if (churchCityEl) churchCityEl.value = c.city || "";
      if (churchStateEl) churchStateEl.value = c.state || "";
    } catch (err) {
      console.error(err);
      toast(err?.message || "Erro ao carregar dados da igreja.", "error");
    }
  }

  // FORM IGREJA: cria ou atualiza dependendo se tem churchId
  document.getElementById("formOnboard")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = (churchNameEl?.value || "").trim();
    const city = (churchCityEl?.value || "").trim();
    const state = (churchStateEl?.value || "").trim();

    if (!name) return toast("Informe o nome da igreja.", "error");

    try {
      if (!hasChurch) {
        // cria igreja
        await createChurchForUser(user, { name, city, state });
        toast("Igreja criada! Bem-vindo 👊", "success");
        go("./dashboard.html");
      } else {
        // edita igreja existente
        await updateDoc(churchRef(u.churchId), {
          name,
          city,
          state,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid
        });
        toast("Igreja atualizada!", "success");
      }
    } catch (err) {
      console.error(err);
      toast(err?.message || "Erro ao salvar igreja (Rules?).", "error");
    }
  });

  // FORM PREFS: salva preferências (sempre)
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
  if (!user) return go("./index.html");
  boot(user);
});