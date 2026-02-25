export const State = {
  user: null,
  churchId: localStorage.getItem("activeChurchId") || null,

  setUser(u) {
    this.user = u;
    window.dispatchEvent(new CustomEvent("auth:changed", { detail: u }));
  },

  setChurch(id) {
    this.churchId = id;
    localStorage.setItem("activeChurchId", id);
    window.dispatchEvent(new CustomEvent("church:changed", { detail: id }));
  }
};