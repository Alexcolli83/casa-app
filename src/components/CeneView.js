"use client";

import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { auth, db } from "@/firebase";
import { perInputData } from "@/lib/casa";

/**
 * Collezione Firestore "cene": un documento per giorno, id = "2026-10-31"
 *  { testo, user, aggiornato }
 */

const fmtGiorno = new Intl.DateTimeFormat("it-IT", { weekday: "long" });
const fmtData = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" });

const lunediDi = (d) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};

export default function CeneView() {
  const [cene, setCene] = useState({});
  const [lunedi, setLunedi] = useState(() => lunediDi(new Date()));
  const oggi = perInputData(new Date());

  useEffect(
    () =>
      onSnapshot(collection(db, "cene"), (snap) => {
        const m = {};
        snap.docs.forEach((d) => (m[d.id] = d.data().testo || ""));
        setCene(m);
      }),
    []
  );

  const giorni = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(lunedi);
    d.setDate(d.getDate() + i);
    return d;
  });

  const sposta = (n) => {
    const d = new Date(lunedi);
    d.setDate(d.getDate() + 7 * n);
    setLunedi(d);
  };

  const domenica = giorni[6];
  const questaSettimana = perInputData(lunedi) === perInputData(lunediDi(new Date()));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={() => sposta(-1)} className="btn-tondo" aria-label="Settimana precedente">‹</button>
        <button onClick={() => setLunedi(lunediDi(new Date()))} className="text-center">
          <div className="text-xl font-bold">Cene</div>
          <div className={`text-xs ${questaSettimana ? "text-slate-400" : "text-cyan-400"}`}>
            {fmtData.format(lunedi)} – {fmtData.format(domenica)}
            {!questaSettimana && " · torna a questa settimana"}
          </div>
        </button>
        <button onClick={() => sposta(1)} className="btn-tondo" aria-label="Settimana successiva">›</button>
      </div>

      <div className="space-y-2">
        {giorni.map((d) => {
          const k = perInputData(d);
          return <Cena key={k + (cene[k] ?? "")} chiave={k} data={d} oggi={k === oggi} valore={cene[k] || ""} />;
        })}
      </div>
    </div>
  );
}

function Cena({ chiave, data, oggi, valore }) {
  const [testo, setTesto] = useState(valore);
  const [salvato, setSalvato] = useState(false);
  const nome = fmtGiorno.format(data);

  const salva = async () => {
    const t = testo.trim();
    if (t === valore.trim()) return;
    if (t) {
      await setDoc(doc(db, "cene", chiave), {
        testo: t,
        user: auth.currentUser.email,
        aggiornato: new Date()
      });
    } else {
      await deleteDoc(doc(db, "cene", chiave));
    }
    setSalvato(true);
  };

  return (
    <label className={`card flex items-center gap-3 py-3 ${oggi ? "border-cyan-400/60" : ""}`}>
      <span className="w-14 shrink-0">
        <span className={`block text-sm font-semibold capitalize ${oggi ? "text-cyan-300" : ""}`}>
          {nome.slice(0, 3)}
        </span>
        <span className="block text-xs text-slate-500">{data.getDate()}</span>
      </span>
      <input
        value={testo}
        onChange={(e) => {
          setTesto(e.target.value);
          setSalvato(false);
        }}
        onBlur={salva}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        enterKeyHint="done"
        placeholder={oggi ? "Cosa si mangia stasera?" : "—"}
        className="flex-1 min-w-0 bg-transparent outline-none text-base placeholder:text-slate-600"
      />
      {salvato && <span className="text-emerald-400 text-sm shrink-0">✓</span>}
    </label>
  );
}
