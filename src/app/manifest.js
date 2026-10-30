export default function manifest() {
  return {
    name: "Casa App",
    short_name: "Casa",
    description: "Le spese di casa di Bobby e Alicia",
    lang: "it",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0f17",
    theme_color: "#0b0f17",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ],
    shortcuts: [
      { name: "Aggiungi spesa", url: "/?azione=nuova", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Lista spesa", url: "/?azione=lista", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] }
    ]
  };
}
