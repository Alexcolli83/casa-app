"use client";

import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/firebase";
import {
  basi,
  proposteAFlusso,
  diStagione,
  fmtCosto,
  fmtMinuti,
  livelliSporco,
  ricordaLocale,
  riassuntoGusti,
  sporcoLabel,
  tempi,
  umori,
  verdure
} from "@/lib/cucina";

const filtriVuoti = {
  basi: [],
  tipi: [],
  verdure: [],
  umori: [],
  tempo: null,
  sporco: null,
  persone: 2,
  testo: ""
};

// Chip piccoli, così ne stanno tanti, ma sempre leggibili
const chipS = "shrink-0 rounded-full border px-2.5 py-1 text-[13px] leading-tight transition active:scale-95";
const chipOff = "border-slate-700 text-slate-300";
const chipOn = "bg-cyan-400 border-cyan-400 text-black font-semibold";

const etichetteUmori = umori.map((u) => u.label);

/** Rilegge i filtri salvati sul telefono, scartando le scelte che non esistono più. */
function filtriSalvati() {
  const f = { ...filtriVuoti, ...ricordaLocale.leggi("filtri2", {}) };
  f.umori = (f.umori || []).filter((u) => etichetteUmori.includes(u));
  return f;
}

const togli = (lista, x) => (lista.includes(x) ? lista.filter((y) => y !== x) : [...lista, x]);

export default function IdeeView({ ricette, dispensa, onScegli }) {
  const [filtri, setFiltri] = useState(filtriSalvati);
  const [proposte, setProposte] = useState(() => ricordaLocale.leggi("proposte", []));
  const [carico, setCarico] = useState(false);
  const [errore, setErrore] = useState("");
  const [dispensaAperta, setDispensaAperta] = useState(false);
  const [fine, setFine] = useState("");

  const aggiorna = (cambio) => {
    const f = { ...filtri, ...cambio };
    setFiltri(f);
    ricordaLocale.scrivi("filtri2", f);
  };

  const scegliBase = (b) => {
    const nuove = togli(filtri.basi, b.id);
    // se tolgo carne o pesce, tolgo anche i loro tipi
    const tipiValidi = basi.filter((x) => nuove.includes(x.id)).flatMap((x) => x.tipi || []);
    aggiorna({ basi: nuove, tipi: filtri.tipi.filter((t) => tipiValidi.includes(t)) });
  };

  const azzera = () => aggiorna({ ...filtriVuoti, persone: filtri.persone });

  const chiedi = async (altre = false) => {
    setCarico(true);
    setErrore("");
    setFine("");
    const giaViste = altre ? proposte : [];
    let lista = [...giaViste];
    if (!altre) setProposte([]);
    let primaArrivata = false;
    try {
      const esito = await proposteAFlusso(
        {
          filtri: {
            ...filtri,
            basi: basi.filter((b) => filtri.basi.includes(b.id)).map((b) => b.label + (b.nota ? ` (${b.nota})` : "")),
            testo: filtri.testo.trim(),
            quante: 50
          },
          dispensa,
          gusti: riassuntoGusti(ricette),
          evita: giaViste.map((p) => p.titolo)
        },
        (ricetta) => {
          if (lista.some((p) => p.titolo?.toLowerCase() === ricetta.titolo.toLowerCase())) return;
          lista = [...lista, ricetta];
          setProposte(lista);
          if (!primaArrivata) {
            primaArrivata = true;
            if (!altre) {
              setTimeout(() => document.getElementById("proposte")?.scrollIntoView({ behavior: "smooth" }), 50);
            }
          }
        }
      );
      if (!esito.quante) throw new Error("Nessuna idea questa volta, riprova.");
      setFine(esito.fine);
    } catch (e) {
      setErrore(e.message);
    } finally {
      ricordaLocale.scrivi("proposte", lista);
      setCarico(false);
    }
  };

  const haTesto = !!filtri.testo.trim();
  const basiConTipi = basi.filter((b) => b.tipi && filtri.basi.includes(b.id));
  const verdureOrdinate = [...verdure].sort((a, b) => diStagione(b) - diStagione(a));
  const scelte =
    filtri.basi.length + filtri.tipi.length + filtri.verdure.length + filtri.umori.length +
    (filtri.tempo ? 1 : 0) + (filtri.sporco ? 1 : 0) + (filtri.testo.trim() ? 1 : 0);

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between px-1">
        <div>
          <h1 className="text-2xl font-bold">Cosa mangiamo?</h1>
          <p className="text-sm text-slate-400">Scegli quello che vuoi, il resto lo decide il cuoco.</p>
        </div>
        {scelte > 0 && (
          <button onClick={azzera} className="text-sm text-slate-400 shrink-0 pb-0.5">
            Azzera
          </button>
        )}
      </div>

      {/* 1. BASE */}
      <Passo n={1} sbiadito={haTesto} titolo="La base">
        <div className="grid grid-cols-5 gap-1.5">
          {basi.map((b) => {
            const on = filtri.basi.includes(b.id);
            return (
              <button
                key={b.id}
                onClick={() => scegliBase(b)}
                className={`rounded-2xl border py-2 flex flex-col items-center gap-0.5 transition active:scale-95 ${
                  on ? "bg-cyan-400 border-cyan-400 text-black font-semibold" : "border-slate-700 text-slate-300"
                }`}
              >
                <span className="text-xl">{b.emoji}</span>
                <span className="text-[12px]">{b.label}</span>
              </button>
            );
          })}
        </div>
        {filtri.basi.includes("altro") && (
          <p className="text-xs text-slate-500 mt-2">Altro = {basi.find((b) => b.id === "altro").nota}</p>
        )}
        {basiConTipi.map((b) => (
          <div key={b.id} className="mt-3">
            <div className="text-xs text-slate-400 mb-1.5">
              {b.emoji} Che {b.label.toLowerCase()}? <span className="text-slate-600">(se non scegli, varia lui)</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {b.tipi.map((t) => (
                <button
                  key={t}
                  onClick={() => aggiorna({ tipi: togli(filtri.tipi, t) })}
                  className={`${chipS} ${filtri.tipi.includes(t) ? chipOn : chipOff}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        ))}
      </Passo>

      {/* 2. VERDURE */}
      <Passo n={2} sbiadito={haTesto} titolo="Le verdure" aiuto={<span><span className="text-emerald-400">verde</span> = di stagione</span>}>
        <div className="flex flex-wrap gap-1.5">
          {verdureOrdinate.map((v) => {
            const on = filtri.verdure.includes(v.nome);
            const st = diStagione(v);
            return (
              <button
                key={v.nome}
                onClick={() => aggiorna({ verdure: togli(filtri.verdure, v.nome) })}
                className={`${chipS} ${on ? chipOn : st ? "border-emerald-500/50 text-emerald-300" : chipOff}`}
              >
                {v.nome}
              </button>
            );
          })}
        </div>
      </Passo>

      {/* 3. STILE */}
      <Passo n={3} sbiadito={haTesto} titolo="Lo stile">
        <div className="flex flex-wrap gap-1.5">
          {umori.map((u) => (
            <button
              key={u.id}
              onClick={() => aggiorna({ umori: togli(filtri.umori, u.label) })}
              className={`${chipS} ${filtri.umori.includes(u.label) ? chipOn : chipOff}`}
            >
              {u.emoji} {u.label}
            </button>
          ))}
        </div>
      </Passo>

      {/* 4. TEMPO, SPORCO, PERSONE */}
      <Passo n={4} titolo="Tempo, pentole, persone">
        <div className="space-y-2.5">
          <Riga etichetta="⏱">
            {tempi.map((t) => (
              <button
                key={t.id}
                onClick={() => aggiorna({ tempo: filtri.tempo === t.id ? null : t.id })}
                className={`${chipS} ${filtri.tempo === t.id ? chipOn : chipOff}`}
              >
                {t.label}
              </button>
            ))}
          </Riga>
          <Riga etichetta="🧽">
            {livelliSporco.map((l) => (
              <button
                key={l.id}
                onClick={() => aggiorna({ sporco: filtri.sporco === l.id ? null : l.id })}
                className={`${chipS} ${filtri.sporco === l.id ? chipOn : chipOff}`}
              >
                {l.emoji} {l.label}
              </button>
            ))}
          </Riga>
          <Riga etichetta="👥">
            <button className={`${chipS} ${chipOff} w-8`} onClick={() => aggiorna({ persone: Math.max(1, filtri.persone - 1) })}>
              −
            </button>
            <span className="w-14 text-center text-sm font-semibold">
              {filtri.persone} {filtri.persone === 1 ? "persona" : "persone"}
            </span>
            <button className={`${chipS} ${chipOff} w-8`} onClick={() => aggiorna({ persone: Math.min(10, filtri.persone + 1) })}>
              +
            </button>
          </Riga>
        </div>
      </Passo>

      {/* 5. SCRIVI TU */}
      <Passo n={5} titolo="Scrivi tu" aiuto={<span className="text-amber-300">comanda su tutto</span>} evidenzia={!!filtri.testo.trim()}>
        <textarea
          value={filtri.testo}
          onChange={(e) => aggiorna({ testo: e.target.value })}
          rows={2}
          placeholder="es. devo finire mezzo cavolo e due salsicce, e ho voglia di qualcosa di caldo"
          className="campo resize-none py-2.5"
        />
        {haTesto && (
          <p className="text-xs text-amber-300/90 mt-1.5">
            Cerco quello che hai scritto. Le scelte sopra valgono solo come suggerimento.
          </p>
        )}
        <button onClick={() => setDispensaAperta((x) => !x)} className="text-xs text-cyan-400 mt-2">
          {dispensaAperta ? "Chiudi la dispensa" : `🧂 Dispensa base: ${dispensa.length} cose sempre in casa`}
        </button>
        {dispensaAperta && (
          <div className="mt-2">
            <Dispensa voci={dispensa} />
          </div>
        )}
      </Passo>

      {errore && <div className="card border-red-500/50 text-red-300 text-sm">{errore}</div>}

      <div className="sticky z-20 pt-2" style={{ bottom: "calc(env(safe-area-inset-bottom) + 4.5rem)" }}>
        <button
          onClick={() => chiedi(false)}
          disabled={carico}
          className="btn-primario w-full text-lg shadow-lg shadow-black/50 disabled:opacity-70"
        >
          {carico ? `Il cuoco scrive… ${proposte.length ? `(${proposte.length})` : "🤔"}` : "👨‍🍳 Proponimi fino a 50 idee"}
        </button>
      </div>

      {proposte.length > 0 && (
        <div id="proposte" className="space-y-3 scroll-mt-20 pt-2">
          <h2 className="text-lg font-bold px-1">
            Le proposte ({proposte.length}){carico && <span className="text-sm font-normal text-slate-400 animate-pulse"> · ne arrivano altre…</span>}
          </h2>
          {proposte.map((p, i) => (
            <SchedaProposta key={i + p.titolo} p={p} onScegli={() => onScegli(p, filtri)} />
          ))}
          {!carico && fine && <MotivoFine fine={fine} quante={proposte.length} />}
          <button
            onClick={() => chiedi(true)}
            disabled={carico}
            className="w-full rounded-2xl border border-cyan-400/50 text-cyan-300 py-3 disabled:opacity-50"
          >
            {carico ? `Arrivano… (${proposte.length})` : "🔄 Altre idee"}
          </button>
        </div>
      )}
    </div>
  );
}

function MotivoFine({ fine }) {
  const testi = {
    STOP: "Il cuoco ha finito le idee per questa richiesta. Con \"Altre idee\" ne cerca di nuove.",
    TEMPO: "Tempo scaduto (Vercel chiude dopo un minuto): queste sono quelle arrivate in tempo.",
    MAX_TOKENS: "Risposta troppo lunga, tagliata qui.",
    INTERROTTO: "Connessione interrotta: tengo quelle arrivate."
  };
  return <p className="text-xs text-slate-500 text-center px-4">{testi[fine] || "Si è fermato (" + fine + ")."}</p>;
}

function Passo({ n, titolo, aiuto, evidenzia, sbiadito, children }) {
  return (
    <section className={`card p-3.5 transition ${evidenzia ? "border-amber-400/60" : ""} ${sbiadito ? "opacity-45" : ""}`}>
      <div className="flex items-center gap-2 mb-2.5">
        <span className="w-5 h-5 rounded-full bg-cyan-400/15 text-cyan-300 text-[11px] font-bold flex items-center justify-center">
          {n}
        </span>
        <span className="text-sm font-semibold text-slate-200">{titolo}</span>
        {aiuto && <span className="ml-auto text-[11px] text-slate-500">{aiuto}</span>}
      </div>
      {children}
    </section>
  );
}

function Riga({ etichetta, children }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="w-6 text-base">{etichetta}</span>
      {children}
    </div>
  );
}

function SchedaProposta({ p, onScegli }) {
  const [aperta, setAperta] = useState(false);
  return (
    <div className="card space-y-3">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-bold leading-tight">{p.titolo}</h3>
          {p.stagionale && <span className="text-xs shrink-0 rounded-full bg-emerald-500/15 text-emerald-300 px-2 py-0.5">di stagione</span>}
        </div>
        <p className="text-sm text-slate-300 mt-1">{p.descrizione}</p>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
        <span>⏱ {fmtMinuti(p.tempoMinuti)}</span>
        <span>💶 {fmtCosto(p.costoEuro)}</span>
        <span>{sporcoLabel(p.padelle)}</span>
        {p.difficolta && <span>📈 {p.difficolta}</span>}
      </div>

      {p.daComprare?.length > 0 && (
        <div className="text-sm text-amber-300">🛒 Da comprare: {p.daComprare.join(", ")}</div>
      )}

      {aperta && (
        <div className="text-sm space-y-2 border-t border-slate-800 pt-3">
          {p.perche && <p className="text-slate-400 italic">{p.perche}</p>}
          {p.ingredienti?.length > 0 && <p><b>Ingredienti:</b> {p.ingredienti.join(", ")}</p>}
          <ol className="list-decimal pl-5 space-y-1 text-slate-300">
            {(p.passaggi || []).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={() => setAperta((x) => !x)} className="flex-1 rounded-2xl border border-slate-700 py-2.5 text-sm">
          {aperta ? "Meno" : "Riassunto"}
        </button>
        <button onClick={onScegli} className="flex-1 btn-primario py-2.5 text-sm">
          Scelgo questa →
        </button>
      </div>
    </div>
  );
}

function Dispensa({ voci }) {
  const [nuova, setNuova] = useState("");
  const salva = (lista) => setDoc(doc(db, "cucina", "dispensa"), { voci: lista });

  const aggiungi = (e) => {
    e.preventDefault();
    const v = nuova.trim().toLowerCase();
    if (!v || voci.includes(v)) return;
    setNuova("");
    salva([...voci, v]);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {voci.map((v) => (
          <button key={v} onClick={() => salva(voci.filter((x) => x !== v))} className="chip text-xs">
            {v} ✕
          </button>
        ))}
      </div>
      <form onSubmit={aggiungi} className="flex gap-2">
        <input value={nuova} onChange={(e) => setNuova(e.target.value)} placeholder="Aggiungi (es. capperi)" className="campo flex-1 py-2" enterKeyHint="done" />
        <button className="btn-primario px-4 py-2">+</button>
      </form>
      <p className="text-xs text-slate-500">Tocca una voce per toglierla. La dispensa è condivisa tra voi due.</p>
    </div>
  );
}
