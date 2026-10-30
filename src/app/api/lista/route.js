// Ingresso per Siri (Comandi rapidi): aggiunge una voce alla lista della spesa.
//
// POST /api/lista   corpo JSON: { "testo": "latte", "chiave": "...", "chi": "Bobby" | "Alicia" }
// Risponde con una frase che Siri può leggere ad alta voce.
//
// Variabili d'ambiente da impostare su Vercel:
//   SIRI_CHIAVE    chiave segreta che il comando invia (senza, nessuno può scrivere)
//   SIRI_EMAIL     email di un account dell'app (es. quello di Bobby)
//   SIRI_PASSWORD  la sua password dell'app
// Il server accede a Firebase con quell'account, come farebbe l'app,
// quindi valgono le stesse regole di sicurezza di Firestore.

import { timingSafeEqual } from "node:crypto";
import { userNames } from "@/lib/casa";

export const dynamic = "force-dynamic";

const API_KEY = "AIzaSyARqITBypOyeTeKsXhPCEggUyqNrCCN--s";
const PROGETTO = "gestione-spese-verrazzano10";

let token = null; // { idToken, scade }

async function ottieniToken() {
  if (token && token.scade > Date.now()) return token.idToken;
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: process.env.SIRI_EMAIL,
        password: process.env.SIRI_PASSWORD,
        returnSecureToken: true
      })
    }
  );
  if (!r.ok) throw new Error("login");
  const j = await r.json();
  token = {
    idToken: j.idToken,
    scade: Date.now() + (Number(j.expiresIn) - 300) * 1000
  };
  return token.idToken;
}

const chiaveGiusta = (data) => {
  const attesa = process.env.SIRI_CHIAVE || "";
  const a = Buffer.from(String(data || ""));
  const b = Buffer.from(attesa);
  return attesa.length >= 16 && a.length === b.length && timingSafeEqual(a, b);
};

const risposta = (testo, status = 200) =>
  new Response(testo, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });

export async function POST(req) {
  let corpo = {};
  try {
    corpo = await req.json();
  } catch {
    return risposta("Richiesta non valida.", 400);
  }

  const chiave = corpo.chiave || req.headers.get("x-casa-chiave");
  if (!chiaveGiusta(chiave)) return risposta("Chiave non valida.", 401);

  let testo = String(corpo.testo || "").trim().replace(/[.!?]+$/, "");
  if (!testo) return risposta("Non ho capito cosa aggiungere.", 400);
  testo = testo.charAt(0).toUpperCase() + testo.slice(1);

  // Chi l'ha aggiunta: "Bobby" o "Alicia" (di default l'account del server)
  const email =
    Object.keys(userNames).find(
      (e) => userNames[e].toLowerCase() === String(corpo.chi || "").toLowerCase()
    ) || process.env.SIRI_EMAIL;

  try {
    const idToken = await ottieniToken();
    const r = await fetch(
      `https://firestore.googleapis.com/v1/projects/${PROGETTO}/databases/(default)/documents/listaSpesa`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({
          fields: {
            nome: { stringValue: testo },
            user: { stringValue: email },
            data: { timestampValue: new Date().toISOString() }
          }
        })
      }
    );
    if (!r.ok) {
      if (r.status === 401) token = null;
      throw new Error("scrittura");
    }
    return risposta(`Aggiunto ${testo} alla lista della spesa.`);
  } catch {
    return risposta("Non sono riuscito ad aggiungerlo, riprova.", 500);
  }
}
