"use client";

import { useState } from "react";
import { addDoc, collection, deleteDoc, doc, writeBatch } from "firebase/firestore";
import { auth, db } from "@/firebase";
import { nomeUtente } from "@/lib/casa";

export default function ListaView({ lista }) {
  const [item, setItem] = useState("");
  const [conferma, setConferma] = useState(false);

  const aggiungi = async (e) => {
    e.preventDefault();
    const nome = item.trim();
    if (!nome) return;
    setItem("");
    await addDoc(collection(db, "listaSpesa"), {
      nome,
      user: auth.currentUser.email,
      data: new Date()
    });
  };

  const elimina = (id) => deleteDoc(doc(db, "listaSpesa", id));

  // Prima "Svuota lista" cancellava solo sullo schermo: ora svuota davvero per tutti e due
  const svuota = async () => {
    if (!conferma) {
      setConferma(true);
      setTimeout(() => setConferma(false), 3000);
      return;
    }
    const batch = writeBatch(db);
    lista.forEach((l) => batch.delete(doc(db, "listaSpesa", l.id)));
    await batch.commit();
    setConferma(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-2xl font-bold">Lista spesa</h1>
        {lista.length > 0 && (
          <button
            onClick={svuota}
            className={`text-sm font-semibold px-3 py-1.5 rounded-full ${
              conferma ? "bg-red-500 text-white" : "text-red-400"
            }`}
          >
            {conferma ? "Sicuro? Tocca ancora" : "Svuota lista"}
          </button>
        )}
      </div>

      <form onSubmit={aggiungi} className="flex gap-2">
        <input
          value={item}
          onChange={(e) => setItem(e.target.value)}
          placeholder="Cosa serve? (es. latte)"
          enterKeyHint="done"
          className="campo flex-1"
        />
        <button type="submit" className="btn-primario px-5">+</button>
      </form>

      {lista.length === 0 ? (
        <div className="card text-center text-slate-400 py-10">La lista è vuota 🎉</div>
      ) : (
        <div className="card p-0 divide-y divide-slate-800">
          {lista.map((l) => (
            <div key={l.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex-1 min-w-0">
                <span className="block truncate">{l.nome}</span>
                <span className="block text-xs text-slate-500">{nomeUtente(l.user)}</span>
              </span>
              <button
                onClick={() => elimina(l.id)}
                aria-label={"Togli " + l.nome}
                className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 active:bg-red-500/20 active:text-red-400"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
