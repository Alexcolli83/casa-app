"use client";

import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/firebase";
import {
  chiediCucina,
  fmtCosto,
  fmtMinuti,
  livelliSporco,
  ricordaLocale,
  riassuntoGusti,
  sporcoLabel,
  tempi,
  umori
} from "@/lib/cucina";

const filtriVuoti = { umori: [], tempo: null, sporco: null, persone: 2 };

export default function IdeeView({ ricette, dispensa, onScegli }) {
  const [filtri, setFiltri] = useState(() => ricordaLocale.leggi("filtri", filtriVuoti));
  const [frigo, setFrigo] = useState(() => ricordaLocale.leggi("frigo", ""));
  const [extra, setExtra] = useState(() => ricordaLocale.leggi("extra", ""));
  const [proposte, setProposte] = useState(() => ricordaLocale.leggi("proposte", []));
  const [carico, setCarico] = useState(false);
  const [errore, setErrore] = useState("");
  const [dispensaAperta, setDispensaAperta] = useState(false);

  const aggiorna = (cambio) => {
    const f = { ...filtri, ...cambio };
    setFiltri(f);
    ricordaLocale.scrivi("filtri", f);
  };

  const toggleUmore = (label) =>
    aggiorna({
      umori: filtri.umori.includes(label) ? filtri.umori.filter((x) => x !== label) : [...filtri.umori, label]
    });

  const chiedi = async (altre = false) => {
    setCarico(true);
    setErrore("");
    try {
      const j = await chiediCucina("proposte", {
        filtri,
        frigo: frigo.trim(),
        extra: extra.trim(),
        dispensa,
        gusti: riassuntoGusti(ricette),
        evita: altre ? proposte.map((p) => p.titolo) : []
      });
      if (!j.proposte.length) throw new Error("Nessuna idea, riprova.");
      setProposte(j.proposte);
      ricordaLocale.scrivi("proposte", j.proposte);
      ricordaLocale.scrivi("frigo", frigo);
      ricordaLocale.scrivi("extra", extra);
      setTimeout(() => document.getElementById("proposte")?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (e) {
      setErrore(e.message);
    } finally {
      setCarico(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="px-1">
        <h1 className="text-2xl font-bold">Cosa mangiamo?</h1>
        <p className="text-sm text-slate-400">Scegli lo stile, il resto lo pensa il cuoco.</p>
      </div>

      <section className="card">
        <div className="titolo-card">Che voglia hai? (anche più d&apos;una)</div>
        <div className="flex flex-wrap gap-2">
          {umori.map((u) => (
            <button
              key={u.id}
              onClick={() => toggleUmore(u.label)}
              className={`chip ${filtri.umori.includes(u.label) ? "chip-on" : ""}`}
            >
              {u.emoji} {u.label}
            </button>
          ))}
        </div>
      </section>

      <section className="card space-y-4">
        <div>
          <div className="titolo-card">Quanto tempo?</div>
          <div className="flex flex-wrap gap-2">
            {tempi.map((t) => (
              <button
                key={t.id}
                onClick={() => aggiorna({ tempo: filtri.tempo === t.id ? null : t.id })}
                className={`chip ${filtri.tempo === t.id ? "chip-on" : ""}`}
              >
                ⏱ {t.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="titolo-card">Quanto vuoi sporcare?</div>
          <div className="flex flex-wrap gap-2">
            {livelliSporco.map((s) => (
              <button
                key={s.id}
                onClick={() => aggiorna({ sporco: filtri.sporco === s.id ? null : s.id })}
                className={`chip ${filtri.sporco === s.id ? "chip-on" : ""}`}
              >
                {s.emoji} {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-300">Persone</div>
          <div className="flex items-center gap-3">
            <button className="btn-tondo w-9 h-9 text-xl" onClick={() => aggiorna({ persone: Math.max(1, filtri.persone - 1) })}>
              −
            </button>
            <span className="w-5 text-center font-bold">{filtri.persone}</span>
            <button className="btn-tondo w-9 h-9 text-xl" onClick={() => aggiorna({ persone: Math.min(10, filtri.persone + 1) })}>
              +
            </button>
          </div>
        </div>
      </section>

      <section className="card space-y-3">
        <div className="titolo-card mb-0">Cosa c&apos;è in frigo oggi? (facoltativo)</div>
        <input
          value={frigo}
          onChange={(e) => setFrigo(e.target.value)}
          placeholder="es. due zucchine, del merluzzo, mezza burrata"
          className="campo"
        />
        <input
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          placeholder="Altro? es. qualcosa di caldo e verduroso"
          className="campo"
        />
        <button onClick={() => setDispensaAperta((x) => !x)} className="text-sm text-cyan-400">
          {dispensaAperta ? "Chiudi la dispensa base" : `🧂 Dispensa base (${dispensa.length} cose sempre in casa)`}
        </button>
        {dispensaAperta && <Dispensa voci={dispensa} />}
      </section>

      {errore && <div className="card border-red-500/50 text-red-300 text-sm">{errore}</div>}

      <button onClick={() => chiedi(false)} disabled={carico} className="btn-primario w-full text-lg disabled:opacity-60">
        {carico ? "Il cuoco ci pensa… 🤔" : "👨‍🍳 Proponimi qualcosa"}
      </button>

      {proposte.length > 0 && (
        <div id="proposte" className="space-y-3 scroll-mt-20">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-bold">Le proposte</h2>
            <button onClick={() => chiedi(true)} disabled={carico} className="text-sm text-cyan-400 disabled:opacity-50">
              🔄 Altre idee
            </button>
          </div>
          {proposte.map((p, i) => (
            <SchedaProposta key={i + p.titolo} p={p} onScegli={() => onScegli(p, filtri)} />
          ))}
        </div>
      )}
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
