"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/firebase";
import { allowedUsers, chiaveMese, nomeUtente } from "@/lib/casa";
import { useCasaData } from "@/lib/useCasaData";
import Login from "@/components/Login";
import MeseView from "@/components/MeseView";
import StoricoView from "@/components/StoricoView";
import CategorieView from "@/components/CategorieView";
import ListaView from "@/components/ListaView";
import SpesaSheet from "@/components/SpesaSheet";
import CalendarioView from "@/components/CalendarioView";
import CucinaView from "@/components/cucina/CucinaView";
import Campanella from "@/components/Campanella";

const schede = [
  { id: "spese", label: "Spese", icona: "💶" },
  { id: "calendario", label: "Calendario", icona: "📅" },
  { id: "cene", label: "Cene", icona: "🍝" },
  { id: "lista", label: "Lista", icona: "🛒" }
];

// Le tre viste delle spese, scelte dal selettore in alto
const visteSpese = [
  { id: "mese", label: "Mese" },
  { id: "storico", label: "Storico" },
  { id: "categorie", label: "Categorie" }
];

export default function Home() {
  const [stato, setStato] = useState("carico"); // carico | fuori | negato | dentro
  const [user, setUser] = useState(null);
  const [scheda, setScheda] = useState("spese");
  const [vista, setVista] = useState("mese");
  const [meseKey, setMeseKey] = useState(() => chiaveMese(new Date()));
  const [sheet, setSheet] = useState({ aperto: false, spesa: null });
  const [giornoScelto, setGiornoScelto] = useState(null);

  const { spese, lista, pronto } = useCasaData(user);

  useEffect(() => {
    // Apertura diretta da scorciatoia ("Aggiungi spesa" tenendo premuta l'icona)
    const azione = new URLSearchParams(window.location.search).get("azione");
    return onAuthStateChanged(auth, (u) => {
      if (u && allowedUsers.includes(u.email)) {
        setUser(u);
        setStato("dentro");
        if (azione === "nuova") setSheet({ aperto: true, spesa: null });
        if (azione === "lista") setScheda("lista");
      } else {
        setUser(null);
        setStato(u ? "negato" : "fuori");
      }
    });
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [scheda, vista]);

  if (stato === "carico") {
    return <div className="min-h-dvh flex items-center justify-center text-5xl animate-pulse">🏠</div>;
  }
  if (stato !== "dentro") return <Login nonAutorizzato={stato === "negato"} />;

  const meseCorrente = chiaveMese(new Date());
  const dataNuova =
    giornoScelto ||
    (meseKey === meseCorrente
      ? new Date()
      : (() => {
          const [y, m] = meseKey.split("-").map(Number);
          return new Date(y, m, 0); // ultimo giorno del mese che stai guardando
        })());

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 bg-[#0b0f17]/85 backdrop-blur safe-top">
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-3">
          <span className="font-bold">🏠 Casa App</span>
          <div className="flex items-center gap-4">
          <Campanella />
          <button
            onClick={() => confirm("Vuoi uscire?") && signOut(auth)}
            className="text-sm text-slate-400 flex items-center gap-2"
          >
            {nomeUtente(user.email)}
            <span className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold">
              {nomeUtente(user.email).charAt(0)}
            </span>
          </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-2 pb-40">
        {scheda === "spese" && (
          <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-[#121824] border border-slate-800/80 mb-4">
            {visteSpese.map((v) => (
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
        )}

        {scheda === "calendario" ? (
          <CalendarioView />
        ) : scheda === "cene" ? (
          <CucinaView />
        ) : scheda === "lista" ? (
          <ListaView lista={lista} />
        ) : !pronto ? (
          <div className="text-center text-slate-400 py-20">Carico le spese…</div>
        ) : vista === "mese" ? (
          <MeseView
            spese={spese}
            meseKey={meseKey}
            setMeseKey={setMeseKey}
            onApri={(s) => setSheet({ aperto: true, spesa: s })}
            onGiornoScelto={setGiornoScelto}
          />
        ) : vista === "storico" ? (
          <StoricoView
            spese={spese}
            onApriMese={(k) => {
              setMeseKey(k);
              setGiornoScelto(null);
              setVista("mese");
            }}
          />
        ) : (
          <CategorieView spese={spese} />
        )}
      </main>

      {scheda === "spese" && (
        <button
          onClick={() => setSheet({ aperto: true, spesa: null })}
          aria-label="Aggiungi spesa"
          className="fixed z-40 right-5 w-16 h-16 rounded-full bg-cyan-400 text-black text-4xl font-light shadow-lg shadow-cyan-500/30 flex items-center justify-center active:scale-95 transition fab-pos"
        >
          +
        </button>
      )}

      <nav className="fixed bottom-0 inset-x-0 z-40 bg-[#0f141d]/95 backdrop-blur border-t border-slate-800 safe-bottom">
        <div className="max-w-lg mx-auto grid grid-cols-4">
          {schede.map((s) => (
            <button
              key={s.id}
              onClick={() => setScheda(s.id)}
              className={`relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] transition ${
                scheda === s.id ? "text-cyan-300" : "text-slate-500"
              }`}
            >
              <span className={`text-xl transition ${scheda === s.id ? "" : "grayscale opacity-70"}`}>{s.icona}</span>
              {s.label}
              {s.id === "lista" && lista.length > 0 && (
                <span className="absolute top-1.5 left-1/2 ml-2 bg-red-500 text-white text-[10px] rounded-full px-1.5">
                  {lista.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      <SpesaSheet
        aperto={sheet.aperto}
        spesa={sheet.spesa}
        dataIniziale={dataNuova}
        onChiudi={() => setSheet((x) => ({ ...x, aperto: false }))}
      />
    </div>
  );
}
