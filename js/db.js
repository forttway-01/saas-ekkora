// ===========================
// Ekkora • db.js (Firestore)
// ===========================
import { db } from "./firebase.js";
import {
  doc, getDoc, setDoc, updateDoc,
  collection, addDoc,
  query, where, orderBy, limit,
  onSnapshot,
  Timestamp, serverTimestamp,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

export {
  doc, getDoc, setDoc, updateDoc,
  collection, addDoc,
  query, where, orderBy, limit,
  onSnapshot,
  Timestamp, serverTimestamp,
  deleteDoc
};

export function userRef(uid) {
  return doc(db, "users", uid);
}

export function churchRef(churchId) {
  return doc(db, "churches", churchId);
}

export function financeCol(churchId) {
  return collection(db, "churches", churchId, "finance");
}