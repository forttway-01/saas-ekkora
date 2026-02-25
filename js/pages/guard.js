import { State } from "../state.js";

export function requireAuth() {
  if (!State.user) window.location.href = "./index.html";
}

export function requireChurch() {
  if (!State.churchId) window.location.href = "./onboarding.html";
}