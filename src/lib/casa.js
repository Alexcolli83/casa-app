// Utenti, categorie e piccoli aiuti condivisi da tutta l'app.

export const userNames = {
  "alexcolli83@gmail.com": "Bobby",
  "alice.brogi91@gmail.com": "Alicia"
};

export const allowedUsers = Object.keys(userNames);

export const persone = [
  { nome: "Bobby", colore: "#34d399" },
  { nome: "Alicia", colore: "#fbbf24" }
];

export const categorie = [
  { id: "luce", label: "Luce", emoji: "💡", colore: "#fbbf24" },
  { id: "gas", label: "Gas", emoji: "🔥", colore: "#f87171" },
  { id: "acqua", label: "Acqua", emoji: "💧", colore: "#60a5fa" },
  { id: "telefono", label: "Telefono", emoji: "📱", colore: "#a78bfa" },
  { id: "internet", label: "Internet", emoji: "🌐", colore: "#22d3ee" },
  { id: "spesa", label: "Spesa", emoji: "🛒", colore: "#34d399" },
  { id: "altro", label: "Altro", emoji: "📦", colore: "#94a3b8" }
];

export const catInfo = (id) =>
  categorie.find((c) => c.id === id) || {
    id,
    label: id || "—",
    emoji: "📦",
    colore: "#94a3b8"
  };

export const nomeUtente = (email) => userNames[email] || email || "—";

/** Data della spesa come Date (gestisce Timestamp Firestore e vecchi record). */
export function dataSpesa(s) {
  if (s?.data?.toDate) return s.data.toDate();
  if (s?.data?.seconds) return new Date(s.data.seconds * 1000);
  if (s?.data instanceof Date) return s.data;
  if (typeof s?.mese === "string" && /^\d{4}-\d{2}$/.test(s.mese)) {
    const [y, m] = s.mese.split("-").map(Number);
    return new Date(y, m - 1, 1);
  }
  return null;
}

export const chiaveMese = (d) =>
  d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");

export const meseDaChiave = (k) => {
  const [y, m] = k.split("-").map(Number);
  return { anno: y, mese: m - 1 };
};

export const spostaMese = (k, delta) => {
  const { anno, mese } = meseDaChiave(k);
  return chiaveMese(new Date(anno, mese + delta, 1));
};

const fmtMese = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" });
export const nomeMese = (k) => {
  const { anno, mese } = meseDaChiave(k);
  const t = fmtMese.format(new Date(anno, mese, 1));
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const fmtMeseBreve = new Intl.DateTimeFormat("it-IT", { month: "short" });
export const nomeMeseBreve = (k) => {
  const { anno, mese } = meseDaChiave(k);
  return fmtMeseBreve.format(new Date(anno, mese, 1)) + " " + String(anno).slice(2);
};

const fmtGiorno = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long"
});
export const nomeGiorno = (d) => {
  const t = fmtGiorno.format(d);
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const fmtEuro = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
export const euro = (n) => fmtEuro.format(Number(n) || 0);

export const importoValido = (s) => {
  const v = Number(s?.importo);
  return isNaN(v) ? 0 : v;
};

/** "12,50" -> 12.5 */
export const leggiImporto = (testo) => {
  const v = Number(String(testo).replace(/\s/g, "").replace(",", "."));
  return isNaN(v) ? null : Math.round(v * 100) / 100;
};

/** yyyy-mm-dd per <input type="date"> */
export const perInputData = (d) =>
  d.getFullYear() +
  "-" +
  String(d.getMonth() + 1).padStart(2, "0") +
  "-" +
  String(d.getDate()).padStart(2, "0");
