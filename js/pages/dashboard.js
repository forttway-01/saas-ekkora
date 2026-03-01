// ======================================
// Ekkora • dashboard.js (tempo real)
// ======================================
import { auth } from "../firebase.js";
import {
  userRef, churchRef, financeCol,
  getDoc, updateDoc,
  query, where, orderBy, onSnapshot,
  Timestamp
} from "../db.js";
import { moneyBRL, toast, initThemeToggle, dateToYyyyMmDd } from "../ui.js";

import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

let lineChart;
let pieChart;

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

function buildDailySeries(items, fromDate, toDate) {
  const days = [];
  const cursor = new Date(fromDate);
  cursor.setHours(12,0,0,0);

  while (cursor <= toDate) {
    const key = dateToYyyyMmDd(cursor);
    days.push({ key, income: 0, expense: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  const map = new Map(days.map(d => [d.key, d]));
  for (const it of items) {
    const dt = it.date?.toDate ? it.date.toDate() : new Date(it.date);
    const key = dateToYyyyMmDd(dt);
    const bucket = map.get(key);
    if (!bucket) continue;
    if (it.type === "income") bucket.income += Number(it.amount || 0);
    else bucket.expense += Number(it.amount || 0);
  }

  let acc = 0;
  const labels = [];
  const incomes = [];
  const expenses = [];
  const balances = [];

  for (const d of days) {
    acc += (d.income - d.expense);
    labels.push(d.key.slice(8));     // dia (DD)
    incomes.push(d.income);
    expenses.push(d.expense);
    balances.push(acc);
  }

  return { labels, incomes, expenses, balances };
}

function computeKPIs(items) {
  let inc = 0, exp = 0, incCount = 0, expCount = 0;
  for (const it of items) {
    const v = Number(it.amount || 0);
    if (it.type === "income") { inc += v; incCount++; }
    else { exp += v; expCount++; }
  }
  return { inc, exp, bal: inc - exp, incCount, expCount };
}

function computeAvg7(items) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 6);
  start.setHours(0,0,0,0);

  let net = 0;
  for (const it of items) {
    const dt = it.date?.toDate ? it.date.toDate() : new Date(it.date);
    if (dt >= start && dt <= now) {
      const v = Number(it.amount || 0);
      net += (it.type === "income") ? v : -v;
    }
  }
  return net / 7;
}

function setKPI(id, value, paint = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = moneyBRL(value);

  if (paint) el.style.color = (value >= 0) ? "var(--green)" : "var(--red)";
}

function renderLastRows(items) {
  const wrap = document.getElementById("lastRows");
  if (!wrap) return;
  wrap.innerHTML = "";

  const latest = [...items]
    .sort((a,b) => (b.date?.seconds || 0) - (a.date?.seconds || 0))
    .slice(0, 8);

  for (const it of latest) {
    const dt = it.date?.toDate ? it.date.toDate() : new Date(it.date);
    const dateStr = dt.toLocaleDateString("pt-BR");
    const badge = it.type === "income"
      ? `<span class="badge income">Entrada</span>`
      : `<span class="badge expense">Saída</span>`;

    const row = document.createElement("div");
   row.className = "ekkRow";
row.style.gridTemplateColumns = ".7fr .7fr 1fr 1.2fr .8fr";
    row.innerHTML = `
      <div>${dateStr}</div>
      <div>${badge}</div>
      <div>${escapeHtml(it.category || "-")}</div>
      <div>${escapeHtml(it.note || "-")}</div>
      <div class="right">${moneyBRL(it.amount || 0)}</div>
    `;
    wrap.appendChild(row);
  }
}

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
function getTextColor() { return cssVar("--text", "#eaf0ff"); }
function getMutedColor() { return cssVar("--muted", "rgba(234,240,255,.65)"); }
function getGridColor() { return cssVar("--border", "rgba(255,255,255,.10)"); }

function ensureLineChart(ctx, labels, incomes, expenses, balances) {
  const data = {
    labels,
    datasets: [
      {
        label: "Entradas",
        data: incomes,
        borderWidth: 2,
        tension: 0.35,
        borderColor: cssVar("--green", "#19c37d"),
        pointRadius: 0
      },
      {
        label: "Saídas",
        data: expenses,
        borderWidth: 2,
        tension: 0.35,
        borderColor: cssVar("--red", "#ff4d4d"),
        pointRadius: 0
      },
      {
        label: "Saldo acumulado",
        data: balances,
        borderWidth: 2.5,
        tension: 0.35,
        borderColor: cssVar("--blue", "#4aa3ff"),
        pointRadius: 0
      }
    ]
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { labels: { color: getTextColor() } }
    },
    scales: {
      x: { ticks: { color: getMutedColor() }, grid: { color: getGridColor() } },
      y: { ticks: { color: getMutedColor() }, grid: { color: getGridColor() } }
    }
  };

  if (!lineChart) {
    lineChart = new Chart(ctx, { type: "line", data, options });
  } else {
    lineChart.data = data;
    lineChart.options = options;
    lineChart.update();
  }
}

function ensurePieChart(ctx, byCategory) {
  const entries = Object.entries(byCategory || {})
    .map(([k, v]) => [String(k || "Outros").trim() || "Outros", Number(v || 0)])
    .filter(([, v]) => Number.isFinite(v))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  let labels = entries.map(e => e[0]);
  let values = entries.map(e => e[1]);

  // ✅ Se não tiver dados (ou tudo zero), evita “gráfico invisível”
  const sum = values.reduce((acc, n) => acc + (Number(n) || 0), 0);
  if (!labels.length || sum <= 0) {
    labels = ["Sem dados no período"];
    values = [1];
  }

  // tons de verde (premium) + fallback para estado sem dados
  const greens = [
    "#0b5d3a","#0f6b43","#127a4b","#158a55","#18a062",
    "#1ab26c","#2ac47a","#4fd38f","#7de2ab","#b7f0d0"
  ];

  const data = {
    labels,
    datasets: [{
      data: values,
      backgroundColor: (labels.length === 1 && labels[0].includes("Sem dados"))
        ? ["rgba(255,255,255,.18)"]
        : greens.slice(0, values.length),
      borderWidth: 0
    }]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false, // ✅ importantíssimo com wrappers novos
    plugins: {
      legend: {
        display: !(labels.length === 1 && labels[0].includes("Sem dados")),
        labels: { color: getTextColor() }
      },
      tooltip: {
        callbacks: {
          label: (item) => {
            const v = Number(item.raw || 0);
            if (labels.length === 1 && labels[0].includes("Sem dados")) return "Sem dados";
            return `${item.label}: ${moneyBRL(v)}`;
          }
        }
      }
    }
  };

  if (!pieChart) {
    pieChart = new Chart(ctx, { type: "doughnut", data, options });
  } else {
    pieChart.data = data;
    pieChart.options = options;
    pieChart.update();
  }
}

async function boot(user) {
  initThemeToggle("btnTheme");

  document.getElementById("btnLogout")?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "./index.html";
  });

  // user doc
  const uSnap = await getDoc(userRef(user.uid));
  const u = uSnap.data();

  if (!u?.churchId) {
    window.location.href = "./index.html";
    return;
  }

  // igreja label
  const cSnap = await getDoc(churchRef(u.churchId));
  const c = cSnap.data();
  document.getElementById("churchLabel").textContent = c?.name || "Minha igreja";

  // meta mensal
  const targetInput = document.getElementById("monthlyTarget");
  targetInput.value = Number(u.monthlyTarget || 0);

  document.getElementById("saveTarget")?.addEventListener("click", async () => {
    const v = Number(targetInput.value || 0);
    await updateDoc(userRef(user.uid), { monthlyTarget: v });
    toast("Meta mensal salva!", "success");
  });

  const from = firstDayOfMonth(new Date());
  const to = lastDayOfMonth(new Date());

  const q = query(
    financeCol(u.churchId),
    where("date", ">=", toTs(from)),
    where("date", "<=", toTs(to)),
    orderBy("date", "asc")
  );

  onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // KPIs
    const k = computeKPIs(items);
    setKPI("kpiIncome", k.inc);
    setKPI("kpiExpense", k.exp);
    setKPI("kpiBalance", k.bal, true);

    document.getElementById("kpiIncomeSub").textContent = `${k.incCount} lançamentos`;
    document.getElementById("kpiExpenseSub").textContent = `${k.expCount} lançamentos`;
    document.getElementById("kpiBalanceSub").textContent = (k.bal >= 0) ? "Saldo positivo ✅" : "Saldo negativo ⚠️";

    // média 7 dias
    const avg7 = computeAvg7(items);
    const avgEl = document.getElementById("kpiAvg7");
    avgEl.textContent = moneyBRL(avg7);
    avgEl.style.color = (avg7 >= 0) ? "var(--green)" : "var(--red)";

    // gráfico principal
    const series = buildDailySeries(items, from, to);
    ensureLineChart(
      document.getElementById("lineChart").getContext("2d"),
      series.labels,
      series.incomes,
      series.expenses,
      series.balances
    );

    // pizza categorias (somando valor)
    const byCat = {};
    for (const it of items) {
      const cat = (it.category || "Outros").trim() || "Outros";
      byCat[cat] = (byCat[cat] || 0) + Number(it.amount || 0);
    }
    ensurePieChart(document.getElementById("pieChart").getContext("2d"), byCat);

    // últimos
    renderLastRows(items);

    // progresso meta (entra no sub das entradas)
    const target = Number(targetInput.value || 0);
    if (target > 0) {
      const percent = Math.max(0, Math.min(100, (k.inc / target) * 100));
      document.getElementById("kpiIncomeSub").textContent =
        `${k.incCount} lançamentos • ${percent.toFixed(1)}% da meta`;
    }
  }, (err) => {
    console.error(err);
    toast(err?.message || "Erro ao escutar finanças", "error");
  });
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "./index.html";
    return;
  }
  boot(user);
});