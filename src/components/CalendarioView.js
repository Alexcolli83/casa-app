"use client";

import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/firebase";
import {
  chiaveMese,
  meseDaChiave,
  nomeGiorno,
  nomeMese,
  perInputData,
  spostaMese
} from "@/lib/casa";

// Turni di Alicia (colore e sigla mostrati nel calendario)
export const tipiTurno = [
  { id: "mattina", label: "Mattina", sigla: "M", colore: "#fbbf24" },
  { id: "pomeriggio", label: "Pomeriggio", sigla: "P", colore: "#fb923c" },
  { id: "notte", label: "Notte", sigla: "N", colore: "#818cf8" },
  { id: "riposo", label: "Riposo", sigla: "R", colore: "#34d399" },
  { id: "altro", label: "Altro", sigla: "•", colore: "#94a3b8" }
];
const turnoInfo = (id) => tipiTurno.find((t) => t.id === id) || tipiTurno[4];

const COLORE_BOBBY = "#22d3ee";

/**
 * Collezione Firestore "calendario", un documento per voce:
 *  { giorno: "2026-10-31", chi: "Alicia" | "Bobby",
 *    turno?: "mattina"..., testo?: "...", ora?: "18:30", user, creato }
 */
export default function CalendarioView() {
  const oggi = perInputData(new Date());
  const [voci, setVoci] = useState([]);
  const [meseKey, setMeseKey] = useState(() => chiaveMese(new Date()));
  const [giorno, setGiorno] = useState(oggi);
  const [form, setForm] = useState(null); // null | "Alicia" | "Bobby"

  useEffect(
    () =>
      onSnapshot(collection(db, "calendario"), (snap) =>
        setVoci(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
    []
  );

  const perGiorno = useMemo(() => {
    const m = {};
    voci.forEach((v) => {
      (m[v.giorno] ||= []).push(v);
    });
    Object.values(m).forEach((l) =>
      l.sort((a, b) => (a.ora || "99").localeCompare(b.ora || "99"))
    );
    return m;
  }, [voci]);

  const { anno, mese } = meseDaChiave(meseKey);
  const giorniNelMese = new Date(anno, mese + 1, 0).getDate();
  const offset = (new Date(anno, mese, 1).getDay() + 6) % 7;
  const chiaveGiorno = (g) => `${meseKey}-${String(g).padStart(2, "0")}`;

  const vociGiorno = perGiorno[giorno] || [];
  const [y, m, g] = giorno.split("-").map(Number);
  const dataSel = new Date(y, m - 1, g);

  const cambiaMese = (k) => {
    setMeseKey(k);
    setForm(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={() => cambiaMese(spostaMese(meseKey, -1))} className="btn-tondo" aria-label="Mese precedente">‹</button>
        <button
          onClick={() => {
            cambiaMese(chiaveMese(new Date()));
            setGiorno(oggi);
          }}
          className="text-center"
        >
          <div className="text-xl font-bold">{nomeMese(meseKey)}</div>
          <div className="text-xs text-slate-400">Turni e impegni</div>
        </button>
        <button onClick={() => cambiaMese(spostaMese(meseKey, 1))} className="btn-tondo" aria-label="Mese successivo">›</button>
      </div>

      <div className="card px-2.5">
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-slate-500 mb-1">
          {["L", "M", "M", "G", "V", "S", "D"].map((x, i) => <div key={i}>{x}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: offset }).map((_, i) => <div key={"v" + i} />)}
          {Array.from({ length: giorniNelMese }).map((_, i) => {
            const k = chiaveGiorno(i + 1);
            const lista = perGiorno[k] || [];
            const turno = lista.find((v) => v.chi === "Alicia" && v.turno);
            const nBobby = lista.filter((v) => v.chi === "Bobby").length;
            const sel = k === giorno;
            return (
              <button
                key={k}
                onClick={() => {
                  setGiorno(k);
                  setForm(null);
                }}
                className={`rounded-xl aspect-square flex flex-col items-center justify-between py-1 transition ${
                  sel ? "bg-slate-200 text-black" : "bg-slate-900/60"
                } ${k === oggi && !sel ? "ring-1 ring-cyan-400" : ""}`}
              >
                <span className="text-sm font-semibold leading-none mt-0.5">{i + 1}</span>
                <span className="flex items-center gap-0.5 h-4">
                  {turno && (
                    <span
                      className="text-[10px] font-bold text-black rounded px-1 leading-4"
                      style={{ background: turnoInfo(turno.turno).colore }}
                    >
                      {turnoInfo(turno.turno).sigla}
                    </span>
                  )}
                  {nBobby > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: COLORE_BOBBY }} />
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 px-1 text-[11px] text-slate-400">
          {tipiTurno.slice(0, 4).map((t) => (
            <span key={t.id} className="flex items-center gap-1">
              <span className="font-bold text-black rounded px-1" style={{ background: t.colore }}>{t.sigla}</span>
              {t.label}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: COLORE_BOBBY }} />
            Impegno Bobby
          </span>
        </div>
      </div>

      {/* Dettaglio del giorno scelto */}
      <div>
        <h3 className="font-semibold px-1 mb-2">{nomeGiorno(dataSel)}</h3>

        <div className="card p-0 divide-y divide-slate-800">
          {vociGiorno.length === 0 && (
            <div className="px-4 py-5 text-center text-slate-400 text-sm">Niente in programma.</div>
          )}
          {vociGiorno.map((v) => (
            <Voce key={v.id} v={v} />
          ))}
        </div>

        {form ? (
          <NuovaVoce chi={form} giorno={giorno} onFatto={() => setForm(null)} />
        ) : (
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button onClick={() => setForm("Alicia")} className="rounded-2xl border border-slate-700 py-3 text-sm">
              <span className="text-amber-300">●</span> Turno Alicia
            </button>
            <button onClick={() => setForm("Bobby")} className="rounded-2xl border border-slate-700 py-3 text-sm">
              <span className="text-cyan-300">●</span> Impegno Bobby
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Voce({ v }) {
  const [conferma, setConferma] = useState(false);
  const t = v.turno ? turnoInfo(v.turno) : null;
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span
        className="w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0"
        style={
          t
            ? { background: t.colore, color: "#000" }
            : { background: COLORE_BOBBY + "33", color: COLORE_BOBBY }
        }
      >
        {t ? t.sigla : "B"}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-medium truncate">
          {t ? `Turno ${t.label.toLowerCase()}` : v.testo}
        </span>
        <span className="block text-xs text-slate-400 truncate">
          {v.chi}
          {v.ora ? " · " + v.ora : ""}
          {t && v.testo ? " · " + v.testo : ""}
        </span>
      </span>
      <button
        onClick={() => {
          if (!conferma) {
            setConferma(true);
            setTimeout(() => setConferma(false), 2500);
          } else deleteDoc(doc(db, "calendario", v.id));
        }}
        className={`h-9 rounded-full text-sm shrink-0 ${
          conferma ? "bg-red-500 text-white px-3" : "w-9 text-slate-400"
        }`}
        aria-label="Elimina"
      >
        {conferma ? "Elimina" : "✕"}
      </button>
    </div>
  );
}

function NuovaVoce({ chi, giorno, onFatto }) {
  const alicia = chi === "Alicia";
  const [turno, setTurno] = useState(alicia ? "mattina" : null);
  const [testo, setTesto] = useState("");
  const [ora, setOra] = useState("");
  const valido = alicia ? !!turno : testo.trim().length > 0;

  const salva = async (e) => {
    e.preventDefault();
    if (!valido) return;
    const scrittura = addDoc(collection(db, "calendario"), {
      giorno,
      chi,
      ...(alicia ? { turno } : {}),
      testo: testo.trim(),
      ora,
      user: auth.currentUser.email,
      creato: new Date()
    });
    onFatto();
    await scrittura;
  };

  return (
    <form onSubmit={salva} className="card mt-3 space-y-3">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold">{alicia ? "Turno di Alicia" : "Impegno di Bobby"}</h4>
        <button type="button" onClick={onFatto} className="text-sm text-slate-400">Annulla</button>
      </div>

      {alicia && (
        <div className="grid grid-cols-5 gap-1.5">
          {tipiTurno.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTurno(t.id)}
              className={`rounded-xl py-2 text-[11px] border ${
                turno === t.id ? "border-transparent text-black font-semibold" : "border-slate-700 text-slate-300"
              }`}
              style={turno === t.id ? { background: t.colore } : undefined}
            >
              <span className="block text-base font-bold">{t.sigla}</span>
              {t.label}
            </button>
          ))}
        </div>
      )}

      <input
        value={testo}
        onChange={(e) => setTesto(e.target.value)}
        placeholder={alicia ? "Nota (es. 7–14, reparto…)" : "Cosa? (es. dentista, calcetto…)"}
        className="campo"
        autoFocus={!alicia}
      />

      <label className="block">
        <span className="text-xs text-slate-400 ml-1">Ora (facoltativa)</span>
        <input type="time" value={ora} onChange={(e) => setOra(e.target.value)} className="campo mt-1" />
      </label>

      <button type="submit" disabled={!valido} className="btn-primario w-full disabled:opacity-40">
        Salva
      </button>
    </form>
  );
}
