"use client";

import { useState } from "react";
import { auth } from "@/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "firebase/auth";

export default function Login({ nonAutorizzato }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errore, setErrore] = useState("");
  const [attesa, setAttesa] = useState(false);

  const esegui = async (fn) => {
    setErrore("");
    setAttesa(true);
    try {
      await fn(auth, email.trim(), password);
    } catch (e) {
      setErrore(
        e?.code === "auth/invalid-credential" || e?.code === "auth/wrong-password"
          ? "Email o password sbagliate"
          : e?.code === "auth/email-already-in-use"
          ? "Questa email è già registrata: usa Accedi"
          : "Qualcosa non è andato: riprova"
      );
    } finally {
      setAttesa(false);
    }
  };

  return (
    <main className="min-h-dvh flex flex-col justify-center px-6 safe-top safe-bottom">
      <div className="text-center mb-10">
        <div className="text-6xl mb-3">🏠</div>
        <h1 className="text-3xl font-bold">Casa App</h1>
        <p className="text-slate-400 mt-1">Le spese di casa, sempre in tasca</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          esegui(signInWithEmailAndPassword);
        }}
        className="space-y-3"
      >
        <input
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="campo"
        />
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="campo"
        />

        {(errore || nonAutorizzato) && (
          <p className="text-red-400 text-sm px-1">
            {errore || "Questo account non è abilitato all'app."}
          </p>
        )}

        <button type="submit" disabled={attesa} className="btn-primario w-full">
          {attesa ? "Un attimo…" : "Accedi"}
        </button>
        <button
          type="button"
          disabled={attesa}
          onClick={() => esegui(createUserWithEmailAndPassword)}
          className="w-full py-3 text-slate-400 text-sm"
        >
          Prima volta? Registrati
        </button>
      </form>
    </main>
  );
}
