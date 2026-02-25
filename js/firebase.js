// ================================
// Ekkora • firebase.js (MVP estável)
// ================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// ✅ Cole aqui as configs do seu Firebase (Project Settings)
const firebaseConfig = {
  apiKey: "AIzaSyDKReuBryF5m8jquZRgseEekT86xLqHbls",
  authDomain: "ekkora-d98af.firebaseapp.com",
  projectId: "ekkora-d98af",
  storageBucket: "ekkora-d98af.firebasestorage.app",
  messagingSenderId: "548601441501",
  appId: "1:548601441501:web:14cb922746226a7d10bf34"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);