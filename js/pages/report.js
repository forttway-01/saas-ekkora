// ======================================
// Ekkora • report.js (MVP estável)
// - Protege rota (logado)
// - Carrega igreja label
// - Mostra relatório simples do período (placeholder)
// ======================================

import { auth } from "../firebase.js";
import {
  userRef, churchRef,
  getDoc,
} from "../db.js";

import { toast, initThemeToggle } from "../ui.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

function go(path){
  const cur = (window.location.pathname.split("/").pop() || "").toLowerCase();
  const tgt = path.replace("./","").toLowerCase();
  if (cur === tgt) return;
  window.location.replace(path);
}

async function boot(user){
  initThemeToggle("btnTheme");

  document.getElementById("btnLogout")?.addEventListener("click", async () => {
    await signOut(auth);
    go("./index.html");
  });

  // user doc
  const uSnap = await getDoc(userRef(user.uid));
  const u = uSnap.data();
  if (!u?.churchId) return go("./onboard.html");

  // church label
  try {
    const cSnap = await getDoc(churchRef(u.churchId));
    const c = cSnap.data();
    const label = document.getElementById("churchLabel");
    if (label) label.textContent = c?.name || "Minha igreja";
  } catch {}

  const repFrom = document.getElementById("repFrom");
  const repTo = document.getElementById("repTo");
  const out = document.getElementById("reportRows");

  // defaults: mês atual
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const toISO = (d) => d.toISOString().slice(0,10);
  if (repFrom) repFrom.value = toISO(from);
  if (repTo) repTo.value = toISO(to);

  document.getElementById("btnRunReport")?.addEventListener("click", () => {
    const a = repFrom?.value || "";
    const b = repTo?.value || "";
    if (!a || !b) return toast("Selecione as datas.", "error");

    // MVP: só confirma na tela (o relatório completo a gente liga com finance depois)
    if (out) {
      out.innerHTML = `
        <div style="font-weight:800; margin-bottom:6px;">Período selecionado</div>
        <div class="muted">${a} até ${b}</div>
        <div style="margin-top:10px;" class="muted">
          Próximo passo: somar Entradas/Saídas desse período e gerar tabela + export.
        </div>
      `;
    }

    toast("Relatório gerado (MVP).", "success");
  });
}

onAuthStateChanged(auth, (user) => {
  if (!user) return go("./index.html");
  boot(user);
});