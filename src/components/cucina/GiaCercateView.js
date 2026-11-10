"use client";

import { useEffect, useMemo, useState } from "react";
import { dataDoc, leggiRicerche } from "@/lib/cucina";
import { SchedaProposta } from "./IdeeView";

const fmtData = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" });

/**
 * Tutte le ricette uscite nelle ricerche passate (storico "ricerche" su Firebase),
 * senza doppioni: un archivio da sfogliare quando non c'è voglia di cercare.
 * Le legge solo quando apri questa pagina (per non consumare letture gratis).
 */
export default function GiaCercateView({ onScegli }) {
  const [ricerche, setRicerche] = useState(null);
  const [errore, setErrore] = useState("");
  const [cerca, setCerca] = useState("");
  const [quanteMostro, setQuanteMostro] = useState(30);

  useEffect(() => {
    leggiRicerche(200)
      .then(setRicerche)
      .catch((e) => setErrore("Non riesco a leggere lo storico (" + (e.code || e.message) + ")."));
  }, []);

  // tutte le ricette, la più recente vince sui doppioni
  const tutte = useMemo(() => {
    const viste = new Map();
    for (const r of ricerche || []) {
      for (const p of r.proposte || []) {
        const k = p.titolo?.toLowerCase();
        if (!k || viste.has(k)) continue;
        viste.set(k, { ...p, _quando: dataDoc(r.data), _ricerca: r.sintesi });
      }
    }
    return [...viste.values()];
  }, [ricerche]);

  const filtrate = useMemo(() => {
    const parole = cerca.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!parole.length) return tutte;
    return tutte.filter((p) => {
      const testo = [p.titolo, p.origine, p.tipologia, p.descrizione, p._ricerca, ...(p.ingredienti || [])]
        .join(" ")
        .toLowerCase();
      return parole.every((w) => testo.includes(w));
    });
  }, [tutte, cerca]);

  return (
    <div className="space-y-3">
      <div className="px-1">
        <h1 className="text-2xl font-bold">Già cercate</h1>
        <p className="text-sm text-slate-400">
          {ricerche === null
            ? "Carico l'archivio…"
            : `${tutte.length} ricette da ${ricerche.length} ricerche. Sfoglia senza consumare richieste.`}
        </p>
      </div>

      {errore && <div className="card border-red-500/50 text-red-300 text-sm">{errore}</div>}

      <input
        value={cerca}
        onChange={(e) => {
          setCerca(e.target.value);
          setQuanteMostro(30);
        }}
        placeholder="🔎 Cerca: pollo, Sicilia, al forno, salmone…"
        className="campo"
      />

      {ricerche !== null && filtrate.length === 0 && (
        <div className="card text-center text-slate-400 py-8">
          {tutte.length ? "Niente con queste parole." : "Ancora vuoto: ogni ricerca in Idee finisce qui da sola."}
        </div>
      )}

      {filtrate.slice(0, quanteMostro).map((p, i) => (
        <div key={i + p.titolo}>
          <div className="text-[11px] text-slate-600 px-2 mb-1 truncate">
            {p._quando && fmtData.format(p._quando)} · {p._ricerca}
          </div>
          <SchedaProposta p={p} onScegli={() => onScegli(p)} />
        </div>
      ))}

      {filtrate.length > quanteMostro && (
        <button onClick={() => setQuanteMostro((n) => n + 30)} className="w-full rounded-2xl border border-slate-700 py-3 text-sm">
          Mostrane altre ({filtrate.length - quanteMostro})
        </button>
      )}
    </div>
  );
}
