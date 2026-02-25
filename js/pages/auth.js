import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { auth } from "../firebase/auth.js";
import { State } from "../state.js";

onAuthStateChanged(auth, (user) => {
  State.setUser(user);

  const path = location.pathname.toLowerCase();
  const isLogin = path.endsWith("/index.html") || path.endsWith("/public/") || path.endsWith("/");

  if (!user && !isLogin) {
    window.location.href = "./index.html";
  }
});