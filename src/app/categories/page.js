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

  const [mode, setMode] = useState("3m");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [categoriaFiltro, setCategoriaFiltro] = useState("all");

  const colors = [
    "#60a5fa",
    "#34d399",
    "#fbbf24",
    "#f87171",
    "#a78bfa",
    "#fb7185",
    "#22d3ee",
  ];

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

  // =========================
  // FUNZIONE UNICA FILTRO DATA
  // =========================
  const getStartDate = () => {
    const now = new Date();

    if (mode === "1m") {
      const d = new Date();
      d.setMonth(now.getMonth() - 1);
      return d;
    }

    if (mode === "3m") {
      const d = new Date();
      d.setMonth(now.getMonth() - 3);
      return d;
    }

    if (mode === "6m") {
      const d = new Date();
      d.setMonth(now.getMonth() - 6);
      return d;
    }

    return null; // all o custom
  };

  // =========================
  // CATEGORIE
  // =========================
  const datiCategorie = useMemo(() => {
    const map = {};

    const start = mode === "custom" ? startDate : getStartDate();

    spese.forEach((s) => {
      if (!s.data) return;

      const d = new Date(s.data.seconds * 1000);

      if (start && d < start) return;
      if (mode === "custom" && endDate && d > endDate) return;

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

    return Object.values(map).sort((a, b) => b.totale - a.totale);
  }, [spese, mode, startDate, endDate, categoriaFiltro]);

  // =========================
  // TREND
  // =========================
  const datiTrend = useMemo(() => {
    const map = {};

    const start = mode === "custom" ? startDate : getStartDate();

    spese.forEach((s) => {
      if (!s.data) return;

      const d = new Date(s.data.seconds * 1000);

      if (start && d < start) return;
      if (mode === "custom" && endDate && d > endDate) return;

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
      <a href="/" style={{ color: "cyan", marginBottom: 10, display: "block" }}>
        ← Home
      </a>

      <h3>📊 Periodo</h3>

      <select value={mode} onChange={(e) => setMode(e.target.value)}>
        <option value="1m">Ultimo mese</option>
        <option value="3m">3 mesi</option>
        <option value="6m">6 mesi</option>
        <option value="all">Tutto</option>
        <option value="custom">Custom</option>
      </select>

      {mode === "custom" && (
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <DatePicker selected={startDate} onChange={setStartDate} />
          <DatePicker selected={endDate} onChange={setEndDate} />
        </div>
      )}

      <h3>🧾 Categoria</h3>

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

      <h2>📊 Spese per categoria</h2>

      <div style={{ width: "100%", height: 300 }}>
        <ResponsiveContainer>
          <BarChart data={datiCategorie}>
            <XAxis dataKey="categoria" stroke="#fff" />
            <YAxis stroke="#fff" />
            <Tooltip />

            <Bar dataKey="totale">
              {datiCategorie.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <h2 style={{ marginTop: 40 }}>📈 Trend mensile</h2>

      <div style={{ width: "100%", height: 300 }}>
        <ResponsiveContainer>
          <LineChart data={datiTrend}>
            <XAxis dataKey="mese" stroke="#fff" />
            <YAxis stroke="#fff" />
            <Tooltip />
            <Line type="monotone" dataKey="totale" stroke="#8884d8" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </main>
  );
}