/* frontend/src/app/about/page.tsx */
export default function AboutPage() {
  return (
    <div className="min-h-screen px-6 py-12">
      <h1 className="text-3xl font-bold text-white mb-8">About Smart WiFi</h1>
      <div className="glass-card p-8 max-w-3xl">
        <h2 className="text-xl font-bold text-white mb-4">Our Network</h2>
        <p className="text-slate-400 leading-relaxed mb-4">
          Swift WiFi is an automated, high-performance Wi-Fi Hotspot Billing and ISP Management platform
          designed for Kenyan hotspot operators and ISPs.
        </p>
        <h2 className="text-xl font-bold text-white mb-4">SLA & Reliability</h2>
        <ul className="list-disc list-inside text-slate-400 space-y-2 mb-4">
          <li>99.9% uptime SLA on the billing platform</li>
          <li>Idempotent M-Pesa callbacks with 5-minute replay deduplication</li>
          <li>Circuit-breaker protected MikroTik provisioning with auto-recovery</li>
          <li>Multi-layer DDoS protection with progressive IP banning</li>
        </ul>
        <h2 className="text-xl font-bold text-white mb-4">Infrastructure</h2>
        <p className="text-slate-400 leading-relaxed">
          Built on Node.js, Express, PostgreSQL (Prisma), Next.js 14, and Tailwind CSS.
          Containerized with Docker and deployed via GitHub Actions CI/CD.
        </p>
      </div>
    </div>
  );
}
