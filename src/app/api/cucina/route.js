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
// Un solo nome per modello: "flash-lite-latest" e "3.5-flash-lite" sono lo STESSO modello
// (stessa quota), riprovarli entrambi sprecava richieste.
const VELOCI = ["gemini-flash-lite-latest", process.env.GEMINI_MODEL || "gemini-3.8-flash"];
const BRAVI = [process.env.GEMINI_MODEL || "gemini-3.8-flash", "gemini-flash-lite-latest"];

const REGIONI = [
  "Valle d'Aosta", "Piemonte", "Liguria", "Lombardia", "Trentino-Alto Adige", "Veneto",
  "Friuli-Venezia Giulia", "Emilia-Romagna", "Toscana", "Umbria", "Marche", "Lazio", "Abruzzo",
  "Molise", "Campania", "Puglia", "Basilicata", "Calabria", "Sicilia", "Sardegna"
];

/** La scaletta delle regioni, che riparte da quella dopo "ripartiDa" (es. l'ultima del giro precedente). */
function scalettaRegioni(ripartiDa) {
  const norm = (x) => String(x || "").toLowerCase().replace(/[^a-z]/g, "");
  const r = norm(ripartiDa);
  const i = r ? REGIONI.findIndex((x) => r.includes(norm(x)) || norm(x).includes(r)) : -1;
  if (i < 0) return REGIONI;
  return [...REGIONI.slice(i + 1), ...REGIONI.slice(0, i + 1)];
}

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
  constructor(msg, status, dettagli) {
    super(msg);
    this.status = status;
    // per i 429: capisco se è il limite al minuto o al giorno, e tra quanto riprovare
    const det = dettagli || [];
    const quote = det.flatMap((d) => d.violations || []).map((v) => v.quotaId || "").join(" ");
    this.alGiorno = /PerDay/i.test(quote);
    const attesa = det.find((d) => d.retryDelay)?.retryDelay;
    this.riprovaTra = attesa ? Math.ceil(parseFloat(attesa)) : null;
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
    if (!r.ok) throw new ErroreGemini(j.error?.message || "errore " + r.status, r.status, j.error?.details);
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

// testo "grezzo" (senza togliere spazi): serve nel flusso, dove i pezzi vanno incollati così come sono
const testoGrezzo = (j) =>
  (j.candidates?.[0]?.content?.parts || [])
    .filter((p) => !p.thought)
    .map((p) => p.text || "")
    .join("");
const testoDi = (j) => testoGrezzo(j).trim();

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

  return `Siamo a ${oggi()}. Proponi PIÙ IDEE POSSIBILI per la cena di stasera (almeno ${n}), senza doppioni.

DOVE CERCARE: fai il GIRO D'ITALIA, a giri ripetuti.
Un GIRO = 1 piatto per ogni regione, in quest'ordine: ${scalettaRegioni(b.ripartiDa).join(", ")};
poi 5 piatti internazionali (Paesi diversi). Totale 25 piatti per giro.
Finito un giro, RICOMINCIA un nuovo giro nello stesso ordine con piatti DIVERSI da quelli già scritti,
e continua così, giro dopo giro, fino a 100 piatti in tutto.
Ogni piatto deve rispettare le nostre richieste (anche ricette tradizionali poco conosciute);
salta una regione solo se proprio non ha nulla di adatto. Non fermarti: è normale e voluto che i piatti siano tanti.

${cosa}

SEMPRE:
- Tempo massimo totale: ${f.tempo ? f.tempo + " minuti" : "nessun limite"}
- Pentole: ${sporco}
- Persone: ${persone}
- Ingredienti di stagione e prezzi ordinari di un supermercato italiano.

IN CASA C'È SEMPRE (dispensa base, usala liberamente): ${(b.dispensa || []).join(", ")}.

${b.gusti ? `I NOSTRI GUSTI (ricette fatte di recente con voti e note dello chef: servono a capire cosa ci piace, NON sono richieste di oggi e non devono cambiare l'ingrediente principale):\n${b.gusti}` : ""}
${b.evita?.length ? `NON riproporre queste: ${b.evita.join("; ")}.` : ""}

FORMATO DELLA RISPOSTA (importantissimo), in DUE PARTI:

PARTE 1 – INDICE. Scrivi prima la riga "INDICE:" e poi 100 righe cortissime numerate (4 giri da 25), una per piatto,
seguendo i giri: "1. Nome del piatto – Regione". Solo titolo e regione, niente altro.

PARTE 2 – SCHEDE. Poi scrivi la riga "SCHEDE:" e, NELLO STESSO ORDINE DELL'INDICE, una scheda per OGNI piatto dell'indice,
senza saltarne nessuno: devi arrivare all'ultimo numero dell'indice.
Ogni scheda è un oggetto JSON completo su UNA SOLA riga; finita una riga vai a capo e scrivi la successiva.
Niente parentesi quadre all'inizio o alla fine, niente \`\`\`.
Esempio di scheda:
{"titolo":"nome del piatto","origine":"regione (es. Toscana) oppure internazionale: Paese","tipologia":"es. piatto povero contadino, secondo di mare","descrizione":"una frase che fa venire fame","perche":"perché è adatta a quello che abbiamo chiesto","ingredienti":["solo i principali, max 6, con quantità per ${persone}"],"daComprare":["solo ciò che probabilmente NON abbiamo in casa"],"passaggi":["3-4 passaggi brevissimi"],"tempoMinuti":30,"costoEuro":8,"padelle":1,"stagionale":true,"difficolta":"facile"}`;
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
 "abbinamento":"vino o bevanda consigliata, possibilmente della stessa zona",
 "origine":"da dove viene il piatto: regione, zona, e in 2-3 frasi la sua storia o curiosità",
 "tempoMinuti":numero totale,
 "costoEuro":numero,
 "padelle":numero,
 "utensili":["..."]
}`;
}

// ---------- le azioni ----------

/** Legge le righe-ricetta (una ricetta JSON per riga). */
function righeRicette(testo) {
  return testo
    .split("\n")
    .map((r) => r.trim().replace(/^[`,\[\]]+|[`,\[\]]+$/g, ""))
    .filter((r) => r.startsWith("{"))
    .map((r) => {
      try {
        return JSON.parse(r);
      } catch {
        return null;
      }
    })
    .filter((x) => x?.titolo);
}

/** Il corpo della richiesta per le proposte: formato "una ricetta per riga". */
const corpoProposte = (b) => ({
  systemInstruction: { parts: [{ text: CHEF }] },
  contents: [{ role: "user", parts: [{ text: promptProposte(b) }] }],
  generationConfig: { temperature: 0.9, maxOutputTokens: 60000 }
});

// versione "tutto insieme" (di riserva)
async function proposte(b, scadenza) {
  const j = await gemini(corpoProposte(b), VELOCI, scadenza, 45000);
  return { proposte: righeRicette(testoDi(j)) };
}

/**
 * Versione "a flusso": le ricette arrivano una alla volta mentre Gemini le scrive.
 * Al telefono mando il testo così com'è; è lui che taglia le righe.
 */
/** Apre un flusso con il primo modello disponibile. Ritorna il body da leggere. */
async function apriFlusso(corpo, scadenza) {
  let ultimo;
  for (const m of BRAVI) {
    if (scadenza - Date.now() < 5000) break;
    for (let i = pensieroBuono[m] ?? 0; i < PENSIERO.length; i++) {
      const gc = { ...corpo.generationConfig };
      if (PENSIERO[i]) gc.thinkingConfig = PENSIERO[i];
      const ctrl = new AbortController();
      const attesa = setTimeout(() => ctrl.abort(), Math.min(20000, scadenza - Date.now()));
      let r;
      try {
        r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${m}:streamGenerateContent?alt=sse`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": (process.env.GEMINI_API_KEY || "").trim()
            },
            body: JSON.stringify({ ...corpo, generationConfig: gc }),
            signal: ctrl.signal
          }
        );
      } catch (e) {
        clearTimeout(attesa);
        ultimo = new ErroreGemini(`${m} troppo lento`, 504);
        console.warn("cucina flusso", m, e.name);
        break; // provo il modello successivo
      }
      clearTimeout(attesa);
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        ultimo = new ErroreGemini(j.error?.message || "errore " + r.status, r.status, j.error?.details);
        console.warn("cucina flusso", m, r.status, String(ultimo.message).slice(0, 120));
        if (r.status === 400 && /think/i.test(ultimo.message)) continue; // altra variante di "pensiero"
        if ([404, 429, 500, 503].includes(r.status) || (r.status === 400 && /model/i.test(ultimo.message))) break;
        throw ultimo;
      }
      pensieroBuono[m] = i;
      return { body: r.body, modello: m };
    }
  }
  throw ultimo || new ErroreGemini("tempo finito", 504);
}

const titoloDiRiga = (riga) => {
  const t = riga.trim().replace(/^[`,\[\]]+|[`,\[\]]+$/g, "");
  if (!t.startsWith("{")) return null;
  try {
    return JSON.parse(t).titolo?.toLowerCase() || null;
  } catch {
    return null;
  }
};

const MAX_GIRI = 1; // una ricerca = UNA richiesta a Gemini (i rilanci li fa Bobby con "Altre idee")

/**
 * Proposte "a flusso" con rilanci: le ricette arrivano una alla volta.
 * Se il cuoco si ferma prima del numero chiesto e c'è ancora tempo,
 * gli chiedo altre ricette (senza ripetere quelle già date), nello stesso flusso.
 * Il primo giro lo apro PRIMA di rispondere, così gli errori arrivano come JSON normale.
 */
async function proposteFlusso(b, scadenza) {
  const f = b.filtri || {};
  const obiettivo = Math.min(Number(f.quante) || 100, 100);
  const evitaBase = b.evita || [];
  const corpoGiro = (fatte, titoli) => {
    const bb = { ...b, filtri: { ...f, quante: Math.max(5, obiettivo - fatte) }, evita: [...evitaBase, ...titoli] };
    // niente "stampo": Google lo rifiuta e ogni rifiuto è una richiesta sprecata
    return corpoProposte(bb);
  };

  const corpoPrimo = corpoGiro(0, []);
  const primo = await apriFlusso(corpoPrimo, scadenza);
  const t0 = Date.now();
  const enc = new TextEncoder();

  return new ReadableStream({
    async start(ctrl) {
      const titoli = [];
      const visti = new Set(evitaBase.map((t) => t.toLowerCase()));
      let motivo = "STOP";
      let body = primo.body;
      let modello = primo.modello;
      let finish = "";

      for (let giro = 0; giro < MAX_GIRI; giro++) {
        if (giro > 0) {
          if (titoli.length >= obiettivo) break;
          if (scadenza - Date.now() < 15000) {
            motivo = "TEMPO";
            break;
          }
          try {
            ({ body, modello } = await apriFlusso(corpoGiro(titoli.length, titoli), scadenza));
          } catch (e) {
            console.warn("cucina rilancio", e.status, String(e.message).slice(0, 120));
            motivo = e.status === 429 ? "QUOTA" : "STOP";
            break;
          }
          ctrl.enqueue(enc.encode("\n"));
        }

        const nuove = await leggiGiro(body, scadenza, (testo) => ctrl.enqueue(enc.encode(testo)), (riga) => {
          const t = titoloDiRiga(riga);
          if (t && !visti.has(t)) {
            visti.add(t);
            titoli.push(t);
            return true;
          }
          return false;
        });
        finish = nuove.finish || finish;
        if (nuove.tempo) {
          motivo = "TEMPO";
          break;
        }
        if (!nuove.quante) break; // questo giro non ha portato niente di nuovo: basta
      }

      if (titoli.length >= obiettivo) motivo = "STOP";
      const info = `${modello.replace("gemini-", "")} · ${Math.round((Date.now() - t0) / 1000)} s · fine: ${finish || motivo}`;
      ctrl.enqueue(enc.encode(`\n${JSON.stringify({ _info: info })}\n`));
      ctrl.enqueue(enc.encode(`\n{"_fine":"${motivo}"}\n`));
      ctrl.close();
    }
  });
}

/** Legge un giro di SSE da Gemini: gira il testo al telefono e conta le ricette nuove. */
/**
 * Estrattore a pezzi: riceve il testo man mano e tira fuori ogni oggetto JSON completo
 * che ha un "titolo" (una ricetta), funziona sia con {"ricette":[{…},{…}]} sia con una per riga.
 */
function creaEstrattore(onRicetta) {
  let buf = "";
  let inStringa = false;
  let escape = false;
  const aperte = [];
  return (testo) => {
    for (const ch of testo) {
      const pos = buf.length;
      buf += ch;
      if (inStringa) {
        if (escape) escape = false;
        else if (ch === "\\") escape = true;
        else if (ch === '"') inStringa = false;
        continue;
      }
      if (ch === '"') inStringa = true;
      else if (ch === "{") aperte.push(pos);
      else if (ch === "}") {
        const inizio = aperte.pop();
        if (inizio === undefined) continue;
        try {
          const o = JSON.parse(buf.slice(inizio, pos + 1));
          if (o && typeof o.titolo === "string") onRicetta(o);
        } catch {
          // non era un oggetto valido: pazienza
        }
        if (!aperte.length) buf = "";
      }
    }
  };
}

/** Legge un giro di SSE da Gemini: estrae le ricette e le manda al telefono una per riga. */
async function leggiGiro(body, scadenza, manda, contaRiga) {
  const lettore = body.getReader();
  const dec = new TextDecoder();
  let resto = "";
  let quante = 0;
  let finish = "";
  const estrai = creaEstrattore((ric) => {
    const riga = JSON.stringify(ric);
    if (contaRiga(riga)) {
      quante++;
      manda(riga + "\n");
    }
  });
  try {
    for (;;) {
      if (Date.now() > scadenza) {
        lettore.cancel().catch(() => {});
        return { quante, tempo: true, finish: "TEMPO" };
      }
      const { value, done } = await lettore.read();
      if (done) break;
      resto += dec.decode(value, { stream: true });
      const eventi = resto.split("\n");
      resto = eventi.pop();
      for (const ev of eventi) {
        const riga = ev.trim();
        if (!riga.startsWith("data:")) continue;
        try {
          const j = JSON.parse(riga.slice(5));
          if (j.candidates?.[0]?.finishReason) finish = j.candidates[0].finishReason;
          const t = testoGrezzo(j);
          if (t) estrai(t);
        } catch {
          // evento non leggibile
        }
      }
    }
  } catch (e) {
    console.warn("cucina lettura giro", e?.message);
  }
  return { quante, tempo: false, finish };
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

const AZIONI = { proposte, proposteFlusso, approfondisci, chiedi };

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
    if (b.azione === "proposteFlusso") {
      const flusso = await proposteFlusso(b, scadenza);
      return new Response(flusso, {
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" }
      });
    }
    return json(await azione(b, scadenza));
  } catch (e) {
    console.error("cucina", b.azione, e?.status, e?.message);
    if (e?.status === 504) {
      return json({ errore: "Google oggi è lento o intasato: riprova tra qualche minuto." }, 504);
    }
    if (e?.status === 429) {
      const msg = e.alGiorno
        ? "Per oggi Gemini ha finito le risposte gratis: si riparte domattina alle 9."
        : `Troppe richieste ravvicinate: aspetta ${e.riprovaTra ? e.riprovaTra + " secondi" : "un minuto"} e riprova.`;
      return json({ errore: msg }, 429);
    }
    if (e?.status === 401 || e?.status === 403) {
      return json({ errore: "La chiave Gemini non viene accettata. Controllala su Vercel." }, 502);
    }
    return json(
      { errore: "Il cuoco si è confuso, riprova tra un attimo. (Dettaglio: " + String(e?.message || e).slice(0, 160) + ")" },
      502
    );
  }
}
