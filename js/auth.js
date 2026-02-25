// ===================================
// Ekkora • auth.js (MVP estável + debug 400)
// ===================================
import { auth } from "./firebase.js";
import { userRef, churchRef, setDoc, getDoc, updateDoc, serverTimestamp } from "./db.js";
import { toast } from "./ui.js";

import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

// ---------- DOM ----------
const formLogin = document.getElementById("formLogin");
const formRegister = document.getElementById("formRegister");
const formOnboarding = document.getElementById("formOnboarding");
const onboardingCard = document.getElementById("onboarding");
const tabs = document.querySelectorAll(".tab");

// ---------- UI helpers ----------
function showOnboarding(show) {
  const authCard = document.querySelector(".auth-card:not(.onboarding)");
  if (show) {
    authCard?.classList.add("hidden");
    onboardingCard?.classList.remove("hidden");
  } else {
    authCard?.classList.remove("hidden");
    onboardingCard?.classList.add("hidden");
  }
}

function goDashboard() {
  window.location.href = "./dashboard.html";
}

function goIndex() {
  window.location.href = "./index.html";
}

// ---------- Error helpers ----------
function prettyAuthError(err) {
  // Firebase costuma devolver:
  // err.code = "auth/invalid-credential" etc
  // err.message = texto grande
  const code = err?.code || "";
  const msg = (err?.message || "").toLowerCase();

  // Alguns casos vêm como 400 no network, mas o Firebase encapsula no err.code
  if (code.includes("invalid-credential") || msg.includes("invalid login credentials")) {
    return "Email ou senha inválidos. (Ou esse usuário está em outro projeto Firebase.)";
  }
  if (code.includes("wrong-password")) return "Senha incorreta.";
  if (code.includes("user-not-found")) return "Usuário não encontrado nesse projeto Firebase.";
  if (code.includes("invalid-email")) return "Email inválido.";
  if (code.includes("too-many-requests")) return "Muitas tentativas. Aguarde um pouco e tente novamente.";
  if (code.includes("operation-not-allowed")) return "Login por Email/Senha não está habilitado no Firebase.";
  if (code.includes("unauthorized-domain")) {
    return "Domínio não autorizado. Adicione localhost/127.0.0.1 em Authentication → Authorized domains.";
  }
  if (code.includes("invalid-api-key") || msg.includes("api key")) {
    return "Config do Firebase inválida (API key / projeto). Confira o firebase.js.";
  }

  // Fallback
  return err?.code || err?.message || "Erro desconhecido ao autenticar.";
}

function logAuthError(context, err) {
  console.group(`🔴 ${context}`);
  console.log("err.code:", err?.code);
  console.log("err.message:", err?.message);
  console.log("full err:", err);
  console.log("origin:", window.location.origin);
  console.groupEnd();
}

// ---------- Data helpers ----------
async function ensureUserDoc(user) {
  const ref = userRef(user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || "",
      churchId: null,
      monthlyTarget: 0,
      createdAt: serverTimestamp()
    });
  }

  const fresh = await getDoc(ref);
  return fresh.data();
}

// ---------- Tabs ----------
tabs.forEach(btn => {
  btn.addEventListener("click", () => {
    tabs.forEach(b => b.classList.remove("is-active"));
    btn.classList.add("is-active");

    const target = btn.dataset.tab;
    document.querySelectorAll(".form[data-pane]").forEach(p => p.classList.remove("is-visible"));
    document.querySelector(`.form[data-pane="${target}"]`)?.classList.add("is-visible");
  });
});

// ---------- Login ----------
formLogin?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("loginEmail")?.value?.trim() || "";
  const pass = document.getElementById("loginPass")?.value || "";

  if (!email || !pass) {
    toast("Preencha email e senha.", "error");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    toast("Bem-vindo de volta!", "success");
    // onAuthStateChanged vai redirecionar
  } catch (err) {
    logAuthError("LOGIN ERROR", err);
    toast(prettyAuthError(err), "error");
  }
});

// ---------- Register ----------
formRegister?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("regName")?.value?.trim() || "";
  const email = document.getElementById("regEmail")?.value?.trim() || "";
  const pass = document.getElementById("regPass")?.value || "";

  if (!name || !email || !pass) {
    toast("Preencha nome, email e senha.", "error");
    return;
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });

    await ensureUserDoc(cred.user);
    toast("Conta criada! Agora crie sua igreja.", "success");
    // onAuthStateChanged vai mostrar onboarding
  } catch (err) {
    logAuthError("REGISTER ERROR", err);
    toast(prettyAuthError(err), "error");
  }
});

// ---------- Logout (onboarding card) ----------
document.getElementById("btnLogout")?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    toast("Você saiu.", "success");
    showOnboarding(false);
  } catch (err) {
    logAuthError("LOGOUT ERROR", err);
    toast("Erro ao sair.", "error");
  }
});

// ---------- Onboarding (criar igreja) ----------
formOnboarding?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const user = auth.currentUser;
  if (!user) {
    toast("Sessão inválida. Faça login novamente.", "error");
    return;
  }

  const churchName = document.getElementById("churchName")?.value?.trim() || "";
  if (!churchName) {
    toast("Informe o nome da igreja.", "error");
    return;
  }

  try {
    // MVP: 1 igreja por dono (churchId = uid)
    const churchId = user.uid;

    await setDoc(churchRef(churchId), {
      name: churchName,
      ownerUid: user.uid,
      createdAt: serverTimestamp()
    });

    await updateDoc(userRef(user.uid), {
      churchId,
      displayName: user.displayName || "",
      email: user.email || "",
      updatedAt: serverTimestamp()
    });

    toast("Igreja criada! Indo pro dashboard…", "success");
    setTimeout(goDashboard, 250);
  } catch (err) {
    console.error("ONBOARDING ERROR:", err);
    toast(err?.message || "Erro no onboarding.", "error");
  }
});

// ---------- Auth state ----------
onAuthStateChanged(auth, async (user) => {
  try {
    if (!user) {
      showOnboarding(false);
      return;
    }

    const u = await ensureUserDoc(user);

    // Se já tem igreja, vai pro dashboard.
    if (u?.churchId) {
      goDashboard();
    } else {
      showOnboarding(true);
    }
  } catch (err) {
    console.error("AUTH STATE ERROR:", err);
    toast("Erro ao validar sessão. Verifique firebaseConfig e permissões.", "error");
  }
});

// ---------- Extra: sanity log ----------
console.log("✅ auth.js carregado • origin:", window.location.origin);