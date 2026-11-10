"use client";

import { useEffect, useRef, useState } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/firebase";
import { avvisaSpesa } from "@/components/Campanella";
import {
  categorie,
  chiaveMese,
  leggiImporto,
  nomeUtente,
  perInputData
} from "@/lib/casa";

/**
 * Pannello dal basso per aggiungere o modificare una spesa.
 * spesa = null -> nuova; altrimenti modifica.
 */
export default function SpesaSheet({ aperto, spesa, dataIniziale, onChiudi }) {
  // Ogni apertura ricrea il modulo, così parte sempre con i valori giusti
  const [apertura, setApertura] = useState(0);
  const [eraAperto, setEraAperto] = useState(aperto);
  if (aperto !== eraAperto) {
    setEraAperto(aperto);
    if (aperto) setApertura((n) => n + 1);
  }

  return (
    <div
      className={`fixed inset-0 z-50 transition ${
        aperto ? "pointer-events-auto" : "pointer-events-none"
      }`}
    >
      <div
        onClick={onChiudi}
        className={`absolute inset-0 bg-black/60 transition-opacity ${
          aperto ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        className={`absolute inset-x-0 bottom-0 max-w-lg mx-auto bg-[#151b26] rounded-t-3xl px-5 pt-3 safe-bottom-sheet transition-transform duration-300 ${
          aperto ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="w-10 h-1.5 bg-slate-600 rounded-full mx-auto mb-4" />
        <Modulo
          key={apertura}
          aperto={aperto}
          spesa={spesa}
          dataIniziale={dataIniziale}
          onChiudi={onChiudi}
        />
      </div>
    </div>
  );
}

function Modulo({ aperto, spesa, dataIniziale, onChiudi }) {
  const [importo, setImporto] = useState(() =>
    spesa ? String(spesa.importo ?? "").replace(".", ",") : ""
  );
  const [categoria, setCategoria] = useState(() => spesa?.categoria || "spesa");
  const [data, setData] = useState(() =>
    perInputData(spesa ? spesa._d : dataIniziale || new Date())
  );
  const [nota, setNota] = useState(() => spesa?.nota || "");
  const [salvo, setSalvo] = useState(false);
  const [confermaElimina, setConfermaElimina] = useState(false);
  const refImporto = useRef(null);

  useEffect(() => {
    if (!aperto || spesa) return;
    const t = setTimeout(() => refImporto.current?.focus(), 250);
    return () => clearTimeout(t);
  }, [aperto, spesa]);

  const valore = leggiImporto(importo);
  const valido = valore !== null && valore > 0 && data;

  const salva = async () => {
    if (!valido || salvo) return;
    setSalvo(true);

    const [y, m, g] = data.split("-").map(Number);
    // Se la data è oggi teniamo l'ora attuale, altrimenti mezzogiorno
    const oggi = perInputData(new Date()) === data;
    const quando = oggi ? new Date() : new Date(y, m - 1, g, 12, 0, 0);

    const campi = {
      categoria,
      importo: valore,
      mese: chiaveMese(quando),
      data: quando,
      nota: nota.trim()
    };

    try {
      if (spesa) {
        // Se non è cambiato il giorno non tocchiamo l'orario originale
        if (perInputData(spesa._d) === data) {
          delete campi.data;
          delete campi.mese;
        }
        await updateDoc(doc(db, "speseCasa", spesa.id), campi);
      } else {
        const ref = await addDoc(collection(db, "speseCasa"), {
          ...campi,
          user: auth.currentUser.email
        });
        avvisaSpesa(ref.id); // notifica all'altro, senza aspettare
      }
      onChiudi();
    } catch {
      setSalvo(false);
      alert("Salvataggio non riuscito, riprova.");
    }
  };

  const elimina = async () => {
    if (!confermaElimina) return setConfermaElimina(true);
    await deleteDoc(doc(db, "speseCasa", spesa.id));
    onChiudi();
  };

  return (
    <>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {spesa ? "Modifica spesa" : "Nuova spesa"}
          </h2>
          {spesa && (
            <span className="text-xs text-slate-400">
              di {nomeUtente(spesa.user)}
            </span>
          )}
        </div>

        <div className="flex items-baseline gap-2 border-b border-slate-700 pb-2 mb-5">
          <span className="text-3xl text-slate-400">€</span>
          <input
            ref={refImporto}
            value={importo}
            onChange={(e) => setImporto(e.target.value.replace(/[^\d.,]/g, ""))}
            inputMode="decimal"
            placeholder="0,00"
            className="flex-1 bg-transparent text-4xl font-bold outline-none tabular-nums min-w-0"
          />
        </div>

        <div className="grid grid-cols-4 gap-2 mb-5">
          {categorie.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoria(c.id)}
              className={`rounded-2xl py-2.5 flex flex-col items-center gap-0.5 border transition ${
                categoria === c.id
                  ? "border-transparent text-black font-semibold"
                  : "border-slate-700 text-slate-300"
              }`}
              style={categoria === c.id ? { background: c.colore } : undefined}
            >
              <span className="text-xl">{c.emoji}</span>
              <span className="text-xs">{c.label}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <label className="block">
            <span className="text-xs text-slate-400 ml-1">Data</span>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="campo mt-1"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-400 ml-1">Nota (facoltativa)</span>
            <input
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="es. bolletta ott."
              className="campo mt-1"
            />
          </label>
        </div>

        <button
          onClick={salva}
          disabled={!valido || salvo}
          className="btn-primario w-full disabled:opacity-40"
        >
          {salvo ? "Salvo…" : spesa ? "Salva modifiche" : "Aggiungi spesa"}
        </button>

        {spesa && (
          <button
            onClick={elimina}
            className={`w-full py-3 mt-2 rounded-2xl text-sm font-semibold ${
              confermaElimina ? "bg-red-500 text-white" : "text-red-400"
            }`}
          >
            {confermaElimina ? "Tocca ancora per eliminare" : "Elimina spesa"}
          </button>
        )}
    </>
  );
}
