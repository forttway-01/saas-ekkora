// ======================================
// Ekkora • onboard.js (Config + Categorias)
// - Protege rota
// - Edita igreja + prefs
// - CRUD de categorias: churches/{churchId}/categories
// ======================================

import { auth, db } from "../firebase.js";
import {
  userRef, churchRef,
  getDoc, updateDoc,
  serverTimestamp,
  collection, doc, setDoc, deleteDoc,
  query, orderBy, onSnapshot
} from "../db.js";

import { toast, initThemeToggle } from "../ui.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

let CHURCH_ID = null;
let ME_ROLE = "viewer";
let unsubCats = null;

function go(path) {
  const cur = (window.location.pathname.split("/").pop() || "").toLowerCase();
  const tgt = path.replace("./", "").toLowerCase();
  if (cur === tgt) return;
  window.location.replace(path);
}

function canManageCategories() {
  return ME_ROLE === "admin" || ME_ROLE === "treasurer";
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function catsCol() {
  return collection(db, "churches", CHURCH_ID, "categories");
}

async function boot(user) {
  initThemeToggle("btnTheme");

  document.getElementById("btnLogout")?.addEventListener("click", async () => {
    await signOut(auth);
    go("./index.html");
  });

  // user doc
  const uSnap = await getDoc(userRef(user.uid));
  const u = uSnap.data() || {};

  if (!u?.churchId) return go("./index.html");
  CHURCH_ID = u.churchId;

  // role
  try {
    const myMemberSnap = await getDoc(doc(db, "churches", CHURCH_ID, "members", user.uid));
    ME_ROLE = myMemberSnap.exists() ? (myMemberSnap.data()?.role || "viewer") : "viewer";
  } catch {
    ME_ROLE = "viewer";
  }

  // church label
  const cSnap = await getDoc(churchRef(CHURCH_ID));
  const c = cSnap.data() || {};
  document.getElementById("churchLabel").textContent = c?.name || "Minha igreja";

  // Preenche campos Igreja
  const churchNameEl = document.getElementById("churchName");
  const churchCityEl = document.getElementById("churchCity");
  const churchStateEl = document.getElementById("churchState");

  if (churchNameEl) churchNameEl.value = c.name || "";
  if (churchCityEl) churchCityEl.value = c.city || "";
  if (churchStateEl) churchStateEl.value = c.state || "";

  // Prefs
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
      await updateDoc(churchRef(CHURCH_ID), {
        name, city, state,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid
      });

      document.getElementById("churchLabel").textContent = name;
      toast("Igreja atualizada!", "success");
    } catch (err) {
      console.error(err);
      toast(err?.message || "Erro ao salvar igreja.", "error");
    }
  });

  // SALVAR PREFS
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

  // ===== Categorias =====
  const hint = document.getElementById("catRoleHint");
  if (hint) {
    hint.textContent = canManageCategories()
      ? "Você pode criar/editar categorias."
      : "Somente Admin/Tesoureiro pode criar categorias.";
  }

  // desabilita forms se não puder
  const formIncome = document.getElementById("formCatIncome");
  const formExpense = document.getElementById("formCatExpense");
  const incomeName = document.getElementById("catIncomeName");
  const expenseName = document.getElementById("catExpenseName");

  if (!canManageCategories()) {
    formIncome?.querySelector("button")?.setAttribute("disabled", "disabled");
    formExpense?.querySelector("button")?.setAttribute("disabled", "disabled");
    incomeName?.setAttribute("disabled", "disabled");
    expenseName?.setAttribute("disabled", "disabled");
  }

  async function addCategory(type, name) {
    const clean = (name || "").trim();
    if (!clean) return toast("Digite o nome da categoria.", "error");

    // id previsível para evitar duplicados por nome+tipo
    const id = (type + "_" + clean.toLowerCase())
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");

    await setDoc(doc(catsCol(), id), {
      type,             // "income" | "expense"
      name: clean,
      createdAt: serverTimestamp(),
      createdByUid: user.uid
    }, { merge: true });
  }

  formIncome?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!canManageCategories()) return toast("Sem permissão.", "error");
    try {
      await addCategory("income", incomeName.value);
      incomeName.value = "";
      toast("Categoria de entrada criada!", "success");
    } catch (err) {
      console.error(err);
      toast(err?.message || "Erro ao criar categoria.", "error");
    }
  });

  formExpense?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!canManageCategories()) return toast("Sem permissão.", "error");
    try {
      await addCategory("expense", expenseName.value);
      expenseName.value = "";
      toast("Categoria de saída criada!", "success");
    } catch (err) {
      console.error(err);
      toast(err?.message || "Erro ao criar categoria.", "error");
    }
  });

  function renderCats(list) {
    const incomeWrap = document.getElementById("incomeCats");
    const expenseWrap = document.getElementById("expenseCats");
    if (!incomeWrap || !expenseWrap) return;

    const incomes = list.filter(x => x.type === "income").sort((a,b)=>a.name.localeCompare(b.name));
    const expenses = list.filter(x => x.type === "expense").sort((a,b)=>a.name.localeCompare(b.name));

    const rowTpl = (x) => `
      <div class="ekkRow" style="grid-template-columns: 1fr .5fr;">
        <div><b>${escapeHtml(x.name)}</b></div>
        <div class="right">
          ${canManageCategories()
            ? `<button class="btn sm danger btnDelCat" data-id="${x.id}">Excluir</button>`
            : `<span class="muted">—</span>`
          }
        </div>
      </div>
    `;

    incomeWrap.innerHTML = incomes.length
      ? incomes.map(rowTpl).join("")
      : `<div class="muted" style="padding:12px;">Nenhuma categoria de entrada.</div>`;

    expenseWrap.innerHTML = expenses.length
      ? expenses.map(rowTpl).join("")
      : `<div class="muted" style="padding:12px;">Nenhuma categoria de saída.</div>`;

    document.querySelectorAll(".btnDelCat").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!canManageCategories()) return toast("Sem permissão.", "error");
        const id = btn.dataset.id;
        if (!confirm("Excluir esta categoria?")) return;
        try {
          await deleteDoc(doc(catsCol(), id));
          toast("Categoria excluída.", "success");
        } catch (err) {
          console.error(err);
          toast(err?.message || "Erro ao excluir.", "error");
        }
      });
    });
  }

  // realtime categorias
  if (unsubCats) unsubCats();
  unsubCats = onSnapshot(query(catsCol(), orderBy("name", "asc")), (snap) => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderCats(list);
  }, (err) => {
    console.error(err);
    toast(err?.message || "Erro ao carregar categorias.", "error");
  });
}

onAuthStateChanged(auth, (user) => {
  if (!user) return go("./index.html");
  boot(user);
});