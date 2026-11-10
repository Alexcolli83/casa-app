/** @type {import('next').NextConfig} */
const nextConfig = {
  // librerie solo-server per le notifiche: non vanno impacchettate
  serverExternalPackages: ["web-push", "firebase-admin"]
};

export default nextConfig;
