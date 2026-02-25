import { requireAuth } from "../guards.js";

await requireAuth();

const churchId = localStorage.getItem("ekkora:churchId");
if (!churchId) {
  window.location.href = "onboarding.html";
}