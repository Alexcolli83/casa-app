"use client";

import { useEffect, useRef, useState } from "react";
import { addDoc, arrayUnion, collection, deleteDoc, doc, increment, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/firebase";
import { nomeUtente, perInputData } from "@/lib/casa";
import {
  chiediCucina,
  dataDoc,
  fmtCosto,
  fmtMinuti,
  nomeMeseIt,
  sporcoLabel,
  stagioneDi
} from "@/lib/cucina";

const pulito = (x) => JSON.parse(JSON.stringify(x ?? null));
const fmtData = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric" });

/** Pagina a tutto schermo di una ricetta: completa, chef in chat, salvataggio nel ricettario. */
export default function RicettaView({ proposta, salvata, filtri, ricette, onSalvata, onChiudi }) {
  const [completa, setCompleta] = useState(salvata?.completa || null);
  const [fonti, setFonti] = useState(salvata?.fonti || []);
  const [fontiViste, setFontiViste] = useState([]);
  const [livello, setLivello] = useState(1);
  const [carico, setCarico] = useState(false);
  const [errore, setErrore] = useState("");
  const [salvaAperto, setSalvaAperto] = useState(false);
  const [settimanaAperta, setSettimanaAperta] = useState(false);
  const [messaIn, setMessaIn] = useState("");
  const partito = useRef(false);

  const titolo = salvata?.titolo || completa?.titolo || proposta?.titolo;

  // note dello chef sulle volte precedenti di questa stessa ricetta
  const precedente = salvata || ricette.find((r) => r.titolo?.toLowerCase() === proposta?.titolo?.toLowerCase());
  const noteChef = (precedente?.note || []).map((n) => n.testo).join(" / ");

  const approfondisci = async (piu = false) => {
    setCarico(true);
    setErrore("");
    const nuovoLivello = piu ? livello + 1 : livello;
    const viste = piu ? [...fontiViste, ...fonti.map((f) => f.titolo)] : fontiViste;
    try {
      const j = await chiediCucina("approfondisci", {
        proposta,
        livello: nuovoLivello,
        fontiViste: viste,
        noteChef,
        persone: filtri?.persone || 2
      });
      setCompleta(j.ricetta);
      setFonti(j.fonti || []);
      setLivello(nuovoLivello);
      setFontiViste(viste);
      if (salvata) {
        await updateDoc(doc(db, "ricette", salvata.id), { completa: pulito(j.ricetta), fonti: pulito(j.fonti || []) });
      }
    } catch (e) {
      setErrore(e.message);
    } finally {
      setCarico(false);
    }
  };

  useEffect(() => {
    // appena scegli una proposta nuova, vado a cercare la versione completa
    if (!partito.current && !completa) {
      partito.current = true;
      approfondisci(false);
    }
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const r = completa || {};
  const p = proposta || {};

  return (
    <div className="fixed inset-0 z-50 bg-[#0b0f17] overflow-y-auto overscroll-contain">
      <header className="sticky top-0 z-10 bg-[#0b0f17]/90 backdrop-blur safe-top">
        <div className="max-w-lg mx-auto flex items-center gap-3 px-4 py-3">
          <button onClick={onChiudi} className="btn-tondo shrink-0" aria-label="Indietro">‹</button>
          <div className="font-bold truncate">{titolo}</div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pb-16 space-y-4">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400 px-1">
          <span>⏱ {fmtMinuti(r.tempoMinuti || p.tempoMinuti || salvata?.tempoMinuti)}</span>
          <span>💶 {fmtCosto(r.costoEuro ?? p.costoEuro ?? salvata?.costoEuro)}</span>
          <span>{sporcoLabel(r.padelle || p.padelle || salvata?.padelle)}</span>
          {r.porzioni && <span>🍽 {r.porzioni} porzioni</span>}
        </div>

        <button
          onClick={() => setSettimanaAperta(true)}
          className="w-full rounded-2xl border border-cyan-400/50 text-cyan-300 py-2.5 text-sm"
        >
          {messaIn ? `📅 Messa in settimana: ${messaIn} ✓` : "📅 Mettila in settimana"}
        </button>

        {salvata && <StoriaSalvata r={salvata} />}

        {errore && (
          <div className="card border-red-500/50 text-red-300 text-sm space-y-2">
            <div>{errore}</div>
            <button onClick={() => approfondisci(false)} className="text-cyan-400">Riprova</button>
          </div>
        )}

        {carico && !completa && (
          <div className="card text-center py-10 text-slate-400">
            <div className="text-4xl animate-pulse mb-2">📖</div>
            Cerco la versione completa sui siti di cucina…
          </div>
        )}

        {!completa && !carico && p.passaggi?.length > 0 && (
          <div className="card text-sm space-y-2">
            <div className="titolo-card">Riassunto</div>
            <ol className="list-decimal pl-5 space-y-1 text-slate-300">
              {p.passaggi.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>
        )}

        {completa && (
          <>
            <section className="card">
              <div className="titolo-card">Ingredienti</div>
              <ul className="divide-y divide-slate-800 text-sm">
                {(r.ingredienti || []).map((g, i) => (
                  <li key={i} className="flex justify-between gap-3 py-1.5">
                    <span>{g.nome || g}</span>
                    <span className="text-slate-400 text-right">{g.quantita}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="card">
              <div className="titolo-card">Preparazione</div>
              <ol className="space-y-3 text-sm">
                {(r.passaggi || []).map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="w-6 h-6 shrink-0 rounded-full bg-cyan-400/15 text-cyan-300 text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="text-slate-200">
                      {s.testo || s}
                      {s.minuti ? <span className="text-slate-500"> · {s.minuti} min</span> : null}
                    </span>
                  </li>
                ))}
              </ol>
            </section>

            {(r.origine || p.origine) && (
              <section className="card text-sm">
                <div className="titolo-card">📍 Da dove viene</div>
                <p className="text-slate-300">{r.origine || [p.origine, p.tipologia].filter(Boolean).join(" · ")}</p>
              </section>
            )}

            <Elenco titolo="🔪 Trucchi del mestiere" voci={r.trucchi} />
            <Elenco titolo="⚠️ Errori da evitare" voci={r.errori} />
            <Elenco titolo="🔁 Varianti e sostituzioni" voci={r.varianti} />
            {r.abbinamento && (
              <div className="card text-sm">
                <span className="font-semibold">🍷 Abbinamento:</span> {r.abbinamento}
              </div>
            )}

            {fonti.length > 0 && (
              <section className="card text-sm">
                <div className="titolo-card">Fonti da cui ho preso spunto</div>
                <ul className="space-y-1.5">
                  {fonti.map((f) => (
                    <li key={f.url}>
                      <a href={f.url} target="_blank" rel="noreferrer" className="text-cyan-400 underline underline-offset-2 break-words">
                        {f.titolo}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <button
              onClick={() => approfondisci(true)}
              disabled={carico}
              className="w-full rounded-2xl border border-slate-700 py-3 text-sm disabled:opacity-60"
            >
              {carico ? "Cerco ancora… 🔎" : "🤨 Non mi basta, cerca più a fondo (alta cucina)"}
            </button>
          </>
        )}

        <Chef ricetta={completa || proposta} noteChef={noteChef} />

        {!salvata && (
          <button onClick={() => setSalvaAperto(true)} className="btn-primario w-full text-lg">
            ✅ L&apos;ho fatta! Salva nel ricettario
          </button>
        )}

        {salvata && (
          <button
            onClick={async () => {
              if (!confirm("Tolgo questa ricetta dal ricettario?")) return;
              await deleteDoc(doc(db, "ricette", salvata.id));
              onChiudi();
            }}
            className="w-full text-sm text-red-400 py-2"
          >
            Togli dal ricettario
          </button>
        )}
      </main>

      {settimanaAperta && (
        <SettimanaSheet
          titolo={titolo}
          onChiudi={() => setSettimanaAperta(false)}
          onMessa={(giorno) => {
            setMessaIn(giorno);
            setSettimanaAperta(false);
          }}
        />
      )}

      {salvaAperto && (
        <SalvaSheet
          proposta={p}
          completa={completa}
          fonti={fonti}
          filtri={filtri}
          onChiudi={() => setSalvaAperto(false)}
          onSalvata={(nuova) => {
            setSalvaAperto(false);
            onSalvata(nuova);
          }}
        />
      )}
    </div>
  );
}

const fmtGiornoSett = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "short" });

/** Pannello: scegli in quale dei prossimi 7 giorni mettere la ricetta (scheda Cene). */
function SettimanaSheet({ titolo, onChiudi, onMessa }) {
  const [cene, setCene] = useState({});
  const [scelto, setScelto] = useState(null);

  const giorni = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  useEffect(
    () =>
      onSnapshot(collection(db, "cene"), (snap) => {
        const m = {};
        snap.docs.forEach((d) => (m[d.id] = d.data().testo || ""));
        setCene(m);
      }),
    []
  );

  const metti = async (d, modo) => {
    const k = perInputData(d);
    const prima = (cene[k] || "").trim();
    const testo = modo === "aggiungi" && prima ? `${prima} + ${titolo}` : titolo;
    await setDoc(doc(db, "cene", k), { testo, user: auth.currentUser.email, aggiornato: new Date() });
    const nome = fmtGiornoSett.format(d).split(" ")[0];
    onMessa(nome);
  };

  return (
    <div className="fixed inset-0 z-[60]">
      <div onClick={onChiudi} className="absolute inset-0 bg-black/60" />
      <div className="absolute inset-x-0 bottom-0 max-w-lg mx-auto bg-[#151b26] rounded-t-3xl px-5 pt-3 safe-bottom-sheet space-y-3">
        <div className="w-10 h-1.5 bg-slate-600 rounded-full mx-auto" />
        <h2 className="text-lg font-bold">In che giorno?</h2>
        <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
          {giorni.map((d, i) => {
            const k = perInputData(d);
            const gia = (cene[k] || "").trim();
            const aperto = scelto === k;
            return (
              <div key={k} className={`rounded-2xl border px-3 py-2.5 ${aperto ? "border-cyan-400/60" : "border-slate-800"}`}>
                <button
                  onClick={() => (gia ? setScelto(aperto ? null : k) : metti(d, "sostituisci"))}
                  className="w-full flex items-center justify-between gap-3 text-left"
                >
                  <span className="font-semibold capitalize text-sm">
                    {i === 0 ? "Stasera" : i === 1 ? "Domani" : fmtGiornoSett.format(d)}
                  </span>
                  <span className={`text-xs truncate ${gia ? "text-slate-400" : "text-slate-600"}`}>{gia || "libero"}</span>
                </button>
                {aperto && (
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => metti(d, "sostituisci")} className="flex-1 rounded-xl border border-slate-700 py-2 text-sm">
                      Sostituisci
                    </button>
                    <button onClick={() => metti(d, "aggiungi")} className="flex-1 btn-primario py-2 text-sm">
                      Aggiungi
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Elenco({ titolo, voci }) {
  if (!voci?.length) return null;
  return (
    <section className="card text-sm">
      <div className="titolo-card">{titolo}</div>
      <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
        {voci.map((v, i) => (
          <li key={i}>{v}</li>
        ))}
      </ul>
    </section>
  );
}

/** Lo chef in chat, accanto ai fornelli. */
function Chef({ ricetta, noteChef }) {
  const [messaggi, setMessaggi] = useState([]);
  const [testo, setTesto] = useState("");
  const [carico, setCarico] = useState(false);
  const fine = useRef(null);

  const manda = async (e) => {
    e?.preventDefault();
    const t = testo.trim();
    if (!t || carico) return;
    const nuovi = [...messaggi, { ruolo: "io", testo: t }];
    setMessaggi(nuovi);
    setTesto("");
    setCarico(true);
    try {
      const j = await chiediCucina("chiedi", { ricetta, messaggi: nuovi, noteChef });
      setMessaggi([...nuovi, { ruolo: "chef", testo: j.risposta }]);
    } catch (err) {
      setMessaggi([...nuovi, { ruolo: "chef", testo: "⚠️ " + err.message }]);
    } finally {
      setCarico(false);
      setTimeout(() => fine.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 50);
    }
  };

  const spunti = ["Fuoco alto o medio?", "Non ho un ingrediente, con cosa lo cambio?", "Come capisco che è pronto?"];

  return (
    <section className="card space-y-3">
      <div className="titolo-card mb-0">👨‍🍳 Chiedi allo chef</div>
      {messaggi.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {spunti.map((s) => (
            <button key={s} onClick={() => setTesto(s)} className="chip text-xs">
              {s}
            </button>
          ))}
        </div>
      )}
      <div className="space-y-2">
        {messaggi.map((m, i) => (
          <div
            key={i}
            className={`text-sm rounded-2xl px-3 py-2 whitespace-pre-wrap ${
              m.ruolo === "io" ? "bg-cyan-400/15 text-cyan-100 ml-8" : "bg-[#0b0f17] border border-slate-800 mr-4"
            }`}
          >
            {m.testo}
          </div>
        ))}
        {carico && <div className="text-sm text-slate-500 animate-pulse">Lo chef risponde…</div>}
        <div ref={fine} />
      </div>
      <form onSubmit={manda} className="flex gap-2">
        <input
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          placeholder="Es. posso usare la panna al posto…"
          className="campo flex-1 py-2.5"
          enterKeyHint="send"
        />
        <button disabled={carico} className="btn-primario px-4 py-2.5 disabled:opacity-60">➤</button>
      </form>
    </section>
  );
}

/** Pannello per salvare: nota dello chef, voto, tempo reale, quanto ha sporcato. */
function SalvaSheet({ proposta, completa, fonti, filtri, onChiudi, onSalvata }) {
  const r = completa || {};
  const [nota, setNota] = useState("");
  const [voto, setVoto] = useState(0);
  const [tempo, setTempo] = useState(String(r.tempoMinuti || proposta.tempoMinuti || ""));
  const [padelle, setPadelle] = useState(Number(r.padelle || proposta.padelle) || 1);
  const [salvo, setSalvo] = useState(false);
  const [errore, setErrore] = useState("");

  const salva = async () => {
    setSalvo(true);
    setErrore("");
    const ora = new Date();
    const user = auth.currentUser.email;
    const dati = {
      ...pulito({
        titolo: r.titolo || proposta.titolo,
        descrizione: proposta.descrizione || "",
        proposta,
        completa,
        fonti,
        tempoMinuti: Number(tempo) || r.tempoMinuti || proposta.tempoMinuti || null,
        padelle,
        costoEuro: r.costoEuro ?? proposta.costoEuro ?? null,
        umori: filtri?.umori || [],
        tag: [...(filtri?.basi || []), ...(filtri?.tipi || []), ...(filtri?.verdure || [])],
        stagioni: [stagioneDi(ora)],
        mesi: [nomeMeseIt(ora)],
        voto: voto || null,
        volte: 1,
        user
      }),
      fattaIl: ora,
      ultimaVolta: ora,
      note: nota.trim() ? [{ testo: nota.trim(), user, data: ora }] : []
    };
    try {
      const ref = await addDoc(collection(db, "ricette"), dati);
      onSalvata({ id: ref.id, ...dati });
    } catch (e) {
      setErrore("Non riesco a salvare (" + (e.code || e.message) + ").");
      setSalvo(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60]">
      <div onClick={onChiudi} className="absolute inset-0 bg-black/60" />
      <div className="absolute inset-x-0 bottom-0 max-w-lg mx-auto bg-[#151b26] rounded-t-3xl px-5 pt-3 safe-bottom-sheet space-y-4">
        <div className="w-10 h-1.5 bg-slate-600 rounded-full mx-auto" />
        <h2 className="text-xl font-bold">Com&apos;è venuta?</h2>

        <div className="flex gap-1 text-3xl">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setVoto(n)} className={n <= voto ? "" : "grayscale opacity-30"}>
              ⭐
            </button>
          ))}
        </div>

        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={3}
          placeholder="Il tocco dello chef: cosa hai cambiato, cosa rifaresti diverso…"
          className="campo resize-none"
        />

        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm text-slate-400">
            Tempo reale (min)
            <input value={tempo} onChange={(e) => setTempo(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="campo mt-1" />
          </label>
          <div className="text-sm text-slate-400">
            Pentole sporcate
            <div className="flex items-center gap-3 mt-2">
              <button className="btn-tondo w-9 h-9 text-xl" onClick={() => setPadelle((x) => Math.max(1, x - 1))}>−</button>
              <span className="font-bold text-white">{padelle}</span>
              <button className="btn-tondo w-9 h-9 text-xl" onClick={() => setPadelle((x) => Math.min(9, x + 1))}>+</button>
            </div>
          </div>
        </div>

        {errore && <div className="text-sm text-red-300">{errore}</div>}

        <button onClick={salva} disabled={salvo} className="btn-primario w-full disabled:opacity-60">
          {salvo ? "Salvo…" : "Salva nel ricettario"}
        </button>
      </div>
    </div>
  );
}

/** Per una ricetta già nel ricettario: quando l'avete fatta, voto e note, più "l'ho rifatta". */
function StoriaSalvata({ r }) {
  const [nota, setNota] = useState("");
  const ref = doc(db, "ricette", r.id);
  const ultima = dataDoc(r.ultimaVolta || r.fattaIl);

  const aggiungiNota = async (e) => {
    e.preventDefault();
    const t = nota.trim();
    if (!t) return;
    setNota("");
    await updateDoc(ref, { note: arrayUnion({ testo: t, user: auth.currentUser.email, data: new Date() }) });
  };

  const rifatta = async () => {
    const ora = new Date();
    await updateDoc(ref, {
      volte: increment(1),
      ultimaVolta: ora,
      stagioni: arrayUnion(stagioneDi(ora)),
      mesi: arrayUnion(nomeMeseIt(ora))
    });
  };

  return (
    <section className="card space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <div className="text-slate-400">
          Fatta {r.volte > 1 ? `${r.volte} volte` : "una volta"}
          {ultima && <> · ultima il {fmtData.format(ultima)}</>}
        </div>
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => updateDoc(ref, { voto: n })} className={n <= (r.voto || 0) ? "" : "grayscale opacity-30"}>
              ⭐
            </button>
          ))}
        </div>
      </div>

      {(r.note || []).length > 0 && (
        <ul className="space-y-2">
          {r.note.map((n, i) => (
            <li key={i} className="rounded-2xl bg-[#0b0f17] border border-slate-800 px-3 py-2">
              <div>{n.testo}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {nomeUtente(n.user)}
                {dataDoc(n.data) && " · " + fmtData.format(dataDoc(n.data))}
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={aggiungiNota} className="flex gap-2">
        <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Aggiungi un tocco dello chef…" className="campo flex-1 py-2" />
        <button className="btn-primario px-4 py-2">+</button>
      </form>
      <button onClick={rifatta} className="w-full rounded-2xl border border-slate-700 py-2.5">🔁 L&apos;ho rifatta oggi</button>
    </section>
  );
}
