"use client";

import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { auth, db } from "@/firebase";
import { nomeUtente, perInputData } from "@/lib/casa";
import { aggiungi, descriviOgni, descriviQuando, giorniTra, unita } from "@/lib/scadenze";

const fmtData = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric" });
const dataBella = (g) => {
  const [y, m, d] = g.split("-").map(Number);
  return fmtData.format(new Date(y, m - 1, d));
};

/** Colore in base a quanto manca: rosso scaduta, giallo entro 7 giorni, grigio più avanti. */
const coloreScadenza = (giorni) => (giorni <= 0 ? "#f87171" : giorni <= 7 ? "#fbbf24" : "#64748b");

/**
 * Pagina "Da fare": cose che tornano ogni tot giorni/settimane/mesi.
 * Quando arriva la scadenza parte una notifica a tutti e due (vedi /api/notifiche, tipo=scadenze).
 */
export default function ScadenzeView() {
  const oggi = perInputData(new Date());
  const [voci, setVoci] = useState(null);
  const [form, setForm] = useState(null); // null | "nuova" | voce da modificare

  useEffect(
    () =>
      onSnapshot(collection(db, "scadenze"), (snap) =>
        setVoci(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
    []
  );

  const ordinate = useMemo(
    () => [...(voci || [])].sort((a, b) => (a.prossima || "").localeCompare(b.prossima || "")),
    [voci]
  );
  const scadute = ordinate.filter((v) => giorniTra(oggi, v.prossima) <= 0).length;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between px-1">
        <div>
          <h1 className="text-2xl font-bold">Da fare</h1>
          <p className="text-sm text-slate-400">
            {voci === null
              ? "Carico…"
              : voci.length
                ? scadute
                  ? `${scadute} da fare adesso`
                  : "Tutto in regola 👍"
                : "Le cose che tornano ogni tot tempo."}
          </p>
        </div>
        {!form && (
          <button onClick={() => setForm("nuova")} className="btn-primario px-4 py-2 text-sm">
            + Aggiungi
          </button>
        )}
      </div>

      {form && (
        <Modulo
          voce={form === "nuova" ? null : form}
          oggi={oggi}
          onFatto={() => setForm(null)}
        />
      )}

      {voci !== null && voci.length === 0 && !form && (
        <div className="card text-center text-slate-400 text-sm py-8 space-y-2">
          <div className="text-3xl">🔁</div>
          <div>
            Esempi: <i>controllare la pressione della caldaia ogni 2 mesi</i>, <i>cambiare il filtro della cappa ogni 6 mesi</i>,{" "}
            <i>pulire i filtri del condizionatore ogni mese</i>.
          </div>
          <div>Allo scadere arriva la notifica a tutti e due.</div>
        </div>
      )}

      <div className="space-y-2">
        {ordinate.map((v) => (
          <Riga key={v.id} v={v} oggi={oggi} onModifica={() => setForm(v)} />
        ))}
      </div>
    </div>
  );
}

function Riga({ v, oggi, onModifica }) {
  const [conferma, setConferma] = useState(false);
  const mancano = giorniTra(oggi, v.prossima);
  const colore = coloreScadenza(mancano);

  const fatto = async () => {
    await updateDoc(doc(db, "scadenze", v.id), {
      ultimaVolta: oggi,
      prossima: aggiungi(oggi, v.ogni, v.unita),
      avvisata: null,
      fattoDa: auth.currentUser.email
    });
  };

  return (
    <div className="card p-3.5 space-y-2.5" style={{ borderColor: mancano <= 0 ? "#f8717166" : undefined }}>
      <button onClick={onModifica} className="w-full text-left flex items-start gap-3">
        <span className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" style={{ background: colore }} />
        <span className="flex-1 min-w-0">
          <span className="block font-semibold leading-tight">{v.titolo}</span>
          {v.nota && <span className="block text-xs text-slate-400 mt-0.5">{v.nota}</span>}
          <span className="block text-xs text-slate-500 mt-1">
            {descriviOgni(v.ogni, v.unita)} · ultima volta {dataBella(v.ultimaVolta)}
            {v.fattoDa ? ` (${nomeUtente(v.fattoDa)})` : ""}
          </span>
        </span>
        <span className="text-right shrink-0">
          <span className="block text-sm font-semibold" style={{ color: colore }}>
            {descriviQuando(oggi, v.prossima)}
          </span>
          <span className="block text-[11px] text-slate-500">{dataBella(v.prossima)}</span>
        </span>
      </button>
      <div className="flex gap-2">
        <button
          onClick={fatto}
          className={`flex-1 rounded-xl py-2 text-sm ${mancano <= 7 ? "btn-primario" : "border border-slate-700 text-slate-300"}`}
        >
          ✓ Fatto oggi
        </button>
        <button
          onClick={() => {
            if (!conferma) {
              setConferma(true);
              setTimeout(() => setConferma(false), 2500);
            } else deleteDoc(doc(db, "scadenze", v.id));
          }}
          className={`rounded-xl px-3 text-sm ${conferma ? "bg-red-500 text-white" : "border border-slate-700 text-slate-400"}`}
        >
          {conferma ? "Elimina" : "✕"}
        </button>
      </div>
    </div>
  );
}

function Modulo({ voce, oggi, onFatto }) {
  const [titolo, setTitolo] = useState(voce?.titolo || "");
  const [nota, setNota] = useState(voce?.nota || "");
  const [ogni, setOgni] = useState(String(voce?.ogni || 1));
  const [u, setU] = useState(voce?.unita || "mesi");
  const [ultima, setUltima] = useState(voce?.ultimaVolta || oggi);
  const valido = titolo.trim() && Number(ogni) >= 1 && ultima;
  const prossima = valido ? aggiungi(ultima, ogni, u) : null;

  const salva = async (e) => {
    e.preventDefault();
    if (!valido) return;
    const dati = {
      titolo: titolo.trim(),
      nota: nota.trim(),
      ogni: Number(ogni),
      unita: u,
      ultimaVolta: ultima,
      prossima,
      avvisata: voce?.prossima === prossima ? voce?.avvisata || null : null
    };
    if (voce) await updateDoc(doc(db, "scadenze", voce.id), dati);
    else await addDoc(collection(db, "scadenze"), { ...dati, user: auth.currentUser.email, creato: new Date() });
    onFatto();
  };

  return (
    <form onSubmit={salva} className="card space-y-3">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold">{voce ? "Modifica" : "Nuova cosa da fare"}</h4>
        <button type="button" onClick={onFatto} className="text-sm text-slate-400">Annulla</button>
      </div>

      <input
        value={titolo}
        onChange={(e) => setTitolo(e.target.value)}
        placeholder="Cosa? (es. pressione caldaia)"
        className="campo"
        autoFocus={!voce}
      />
      <input
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        placeholder="Nota (facoltativa, es. deve stare tra 1 e 1,5 bar)"
        className="campo"
      />

      <div>
        <div className="text-xs text-slate-400 ml-1 mb-1">Ogni quanto?</div>
        <div className="flex gap-2">
          <input
            value={ogni}
            onChange={(e) => setOgni(e.target.value.replace(/\D/g, "").slice(0, 3))}
            inputMode="numeric"
            className="campo w-20 text-center"
          />
          <div className="flex-1 grid grid-cols-3 gap-1.5">
            {unita.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setU(x.id)}
                className={`rounded-xl text-sm border ${u === x.id ? "bg-cyan-400 border-cyan-400 text-black font-semibold" : "border-slate-700 text-slate-300"}`}
              >
                {x.plurale}
              </button>
            ))}
          </div>
        </div>
      </div>

      <label className="block">
        <span className="text-xs text-slate-400 ml-1">Ultima volta che l&apos;hai fatto</span>
        <input type="date" value={ultima} max={oggi} onChange={(e) => setUltima(e.target.value)} className="campo mt-1" />
      </label>

      {prossima && (
        <div className="text-sm text-slate-300 px-1">
          🔔 Prossimo avviso: <b>{dataBella(prossima)}</b> ({descriviQuando(oggi, prossima)})
        </div>
      )}

      <button type="submit" disabled={!valido} className="btn-primario w-full disabled:opacity-40">
        Salva
      </button>
    </form>
  );
}
