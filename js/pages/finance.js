// ======================================
// Ekkora • finance.js (ESTÁVEL + Categorias dinâmicas)
// - Categorias vêm de churches/{churchId}/categories (income/expense)
// - Dropdown muda conforme o Tipo
// - Lançamentos em churches/{churchId}/finance com date Timestamp
// ======================================

import { auth, db } from "../firebase.js";
import {
  userRef, churchRef, financeCol,
  getDoc, setDoc, deleteDoc,
  doc, collection,
  query, orderBy, onSnapshot,
  Timestamp, serverTimestamp
} from "../db.js";

import { moneyBRL, toast, initThemeToggle } from "../ui.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

let CHURCH_ID = null;
let ME_ROLE = "viewer";

let ALL = [];
let CATS = []; // {id,name,type}

function go(path) {
  const cur = (window.location.pathname.split("/").pop() || "").toLowerCase();
  const tgt = path.replace("./", "").toLowerCase();
  if (cur === tgt) return;
  window.location.replace(path);
}

function canWrite() {
  return ME_ROLE === "admin" || ME_ROLE === "treasurer";
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function fmtDate(tsOrAny) {
  try {
    const d = tsOrAny?.toDate ? tsOrAny.toDate() : new Date(tsOrAny);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR");
  } catch { return "—"; }
}

function catsCol() {
  return collection(db, "churches", CHURCH_ID, "categories");
}

function fillCategorySelect(type) {
  const sel = document.getElementById("fCategory");
  const hint = document.getElementById("catHint");
  if (!sel) return;

  const list = (CATS || [])
    .filter(c => c.type === type)
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const current = sel.value;

  sel.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = list.length ? "Selecione…" : "Nenhuma categoria criada";
  sel.appendChild(opt0);

  // sempre ter "Outros" como fallback
  const out = document.createElement("option");
  out.value = "Outros";
  out.textContent = "Outros";
  sel.appendChild(out);

  for (const c of list) {
    const o = document.createElement("option");
    o.value = c.name;
    o.textContent = c.name;
    sel.appendChild(o);
  }

  // restaura seleção se ainda existir
  const exists = Array.from(sel.options).some(o => o.value === current);
  sel.value = exists ? current : (list.length ? "" : "Outros");

  if (hint) {
    hint.textContent = list.length
      ? "Categorias vindas de Configurações."
      : "Crie categorias em Configurações (ou use 'Outros').";
  }
}

function applySearch() {
  const q = (document.getElementById("searchFinance")?.value || "").trim().toLowerCase();
  const list = !q ? ALL : ALL.filter(it => {
    const hay = [it.type, it.category, it.note].join(" ").toLowerCase();
    return hay.includes(q);
  });
  render(list);
}

function render(items) {
  const wrap = document.getElementById("financeRows");
  if (!wrap) return;

  wrap.innerHTML = "";

  if (!items.length) {
    wrap.innerHTML = `<div class="muted" style="padding:14px;">Nenhum lançamento ainda.</div>`;
    return;
  }

  for (const it of items) {
    const row = document.createElement("div");
    row.className = "ekkRow";
    row.style.gridTemplateColumns = ".8fr .8fr 1fr 1.4fr .8fr .7fr";

    const badge = it.type === "income"
      ? `<span class="pill">Entrada</span>`
      : `<span class="pill">Saída</span>`;

    row.innerHTML = `
      <div>${fmtDate(it.date)}</div>
      <div>${badge}</div>
      <div>${escapeHtml(it.category || "—")}</div>
      <div>${escapeHtml(it.note || "—")}</div>
      <div class="right">${moneyBRL(Number(it.amount || 0))}</div>
      <div class="right">
        ${canWrite()
          ? `<button class="btn sm danger btnDel" data-id="${it.id}">Excluir</button>`
          : `<span class="muted">—</span>`
        }
      </div>
    `;
    wrap.appendChild(row);
  }

  wrap.querySelectorAll(".btnDel").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!canWrite()) return toast("Você não tem permissão para excluir.", "error");
      const id = btn.dataset.id;
      if (!confirm("Excluir este lançamento?")) return;

      try {
        await deleteDoc(doc(db, "churches", CHURCH_ID, "finance", id));
        toast("Lançamento excluído.", "success");
      } catch (err) {
        console.error(err);
        toast(err?.message || "Erro ao excluir.", "error");
      }
    });
  });
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
  } catch {
    ME_ROLE = "viewer";
  }

  // default date = hoje
  const fDate = document.getElementById("fDate");
  if (fDate && !fDate.value) fDate.value = new Date().toISOString().slice(0, 10);

  // search
  document.getElementById("searchFinance")?.addEventListener("input", applySearch);

  // tipo -> atualiza categorias
  const fType = document.getElementById("fType");
  fType?.addEventListener("change", () => fillCategorySelect(fType.value));

  // realtime categories
  onSnapshot(query(catsCol(), orderBy("name", "asc")), (snap) => {
    CATS = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    fillCategorySelect(fType?.value || "income");
  }, (err) => {
    console.error(err);
    toast(err?.message || "Erro ao carregar categorias.", "error");
    fillCategorySelect(fType?.value || "income");
  });

  // form
  const form = document.getElementById("formFinance");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!canWrite()) {
      toast("Sem permissão para lançar. Peça ao admin para te dar Tesoureiro/Admin.", "error");
      return;
    }

    const type = (document.getElementById("fType")?.value || "income").trim();
    const amount = Number(document.getElementById("fAmount")?.value || 0);
    const category = (document.getElementById("fCategory")?.value || "").trim();
    const dateISO = (document.getElementById("fDate")?.value || "").trim();
    const note = (document.getElementById("fNote")?.value || "").trim();

    if (!dateISO) return toast("Informe a data.", "error");
    if (!amount || amount <= 0) return toast("Informe um valor válido.", "error");
    if (!category) return toast("Selecione uma categoria.", "error");

    // Timestamp (Dashboard filtra por Timestamp)
    const date = Timestamp.fromDate(new Date(dateISO + "T12:00:00"));

    try {
      const newRef = doc(financeCol(CHURCH_ID)); // id automático
      await setDoc(newRef, {
        type,
        amount,
        category,
        note: note || null,
        date,
        createdAt: serverTimestamp(),
        createdByUid: user.uid
      });

      toast("Lançamento salvo!", "success");
      form.reset();
      if (fDate) fDate.value = new Date().toISOString().slice(0, 10);
      document.getElementById("fType").value = "income";
      fillCategorySelect("income"); // repõe options após reset
    } catch (err) {
      console.error("SAVE FINANCE ERROR:", err);
      toast(err?.message || "Erro ao salvar lançamento.", "error");
    }
  });

  // realtime finance
  const q = query(financeCol(CHURCH_ID), orderBy("date", "desc"));
  onSnapshot(q, (snap) => {
    ALL = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    applySearch();
  }, (err) => {
    console.error(err);
    toast(err?.message || "Erro ao carregar finanças.", "error");
  });
}

onAuthStateChanged(auth, (user) => {
  if (!user) return go("./index.html");
  boot(user);
});