console.log("✅ AUTH.JS CARREGADO (Ekkora) — anti-loop — 2026-02-27");

import { auth, db } from "./firebase.js";
import { userRef, getDoc, setDoc, updateDoc, doc, serverTimestamp } from "./db.js";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { toast } from "./ui.js";

function currentPage() {
  return (window.location.pathname.split("/").pop() || "").toLowerCase();
}

function go(path) {
  const target = path.replace("./", "").toLowerCase();
  if (currentPage() === target) return; // anti-loop
  window.location.replace(path);        // evita ping-pong no histórico
}

async function ensureUserDoc(user) {
  const ref = userRef(user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      email: (user.email || "").toLowerCase(),
      displayName: user.displayName || "",
      churchId: null,
      createdAt: serverTimestamp()
    });
  }

  const fresh = await getDoc(ref);
  return fresh.data();
}

// Prefill ?invite= e abrir aba criar conta
(function prefillInvite() {
  const invited = (new URLSearchParams(window.location.search).get("invite") || "").trim();
  if (!invited) return;

  setTimeout(() => {
    document.getElementById("regEmail")?.setAttribute("value", invited);
    const regEmail = document.getElementById("regEmail");
    const loginEmail = document.getElementById("loginEmail");
    if (regEmail) regEmail.value = invited;
    if (loginEmail) loginEmail.value = invited;

    document.querySelector('.tab[data-tab="register"]')?.click();
  }, 50);
})();

// LOGIN
document.getElementById("formLogin")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = (document.getElementById("loginEmail")?.value || "").trim();
  const pass = (document.getElementById("loginPass")?.value || "");
  if (!email || !pass) return toast("Preencha email e senha.", "error");

  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    toast(err?.message || "Erro ao entrar.", "error");
  }
});

// REGISTER
document.getElementById("formRegister")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = (document.getElementById("regName")?.value || "").trim();
  const email = (document.getElementById("regEmail")?.value || "").trim();
  const pass = (document.getElementById("regPass")?.value || "");
  if (!name || !email || !pass) return toast("Preencha nome, email e senha.", "error");

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });
    await ensureUserDoc(cred.user);
    toast("Conta criada! Agora faça login.", "success");
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    toast(err?.message || "Erro ao criar conta.", "error");
  }
});

// convite via inviteIndex
async function tryAcceptInvite(user) {
  const email = (user.email || "").trim().toLowerCase();
  if (!email) return null;

  const idxRef = doc(db, "inviteIndex", email);
  const idxSnap = await getDoc(idxRef);
  if (!idxSnap.exists()) return null;

  const inv = idxSnap.data();
  if (inv?.status !== "pending" || !inv?.churchId) return null;

  const ok = confirm(`Você foi convidado.\nCargo: ${inv.role}\n\nAceitar agora?`);
  if (!ok) return null;

  const churchId = inv.churchId;
  const role = inv.role || "viewer";

  await setDoc(doc(db, "churches", churchId, "members", user.uid), {
    uid: user.uid,
    email,
    name: user.displayName || email,
    role,
    createdAt: serverTimestamp(),
    createdByInvite: true
  }, { merge: true });

  await updateDoc(userRef(user.uid), {
    churchId,
    updatedAt: serverTimestamp()
  });

  await updateDoc(idxRef, {
    status: "accepted",
    acceptedByUid: user.uid,
    acceptedAt: serverTimestamp()
  });

  try {
    await updateDoc(doc(db, "churches", churchId, "invites", email), {
      status: "accepted",
      acceptedByUid: user.uid,
      acceptedAt: serverTimestamp()
    });
  } catch {}

  return churchId;
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return; // fica no login

  try {
    const u = await ensureUserDoc(user);

    if (!u?.churchId) {
      const accepted = await tryAcceptInvite(user);
      if (accepted) return go("./dashboard.html");
      return go("./onboard.html");
    }

    return go("./dashboard.html");
  } catch (err) {
    console.error("AUTH STATE ERROR:", err);
    toast("Erro ao validar sessão (provável Rules/Users doc).", "error");
  }
});