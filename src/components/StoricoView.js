"use client";

import { useMemo } from "react";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import {
  catInfo,
  chiaveMese,
  euro,
  importoValido,
  nomeMese,
  nomeMeseBreve
} from "@/lib/casa";

/** Elenco di tutti i mesi: tocchi un mese e vedi tutte le sue spese. */
export default function StoricoView({ spese, onApriMese }) {
  const mesi = useMemo(() => {
    const m = {};
    spese.forEach((s) => {
      const k = chiaveMese(s._d);
      if (!m[k]) m[k] = { k, tot: 0, n: 0, cat: {} };
      const v = importoValido(s);
      m[k].tot += v;
      m[k].n += 1;
      m[k].cat[s.categoria] = (m[k].cat[s.categoria] || 0) + v;
    });
    return Object.values(m).sort((a, b) => b.k.localeCompare(a.k));
  }, [spese]);

  const ultimi12 = [...mesi].slice(0, 12).reverse();
  const media = mesi.length
    ? mesi.reduce((a, m) => a + m.tot, 0) / mesi.length
    : 0;

  const anni = [];
  mesi.forEach((m) => {
    const y = m.k.slice(0, 4);
    let a = anni.find((x) => x.y === y);
    if (!a) anni.push((a = { y, tot: 0, mesi: [] }));
    a.tot += m.tot;
    a.mesi.push(m);
  });

  if (mesi.length === 0) {
    return <div className="card text-center text-slate-400 py-10">Ancora nessuna spesa registrata.</div>;
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold px-1">Storico mesi</h1>

      <div className="card">
        <div className="flex justify-between items-baseline mb-2">
          <h3 className="titolo-card mb-0">Ultimi mesi</h3>
          <span className="text-xs text-slate-400">media {euro(media)}</span>
        </div>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ultimi12}>
              <XAxis
                dataKey="k"
                tickFormatter={(k) => nomeMeseBreve(k).slice(0, 3)}
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                interval={0}
              />
              <Tooltip
                formatter={(v) => euro(v)}
                labelFormatter={nomeMese}
                cursor={{ fill: "#ffffff10" }}
                contentStyle={{ background: "#0f141d", border: "1px solid #334155", borderRadius: 12 }}
              />
              <Bar dataKey="tot" name="Totale" radius={[6, 6, 0, 0]} onClick={(d) => onApriMese(d.k)}>
                {ultimi12.map((m) => (
                  <Cell key={m.k} fill="#22d3ee" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {anni.map((a) => (
        <div key={a.y}>
          <div className="flex justify-between text-sm text-slate-400 px-1 mb-2">
            <span className="font-semibold text-slate-200">{a.y}</span>
            <span className="tabular-nums">{euro(a.tot)}</span>
          </div>
          <div className="space-y-2">
            {a.mesi.map((m) => {
              const cat = Object.entries(m.cat).sort((x, y) => y[1] - x[1]);
              return (
                <button
                  key={m.k}
                  onClick={() => onApriMese(m.k)}
                  className="card w-full text-left active:bg-slate-800/60"
                >
                  <div className="flex justify-between items-baseline">
                    <span className="font-semibold">{nomeMese(m.k)}</span>
                    <span className="font-bold tabular-nums">{euro(m.tot)}</span>
                  </div>
                  <div className="flex h-2 rounded-full overflow-hidden mt-2.5 bg-slate-800">
                    {cat.map(([id, v]) => (
                      <div key={id} style={{ width: `${(v / m.tot) * 100}%`, background: catInfo(id).colore }} />
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 mt-2">
                    <span className="truncate">
                      {cat.slice(0, 3).map(([id]) => catInfo(id).emoji + " " + catInfo(id).label).join("  ")}
                    </span>
                    <span className="shrink-0 ml-2">{m.n} spese ›</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
