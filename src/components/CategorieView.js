"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line
} from "recharts";
import {
  catInfo,
  categorie,
  chiaveMese,
  euro,
  importoValido,
  nomeMese,
  nomeMeseBreve
} from "@/lib/casa";

const periodi = [
  { id: "1m", label: "1 mese" },
  { id: "3m", label: "3 mesi" },
  { id: "6m", label: "6 mesi" },
  { id: "all", label: "Tutto" },
  { id: "custom", label: "Scegli" }
];

const tooltipStile = { background: "#0f141d", border: "1px solid #334155", borderRadius: 12 };

export default function CategorieView({ spese }) {
  const [mode, setMode] = useState("3m");
  const [dal, setDal] = useState("");
  const [al, setAl] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("all");

  const filtrate = useMemo(() => {
    let start = null;
    let end = null;
    if (["1m", "3m", "6m"].includes(mode)) {
      start = new Date();
      start.setMonth(start.getMonth() - Number(mode[0]));
    }
    if (mode === "custom") {
      if (dal) start = new Date(dal + "T00:00:00");
      if (al) end = new Date(al + "T23:59:59");
    }
    return spese.filter((s) => {
      if (start && s._d < start) return false;
      if (end && s._d > end) return false;
      if (categoriaFiltro !== "all" && s.categoria !== categoriaFiltro) return false;
      return true;
    });
  }, [spese, mode, dal, al, categoriaFiltro]);

  const datiCategorie = useMemo(() => {
    const m = {};
    filtrate.forEach((s) => {
      m[s.categoria] = (m[s.categoria] || 0) + importoValido(s);
    });
    return Object.entries(m)
      .map(([id, totale]) => ({ ...catInfo(id), totale }))
      .sort((a, b) => b.totale - a.totale);
  }, [filtrate]);

  const datiTrend = useMemo(() => {
    const m = {};
    filtrate.forEach((s) => {
      const k = chiaveMese(s._d);
      m[k] = (m[k] || 0) + importoValido(s);
    });
    return Object.entries(m)
      .map(([mese, totale]) => ({ mese, totale }))
      .sort((a, b) => a.mese.localeCompare(b.mese));
  }, [filtrate]);

  const totale = filtrate.reduce((a, s) => a + importoValido(s), 0);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold px-1">Categorie</h1>

      <div className="card space-y-3">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {periodi.map((p) => (
            <button
              key={p.id}
              onClick={() => setMode(p.id)}
              className={`chip ${mode === p.id ? "chip-on" : ""}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {mode === "custom" && (
          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className="text-xs text-slate-400 ml-1">Dal</span>
              <input type="date" value={dal} onChange={(e) => setDal(e.target.value)} className="campo mt-1" />
            </label>
            <label>
              <span className="text-xs text-slate-400 ml-1">Al</span>
              <input type="date" value={al} onChange={(e) => setAl(e.target.value)} className="campo mt-1" />
            </label>
          </div>
        )}

        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setCategoriaFiltro("all")}
            className={`chip ${categoriaFiltro === "all" ? "chip-on" : ""}`}
          >
            Tutte
          </button>
          {categorie.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoriaFiltro(c.id)}
              className={`chip ${categoriaFiltro === c.id ? "chip-on" : ""}`}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>

        <div className="flex justify-between items-baseline pt-1">
          <span className="text-sm text-slate-400">Totale periodo</span>
          <span className="text-xl font-bold tabular-nums">{euro(totale)}</span>
        </div>
      </div>

      <div className="card">
        <h3 className="titolo-card">Spese per categoria</h3>
        {datiCategorie.length === 0 ? (
          <p className="text-slate-400 text-sm py-6 text-center">Nessuna spesa nel periodo.</p>
        ) : (
          <div className="h-60 -ml-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datiCategorie}>
                <XAxis dataKey="emoji" stroke="#64748b" fontSize={16} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} width={48} />
                <Tooltip
                  formatter={(v) => euro(v)}
                  labelFormatter={(_, p) => p?.[0]?.payload?.label || ""}
                  cursor={{ fill: "#ffffff10" }}
                  contentStyle={tooltipStile}
                />
                <Bar dataKey="totale" name="Totale" radius={[6, 6, 0, 0]}>
                  {datiCategorie.map((c) => (
                    <Cell key={c.id} fill={c.colore} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {datiTrend.length > 0 && (
        <div className="card">
          <h3 className="titolo-card">Trend mensile</h3>
          <div className="h-52 -ml-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={datiTrend}>
                <XAxis dataKey="mese" tickFormatter={nomeMeseBreve} stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} width={48} />
                <Tooltip formatter={(v) => euro(v)} labelFormatter={nomeMese} contentStyle={tooltipStile} />
                <Line type="monotone" dataKey="totale" name="Totale" stroke="#22d3ee" strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
