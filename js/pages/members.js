// ======================================
// Ekkora • members.js (FINAL para index.html)
// - Cria convite em churches/{churchId}/invites/{email}
// - Cria índice global inviteIndex/{email}
// - Gera link: /index.html?invite=email
// ======================================

import { auth, db } from "../firebase.js";
import {
  userRef,
  churchRef,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  doc,
  query,
  onSnapshot,
  serverTimestamp
} from "../db.js";

import { toast, initThemeToggle } from "../ui.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

let CHURCH_ID = null;
let ME_UID = null;
let ME_ROLE = "viewer";

function membersCol() { return collection(db, "churches", CHURCH_ID, "members"); }
function invitesCol() { return collection(db, "churches", CHURCH_ID, "invites"); }

function canManage() { return ME_ROLE === "admin"; }

// ✅ seu ambiente é /index.html (sem /public)
function buildInviteLink(email) {
  return `${window.location.origin}/index.html?invite=${encodeURIComponent(email)}`;
}

function setupInviteModal() {
  const modal = document.getElementById("modalInvite");
  const btnOpen = document.getElementById("btnOpenInvite");
  const btnClose = document.getElementById("closeInvite");
  const btnCancel = document.getElementById("cancelInvite");

  const open = () => modal?.classList.remove("hidden");
  const close = () => modal?.classList.add("hidden");

  btnOpen?.addEventListener("click", () => {
    if (!canManage()) return toast("Apenas Admin pode convidar.", "error");
    open();
  });
  btnClose?.addEventListener("click", close);
  btnCancel?.addEventListener("click", close);

  modal?.addEventListener("click", (e) => {
    if (e.target?.id === "modalInvite") close();
  });

  return { close };
}

function renderMembers(list) {
  const wrap = document.getElementById("memberRows");
  if (!wrap) return;

  wrap.innerHTML = "";

  list.forEach(m => {
    const row = document.createElement("div");
    row.className = "ekkRow";
row.style.gridTemplateColumns = "1.2fr 1.2fr .8fr .8fr";
    row.innerHTML = `
      <div>${m.name || m.email || "-"}</div>
      <div>${m.email || "-"}</div>
      <div>${m.role || "-"}</div>
      <div class="right">
        ${canManage() && m.uid !== ME_UID ? `<button class="link-btn btnRemove" data-uid="${m.uid}">Remover</button>` : "—"}
      </div>
    `;
    wrap.appendChild(row);
  });

  wrap.querySelectorAll(".btnRemove").forEach(btn => {
    btn.addEventListener("click", async () => {
      const uid = btn.dataset.uid;
      if (!uid) return;
      if (!confirm("Remover membro?")) return;

      try {
        await deleteDoc(doc(membersCol(), uid));
        toast("Membro removido!", "success");
      } catch (err) {
        console.error(err);
        toast(err?.message || "Erro ao remover.", "error");
      }
    });
  });
}

async function boot(user) {
  initThemeToggle("btnTheme");
  ME_UID = user.uid;

  document.getElementById("btnLogout")?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "./index.html";
  });

  // pega churchId do usuário
  const uSnap = await getDoc(userRef(user.uid));
  const u = uSnap.data();
  if (!u?.churchId) return (window.location.href = "./onboard.html");
  CHURCH_ID = u.churchId;

  // igreja
  const cSnap = await getDoc(churchRef(CHURCH_ID));
  const c = cSnap.data();
  const label = document.getElementById("churchLabel");
  if (label) label.textContent = c?.name || "Minha igreja";

  // bootstrap owner como admin
  if (c?.ownerUid === user.uid) {
    await setDoc(doc(membersCol(), user.uid), {
      uid: user.uid,
      email: (user.email || "").toLowerCase(),
      name: user.displayName || "Admin",
      role: "admin",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    ME_ROLE = "admin";
  } else {
    const myMember = await getDoc(doc(membersCol(), user.uid));
    ME_ROLE = myMember.data()?.role || "viewer";
  }

  if (!canManage()) {
    const btn = document.getElementById("btnOpenInvite");
    if (btn) btn.style.display = "none";
  }

  // realtime members
  onSnapshot(query(membersCol()), (snap) => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderMembers(list);
  });

  // convite
  const { close } = setupInviteModal();

  document.getElementById("formInvite")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!canManage()) return toast("Apenas Admin pode convidar.", "error");

    const email = (document.getElementById("inviteEmail")?.value || "").trim().toLowerCase();
    const role = document.getElementById("inviteRole")?.value || "viewer";
    if (!email) return toast("Informe o email.", "error");

    try {
      // 1) convite na igreja
      await setDoc(doc(invitesCol(), email), {
        email,
        role,
        churchId: CHURCH_ID,
        invitedByUid: ME_UID,
        status: "pending",
        createdAt: serverTimestamp()
      }, { merge: true });

      // 2) índice global para o convidado achar sem query
      await setDoc(doc(db, "inviteIndex", email), {
        email,
        role,
        churchId: CHURCH_ID,
        status: "pending",
        updatedAt: serverTimestamp()
      }, { merge: true });

      // 3) link correto
      const inviteLink = buildInviteLink(email);

      try {
        await navigator.clipboard.writeText(inviteLink);
        toast("Convite criado! Link copiado ✅", "success");
      } catch {
        console.log("Invite link:", inviteLink);
        toast("Convite criado! Link no console (F12).", "success");
      }

      document.getElementById("inviteEmail").value = "";
      close();
    } catch (err) {
      console.error(err);
      toast(err?.message || "Erro ao criar convite.", "error");
    }
  });
}

onAuthStateChanged(auth, (user) => {
  if (!user) return (window.location.href = "./index.html");
  boot(user);
});