// Cose da fare ricorrenti ("ogni 2 mesi controllare la pressione della caldaia").
// Funzioni pure sulle date "AAAA-MM-GG", usate sia dall'app sia dal server delle notifiche.
//
// Firestore "scadenze", un documento per cosa:
//   { titolo, nota?, ogni: 2, unita: "giorni" | "settimane" | "mesi",
//     ultimaVolta: "2026-11-17", prossima: "2027-01-17",
//     avvisata?: "2027-01-17"   // per quale scadenza è già partita la notifica
//     user, creato }

export const unita = [
  { id: "giorni", singolare: "giorno", plurale: "giorni" },
  { id: "settimane", singolare: "settimana", plurale: "settimane" },
  { id: "mesi", singolare: "mese", plurale: "mesi" }
];

const daStringa = (g) => {
  const [y, m, d] = g.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const aStringa = (d) => d.toISOString().slice(0, 10);

/** Aggiunge "n giorni/settimane/mesi" a una data. Coi mesi, il 31 diventa l'ultimo giorno del mese. */
export function aggiungi(giorno, n, u) {
  const d = daStringa(giorno);
  const q = Math.max(1, Number(n) || 1);
  if (u === "mesi") {
    const g = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + q);
    const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(g, ultimo));
  } else {
    d.setUTCDate(d.getUTCDate() + q * (u === "settimane" ? 7 : 1));
  }
  return aStringa(d);
}

/** Quanti giorni da "a" a "b" (positivo se b è dopo a). */
export const giorniTra = (a, b) => Math.round((daStringa(b) - daStringa(a)) / 86400000);

/** "ogni 2 mesi", "ogni giorno", "ogni 3 settimane" */
export function descriviOgni(n, u) {
  const info = unita.find((x) => x.id === u) || unita[0];
  const q = Number(n) || 1;
  return q === 1 ? `ogni ${info.singolare}` : `ogni ${q} ${info.plurale}`;
}

/** "tra 5 giorni", "oggi", "scaduta da 3 giorni" */
export function descriviQuando(oggi, prossima) {
  const d = giorniTra(oggi, prossima);
  if (d === 0) return "oggi";
  if (d === 1) return "domani";
  if (d > 1) return `tra ${d} giorni`;
  if (d === -1) return "scaduta ieri";
  return `scaduta da ${-d} giorni`;
}
