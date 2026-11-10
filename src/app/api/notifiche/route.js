// Notifiche di Casa App.
//
// GET  /api/notifiche?tipo=cena&ora=14      (lo chiama Vercel ogni giorno: promemoria cena di stasera)
// GET  /api/notifiche?tipo=impegni&ora=19   (promemoria impegni e turni di domani)
//   Vercel gratuito chiama "entro l'ora" e solo in ora UTC: per questo ogni promemoria ha due orari
//   in vercel.json (estate/inverno) e qui parte solo se in Italia è l'ora giusta, una volta al giorno.
//
// POST (con il "pass" Firebase dell'utente)
//   { azione: "iscrivi", sub }       questo telefono vuole le notifiche
//   { azione: "disiscrivi", endpoint }
//   { azione: "prova" }              notifica di prova a me stesso
//   { azione: "spesa", id }          ho appena aggiunto una spesa: avviso l'altro

import { allowedUsers, catInfo, euro, nomeUtente } from "@/lib/casa";
import { adminAuth, adminDb, configOk, giornoDopo, mandaA, oraRoma } from "@/lib/notificheServer";

export const dynamic = "force-dynamic";

const json = (dati, status = 200) => Response.json(dati, { status });

const turni = {
  mattina: "turno di mattina",
  pomeriggio: "turno di pomeriggio",
  notte: "turno di notte",
  riposo: "riposo",
  altro: "turno"
};

// ---------- promemoria programmati ----------

export async function GET(req) {
  const manca = configOk();
  if (manca.length) return json({ errore: "Mancano su Vercel: " + manca.join(", ") }, 500);

  // se è impostato CRON_SECRET, solo Vercel può chiamare
  if (process.env.CRON_SECRET && req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return json({ errore: "Non autorizzato." }, 401);
  }

  const url = new URL(req.url);
  return json(await promemoria(url.searchParams.get("tipo"), Number(url.searchParams.get("ora")), false));
}

/** Prepara e manda il promemoria. Con "forza" ignora ora e "già mandato" (per la prova dall'app). */
async function promemoria(tipo, oraVoluta, forza, soloA) {
  const { giorno, ora } = oraRoma();
  if (!forza && ora !== oraVoluta) return { saltato: `in Italia sono le ${ora}, non le ${oraVoluta}` };

  const db = adminDb();
  const segno = db.collection("notificheInviate").doc(`${tipo}-${giorno}`);
  if (!forza && (await segno.get()).exists) return { saltato: "già mandata oggi" };

  let messaggio = null;

  if (tipo === "cena") {
    const c = await db.collection("cene").doc(giorno).get();
    const testo = c.exists ? (c.data().testo || "").trim() : "";
    if (testo) messaggio = { titolo: "🍝 Stasera si mangia", testo, url: "/" };
  } else if (tipo === "impegni") {
    const domani = giornoDopo(giorno);
    const snap = await db.collection("calendario").where("giorno", "==", domani).get();
    const voci = snap.docs
      .map((d) => d.data())
      .sort((a, b) => (a.ora || "99").localeCompare(b.ora || "99"))
      .map((v) => {
        const cosa = v.turno ? turni[v.turno] || "turno" : "";
        const pezzi = [cosa, v.testo].filter(Boolean).join(": ");
        return `${v.chi}: ${pezzi || "impegno"}${v.ora ? ` alle ${v.ora}` : ""}`;
      });
    if (voci.length) messaggio = { titolo: "📅 Domani", testo: voci.join("\n"), url: "/" };
  } else {
    return { errore: "tipo sconosciuto" };
  }

  if (!messaggio) {
    if (!forza) await segno.set({ quando: new Date(), partite: 0, nota: "niente da dire" });
    return { niente: true };
  }

  const partite = await mandaA(soloA || allowedUsers, messaggio);
  if (!forza) await segno.set({ quando: new Date(), partite });
  return { partite, messaggio };
}

// ---------- azioni dall'app ----------

export async function POST(req) {
  const manca = configOk();
  if (manca.length) return json({ errore: "Mancano su Vercel: " + manca.join(", ") }, 500);

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  let email = null;
  try {
    email = (await adminAuth().verifyIdToken(token)).email;
  } catch {
    // token non valido
  }
  if (!email || !allowedUsers.includes(email)) return json({ errore: "Non autorizzato." }, 401);

  let b = {};
  try {
    b = await req.json();
  } catch {
    return json({ errore: "Richiesta non valida." }, 400);
  }

  const db = adminDb();
  const mio = db.collection("notifiche").doc(email);

  try {
    if (b.azione === "iscrivi") {
      if (!b.sub?.endpoint) return json({ errore: "Iscrizione non valida." }, 400);
      const snap = await mio.get();
      const subs = (snap.exists ? snap.data().subs || [] : []).filter((s) => s.endpoint !== b.sub.endpoint);
      await mio.set({ subs: [...subs, b.sub], aggiornato: new Date() }, { merge: true });
      return json({ ok: true });
    }

    if (b.azione === "disiscrivi") {
      const snap = await mio.get();
      const subs = (snap.exists ? snap.data().subs || [] : []).filter((s) => s.endpoint !== b.endpoint);
      await mio.set({ subs }, { merge: true });
      return json({ ok: true });
    }

    if (b.azione === "prova") {
      const partite = await mandaA([email], { titolo: "🔔 Casa App", testo: "Le notifiche funzionano!" });
      return json({ partite });
    }

    if (b.azione === "provaPromemoria") {
      // solo a me, subito, senza segnarlo come mandato
      return json(await promemoria(b.tipo, 0, true, [email]));
    }

    if (b.azione === "spesa") {
      const s = await db.collection("speseCasa").doc(String(b.id || "")).get();
      if (!s.exists) return json({ errore: "Spesa non trovata." }, 404);
      const d = s.data();
      if (d.user !== email) return json({ errore: "Non è una tua spesa." }, 403);
      const cat = catInfo(d.categoria);
      const altri = allowedUsers.filter((u) => u !== email);
      const partite = await mandaA(altri, {
        titolo: `💸 ${nomeUtente(email)} ha aggiunto una spesa`,
        testo: `${cat.emoji} ${cat.label}: ${euro(d.importo)}${d.nota ? ` – ${d.nota}` : ""}`,
        url: "/"
      });
      return json({ partite });
    }

    return json({ errore: "Azione sconosciuta." }, 400);
  } catch (e) {
    console.error("notifiche", b.azione, e);
    return json({ errore: "Errore: " + String(e?.message || e).slice(0, 140) }, 500);
  }
}
