export function AtmosphereBg() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[oklch(0.12_0.03_240)]" />
      <div
        className="atmosphere-orb absolute -left-[20%] -top-[10%] h-[55vh] w-[55vh] rounded-full opacity-70 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, oklch(0.55 0.14 210 / 45%) 0%, transparent 70%)",
          animation: "mesh-drift 18s ease-in-out infinite",
        }}
      />
      <div
        className="atmosphere-orb absolute -right-[15%] top-[20%] h-[50vh] w-[50vh] rounded-full opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, oklch(0.45 0.1 190 / 40%) 0%, transparent 70%)",
          animation: "mesh-drift 22s ease-in-out infinite reverse",
        }}
      />
      <div
        className="atmosphere-orb absolute bottom-[-20%] left-[30%] h-[45vh] w-[45vh] rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, oklch(0.4 0.08 250 / 35%) 0%, transparent 70%)",
          animation: "mesh-drift 26s ease-in-out infinite",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `
            linear-gradient(oklch(0.78 0.14 210 / 6%) 1px, transparent 1px),
            linear-gradient(90deg, oklch(0.78 0.14 210 / 6%) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(ellipse 80% 70% at 50% 30%, black 20%, transparent 75%)",
        }}
      />
      <div
        className="atmosphere-scan absolute left-0 right-0 h-32 opacity-[0.07]"
        style={{
          background:
            "linear-gradient(to bottom, transparent, oklch(0.85 0.1 210 / 60%), transparent)",
          animation: "scanline 9s linear infinite",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[oklch(0.1_0.03_240/80%)]" />
    </div>
  );
}
