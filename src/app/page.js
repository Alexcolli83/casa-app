"use client";

import { useEffect, useMemo, useState } from "react";
import { auth, db } from "@/firebase";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword
} from "firebase/auth";

import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc
} from "firebase/firestore";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts";

const allowedUsers = [
  "alexcolli83@gmail.com",
  "alice.brogi91@gmail.com"
];

export default function Home() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [spese, setSpese] = useState([]);
  const [lista, setLista] = useState([]);

  const [categoria, setCategoria] = useState("luce");
  const [importo, setImporto] = useState("");
  const [item, setItem] = useState("");

  const meseCorrente =
    new Date().getFullYear() +
    "-" +
    String(new Date().getMonth() + 1).padStart(2, "0");

  // AUTH
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u && allowedUsers.includes(u.email)) setUser(u);
      else setUser(null);
    });
    return () => unsub();
  }, []);

  // FIRESTORE SPESE
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "speseCasa"), (snap) => {
      setSpese(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // FIRESTORE LISTA
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "listaSpesa"), (snap) => {
      setLista(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const login = () => signInWithEmailAndPassword(auth, email, password);
  const register = () => createUserWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);

  // ADD SPESA
  const aggiungiSpesa = async () => {
    if (!importo) return;

    await addDoc(collection(db, "speseCasa"), {
      categoria,
      importo: Number(importo),
      mese: meseCorrente,
      data: new Date(),
      user: auth.currentUser.email
    });

    setImporto("");
  };

  const eliminaSpesa = async (id) => {
    await deleteDoc(doc(db, "speseCasa", id));
  };

  const modificaImporto = async (id, val) => {
    await updateDoc(doc(db, "speseCasa", id), {
      importo: Number(val)
    });
  };

  const aggiungiItem = async () => {
    if (!item) return;

    await addDoc(collection(db, "listaSpesa"), {
      nome: item,
      user: auth.currentUser.email,
      data: new Date()
    });

    setItem("");
  };

  const eliminaItem = async (id) => {
    await deleteDoc(doc(db, "listaSpesa", id));
  };

  // FILTRI
  const speseMese = spese.filter((s) => s.mese === meseCorrente);

  const totaleMese = speseMese.reduce(
    (acc, s) => acc + Number(s.importo),
    0
  );

  // GRAFICO GIORNALIERO
  const datiGrafico = useMemo(() => {
    const map = {};

    speseMese.forEach((s) => {
      const day = new Date(s.data.seconds * 1000).getDate();

      if (!map[day]) {
        map[day] = { giorno: day, totale: 0 };
      }

      map[day].totale += Number(s.importo);
    });

    return Object.values(map).sort((a, b) => a.giorno - b.giorno);
  }, [speseMese]);

  if (!user) {
    return (
      <main style={{ padding: 20 }}>
        <h1>Login Casa App</h1>
        <input placeholder="email" onChange={(e) => setEmail(e.target.value)} />
        <input type="password" placeholder="password" onChange={(e) => setPassword(e.target.value)} />
        <button onClick={login}>Login</button>
        <button onClick={register}>Register</button>
      </main>
    );
  }

  return (
    <main style={{ padding: 20 }}>
      <h1>🏠 Casa App PRO</h1>

      <p>{user.email}</p>
      <button onClick={logout}>Logout</button>

      <hr />

      {/* TOTALE */}
      <h2>💰 Totale mese: €{totaleMese}</h2>

      {/* GRAFICO */}
      <h3>📊 Andamento giornaliero</h3>

      <div style={{ width: "100%", height: 250 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datiGrafico}>
            <XAxis dataKey="giorno" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="totale" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <hr />

      {/* INPUT */}
      <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
        <option value="luce">luce</option>
        <option value="gas">gas</option>
        <option value="acqua">acqua</option>
        <option value="telefono">telefono</option>
        <option value="internet">internet</option>
        <option value="spesa">spesa</option>
        <option value="altro">altro</option>
      </select>

      <input value={importo} onChange={(e) => setImporto(e.target.value)} />
      <button onClick={aggiungiSpesa}>Aggiungi</button>

      <hr />

      {/* CALENDARIO */}
      <h3>📅 Spese del mese</h3>

      {speseMese.map((s) => (
        <div key={s.id} style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            <small>{s.user}</small>
            <div>
              {s.categoria} - €{s.importo}
            </div>
          </div>

          <input
            defaultValue={s.importo}
            onBlur={(e) => modificaImporto(s.id, e.target.value)}
            style={{ width: 60 }}
          />

          <button onClick={() => eliminaSpesa(s.id)}>❌</button>
        </div>
      ))}

      <hr />

      {/* LISTA SPESA */}
      <h2>🛒 Lista spesa</h2>

      <input value={item} onChange={(e) => setItem(e.target.value)} />
      <button onClick={aggiungiItem}>Aggiungi</button>

      {lista.map((l) => (
        <div key={l.id}>
          {l.nome}
          <button onClick={() => eliminaItem(l.id)}>❌</button>
        </div>
      ))}
    </main>
  );
}