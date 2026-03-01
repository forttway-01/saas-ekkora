// ======================================
// Ekkora • people.js (Cadastro de Membros)
// Collection: churches/{churchId}/people
// - Real-time (onSnapshot)
// - Buscar
// - Criar/Editar/Excluir (admin/owner)
// ======================================

import { auth, db } from "../firebase.js";
import {
  userRef, churchRef,
  getDoc, setDoc, updateDoc, deleteDoc,
  collection, doc, query, onSnapshot,
  serverTimestamp
} from "../db.js";

import { toast, initThemeToggle } from "../ui.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

let CHURCH_ID = null;
let ME_ROLE = "viewer";
let ALL = [];

function go(path){
  const cur = (window.location.pathname.split("/").pop() || "").toLowerCase();
  const tgt = path.replace("./","").toLowerCase();
  if (cur === tgt) return;
  window.location.replace(path);
}

function peopleCol() {
  return collection(db, "churches", CHURCH_ID, "people");
}

function canEdit() {
  return ME_ROLE === "admin";
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function calcAge(birthISO) {
  if (!birthISO) return "";
  const d = new Date(birthISO);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age <= 120 ? age : "";
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

function setModal(open) {
  const m = document.getElementById("modalPerson");
  if (!m) return;
  m.classList.toggle("hidden", !open);
}

function fillForm(p = null) {
  document.getElementById("personId").value = p?.id || "";
  document.getElementById("pName").value = p?.name || "";
  document.getElementById("pBirth").value = p?.birthDate || "";
  document.getElementById("pPhone").value = p?.phone || "";
  document.getElementById("pEmail").value = p?.email || "";
  document.getElementById("pBaptism").value = p?.baptismDate || "";
  document.getElementById("pStatus").value = p?.status || "ativo";
  document.getElementById("pAddress").value = p?.address || "";
  document.getElementById("pNotes").value = p?.notes || "";

  document.getElementById("modalTitle").textContent = p?.id ? "Editar membro" : "Novo membro";
}

function render(list) {
  const wrap = document.getElementById("peopleRows");
  if (!wrap) return;

  wrap.innerHTML = "";

  if (!list.length) {
    wrap.innerHTML = `<div class="muted" style="padding:14px;">Nenhum membro cadastrado ainda.</div>`;
    return;
  }

  for (const p of list) {
    const age = calcAge(p.birthDate);
    const row = document.createElement("div");
    row.className = "row";
    row.style.gridTemplateColumns = "1.2fr .5fr .8fr .9fr .9fr .7fr";

    row.innerHTML = `
      <div><b>${escapeHtml(p.name || "—")}</b></div>
      <div>${age !== "" ? age : "—"}</div>
      <div>${escapeHtml(p.phone || "—")}</div>
      <div>${fmtDate(p.baptismDate)}</div>
      <div><span class="pill">${escapeHtml(p.status || "—")}</span></div>
      <div class="right">
        ${canEdit() ? `
          <button class="btn sm ghost btnEdit" data-id="${p.id}">Editar</button>
          <button class="btn sm danger btnDel" data-id="${p.id}">Excluir</button>
        ` : `<span class="muted">—</span>`}
      </div>
    `;

    wrap.appendChild(row);
  }

  wrap.querySelectorAll(".btnEdit").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const p = ALL.find(x => x.id === id);
      fillForm(p);
      setModal(true);
    });
  });

  wrap.querySelectorAll(".btnDel").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      if (!confirm("Excluir este membro?")) return;
      try {
        await deleteDoc(doc(peopleCol(), id));
        toast("Membro excluído.", "success");
      } catch (err) {
        console.error(err);
        toast(err?.message || "Erro ao excluir.", "error");
      }
    });
  });
}

function applySearch() {
  const q = (document.getElementById("search")?.value || "").trim().toLowerCase();
  if (!q) return render(ALL);

  const filtered = ALL.filter(p => {
    const hay = [
      p.name, p.phone, p.email, p.status, p.address, p.notes
    ].join(" ").toLowerCase();
    return hay.includes(q);
  });

  render(filtered);
}

async function boot(user) {
  initThemeToggle("btnTheme");

  document.getElementById("btnLogout")?.addEventListener("click", async () => {
    await signOut(auth);
    go("./index.html");
  });

  // user doc
  const uSnap = await getDoc(userRef(user.uid));
  const u = uSnap.data();
  if (!u?.churchId) return go("./onboard.html");

  CHURCH_ID = u.churchId;

  // church label
  try {
    const cSnap = await getDoc(churchRef(CHURCH_ID));
    const c = cSnap.data();
    const label = document.getElementById("churchLabel");
    if (label) label.textContent = c?.name || "Minha igreja";
  } catch {}

  // role
  try {
    const myMemberSnap = await getDoc(doc(db, "churches", CHURCH_ID, "members", user.uid));
    ME_ROLE = myMemberSnap.exists() ? (myMemberSnap.data()?.role || "viewer") : "viewer";
  } catch {}

  // se não pode editar, esconde botão novo
  if (!canEdit()) {
    const btn = document.getElementById("btnNew");
    if (btn) btn.style.display = "none";
  }

  // modal handlers
  const close = () => setModal(false);

  document.getElementById("btnNew")?.addEventListener("click", () => {
    if (!canEdit()) return toast("Apenas Admin pode cadastrar.", "error");
    fillForm(null);
    setModal(true);
  });

  document.getElementById("closePerson")?.addEventListener("click", close);
  document.getElementById("cancelPerson")?.addEventListener("click", close);

  document.getElementById("modalPerson")?.addEventListener("click", (e) => {
    if (e.target?.id === "modalPerson") close();
  });

  // search
  document.getElementById("search")?.addEventListener("input", applySearch);

  // salvar
  document.getElementById("formPerson")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!canEdit()) return toast("Apenas Admin pode salvar.", "error");

    const id = (document.getElementById("personId").value || "").trim();
    const payload = {
      name: (document.getElementById("pName").value || "").trim(),
      birthDate: (document.getElementById("pBirth").value || "").trim() || null,
      phone: (document.getElementById("pPhone").value || "").trim() || null,
      email: (document.getElementById("pEmail").value || "").trim().toLowerCase() || null,
      baptismDate: (document.getElementById("pBaptism").value || "").trim() || null,
      status: (document.getElementById("pStatus").value || "ativo").trim(),
      address: (document.getElementById("pAddress").value || "").trim() || null,
      notes: (document.getElementById("pNotes").value || "").trim() || null,
      updatedAt: serverTimestamp()
    };

    if (!payload.name) return toast("Informe o nome.", "error");

    try {
      if (!id) {
        // create
        const newRef = doc(peopleCol());
        await setDoc(newRef, {
          ...payload,
          createdAt: serverTimestamp(),
          createdByUid: user.uid
        });
        toast("Membro cadastrado!", "success");
      } else {
        // update
        await updateDoc(doc(peopleCol(), id), payload);
        toast("Membro atualizado!", "success");
      }

      setModal(false);
    } catch (err) {
      console.error(err);
      toast(err?.message || "Erro ao salvar.", "error");
    }
  });

  // realtime
  onSnapshot(query(peopleCol()), (snap) => {
    ALL = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    applySearch();
  }, (err) => {
    console.error(err);
    toast(err?.message || "Erro ao carregar membros.", "error");
  });
}

onAuthStateChanged(auth, (user) => {
  if (!user) return go("./index.html");
  boot(user);
});