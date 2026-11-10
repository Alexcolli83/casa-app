// Notifiche push, lato server (solo nelle route API, mai nel browser).
//
// Variabili d'ambiente su Vercel:
//   FIREBASE_SERVICE_ACCOUNT  il file JSON della "chiave di servizio" Firebase, incollato tutto
//   VAPID_PRIVATE_KEY         la chiave privata delle notifiche
//
// Firestore:
//   notifiche/{email}         { subs: [ iscrizioni push dei telefoni di quella persona ] }
//   notificheInviate/{id}     segna cosa è già partito oggi (per non mandarlo due volte)

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as webpush from "web-push";

export const VAPID_PUBLIC_KEY =
  "BFLK-8pjCLOC6wNBUbj1GK1PoflG9X3vvd4HEWy8C-xD47y9pzE4AXF3g8dIx6HgFYseVr8tGg6IJM47-emrHJU";

export function configOk() {
  const manca = [];
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) manca.push("FIREBASE_SERVICE_ACCOUNT");
  if (!process.env.VAPID_PRIVATE_KEY) manca.push("VAPID_PRIVATE_KEY");
  return manca;
}

function app() {
  if (getApps().length) return getApps()[0];
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  return initializeApp({ credential: cert(sa) });
}

export const adminDb = () => getFirestore(app());

// Controllo del "pass" dell'utente con il servizio di Google (senza firebase-admin/auth,
// che su Vercel non si carica). Stesso metodo della sezione Cucina.
const FIREBASE_API_KEY = "AIzaSyARqITBypOyeTeKsXhPCEggUyqNrCCN--s";
export async function emailDaToken(token) {
  if (!token) return null;
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: token })
  });
  if (!r.ok) return null;
  const j = await r.json();
  return j.users?.[0]?.email || null;
}

let vapidPronto = false;
function vapid() {
  if (vapidPronto) return;
  webpush.setVapidDetails("mailto:casa-app@example.com", VAPID_PUBLIC_KEY, (process.env.VAPID_PRIVATE_KEY || "").trim());
  vapidPronto = true;
}

/** Manda una notifica a tutti i telefoni delle persone indicate (email). Ritorna quante ne sono partite. */
export async function mandaA(emails, { titolo, testo, url = "/" }) {
  vapid();
  const db = adminDb();
  const payload = JSON.stringify({ titolo, testo, url });
  let partite = 0;
  for (const email of emails) {
    const ref = db.collection("notifiche").doc(email);
    const snap = await ref.get();
    const subs = snap.exists ? snap.data().subs || [] : [];
    const vive = [];
    for (const sub of subs) {
      try {
        await webpush.sendNotification(sub, payload, { TTL: 6 * 3600 });
        partite++;
        vive.push(sub);
      } catch (e) {
        // 404/410 = il telefono ha tolto il permesso o reinstallato l'app: la butto
        if (e.statusCode !== 404 && e.statusCode !== 410) vive.push(sub);
        console.warn("push", email, e.statusCode, String(e.body || e.message).slice(0, 120));
      }
    }
    if (vive.length !== subs.length) await ref.set({ subs: vive }, { merge: true });
  }
  return partite;
}

/** Data e ora "italiane" (Europe/Rome), qualunque sia il fuso del server. */
export function oraRoma(d = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Rome",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23"
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value])
  );
  return { giorno: `${p.year}-${p.month}-${p.day}`, ora: Number(p.hour) };
}

/** Il giorno dopo, in formato "2026-11-11". */
export function giornoDopo(giorno) {
  const [y, m, g] = giorno.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, g + 1));
  return d.toISOString().slice(0, 10);
}
