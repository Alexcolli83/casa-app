import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyARqITBypOyeTeKsXhPCEggUyqNrCCN--s",
  authDomain: "gestione-spese-verrazzano10.firebaseapp.com",
  projectId: "gestione-spese-verrazzano10",
  storageBucket: "gestione-spese-verrazzano10.firebasestorage.app",
  messagingSenderId: "856995036307",
  appId: "1:856995036307:web:1dab8d551e29cef51e6166"
};

const firstInit = getApps().length === 0;
const app = firstInit ? initializeApp(firebaseConfig) : getApps()[0];

// Sul telefono teniamo una copia locale dei dati: l'app si apre subito
// e funziona anche senza rete (si sincronizza appena torna la connessione).
let firestore;
if (firstInit && typeof window !== "undefined") {
  try {
    firestore = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
  } catch {
    firestore = getFirestore(app);
  }
} else {
  firestore = getFirestore(app);
}

export const db = firestore;
export const auth = getAuth(app);
