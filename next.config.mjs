/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  /** Сборка для Docker / контейнерного хостинга (Wispbyte, VPS, k8s). */
  output: "standalone",
}

export default nextConfig
