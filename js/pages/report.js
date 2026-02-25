import { requireAuth } from "../guards.js";
import { db } from "../firebase.js";
import { toast } from "../ui.js";
import { logout } from "../auth.js";

import {
  collection, query, where, orderBy, getDocs, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

requireAuth();

const churchId = localStorage.getItem("ekkora:churchId");
if (!churchId) window.location.href = "/onboarding.html";

document.getElementById("btnGoOnboarding")?.addEventListener("click", () => {
  window.location.href = "/onboarding.html";
});

document.getElementById("btnLogout")?.addEventListener("click", async () => {
  await logout();
  localStorage.removeItem("ekkora:churchId");
  window.location.href = "/index.html";
});

function brl(v){
  return Number(v||0).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
}
function ymd(date){
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${dd}`;
}

function setDefaultDates(){
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate()-30);
  document.getElementById("fromDate").value = ymd(from);
  document.getElementById("toDate").value = ymd(to);
}

function parseDate(id){
  const v = document.getElementById(id).value;
  const d = v ? new Date(v + "T00:00:00") : null;
  return d;
}

let lastRows = [];

async function load(){
  try{
    const from = parseDate("fromDate");
    const to = parseDate("toDate");
    const type = document.getElementById("typeFilter").value;
    const cat = (document.getElementById("categoryFilter").value || "").trim().toLowerCase();

    if(!from || !to){
      toast("Selecione o período.", "warn");
      return;
    }

    const toEnd = new Date(to);
    toEnd.setDate(toEnd.getDate()+1);

    const txRef = collection(db, `churches/${churchId}/transactions`);
    const qBase = query(
      txRef,
      where("date", ">=", Timestamp.fromDate(from)),
      where("date", "<", Timestamp.fromDate(toEnd)),
      orderBy("date", "asc")
    );

    const snap = await getDocs(qBase);
    let rows = snap.docs.map(d => ({ id:d.id, ...d.data() }));

    if(type !== "all") rows = rows.filter(r => r.type === type);
    if(cat) rows = rows.filter(r => String(r.category||"").toLowerCase().includes(cat));

    lastRows = rows;

    let sumIn=0, sumOut=0;
    const byDay = new Map();
    const byCat = new Map();

    for(const r of rows){
      const amt = Number(r.amount||0);
      if(r.type === "in") sumIn += amt;
      if(r.type === "out") sumOut += amt;

      const d = r.date?.toDate ? r.date.toDate() : null;
      if(d){
        const key = ymd(d);
        if(!byDay.has(key)) byDay.set(key, { in:0, out:0 });
        const v = byDay.get(key);
        if(r.type==="in") v.in += amt;
        if(r.type==="out") v.out += amt;
      }

      const c = (r.category || "Sem categoria").toString();
      byCat.set(c, (byCat.get(c)||0) + amt);
    }

    document.getElementById("rIn").textContent = brl(sumIn);
    document.getElementById("rOut").textContent = brl(sumOut);
    document.getElementById("rNet").textContent = brl(sumIn - sumOut);
    document.getElementById("rCount").textContent = String(rows.length);

    const tbody = document.getElementById("txTable");
    tbody.innerHTML = rows.map(r => {
      const d = r.date?.toDate ? r.date.toDate() : new Date();
      return `
        <tr class="rowHover">
          <td>${d.toLocaleDateString("pt-BR")}</td>
          <td>${r.title || "-"}</td>
          <td>${r.category || "-"}</td>
          <td>${r.type === "in" ? "Entrada" : "Saída"}</td>
          <td>${brl((r.type==="out" ? -1 : 1) * Number(r.amount||0))}</td>
        </tr>
      `;
    }).join("") || `<tr><td colspan="5" class="muted">Sem dados no período.</td></tr>`;

    if(window.Chart){
      const keys = [...byDay.keys()].sort();
      let running = 0;
      const labels = [];
      const saldo = [];
      const volume = [];

      for(const k of keys){
        const v = byDay.get(k);
        const net = (v.in||0) - (v.out||0);
        running += net;
        labels.push(k.slice(5));
        saldo.push(running);
        volume.push((v.in||0) + (v.out||0));
      }

      const ctx1 = document.getElementById("chartSeries");
      if(ctx1){
        new Chart(ctx1, {
          type:"line",
          data:{ labels, datasets:[
            { label:"Saldo acumulado", data: saldo, tension:.35 },
            { label:"Volume", data: volume, tension:.35 }
          ]},
          options:{
            responsive:true,
            plugins:{ legend:{ display:true } },
            scales:{ y:{ ticks:{ callback:(v)=> brl(v) } } }
          }
        });
      }

      const topCats = [...byCat.entries()]
        .map(([k,v]) => [k, Number(v||0)])
        .sort((a,b)=> Math.abs(b[1]) - Math.abs(a[1]))
        .slice(0,8);

      const ctx2 = document.getElementById("chartCats");
      if(ctx2){
        new Chart(ctx2, {
          type:"bar",
          data:{
            labels: topCats.map(x=>x[0]),
            datasets:[{ label:"Valor", data: topCats.map(x=>x[1]) }]
          },
          options:{
            responsive:true,
            plugins:{ legend:{ display:false } },
            scales:{ y:{ ticks:{ callback:(v)=> brl(v) } } }
          }
        });
      }
    }

  }catch(e){
    console.error(e);
    toast("Falha ao carregar relatórios.", "error");
  }
}

function exportCsv(){
  if(!lastRows.length){
    toast("Nada para exportar.", "warn");
    return;
  }
  const header = ["date","title","category","type","amount"];
  const lines = [header.join(",")];

  for(const r of lastRows){
    const d = r.date?.toDate ? r.date.toDate() : new Date();
    const row = [
      `"${d.toISOString()}"`,
      `"${String(r.title||"").replaceAll('"','""')}"`,
      `"${String(r.category||"").replaceAll('"','""')}"`,
      `"${String(r.type||"")}"`,
      `"${Number(r.amount||0)}"`
    ];
    lines.push(row.join(","));
  }

  const blob = new Blob([lines.join("\n")], { type:"text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ekkora-relatorio-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast("CSV exportado ✅", "success");
}

document.getElementById("btnApply")?.addEventListener("click", load);
document.getElementById("btnReset")?.addEventListener("click", () => {
  document.getElementById("typeFilter").value = "all";
  document.getElementById("categoryFilter").value = "";
  setDefaultDates();
  load();
});
document.getElementById("btnExportCsv")?.addEventListener("click", exportCsv);

setDefaultDates();
load();

