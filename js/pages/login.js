import { redirectIfLoggedIn } from "../guards.js";
import { login, resetPassword } from "../auth.js";
import { toast } from "../ui.js";

redirectIfLoggedIn();

const form = document.getElementById("loginForm");
const btnForgot = document.getElementById("btnForgot");

form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    toast("Preencha email e senha.", "warn");
    return;
  }

  try {
    await login(email, password);
    toast("Login realizado ✅", "success");
    window.location.href = "onboarding.html";
  } catch (err) {
    console.error(err);
    toast("Erro no login: verifique email/senha.", "error");
  }
});

btnForgot?.addEventListener("click", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  if (!email) return toast("Digite seu email pra recuperar a senha.", "warn");

  try {
    await resetPassword(email);
    toast("Email de recuperação enviado ✅", "success");
  } catch (err) {
    console.error(err);
    toast("Não consegui enviar. Verifique o email.", "error");
  }
});