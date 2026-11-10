// Costanti e piccoli aiuti della sezione Cucina.

import { auth } from "@/firebase";

/** Passo 1: la base del piatto. Carne e pesce aprono la scelta dei tipi. */
export const basi = [
  { id: "uova", label: "Uova", emoji: "🥚" },
  {
    id: "carne",
    label: "Carne",
    emoji: "🥩",
    tipi: ["pollo", "tacchino", "maiale", "vitello", "manzo", "agnello", "coniglio", "salsiccia", "macinato"]
  },
  {
    id: "pesce",
    label: "Pesce",
    emoji: "🐟",
    tipi: [
      "calamari", "seppie", "totani", "polpo", "gamberi", "cozze", "vongole", "pangasio",
      "merluzzo", "orata", "branzino", "trota", "salmone", "tonno fresco", "sgombro", "alici"
    ]
  },
  { id: "legumi", label: "Legumi", emoji: "🫘", tipi: ["ceci", "fagioli", "lenticchie", "cicerchie", "fave", "piselli"] },
  { id: "altro", label: "Altro", emoji: "🍳", nota: "né carne né pesce: formaggi, tegamini, torte salate…" }
];

/** Passo 2: le verdure, con i mesi in cui sono di stagione (1 = gennaio). */
const tuttoLanno = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
export const verdure = [
  { nome: "carote", mesi: tuttoLanno },
  { nome: "patate", mesi: tuttoLanno },
  { nome: "cipolle", mesi: tuttoLanno },
  { nome: "sedano", mesi: tuttoLanno },
  { nome: "insalata", mesi: tuttoLanno },
  { nome: "finocchi", mesi: [10, 11, 12, 1, 2, 3, 4] },
  { nome: "cavolfiore", mesi: [10, 11, 12, 1, 2, 3] },
  { nome: "broccoli", mesi: [10, 11, 12, 1, 2, 3] },
  { nome: "cavolo nero", mesi: [10, 11, 12, 1, 2] },
  { nome: "verza", mesi: [10, 11, 12, 1, 2, 3] },
  { nome: "cavolini di Bruxelles", mesi: [10, 11, 12, 1, 2] },
  { nome: "cime di rapa", mesi: [10, 11, 12, 1, 2] },
  { nome: "radicchio", mesi: [10, 11, 12, 1, 2, 3] },
  { nome: "carciofi", mesi: [11, 12, 1, 2, 3, 4] },
  { nome: "porri", mesi: [10, 11, 12, 1, 2, 3] },
  { nome: "spinaci", mesi: [10, 11, 12, 1, 2, 3, 4] },
  { nome: "bietole", mesi: [3, 4, 5, 6, 9, 10, 11] },
  { nome: "zucca", mesi: [9, 10, 11, 12] },
  { nome: "funghi", mesi: [9, 10, 11] },
  { nome: "topinambur", mesi: [11, 12, 1, 2, 3] },
  { nome: "barbabietola", mesi: [6, 7, 8, 9, 10] },
  { nome: "asparagi", mesi: [4, 5, 6] },
  { nome: "piselli freschi", mesi: [4, 5, 6] },
  { nome: "fave fresche", mesi: [4, 5, 6] },
  { nome: "zucchine", mesi: [5, 6, 7, 8, 9] },
  { nome: "fagiolini", mesi: [6, 7, 8, 9] },
  { nome: "melanzane", mesi: [6, 7, 8, 9] },
  { nome: "peperoni", mesi: [6, 7, 8, 9] },
  { nome: "pomodori", mesi: [6, 7, 8, 9] },
  { nome: "cetrioli", mesi: [6, 7, 8] }
];

export const diStagione = (v, d = new Date()) => v.mesi.includes(d.getMonth() + 1);

/** Passo 3: lo stile. Si possono combinare. */
export const umori = [
  { id: "veloce-economico", label: "Veloce e spendo poco", emoji: "⚡" },
  { id: "proteico", label: "Molto proteico", emoji: "💪" },
  { id: "leggero", label: "Pochi grassi", emoji: "🪶" },
  { id: "verdura", label: "Più verdura che altro", emoji: "🥬" },
  { id: "gourmet", label: "Gourmet con classe", emoji: "🎩" },
  { id: "comfort", label: "Coccola", emoji: "🧀" },
  { id: "unico", label: "Piatto unico", emoji: "🍲" },
  { id: "forno", label: "Al forno", emoji: "🔥" },
  { id: "umido", label: "In umido", emoji: "🫕" },
  { id: "croccante", label: "Croccante", emoji: "✨" },
  { id: "piccante", label: "Piccante", emoji: "🌶️" },
  { id: "toscana", label: "Tradizione toscana", emoji: "🍷" },
  { id: "mondo", label: "Giro del mondo", emoji: "🌍" },
  { id: "sorpresa", label: "Sorprendimi", emoji: "🎲" }
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
  const testo = await r.text();
  let j = {};
  try {
    j = JSON.parse(testo);
  } catch {
    // risposta non JSON (es. tempo scaduto su Vercel)
  }
  if (!r.ok || !testo) {
    throw new Error(
      j.errore ||
        `Qualcosa è andato storto (errore ${r.status}${testo ? ": " + testo.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140) : ""}).`
    );
  }
  return j;
}

/**
 * Chiede le proposte "a flusso": ogni ricetta, appena scritta, viene passata a onRicetta.
 * Ritorna quante ne sono arrivate.
 */
export async function proposteAFlusso(dati, onRicetta) {
  const u = auth.currentUser;
  if (!u) throw new Error("Devi essere dentro l'app.");
  const token = await u.getIdToken();
  const r = await fetch("/api/cucina", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ azione: "proposteFlusso", ...dati })
  });
  if (!r.ok || !r.body) {
    const testo = await r.text().catch(() => "");
    let j = {};
    try {
      j = JSON.parse(testo);
    } catch {
      // non JSON
    }
    throw new Error(
      j.errore || `Qualcosa è andato storto (errore ${r.status}: ${testo.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140)}).`
    );
  }

  const lettore = r.body.getReader();
  const dec = new TextDecoder();
  let buffer = "";
  let quante = 0;
  const visti = new Set();

  const leggiRiga = (riga) => {
    const t = riga.trim().replace(/^[`,\[\]]+|[`,\[\]]+$/g, "");
    if (!t.startsWith("{")) return;
    try {
      const ric = JSON.parse(t);
      const chiave = ric?.titolo?.toLowerCase();
      if (!chiave || visti.has(chiave)) return;
      visti.add(chiave);
      quante++;
      onRicetta(ric);
    } catch {
      // riga incompleta o rotta: la salto
    }
  };

  for (;;) {
    let pezzo;
    try {
      pezzo = await lettore.read();
    } catch {
      break; // connessione interrotta: tengo quelle arrivate
    }
    if (pezzo.done) break;
    buffer += dec.decode(pezzo.value, { stream: true });
    const righe = buffer.split("\n");
    buffer = righe.pop();
    righe.forEach(leggiRiga);
  }
  leggiRiga(buffer);
  return quante;
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
