"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase";
import { dataSpesa } from "@/lib/casa";

/** Ascolta in tempo reale spese e lista della spesa (solo da loggati). */
export function useCasaData(user) {
  const [spese, setSpese] = useState([]);
  const [lista, setLista] = useState([]);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    if (!user) return;

    const unsubSpese = onSnapshot(collection(db, "speseCasa"), (snap) => {
      setSpese(
        snap.docs
          .map((d) => {
            const s = { id: d.id, ...d.data() };
            return { ...s, _d: dataSpesa(s) };
          })
          .filter((s) => s._d)
      );
      setPronto(true);
    });

    const unsubLista = onSnapshot(collection(db, "listaSpesa"), (snap) => {
      setLista(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.data?.seconds || 0) - (b.data?.seconds || 0))
      );
    });

    return () => {
      unsubSpese();
      unsubLista();
    };
  }, [user]);

  return { spese, lista, pronto };
}
