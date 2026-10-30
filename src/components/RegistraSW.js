"use client";

import { useEffect } from "react";

/** Registra il service worker: serve per installare l'app sul telefono. */
export default function RegistraSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
