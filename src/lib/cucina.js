// Costanti e piccoli aiuti della sezione Cucina.

import { auth } from "@/firebase";

/** I "tab" di umore: si possono combinare. */
export const umori = [
  { id: "pesce-legumi", label: "Pesce e legumi", emoji: "🐟" },
  { id: "carne-verdura", label: "Carne e verdura", emoji: "🥩" },
  { id: "verduroso", label: "Verduroso", emoji: "🥦" },
  { id: "gourmet", label: "Gourmet con classe", emoji: "🎩" },
  { id: "veloce-economico", label: "Veloce e spendo poco", emoji: "⚡" },
  { id: "proteico", label: "Molto proteico", emoji: "💪" },
  { id: "leggero", label: "Pochi grassi", emoji: "🪶" },
  { id: "comfort", label: "Coccola", emoji: "🧀" },
  { id: "pesce", label: "Solo pesce", emoji: "🦐" },
  { id: "vegetariano", label: "Vegetariano", emoji: "🌱" }
];

export const tempi = [
  { id: 15, label: "15 min" },
  { id: 30, label: "30 min" },
  { id: 45, label: "45 min" },
  { id: 90, label: "Con calma" }
];

export const livelliSporco = [
  { id: 1, label: "Una padella", emoji: "🍳" },
  { id: 2, label: "Poco", emoji: "🥄" },
  { id: 3, label: "Chi se ne frega", emoji: "💥" }
];

export const dispensaIniziale = [
  "sale", "pepe", "olio extravergine", "aceto", "rosmarino", "timo", "paprika",
  "senape", "cipolle", "aglio", "fagioli in scatola", "ceci in scatola",
  "tonno in scatola", "salmone affumicato", "affettati vari", "pasta", "riso",
  "uova", "farina", "burro", "parmigiano", "pomodori pelati"
];

const nomiMesi = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"
];

export const nomeMeseIt = (d = new Date()) => nomiMesi[d.getMonth()];

export const stagioneDi = (d = new Date()) => {
  const m = d.getMonth(); // 0 = gennaio
  if (m === 11 || m <= 1) return "inverno";
  if (m <= 4) return "primavera";
  if (m <= 7) return "estate";
  return "autunno";
};

export const stagioni = [
  { id: "primavera", label: "Primavera", emoji: "🌸" },
  { id: "estate", label: "Estate", emoji: "☀️" },
  { id: "autunno", label: "Autunno", emoji: "🍂" },
  { id: "inverno", label: "Inverno", emoji: "❄️" }
];

export const sporcoLabel = (n) => {
  const v = Number(n) || 0;
  if (v <= 1) return "🍳 una padella";
  if (v === 2) return "🥄🥄 due pentole";
  return "💥 " + v + " pentole";
};

export const fmtMinuti = (m) => {
  const v = Math.round(Number(m) || 0);
  if (!v) return "—";
  if (v < 60) return v + " min";
  const h = Math.floor(v / 60);
  const r = v % 60;
  return h + " h" + (r ? " " + r : "");
};

export const fmtCosto = (c) => {
  const v = Number(c);
  if (!v && v !== 0) return "—";
  return "~" + v.toLocaleString("it-IT", { maximumFractionDigits: 0 }) + " €";
};

/** Data di un documento Firestore (Timestamp o Date). */
export const dataDoc = (x) => {
  if (x?.toDate) return x.toDate();
  if (x?.seconds) return new Date(x.seconds * 1000);
  if (x instanceof Date) return x;
  return null;
};

/** I gusti dello chef: riassunto delle ultime ricette fatte, con voti e note. */
export function riassuntoGusti(ricette, max = 25) {
  return ricette
    .slice(0, max)
    .map((r) => {
      const note = (r.note || []).map((n) => n.testo).join(" / ");
      return `- ${r.titolo}${r.voto ? ` (voto ${r.voto}/5)` : ""}${note ? `: ${note}` : ""}`;
    })
    .join("\n")
    .slice(0, 4000);
}

/** Chiama il nostro server (che parla con Gemini) con il "pass" di Firebase. */
export async function chiediCucina(azione, dati) {
  const u = auth.currentUser;
  if (!u) throw new Error("Devi essere dentro l'app.");
  const token = await u.getIdToken();
  const r = await fetch("/api/cucina", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ azione, ...dati })
  });
  let j = {};
  try {
    j = await r.json();
  } catch {
    // risposta non JSON
  }
  if (!r.ok) throw new Error(j.errore || "Qualcosa è andato storto, riprova.");
  return j;
}

/** Piccola memoria sul telefono (non condivisa): se non va, pazienza. */
export const ricordaLocale = {
  leggi(chiave, def) {
    try {
      const v = localStorage.getItem("cucina:" + chiave);
      return v ? JSON.parse(v) : def;
    } catch {
      return def;
    }
  },
  scrivi(chiave, val) {
    try {
      localStorage.setItem("cucina:" + chiave, JSON.stringify(val));
    } catch {
      // niente
    }
  }
};
