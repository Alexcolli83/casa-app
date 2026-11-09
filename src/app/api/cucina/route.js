// Il "cuoco" lato server: riceve le richieste dalla sezione Cucina e chiede a Gemini.
//
// POST /api/cucina   (header Authorization: Bearer <token Firebase dell'utente>)
//   { azione: "proposte",     filtri, dispensa, extra, gusti, evita }
//   { azione: "approfondisci", proposta, livello, fontiViste, noteChef }
//   { azione: "chiedi",       ricetta, messaggi, noteChef }
//
// Variabili d'ambiente su Vercel:
//   GEMINI_API_KEY   la chiave di Google AI Studio (obbligatoria)
//   GEMINI_MODEL     facoltativa: forza un modello preciso
//
// La chiave non esce mai dal server. Solo Bobby e Alicia (loggati) possono usarlo.

import { allowedUsers } from "@/lib/casa";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FIREBASE_API_KEY = "AIzaSyARqITBypOyeTeKsXhPCEggUyqNrCCN--s";

const MODELLI = [
  process.env.GEMINI_MODEL,
  "gemini-flash-latest",
  "gemini-2.5-flash",
  "gemini-2.0-flash"
].filter(Boolean);

let modelloBuono = null; // il primo che ha funzionato, per non riprovare ogni volta

// ---------- controllo di chi chiama ----------

const tokenVisti = new Map(); // token -> { email, scade }

async function emailDaToken(token) {
  if (!token) return null;
  const c = tokenVisti.get(token);
  if (c && c.scade > Date.now()) return c.email;
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token })
    }
  );
  if (!r.ok) return null;
  const j = await r.json();
  const email = j.users?.[0]?.email || null;
  if (email) {
    if (tokenVisti.size > 50) tokenVisti.clear();
    tokenVisti.set(token, { email, scade: Date.now() + 10 * 60 * 1000 });
  }
  return email;
}

// ---------- Gemini ----------

class ErroreGemini extends Error {
  constructor(msg, status) {
    super(msg);
    this.status = status;
  }
}

async function chiamaModello(modello, corpo) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modello}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY || ""
      },
      body: JSON.stringify(corpo)
    }
  );
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErroreGemini(j.error?.message || "errore " + r.status, r.status);
  return j;
}

/** Prova i modelli in ordine finché uno risponde. */
async function gemini(corpo) {
  const lista = modelloBuono ? [modelloBuono, ...MODELLI.filter((m) => m !== modelloBuono)] : MODELLI;
  let ultimo;
  for (const m of lista) {
    try {
      const j = await chiamaModello(m, corpo);
      modelloBuono = m;
      return j;
    } catch (e) {
      ultimo = e;
      // modello inesistente o non disponibile: passo al prossimo
      if (e.status === 404 || (e.status === 400 && /model/i.test(e.message))) continue;
      // quota finita su questo modello: provo il prossimo
      if (e.status === 429) continue;
      throw e;
    }
  }
  throw ultimo;
}

const testoDi = (j) =>
  (j.candidates?.[0]?.content?.parts || [])
    .filter((p) => !p.thought)
    .map((p) => p.text || "")
    .join("")
    .trim();

/** Estrae il JSON anche se il modello ci mette intorno ``` o due parole. */
function leggiJSON(testo) {
  const pulito = testo.replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(pulito);
  } catch {
    const a = pulito.indexOf("{");
    const b = pulito.lastIndexOf("}");
    if (a >= 0 && b > a) return JSON.parse(pulito.slice(a, b + 1));
    throw new Error("JSON non leggibile");
  }
}

const fontiDi = (j) => {
  const chunks = j.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const viste = new Set();
  return chunks
    .map((c) => c.web)
    .filter((w) => w?.uri && !viste.has(w.uri) && viste.add(w.uri))
    .map((w) => ({ titolo: w.title || w.uri, url: w.uri }))
    .slice(0, 6);
};

// ---------- le istruzioni per il cuoco ----------

const oggi = () => {
  const d = new Date();
  return d.toLocaleDateString("it-IT", { month: "long", year: "numeric", timeZone: "Europe/Rome" });
};

const CHEF =
  "Sei il consigliere di cucina di Bobby e Alicia, una coppia che vive in Toscana (zona Arezzo). " +
  "Parli italiano, in modo semplice, pratico e amichevole. Bobby è lo chef di casa. " +
  "Rispetti la stagionalità italiana e i prezzi ordinari di un supermercato italiano. " +
  "Quando ti ispiri a ricette trovate online, riscrivile con parole tue: non copiare mai testi interi.";

function promptProposte(b) {
  const f = b.filtri || {};
  return `Siamo a ${oggi()}. Proponi ${f.quante || 4} idee per la cena di stasera, diverse tra loro.

COSA VOGLIAMO:
- Stile: ${(f.umori || []).join(", ") || "libero, sorprendimi"}
- Tempo massimo totale: ${f.tempo ? f.tempo + " minuti" : "nessun limite"}
- Quanto possiamo sporcare: ${f.sporco === 1 ? "UNA sola padella/pentola" : f.sporco === 2 ? "poco, massimo 2 pentole" : "non importa"}
- Persone: ${f.persone || 2}
${b.extra ? `- Richiesta in parole nostre: ${b.extra}` : ""}

IN CASA C'È SEMPRE (dispensa base): ${(b.dispensa || []).join(", ")}.
${b.frigo ? `OGGI ABBIAMO ANCHE: ${b.frigo}. Cerca di usarlo.` : ""}

${b.gusti ? `COSA ABBIAMO CUCINATO DI RECENTE, CON VOTI E NOTE DELLO CHEF (impara i nostri gusti, evita di riproporre le stesse cose):\n${b.gusti}` : ""}
${b.evita?.length ? `NON riproporre queste: ${b.evita.join("; ")}.` : ""}

Rispondi SOLO con JSON in questo formato:
{"proposte":[{
 "titolo":"nome del piatto",
 "descrizione":"una frase che fa venire fame",
 "perche":"perché è adatta a quello che abbiamo chiesto",
 "ingredienti":["ingrediente principale con quantità per ${f.persone || 2}"],
 "daComprare":["solo ciò che probabilmente NON abbiamo in casa, vuoto se niente"],
 "passaggi":["3-6 passaggi brevi"],
 "tempoMinuti":numero totale,
 "costoEuro":costo indicativo totale in euro,
 "padelle":numero di pentole/padelle sporcate,
 "utensili":["padella","tagliere"],
 "stagionale":true/false,
 "difficolta":"facile|media|impegnativa"
}]}`;
}

function promptApprofondisci(b) {
  const p = b.proposta || {};
  const livello = Number(b.livello) || 1;
  return `Siamo a ${oggi()}. Vogliamo cucinare stasera: "${p.titolo}" (${p.descrizione || ""}).
Idea di partenza: ingredienti ${(p.ingredienti || []).join(", ")}; passaggi: ${(p.passaggi || []).join(" | ")}.
Persone: ${b.persone || 2}.

Cerca sul web ${livello > 1 ? "fonti DI ALTA CUCINA e più approfondite (chef stellati, scuole di cucina, riviste gastronomiche serie)" : "fonti affidabili di cucina (anche di alta cucina)"} e costruisci la versione completa, con i trucchi del mestiere.
${b.fontiViste?.length ? `Prima avevamo già visto queste fonti e NON ci sono bastate, cercane di diverse e vai più a fondo: ${b.fontiViste.join(", ")}.` : ""}
${b.noteChef ? `Note dello chef di casa sulle volte precedenti (tienine conto): ${b.noteChef}` : ""}

Riscrivi tutto con parole tue. Rispondi SOLO con JSON:
{
 "titolo":"...",
 "porzioni":numero,
 "ingredienti":[{"nome":"...","quantita":"..."}],
 "passaggi":[{"testo":"passaggio dettagliato, con fuoco (basso/medio/alto) e segnali per capire quando è pronto","minuti":numero}],
 "trucchi":["trucchi del mestiere da chef"],
 "errori":["errori da evitare"],
 "varianti":["sostituzioni o varianti utili"],
 "abbinamento":"vino o bevanda consigliata",
 "tempoMinuti":numero totale,
 "costoEuro":numero,
 "padelle":numero,
 "utensili":["..."]
}`;
}

// ---------- le azioni ----------

async function proposte(b) {
  const j = await gemini({
    systemInstruction: { parts: [{ text: CHEF }] },
    contents: [{ role: "user", parts: [{ text: promptProposte(b) }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 1 }
  });
  const dati = leggiJSON(testoDi(j));
  return { proposte: Array.isArray(dati.proposte) ? dati.proposte : [] };
}

async function approfondisci(b) {
  const corpo = {
    systemInstruction: { parts: [{ text: CHEF }] },
    contents: [{ role: "user", parts: [{ text: promptApprofondisci(b) }] }],
    generationConfig: { temperature: 0.6 }
  };
  let j;
  try {
    // con la ricerca Google
    j = await gemini({ ...corpo, tools: [{ google_search: {} }] });
  } catch (e) {
    if (e.status === 401 || e.status === 403) throw e;
    // ricerca non disponibile (quota o altro): rispondo comunque, senza web
    j = await gemini({ ...corpo, generationConfig: { ...corpo.generationConfig, responseMimeType: "application/json" } });
  }
  const ricetta = leggiJSON(testoDi(j));
  return { ricetta, fonti: fontiDi(j) };
}

async function chiedi(b) {
  const r = b.ricetta || {};
  const sistema =
    CHEF +
    `\n\nStiamo cucinando adesso questa ricetta:\n${JSON.stringify(r).slice(0, 6000)}\n` +
    (b.noteChef ? `Note dello chef di casa: ${b.noteChef}\n` : "") +
    "Rispondi come un cuoco esperto accanto ai fornelli: breve, concreto, al massimo 6-7 righe, " +
    "con fuoco, tempi e segnali visivi. Se chiede una sostituzione, di' anche cosa cambia nel risultato.";
  const contents = (b.messaggi || []).slice(-16).map((m) => ({
    role: m.ruolo === "chef" ? "model" : "user",
    parts: [{ text: String(m.testo || "").slice(0, 2000) }]
  }));
  if (!contents.length) throw new Error("Nessuna domanda.");
  const j = await gemini({
    systemInstruction: { parts: [{ text: sistema }] },
    contents,
    generationConfig: { temperature: 0.7 }
  });
  return { risposta: testoDi(j) || "Non ho capito, me la rifai?" };
}

const AZIONI = { proposte, approfondisci, chiedi };

// ---------- ingresso ----------

const json = (dati, status = 200) => Response.json(dati, { status });

export async function POST(req) {
  if (!process.env.GEMINI_API_KEY) {
    return json({ errore: "Manca GEMINI_API_KEY su Vercel." }, 500);
  }

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const email = await emailDaToken(token).catch(() => null);
  if (!email || !allowedUsers.includes(email)) {
    return json({ errore: "Non autorizzato." }, 401);
  }

  let b = {};
  try {
    b = await req.json();
  } catch {
    return json({ errore: "Richiesta non valida." }, 400);
  }

  const azione = AZIONI[b.azione];
  if (!azione) return json({ errore: "Azione sconosciuta." }, 400);

  try {
    return json(await azione(b));
  } catch (e) {
    console.error("cucina", b.azione, e?.status, e?.message);
    if (e?.status === 429) {
      return json({ errore: "Per oggi Gemini ha finito le risposte gratis. Riprova più tardi o domani." }, 429);
    }
    if (e?.status === 401 || e?.status === 403) {
      return json({ errore: "La chiave Gemini non viene accettata. Controllala su Vercel." }, 502);
    }
    return json({ errore: "Il cuoco si è confuso, riprova tra un attimo." }, 502);
  }
}
