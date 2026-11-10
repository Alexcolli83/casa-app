"use client";

import { useMemo, useState } from "react";
import { dataDoc, fmtMinuti, sporcoLabel, stagioneDi, stagioni } from "@/lib/cucina";

const fmtData = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "2-digit" });

const filtriTempo = [
  { id: 20, label: "≤ 20 min" },
  { id: 40, label: "≤ 40 min" }
];
const filtriSporco = [
  { id: 1, label: "🍳 Una padella" },
  { id: 2, label: "🥄 Poco" }
];

export default function RicettarioView({ ricette, onApri }) {
  const [cerca, setCerca] = useState("");
  const [stagione, setStagione] = useState(null);
  const [tempo, setTempo] = useState(null);
  const [sporco, setSporco] = useState(null);
  const [soloTop, setSoloTop] = useState(false);

  const filtrate = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    return ricette.filter((r) => {
      if (q) {
        const testo = [r.titolo, r.descrizione, r.proposta?.origine, r.proposta?.tipologia, ...(r.umori || []), ...(r.tag || []), ...(r.note || []).map((n) => n.testo)]
          .join(" ")
          .toLowerCase();
        if (!testo.includes(q)) return false;
      }
      if (stagione && !(r.stagioni || []).includes(stagione)) return false;
      if (tempo && !(Number(r.tempoMinuti) && Number(r.tempoMinuti) <= tempo)) return false;
      if (sporco && !(Number(r.padelle) && Number(r.padelle) <= sporco)) return false;
      if (soloTop && (r.voto || 0) < 4) return false;
      return true;
    });
  }, [ricette, cerca, stagione, tempo, sporco, soloTop]);

  const oraStagione = stagioneDi();

  return (
    <div className="space-y-4">
      <div className="px-1">
        <h1 className="text-2xl font-bold">Ricettario</h1>
        <p className="text-sm text-slate-400">
          {ricette.length ? `${ricette.length} ricette fatte da voi` : "Ancora vuoto: scegli un'idea, cucinala e salvala qui."}
        </p>
      </div>

      <input value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder="🔎 Cerca (piatto, ingrediente, nota…)" className="campo" />

      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
        {stagioni.map((s) => (
          <button
            key={s.id}
            onClick={() => setStagione(stagione === s.id ? null : s.id)}
            className={`chip ${stagione === s.id ? "chip-on" : ""}`}
          >
            {s.emoji} {s.label}
            {s.id === oraStagione && stagione !== s.id ? " ·" : ""}
          </button>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
        {filtriTempo.map((t) => (
          <button key={t.id} onClick={() => setTempo(tempo === t.id ? null : t.id)} className={`chip ${tempo === t.id ? "chip-on" : ""}`}>
            ⏱ {t.label}
          </button>
        ))}
        {filtriSporco.map((s) => (
          <button key={s.id} onClick={() => setSporco(sporco === s.id ? null : s.id)} className={`chip ${sporco === s.id ? "chip-on" : ""}`}>
            {s.label}
          </button>
        ))}
        <button onClick={() => setSoloTop((x) => !x)} className={`chip ${soloTop ? "chip-on" : ""}`}>
          ⭐ 4+
        </button>
      </div>

      {filtrate.length === 0 ? (
        ricette.length > 0 && <div className="card text-center text-slate-400 py-8">Niente con questi filtri.</div>
      ) : (
        <div className="space-y-2">
          {filtrate.map((r) => {
            const d = dataDoc(r.ultimaVolta || r.fattaIl);
            const st = stagioni.find((s) => s.id === (r.stagioni || [])[0]);
            return (
              <button key={r.id} onClick={() => onApri(r)} className="card w-full text-left block space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold leading-tight">{r.titolo}</span>
                  {r.voto ? <span className="text-xs shrink-0">{"⭐".repeat(r.voto)}</span> : null}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-400">
                  <span>⏱ {fmtMinuti(r.tempoMinuti)}</span>
                  <span>{sporcoLabel(r.padelle)}</span>
                  {st && <span>{st.emoji} {st.label}</span>}
                  {d && <span>📅 {fmtData.format(d)}</span>}
                  {r.volte > 1 && <span>🔁 {r.volte} volte</span>}
                  {r.proposta?.origine && <span>📍 {r.proposta.origine}</span>}
                </div>
                {r.note?.length > 0 && (
                  <div className="text-xs text-slate-500 italic truncate">“{r.note[r.note.length - 1].testo}”</div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
