"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import {
  catInfo,
  chiaveMese,
  euro,
  importoValido,
  meseDaChiave,
  nomeGiorno,
  nomeMese,
  nomeUtente,
  persone,
  spostaMese
} from "@/lib/casa";

export default function MeseView({ spese, meseKey, setMeseKey, onApri, onGiornoScelto }) {
  const [giornoSel, setGiornoSel] = useState(null);
  const meseOggi = chiaveMese(new Date());
  const { anno, mese } = meseDaChiave(meseKey);
  const giorniNelMese = new Date(anno, mese + 1, 0).getDate();

  const cambiaMese = (k) => {
    setGiornoSel(null);
    onGiornoScelto(null);
    setMeseKey(k);
  };

  const speseMese = useMemo(
    () =>
      spese
        .filter((s) => chiaveMese(s._d) === meseKey)
        .sort((a, b) => b._d - a._d),
    [spese, meseKey]
  );

  const totale = speseMese.reduce((a, s) => a + importoValido(s), 0);

  const totPrec = useMemo(() => {
    const k = spostaMese(meseKey, -1);
    return spese
      .filter((s) => chiaveMese(s._d) === k)
      .reduce((a, s) => a + importoValido(s), 0);
  }, [spese, meseKey]);

  const perPersona = persone.map((p) => ({
    ...p,
    totale: speseMese
      .filter((s) => nomeUtente(s.user) === p.nome)
      .reduce((a, s) => a + importoValido(s), 0)
  }));

  const perCategoria = useMemo(() => {
    const m = {};
    speseMese.forEach((s) => {
      m[s.categoria] = (m[s.categoria] || 0) + importoValido(s);
    });
    return Object.entries(m)
      .map(([id, tot]) => ({ ...catInfo(id), tot }))
      .sort((a, b) => b.tot - a.tot);
  }, [speseMese]);

  const perGiorno = useMemo(() => {
    const m = {};
    speseMese.forEach((s) => {
      const g = s._d.getDate();
      m[g] = (m[g] || 0) + importoValido(s);
    });
    return m;
  }, [speseMese]);

  // Grafico cumulativo (come prima: totale, Bobby, Alicia)
  const datiGrafico = (() => {
    const ultimo = meseKey === meseOggi ? new Date().getDate() : giorniNelMese;
    let b = 0, a = 0, t = 0;
    const out = [];
    for (let g = 1; g <= ultimo; g++) {
      speseMese
        .filter((s) => s._d.getDate() === g)
        .forEach((s) => {
          const v = importoValido(s);
          t += v;
          if (nomeUtente(s.user) === "Bobby") b += v;
          if (nomeUtente(s.user) === "Alicia") a += v;
        });
      out.push({ giorno: g, totale: t, Bobby: b, Alicia: a });
    }
    return out;
  })();

  // Lista raggruppata per giorno
  const listaVisibile = giornoSel
    ? speseMese.filter((s) => s._d.getDate() === giornoSel)
    : speseMese;
  const gruppi = [];
  listaVisibile.forEach((s) => {
    const g = s._d.getDate();
    let gr = gruppi.find((x) => x.g === g);
    if (!gr) gruppi.push((gr = { g, d: s._d, voci: [], tot: 0 }));
    gr.voci.push(s);
    gr.tot += importoValido(s);
  });

  const offset = (new Date(anno, mese, 1).getDay() + 6) % 7; // lunedì = 0
  const oggiG = meseKey === meseOggi ? new Date().getDate() : null;
  const diff = totale - totPrec;

  return (
    <div className="space-y-5">
      {/* Selettore mese */}
      <div className="flex items-center justify-between">
        <button onClick={() => cambiaMese(spostaMese(meseKey, -1))} className="btn-tondo" aria-label="Mese precedente">‹</button>
        <button onClick={() => cambiaMese(meseOggi)} className="text-center">
          <div className="text-xl font-bold">{nomeMese(meseKey)}</div>
          {meseKey !== meseOggi && (
            <div className="text-xs text-cyan-400">torna al mese corrente</div>
          )}
        </button>
        <button onClick={() => cambiaMese(spostaMese(meseKey, 1))} className="btn-tondo" aria-label="Mese successivo">›</button>
      </div>

      {/* Totale */}
      <div className="card bg-gradient-to-br from-cyan-500/20 to-transparent">
        <div className="text-sm text-slate-400">Totale del mese</div>
        <div className="text-4xl font-bold tabular-nums mt-1">{euro(totale)}</div>
        {totPrec > 0 && (
          <div className={`text-xs mt-1 ${diff > 0 ? "text-red-400" : "text-emerald-400"}`}>
            {diff > 0 ? "▲" : "▼"} {euro(Math.abs(diff))} rispetto al mese prima
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 mt-4">
          {perPersona.map((p) => (
            <div key={p.nome} className="rounded-2xl bg-black/25 px-3 py-2">
              <div className="text-xs flex items-center gap-1.5 text-slate-400">
                <span className="w-2 h-2 rounded-full" style={{ background: p.colore }} />
                {p.nome}
              </div>
              <div className="font-semibold tabular-nums">{euro(p.totale)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Per categoria nel mese */}
      {perCategoria.length > 0 && (
        <div className="card">
          <h3 className="titolo-card">Per categoria</h3>
          <div className="space-y-2.5">
            {perCategoria.map((c) => (
              <div key={c.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{c.emoji} {c.label}</span>
                  <span className="tabular-nums font-medium">{euro(c.tot)}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(c.tot / totale) * 100}%`, background: c.colore }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Andamento */}
      {speseMese.length > 0 && (
        <div className="card">
          <h3 className="titolo-card">Andamento</h3>
          <div className="h-48 -ml-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={datiGrafico}>
                <XAxis dataKey="giorno" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} width={44} />
                <Tooltip
                  formatter={(v) => euro(v)}
                  labelFormatter={(g) => `Giorno ${g}`}
                  contentStyle={{ background: "#0f141d", border: "1px solid #334155", borderRadius: 12 }}
                />
                <Line type="monotone" dataKey="totale" stroke="#22d3ee" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="Bobby" stroke="#34d399" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="Alicia" stroke="#fbbf24" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Calendario */}
      <div className="card">
        <h3 className="titolo-card">Calendario</h3>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-slate-500 mb-1">
          {["L", "M", "M", "G", "V", "S", "D"].map((x, i) => <div key={i}>{x}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: offset }).map((_, i) => <div key={"v" + i} />)}
          {Array.from({ length: giorniNelMese }).map((_, i) => {
            const g = i + 1;
            const tot = perGiorno[g] || 0;
            const sel = giornoSel === g;
            return (
              <button
                key={g}
                onClick={() => {
                  const nuovo = sel ? null : g;
                  setGiornoSel(nuovo);
                  onGiornoScelto(nuovo ? new Date(anno, mese, nuovo) : null);
                }}
                className={`rounded-xl aspect-square flex flex-col items-center justify-center leading-tight transition ${
                  sel
                    ? "bg-cyan-400 text-black"
                    : tot > 0
                    ? "bg-slate-700/70"
                    : "bg-slate-900/60 text-slate-500"
                } ${oggiG === g && !sel ? "ring-1 ring-cyan-400" : ""}`}
              >
                <span className="text-sm font-semibold">{g}</span>
                {tot > 0 && (
                  <span className="text-[9px] tabular-nums opacity-80">
                    {tot >= 1000 ? Math.round(tot / 100) / 10 + "k" : Math.round(tot)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista spese */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <h3 className="font-semibold">
            {giornoSel ? `Spese del ${giornoSel}` : "Tutte le spese"}{" "}
            <span className="text-slate-500 font-normal">({listaVisibile.length})</span>
          </h3>
          {giornoSel && (
            <button
              onClick={() => { setGiornoSel(null); onGiornoScelto(null); }}
              className="text-sm text-cyan-400"
            >
              Mostra tutte
            </button>
          )}
        </div>

        {gruppi.length === 0 && (
          <div className="card text-center text-slate-400 py-8">
            Nessuna spesa {giornoSel ? "in questo giorno" : "in questo mese"}.<br />
            <span className="text-sm">Tocca + per aggiungerne una.</span>
          </div>
        )}

        <div className="space-y-4">
          {gruppi.map((gr) => (
            <div key={gr.g}>
              <div className="flex justify-between text-xs text-slate-400 px-1 mb-1.5">
                <span>{nomeGiorno(gr.d)}</span>
                <span className="tabular-nums">{euro(gr.tot)}</span>
              </div>
              <div className="card p-0 divide-y divide-slate-800">
                {gr.voci.map((s) => {
                  const c = catInfo(s.categoria);
                  return (
                    <button
                      key={s.id}
                      onClick={() => onApri(s)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-800/60"
                    >
                      <span
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                        style={{ background: c.colore + "33" }}
                      >
                        {c.emoji}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-medium truncate">
                          {s.nota ? s.nota : c.label}
                        </span>
                        <span className="block text-xs text-slate-400 truncate">
                          {s.nota ? c.label + " · " : ""}{nomeUtente(s.user)}
                        </span>
                      </span>
                      <span className="font-semibold tabular-nums">{euro(importoValido(s))}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
