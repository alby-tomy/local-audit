/**
 * Decorative blurred gradient orbs that drift slowly behind page content.
 * Colors are driven by the active theme's --accent / --accent-2 CSS variables,
 * so the same component reads correctly in all three themes.
 */
export function AmbientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-base" />
      <div
        className="absolute -top-40 -left-40 h-[32rem] w-[32rem] rounded-full opacity-[var(--orb-opacity)] blur-[120px] animate-drift-slow"
        style={{ background: "radial-gradient(circle, rgb(var(--accent)) 0%, transparent 70%)" }}
      />
      <div
        className="absolute top-1/3 -right-40 h-[28rem] w-[28rem] rounded-full opacity-[var(--orb-opacity)] blur-[120px] animate-drift-slower"
        style={{ background: "radial-gradient(circle, rgb(var(--accent-2)) 0%, transparent 70%)" }}
      />
      <div
        className="absolute bottom-0 left-1/4 h-[24rem] w-[24rem] rounded-full opacity-[var(--orb-opacity-2)] blur-[120px] animate-drift-slow"
        style={{ background: "radial-gradient(circle, rgb(var(--accent)) 0%, transparent 70%)" }}
      />
      <div className="absolute inset-0 bg-grid-fade" />
    </div>
  );
}
