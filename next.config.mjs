/** @type {import('next').NextConfig} */
const nextConfig = {
  // garante que db/calculo.sql seja incluído no bundle da function na Vercel
  // (a rota lê o arquivo em runtime com fs.readFileSync)
  experimental: {
    outputFileTracingIncludes: {
      "/api/calculo": ["./db/calculo.sql"],
    },
  },
};

export default nextConfig;
