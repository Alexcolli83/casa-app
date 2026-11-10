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

/**
 * Rimette a posto la chiave privata se nel copia-incolla si è rovinata:
 * "\\n" scritti come testo, a capo spariti, spazi al posto degli a capo, virgolette in più.
 */
function sistemaChiave(k) {
  let t = String(k || "").trim().replace(/^"|"$/g, "");
  t = t.replace(/\\\\n/g, "\n").replace(/\\n/g, "\n").replace(/\r/g, "");
  const m = t.match(/-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/);
  if (!m) return t;
  const corpo = m[2].replace(/[^A-Za-z0-9+/=]/g, ""); // solo i caratteri della chiave
  const righe = corpo.match(/.{1,64}/g) || [];
  return `-----BEGIN ${m[1]}-----\n${righe.join("\n")}\n-----END ${m[1]}-----\n`;
}

/** Legge la chiave di servizio, anche se incollata con qualche difetto. */
function leggiServiceAccount() {
  let testo = String(process.env.FIREBASE_SERVICE_ACCOUNT || "").trim();
  // a volte arriva tra virgolette o con gli a capo "veri" dentro le stringhe
  if (testo.startsWith("'") && testo.endsWith("'")) testo = testo.slice(1, -1);
  let sa;
  try {
    sa = JSON.parse(testo);
  } catch {
    // a capo "veri" dentro le stringhe (non permessi in JSON): li trasformo in \n e riprovo
    let fuori = "";
    let inStringa = false;
    for (let i = 0; i < testo.length; i++) {
      const c = testo[i];
      if (c === '"' && testo[i - 1] !== "\\") inStringa = !inStringa;
      if (inStringa && (c === "\n" || c === "\r")) {
        if (c === "\n") fuori += "\\n";
        continue;
      }
      fuori += c;
    }
    sa = JSON.parse(fuori);
  }
  if (typeof sa === "string") sa = JSON.parse(sa); // incollata "doppia"
  sa.private_key = sistemaChiave(sa.private_key);
  return sa;
}

function app() {
  if (getApps().length) return getApps()[0];
  return initializeApp({ credential: cert(leggiServiceAccount()) });
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
