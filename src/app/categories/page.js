"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/firebase";
import { collection, onSnapshot } from "firebase/firestore";

import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

export default function Categories() {
  const [spese, setSpese] = useState([]);

  // FILTRI
  const [mode, setMode] = useState("3m");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [categoriaFiltro, setCategoriaFiltro] = useState("all");

  // FIRESTORE
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "speseCasa"), (snap) => {
      setSpese(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );
    });

    return () => unsub();
  }, []);

  // COLORI BARRE
  const colors = [
    "#60a5fa",
    "#34d399",
    "#fbbf24",
    "#f87171",
    "#a78bfa",
    "#fb7185",
    "#22d3ee",
  ];

  // 📊 CATEGORIE
  const datiCategorie = useMemo(() => {
    const now = new Date();
    const meseCorrente =
      now.getFullYear() +
      "-" +
      String(now.getMonth() + 1).padStart(2, "0");

    const map = {};

    spese.forEach((s) => {
      if (!s.data) return;

      const d = new Date(s.data.seconds * 1000);

      const mese =
        d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0");

      if (mese !== meseCorrente) return;

      if (categoriaFiltro !== "all" && s.categoria !== categoriaFiltro)
        return;

      const val = Number(s.importo);
      if (isNaN(val)) return;

      if (!map[s.categoria]) {
        map[s.categoria] = {
          categoria: s.categoria,
          totale: 0,
        };
      }

      map[s.categoria].totale += val;
    });

    return Object.values(map);
  }, [spese, categoriaFiltro]);

  // 📈 TREND
  const datiTrend = useMemo(() => {
    const map = {};
    const now = new Date();
    let start = null;

    if (mode === "1m") {
      start = new Date();
      start.setMonth(now.getMonth() - 1);
    } else if (mode === "3m") {
      start = new Date();
      start.setMonth(now.getMonth() - 3);
    } else if (mode === "6m") {
      start = new Date();
      start.setMonth(now.getMonth() - 6);
    }

    spese.forEach((s) => {
      if (!s.data) return;

      const d = new Date(s.data.seconds * 1000);

      if (start && d < start) return;
      if (startDate && d < startDate) return;
      if (endDate && d > endDate) return;

      if (categoriaFiltro !== "all" && s.categoria !== categoriaFiltro)
        return;

      const mese =
        d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0");

      const val = Number(s.importo);
      if (isNaN(val)) return;

      if (!map[mese]) {
        map[mese] = { mese, totale: 0 };
      }

      map[mese].totale += val;
    });

    return Object.values(map).sort((a, b) =>
      a.mese.localeCompare(b.mese)
    );
  }, [spese, mode, startDate, endDate, categoriaFiltro]);

  return (
    <main style={{ padding: 20, background: "#0f0f0f", color: "white" }}>
      {/* HOME */}
      <a href="/" style={{ color: "cyan", display: "block", marginBottom: 10 }}>
        ← Home
      </a>

      {/* MODE */}
      <h3>📊 Periodo rapido</h3>

      <select value={mode} onChange={(e) => setMode(e.target.value)}>
        <option value="1m">Ultimo mese</option>
        <option value="3m">3 mesi</option>
        <option value="6m">6 mesi</option>
        <option value="all">Tutto</option>
        <option value="custom">Custom</option>
      </select>

      {mode === "custom" && (
        <>
          <h4>📅 Range personalizzato</h4>

          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <DatePicker selected={startDate} onChange={setStartDate} />
            <DatePicker selected={endDate} onChange={setEndDate} />
          </div>
        </>
      )}

      {/* CATEGORIA */}
      <h3>🧾 Filtro categoria</h3>

      <select
        value={categoriaFiltro}
        onChange={(e) => setCategoriaFiltro(e.target.value)}
      >
        <option value="all">Tutte</option>
        <option value="luce">luce</option>
        <option value="gas">gas</option>
        <option value="acqua">acqua</option>
        <option value="telefono">telefono</option>
        <option value="internet">internet</option>
        <option value="spesa">spesa</option>
        <option value="altro">altro</option>
      </select>

      {/* BAR CHART */}
      <h2>📊 Spese per categoria</h2>

      <div style={{ width: "100%", height: 300 }}>
        <ResponsiveContainer>
          <BarChart data={datiCategorie}>
            <XAxis dataKey="categoria" stroke="#fff" />
            <YAxis stroke="#fff" />
            <Tooltip />

            <Bar dataKey="totale">
              {datiCategorie.map((_, index) => (
                <Cell
                  key={index}
                  fill={colors[index % colors.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* TREND */}
      <h2 style={{ marginTop: 40 }}>📈 Trend spese</h2>

      <div style={{ width: "100%", height: 300 }}>
        <ResponsiveContainer>
          <LineChart data={datiTrend}>
            <XAxis dataKey="mese" stroke="#fff" />
            <YAxis stroke="#fff" />
            <Tooltip />

            <Line
              type="monotone"
              dataKey="totale"
              stroke="#8884d8"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </main>
  );
}