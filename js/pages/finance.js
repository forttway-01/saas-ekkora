// ======================================
// Ekkora • finance.js (tempo real)
// ======================================
import { auth } from "../firebase.js";
import {
  userRef, churchRef, financeCol,
  getDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot,
  serverTimestamp, Timestamp, doc
} from "../db.js";

import { toast, initThemeToggle, yyyyMmDdToDate, dateToYyyyMmDd, moneyBRL } from "../ui.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

let CHURCH_ID = null;
let currentDocs = [];

function firstDayOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0);
}
function lastDayOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
}
function toTs(date) {
  return Timestamp.fromDate(date);
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function openModal(item) {
  document.getElementById("modal").classList.remove("hidden");
  document.getElementById("editId").value = item.id;

  document.getElementById("editType").value = item.type || "income";
  document.getElementById("editAmount").value = Number(item.amount || 0);
  document.getElementById("editCategory").value = item.category || "";
  document.getElementById("editNote").value = item.note || "";

  const dt = item.date?.toDate ? item.date.toDate() : new Date(item.date);
  document.getElementById("editDate").value = dateToYyyyMmDd(dt);
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
}

function renderRows(items) {
  const wrap = document.getElementById("rows");
  wrap.innerHTML = "";

  for (const it of items) {
    const dt = it.date?.toDate ? it.date.toDate() : new Date(it.date);
    const dateStr = dt.toLocaleDateString("pt-BR");
    const badge = it.type === "income"
      ? `<span class="badge income">Entrada</span>`
      : `<span class="badge expense">Saída</span>`;

    const row = document.createElement("div");
    row.className = "row";
    row.style.gridTemplateColumns = "120px 110px 150px 1fr 140px 140px";
    row.innerHTML = `
      <div>${dateStr}</div>
      <div>${badge}</div>
      <div>${escapeHtml(it.category || "-")}</div>
      <div>${escapeHtml(it.note || "-")}</div>
      <div class="right">${moneyBRL(it.amount || 0)}</div>
      <div class="actions-inline">
        <button class="link-btn" data-action="edit" data-id="${it.id}">Editar</button>
      </div>
    `;
    wrap.appendChild(row);
  }

  wrap.querySelectorAll("button[data-action='edit']").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const item = currentDocs.find(x => x.id === id);
      if (item) openModal(item);
    });
  });
}

async function boot(user) {
  initThemeToggle("btnTheme");

  document.getElementById("btnLogout")?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "./index.html";
  });

  document.getElementById("closeModal")?.addEventListener("click", closeModal);
  document.getElementById("modal")?.addEventListener("click", (e) => {
    if (e.target?.id === "modal") closeModal();
  });

  // data padrão: hoje
  const dateInput = document.getElementById("date");
  dateInput.value = dateToYyyyMmDd(new Date());

  // user doc -> churchId
  const uSnap = await getDoc(userRef(user.uid));
  const u = uSnap.data();
  if (!u?.churchId) {
    window.location.href = "./index.html";
    return;
  }
  CHURCH_ID = u.churchId;

  // igreja label
  const cSnap = await getDoc(churchRef(CHURCH_ID));
  const c = cSnap.data();
  document.getElementById("churchLabel").textContent = c?.name || "Minha igreja";

  // listener do mês
  const from = firstDayOfMonth(new Date());
  const to = lastDayOfMonth(new Date());

  const q = query(
    financeCol(CHURCH_ID),
    where("date", ">=", toTs(from)),
    where("date", "<=", toTs(to)),
    orderBy("date", "desc")
  );

  onSnapshot(q, (snap) => {
    currentDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderRows(currentDocs);
  }, (err) => {
    console.error(err);
    toast(err?.message || "Erro ao carregar finanças", "error");
  });

  // CREATE
  document.getElementById("formFinance")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const type = document.getElementById("type").value;
    const amount = Number(document.getElementById("amount").value || 0);
    const category = document.getElementById("category").value.trim();
    const note = document.getElementById("note").value.trim();
    const dateStr = document.getElementById("date").value;

    if (!category) return toast("Informe a categoria.", "error");
    if (!dateStr) return toast("Informe a data.", "error");
    if (!(amount > 0)) return toast("Informe um valor maior que 0.", "error");

    try {
      await addDoc(financeCol(CHURCH_ID), {
        type,
        amount,
        category,
        note,
        date: Timestamp.fromDate(yyyyMmDdToDate(dateStr)),
        createdAt: serverTimestamp(),
        createdBy: user.uid
      });

      // reset
      document.getElementById("amount").value = "";
      document.getElementById("category").value = "";
      document.getElementById("note").value = "";
      document.getElementById("type").value = "income";
      document.getElementById("date").value = dateToYyyyMmDd(new Date());

      toast("Lançamento salvo!", "success");
    } catch (err) {
      console.error(err);
      toast(err?.message || "Erro ao salvar", "error");
    }
  });

  // EDIT SUBMIT
  document.getElementById("formEdit")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = document.getElementById("editId").value;
    const type = document.getElementById("editType").value;
    const amount = Number(document.getElementById("editAmount").value || 0);
    const category = document.getElementById("editCategory").value.trim();
    const note = document.getElementById("editNote").value.trim();
    const dateStr = document.getElementById("editDate").value;

    if (!id) return;
    if (!category) return toast("Informe a categoria.", "error");
    if (!dateStr) return toast("Informe a data.", "error");
    if (!(amount > 0)) return toast("Informe um valor maior que 0.", "error");

    try {
      const ref = doc((await import("../firebase.js")).db, "churches", CHURCH_ID, "finance", id);
      await updateDoc(ref, {
        type,
        amount,
        category,
        note,
        date: Timestamp.fromDate(yyyyMmDdToDate(dateStr)),
        updatedAt: serverTimestamp(),
        updatedBy: user.uid
      });

      closeModal();
      toast("Atualizado!", "success");
    } catch (err) {
      console.error(err);
      toast(err?.message || "Erro ao atualizar", "error");
    }
  });

  // DELETE
  document.getElementById("btnDelete")?.addEventListener("click", async () => {
    const id = document.getElementById("editId").value;
    if (!id) return;

    if (!confirm("Excluir este lançamento?")) return;

    try {
      const ref = doc((await import("../firebase.js")).db, "churches", CHURCH_ID, "finance", id);
      await deleteDoc(ref);

      closeModal();
      toast("Excluído!", "success");
    } catch (err) {
      console.error(err);
      toast(err?.message || "Erro ao excluir", "error");
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