"use client";

import { useEffect, useState } from "react";
import { db } from "@/firebase";
import { collection, onSnapshot } from "firebase/firestore";

export default function History() {
  const [spese, setSpese] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "speseCasa"), (snap) => {
      setSpese(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => unsub();
  }, []);

  // 🔥 raggruppa per mese
  const mesi = {};

  spese.forEach((s) => {
    if (!s.data) return;

    const d = new Date(s.data.seconds * 1000);

    const key =
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0");

    const val = Number(s.importo);
    if (isNaN(val)) return;

    if (!mesi[key]) mesi[key] = 0;

    mesi[key] += val;
  });

  return (
    
  <main style={{ padding: 20 }}>

    {/* 👇 INCOLLA QUI */}
    <div style={{ marginBottom: 20 }}>
      <a
        href="/"
        style={{
          color: "cyan",
          textDecoration: "none",
          fontWeight: "bold"
        }}
      >
        ← Torna alla Home
      </a>
    </div>
      <h1>📊 Storico Mesi</h1>

      {Object.entries(mesi)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([mese, totale]) => (
          <div
            key={mese}
            style={{
              padding: 10,
              borderBottom: "1px solid #333"
            }}
          >
            <strong>{mese}</strong> → €{totale}
          </div>
        ))}
    </main>
  );
}