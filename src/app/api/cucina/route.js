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

// Modelli in ordine di prova. Se uno è intasato, lento o senza quota, si passa al successivo.
// VELOCI: per proposte e chat (risposta in pochi secondi).
// BRAVI: per la ricetta completa con ricerca sul web (più raffinati, ma a volte intasati).
const VELOCI = [
  "gemini-flash-lite-latest",
  "gemini-3.5-flash-lite",
  process.env.GEMINI_MODEL,
  "gemini-3.8-flash",
  "gemini-flash-latest"
].filter((m, i, a) => m && a.indexOf(m) === i);

const BRAVI = [
  process.env.GEMINI_MODEL,
  "gemini-3.8-flash",
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-3.5-flash-lite"
].filter((m, i, a) => m && a.indexOf(m) === i);

const MAX_TENTATIVO = 25000; // un singolo modello non può tenerci appesi più di 25 secondi
const BUDGET = 55000; // tempo totale per richiesta (Vercel taglia a 60)

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

/** Una chiamata a un modello, con cronometro: se sfora "ms" la abbandono. */
async function chiamaModello(modello, corpo, ms = MAX_TENTATIVO) {
  if (ms < 2000) throw new ErroreGemini("tempo finito", 504);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modello}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": (process.env.GEMINI_API_KEY || "").trim()
        },
        body: JSON.stringify(corpo),
        signal: ctrl.signal
      }
    );
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new ErroreGemini(j.error?.message || "errore " + r.status, r.status);
    return j;
  } catch (e) {
    if (e.name === "AbortError") throw new ErroreGemini(`${modello} troppo lento`, 504);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// Quanto far "ragionare" il modello prima di rispondere: poco, sennò è lentissimo.
// I modelli nuovi vogliono thinkingLevel, i vecchi thinkingBudget: provo nell'ordine.
const PENSIERO = [{ thinkingLevel: "minimal" }, { thinkingLevel: "low" }, { thinkingBudget: 0 }, null];
const pensieroBuono = {}; // modello -> indice in PENSIERO che ha funzionato

async function chiamaVeloce(modello, corpo, scadenza = Date.now() + MAX_TENTATIVO, maxMs = MAX_TENTATIVO) {
  const inizio = pensieroBuono[modello] ?? 0;
  let ultimo;
  for (let i = inizio; i < PENSIERO.length; i++) {
    const gc = { ...(corpo.generationConfig || {}) };
    if (PENSIERO[i]) gc.thinkingConfig = PENSIERO[i];
    try {
      const ms = Math.min(maxMs, scadenza - Date.now());
      const j = await chiamaModello(modello, { ...corpo, generationConfig: gc }, ms);
      pensieroBuono[modello] = i;
      return j;
    } catch (e) {
      ultimo = e;
      // solo se si lamenta del "thinking" provo la variante successiva
      if (e.status === 400 && /think/i.test(e.message)) continue;
      throw e;
    }
  }
  throw ultimo;
}

/** Prova i modelli in ordine finché uno risponde, senza superare la scadenza. */
async function gemini(corpo, modelli, scadenza, maxMs = MAX_TENTATIVO) {
  let ultimo;
  for (const m of modelli) {
    if (scadenza - Date.now() < 3000) break;
    try {
      return await chiamaVeloce(m, corpo, scadenza, maxMs);
    } catch (e) {
      ultimo = e;
      console.warn("cucina modello", m, e.status, String(e.message).slice(0, 120));
      // inesistente, senza quota, intasato o lento: passo al prossimo
      if ([404, 429, 500, 503, 504].includes(e.status)) continue;
      if (e.status === 400 && /model/i.test(e.message)) continue;
      throw e;
    }
  }
  throw ultimo || new ErroreGemini("tempo finito", 504);
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
  const n = f.quante || 5;
  const persone = f.persone || 2;
  const testo = (f.testo || "").trim();
  const sporco =
    f.sporco === 1
      ? "UNA sola padella (o pentola), più tagliere e coltello. Nient'altro: niente frullatori, forno o altri attrezzi."
      : f.sporco === 2
        ? "poco: massimo 2 pentole/padelle, niente piccoli elettrodomestici."
        : "non importa; i piccoli elettrodomestici (frullatore, minipimer, robot) usali solo se servono davvero per un piatto più impegnativo.";

  const scelte = [
    (f.basi || []).length && `base: ${f.basi.join(", ")}`,
    (f.tipi || []).length && `ingrediente: ${f.tipi.join(", ")}`,
    (f.verdure || []).length && `verdure in casa: ${f.verdure.join(", ")}`,
    (f.umori || []).length && `stile: ${f.umori.join(", ")}`
  ].filter(Boolean);

  let cosa;
  if (testo) {
    // il testo scritto è LA ricerca: le spunte sono solo un contorno
    cosa = `LA NOSTRA RICHIESTA (è l'unica cosa che conta davvero): "${testo}"

- Se descrive un piatto o degli ingredienti precisi, TUTTE le ${n} proposte devono contenere proprio quegli ingredienti come protagonisti: ${n} modi diversi di fare quel piatto o piatti molto vicini. Non cambiare ingrediente principale.
- Se parla di cose da finire in frigo, ogni proposta le deve usare.
- Non aggiungere carni, pesci o legumi che non abbiamo nominato.
${scelte.length ? `- Suggerimenti secondari (usali SOLO se si sposano con la richiesta, altrimenti IGNORALI del tutto): ${scelte.join("; ")}.` : ""}`;
  } else {
    const t = f.tipi || [];
    const regolaBase = t.length
      ? `- OGNI proposta deve avere come protagonista ${t.length === 1 ? `il/la ${t[0]}` : `uno di questi: ${t.join(", ")} (distribuiscili tra le proposte)`}. NON proporre altri tipi di carne, pesce o legumi.
- Le ${n} proposte devono essere tutte DIVERSE: cambia taglio, cottura, condimento e stile (in padella, al forno, in umido, impanato, alla griglia…).`
      : (f.basi || []).length
        ? `- OGNI proposta deve avere come protagonista la base scelta (${f.basi.join(", ")}); dentro la base varia l'ingrediente principale. Se le basi sono più d'una, distribuiscile.
- Le ${n} proposte devono essere tutte DIVERSE, niente doppioni.`
        : `- Le ${n} proposte devono essere tutte DIVERSE: varia ingrediente principale e cottura.`;
    cosa = `LE NOSTRE SCELTE (se una voce manca, decidi tu):
- BASE DEL PIATTO (è la ricerca principale): ${(f.basi || []).join(", ") || "libera"}
- INGREDIENTE PRINCIPALE: ${(f.tipi || []).join(", ") || "non scelto"}
- Verdure che abbiamo in casa, da usare come contorno o condimento: ${(f.verdure || []).join(", ") || "a scelta, meglio se di stagione"}
- Stile: ${(f.umori || []).join(", ") || "libero"}

REGOLE:
${regolaBase}
- Le verdure scelte sono quelle che abbiamo: usale, ma la base resta il piatto principale (salvo lo stile "Più verdura che altro").`;
  }

  return `Siamo a ${oggi()}. Proponi esattamente ${n} idee per la cena di stasera, senza doppioni.

${cosa}

SEMPRE:
- Tempo massimo totale: ${f.tempo ? f.tempo + " minuti" : "nessun limite"}
- Pentole: ${sporco}
- Persone: ${persone}
- Ingredienti di stagione e prezzi ordinari di un supermercato italiano.

IN CASA C'È SEMPRE (dispensa base, usala liberamente): ${(b.dispensa || []).join(", ")}.

${b.gusti ? `I NOSTRI GUSTI (ricette fatte di recente con voti e note dello chef: servono a capire cosa ci piace, NON sono richieste di oggi e non devono cambiare l'ingrediente principale):\n${b.gusti}` : ""}
${b.evita?.length ? `NON riproporre queste: ${b.evita.join("; ")}.` : ""}

Rispondi SOLO con JSON in questo formato:
{"proposte":[{
 "titolo":"nome del piatto",
 "descrizione":"una frase che fa venire fame",
 "perche":"perché è adatta a quello che abbiamo chiesto",
 "ingredienti":[${n > 8 ? `"solo gli ingredienti principali, max 6, con quantità per ${persone}"` : `"ingrediente con quantità per ${persone}"`}],
 "daComprare":["solo ciò che probabilmente NON abbiamo in casa, vuoto se niente"],
 "passaggi":[${n > 8 ? '"3-4 passaggi brevissimi, una riga ciascuno"' : '"3-6 passaggi brevi"'}],
 "tempoMinuti":numero totale,
 "costoEuro":costo indicativo totale in euro,
 "padelle":numero di pentole/padelle sporcate,
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

async function proposte(b, scadenza) {
  const j = await gemini({
    systemInstruction: { parts: [{ text: CHEF }] },
    contents: [{ role: "user", parts: [{ text: promptProposte(b) }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 1 }
  }, VELOCI, scadenza, 45000); // tante ricette: il primo modello ha più tempo
  const dati = leggiJSON(testoDi(j));
  return { proposte: Array.isArray(dati.proposte) ? dati.proposte : [] };
}

async function approfondisci(b, scadenza) {
  const corpo = {
    systemInstruction: { parts: [{ text: CHEF }] },
    contents: [{ role: "user", parts: [{ text: promptApprofondisci(b) }] }],
    generationConfig: { temperature: 0.6 }
  };
  let j;
  try {
    // con la ricerca Google, lasciando almeno 15 secondi per il piano B
    j = await gemini({ ...corpo, tools: [{ google_search: {} }] }, BRAVI, scadenza - 15000);
  } catch (e) {
    if (e.status === 401 || e.status === 403) throw e;
    // piano B: niente web, modello veloce
    j = await gemini(
      { ...corpo, generationConfig: { ...corpo.generationConfig, responseMimeType: "application/json" } },
      VELOCI,
      scadenza
    );
  }
  const ricetta = leggiJSON(testoDi(j));
  return { ricetta, fonti: fontiDi(j) };
}

async function chiedi(b, scadenza) {
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
  }, VELOCI, scadenza);
  return { risposta: testoDi(j) || "Non ho capito, me la rifai?" };
}

const AZIONI = { proposte, approfondisci, chiedi };

// ---------- ingresso ----------

const json = (dati, status = 200) => Response.json(dati, { status });

// GET /api/cucina  -> pagina di controllo: la chiave c'è? Gemini risponde?
// Non mostra la chiave e non restituisce testi, solo esiti.
export async function GET() {
  const chiave = process.env.GEMINI_API_KEY || "";
  const esito = {
    chiavePresente: !!chiave,
    inizioChiave: chiave ? chiave.slice(0, 3) + "…" : null,
    lunghezza: chiave.length,
    spaziIntorno: chiave !== chiave.trim(),
    prove: []
  };
  if (!chiave) return json(esito);
  for (const m of VELOCI) {
    const t0 = Date.now();
    try {
      await chiamaVeloce(m, { contents: [{ role: "user", parts: [{ text: "Rispondi solo: ok" }] }] }, Date.now() + 8000);
      esito.prove.push({
        modello: m,
        esito: "OK",
        secondi: (Date.now() - t0) / 1000,
        pensiero: JSON.stringify(PENSIERO[pensieroBuono[m]] ?? "default")
      });
      break;
    } catch (e) {
      esito.prove.push({ modello: m, esito: "ERRORE " + (e.status || ""), dettaglio: String(e.message).slice(0, 200) });
    }
  }
  return json(esito);
}

export async function POST(req) {
  const scadenza = Date.now() + BUDGET;
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
    return json(await azione(b, scadenza));
  } catch (e) {
    console.error("cucina", b.azione, e?.status, e?.message);
    if (e?.status === 504) {
      return json({ errore: "Google oggi è lento o intasato: riprova tra qualche minuto." }, 504);
    }
    if (e?.status === 429) {
      return json({ errore: "Per oggi Gemini ha finito le risposte gratis. Riprova più tardi o domani." }, 429);
    }
    if (e?.status === 401 || e?.status === 403) {
      return json({ errore: "La chiave Gemini non viene accettata. Controllala su Vercel." }, 502);
    }
    return json({ errore: "Il cuoco si è confuso, riprova tra un attimo." }, 502);
  }
}
