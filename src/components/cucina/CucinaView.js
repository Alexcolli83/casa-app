"use client";

import { useEffect, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase";
import { dataDoc, dispensaIniziale } from "@/lib/cucina";
import CeneView from "@/components/CeneView";
import IdeeView from "./IdeeView";
import RicettarioView from "./RicettarioView";
import RicettaView from "./RicettaView";

/**
 * Scheda "Cene": il calendario delle cene della settimana (come prima)
 * più le due parti nuove della cucina.
 *
 * Firestore:
 *  cucina/dispensa  { voci: [..] }                 la dispensa base, condivisa
 *  ricette/{id}     le ricette fatte, con note e voti (il ricettario)
 */

const viste = [
  { id: "settimana", label: "Settimana" },
  { id: "idee", label: "Idee" },
  { id: "ricettario", label: "Ricettario" }
];

export default function CucinaView() {
  const [vista, setVista] = useState("settimana");
  const [ricette, setRicette] = useState([]);
  const [dispensa, setDispensa] = useState(null);
  const [aperta, setAperta] = useState(null); // { proposta, salvata, filtri }

  useEffect(() => {
    const u1 = onSnapshot(collection(db, "ricette"), (snap) => {
      setRicette(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort(
            (a, b) =>
              (dataDoc(b.ultimaVolta || b.fattaIl)?.getTime() || 0) -
              (dataDoc(a.ultimaVolta || a.fattaIl)?.getTime() || 0)
          )
      );
    });
    const u2 = onSnapshot(doc(db, "cucina", "dispensa"), (d) => {
      setDispensa(d.exists() ? d.data().voci || [] : dispensaIniziale);
    });
    return () => {
      u1();
      u2();
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [vista]);

  // la ricetta salvata aperta resta aggiornata se cambia (note, voti)
  const salvataAggiornata = aperta?.salvata ? ricette.find((r) => r.id === aperta.salvata.id) || aperta.salvata : null;

  return (
    <div>
      <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-[#121824] border border-slate-800/80 mb-4">
        {viste.map((v) => (
          <button
            key={v.id}
            onClick={() => setVista(v.id)}
            className={`rounded-xl py-2 text-sm transition ${
              vista === v.id ? "bg-cyan-400 text-black font-semibold" : "text-slate-400"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {vista === "settimana" ? (
        <CeneView />
      ) : vista === "idee" ? (
        <IdeeView
          ricette={ricette}
          dispensa={dispensa || dispensaIniziale}
          onScegli={(proposta, filtri) => setAperta({ proposta, salvata: null, filtri })}
        />
      ) : (
        <RicettarioView ricette={ricette} onApri={(r) => setAperta({ proposta: r.proposta || r, salvata: r })} />
      )}

      {aperta && (
        <RicettaView
          key={aperta.salvata?.id || aperta.proposta?.titolo}
          proposta={aperta.proposta}
          salvata={salvataAggiornata}
          filtri={aperta.filtri}
          ricette={ricette}
          onSalvata={(r) => setAperta((x) => ({ ...x, salvata: r }))}
          onChiudi={() => setAperta(null)}
        />
      )}
    </div>
  );
}
