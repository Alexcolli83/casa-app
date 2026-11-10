"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { auth } from "@/firebase";

// chiave pubblica delle notifiche (quella privata sta solo su Vercel)
const VAPID_PUBLIC_KEY =
  "BFLK-8pjCLOC6wNBUbj1GK1PoflG9X3vvd4HEWy8C-xD47y9pzE4AXF3g8dIx6HgFYseVr8tGg6IJM47-emrHJU";

const base64InUint8 = (b64) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

/** Chiama /api/notifiche con il "pass" Firebase. */
export async function chiamaNotifiche(dati) {
  const u = auth.currentUser;
  if (!u) return null;
  const token = await u.getIdToken();
  const r = await fetch("/api/notifiche", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify(dati)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.errore || "Errore " + r.status);
  return j;
}

/** Dopo aver aggiunto una spesa: avvisa l'altro (se non va, pazienza). */
export const avvisaSpesa = (id) => chiamaNotifiche({ azione: "spesa", id }).catch(() => {});

function supportate() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

const iPhoneNonInstallata = () =>
  typeof window !== "undefined" &&
  /iPhone|iPad/.test(navigator.userAgent) &&
  !window.matchMedia("(display-mode: standalone)").matches;

/** La campanella in alto: attiva/disattiva le notifiche su questo telefono, e fa le prove. */
export default function Campanella() {
  const [stato, setStato] = useState("…"); // "no" | "negate" | "attive" | "spente" | "…"
  const [aperto, setAperto] = useState(false);
  const [msg, setMsg] = useState("");
  const [lavoro, setLavoro] = useState(false);

  useEffect(() => {
    (async () => {
      if (!supportate()) return setStato("no");
      if (Notification.permission === "denied") return setStato("negate");
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg && (await reg.pushManager.getSubscription());
      setStato(sub ? "attive" : "spente");
    })().catch(() => setStato("spente"));
  }, []);

  const attiva = async () => {
    setLavoro(true);
    setMsg("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStato(perm === "denied" ? "negate" : "spente");
        throw new Error("Permesso non dato.");
      }
      const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64InUint8(VAPID_PUBLIC_KEY) }));
      await chiamaNotifiche({ azione: "iscrivi", sub: sub.toJSON() });
      setStato("attive");
      setMsg("Fatto! Prova con i bottoni qui sotto.");
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLavoro(false);
    }
  };

  const spegni = async () => {
    setLavoro(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg && (await reg.pushManager.getSubscription());
      if (sub) {
        await chiamaNotifiche({ azione: "disiscrivi", endpoint: sub.endpoint }).catch(() => {});
        await sub.unsubscribe();
      }
      setStato("spente");
      setMsg("Notifiche spente su questo telefono.");
    } finally {
      setLavoro(false);
    }
  };

  const prova = async (dati, okMsg) => {
    setLavoro(true);
    setMsg("");
    try {
      const j = await chiamaNotifiche(dati);
      if (j?.niente) setMsg("Niente da notificare (nessuna cena/impegno segnato).");
      else if (j?.partite) setMsg(okMsg);
      else if (j?.errori?.length) setMsg("Google ha rifiutato l'invio: " + j.errori.join(" | "));
      else setMsg(`Nessun telefono iscritto (${j?.iscritti ?? 0} trovati): spegni e riattiva le notifiche.`);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLavoro(false);
    }
  };

  return (
    <>
      <button onClick={() => setAperto(true)} className="text-lg relative" aria-label="Notifiche">
        🔔
        {stato === "attive" && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400" />}
      </button>

      {aperto &&
        createPortal(
        <div className="fixed inset-0 z-[70]">
          <div onClick={() => setAperto(false)} className="absolute inset-0 bg-black/60" />
          <div className="absolute inset-x-0 bottom-0 max-w-lg mx-auto bg-[#151b26] rounded-t-3xl px-5 pt-3 safe-bottom-sheet space-y-4">
            <div className="w-10 h-1.5 bg-slate-600 rounded-full mx-auto" />
            <h2 className="text-xl font-bold">🔔 Notifiche</h2>
            <ul className="text-sm text-slate-300 space-y-1">
              <li>🍝 Alle 14: cosa si mangia stasera (se segnato)</li>
              <li>📅 Alle 19: impegni e turni di domani</li>
              <li>💸 Subito: quando l&apos;altro aggiunge una spesa</li>
            </ul>
            <p className="text-xs text-slate-500">Gli orari possono slittare fino a un&apos;ora (piano gratuito).</p>

            {stato === "no" && (
              <div className="text-sm text-amber-300">
                {iPhoneNonInstallata()
                  ? "Su iPhone le notifiche funzionano solo con l'app aggiunta alla schermata Home (e iOS 16.4 o più recente). Aprila da lì."
                  : "Questo telefono/browser non supporta le notifiche."}
              </div>
            )}
            {stato === "negate" && (
              <div className="text-sm text-amber-300">
                Le notifiche sono bloccate. Riattivale dalle impostazioni del telefono (Notifiche → Casa App), poi riapri l&apos;app.
              </div>
            )}

            {stato === "spente" && (
              <button onClick={attiva} disabled={lavoro} className="btn-primario w-full disabled:opacity-60">
                {lavoro ? "Attivo…" : "Attiva le notifiche su questo telefono"}
              </button>
            )}

            {stato === "attive" && (
              <div className="space-y-2">
                <div className="text-sm text-emerald-300">✓ Attive su questo telefono</div>
                <div className="grid grid-cols-3 gap-2">
                  <button disabled={lavoro} onClick={() => prova({ azione: "prova" }, "Inviata: controlla le notifiche!")} className="rounded-xl border border-slate-700 py-2 text-xs">
                    Prova
                  </button>
                  <button disabled={lavoro} onClick={() => prova({ azione: "provaPromemoria", tipo: "cena" }, "Promemoria cena inviato.")} className="rounded-xl border border-slate-700 py-2 text-xs">
                    Prova cena
                  </button>
                  <button disabled={lavoro} onClick={() => prova({ azione: "provaPromemoria", tipo: "impegni" }, "Promemoria impegni inviato.")} className="rounded-xl border border-slate-700 py-2 text-xs">
                    Prova domani
                  </button>
                </div>
                <button onClick={spegni} disabled={lavoro} className="w-full text-xs text-slate-500 py-1">
                  Spegni su questo telefono
                </button>
              </div>
            )}

            {msg && <div className="text-sm text-slate-300">{msg}</div>}
          </div>
        </div>,
          document.body
        )}
    </>
  );
}
