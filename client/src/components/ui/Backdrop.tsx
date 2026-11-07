/**
 * Ambient background: slow aurora blobs tinted by the album art (via the
 * --accent / --glow custom properties, which cross-fade on song change),
 * a smooth top wash fading into near-black, and a faint film grain.
 */
export default function Backdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg" aria-hidden="true">
      <div
        className="aurora-blob"
        style={{
          width: "70vmax",
          height: "70vmax",
          left: "-20vmax",
          top: "-30vmax",
          background: "radial-gradient(circle, var(--glow) 0%, transparent 65%)",
          opacity: 0.9,
          animation: "drift-a 52s var(--ease) infinite",
        }}
      />
      <div
        className="aurora-blob"
        style={{
          width: "60vmax",
          height: "60vmax",
          right: "-25vmax",
          top: "-15vmax",
          background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 45%, transparent) 0%, transparent 65%)",
          opacity: 0.55,
          animation: "drift-b 64s var(--ease) infinite",
        }}
      />
      <div
        className="aurora-blob"
        style={{
          width: "55vmax",
          height: "55vmax",
          left: "10vmax",
          top: "20vmax",
          background: "radial-gradient(circle, color-mix(in srgb, var(--glow) 70%, transparent) 0%, transparent 65%)",
          opacity: 0.45,
          animation: "drift-c 44s var(--ease) infinite",
        }}
      />
      {/* Darken toward the bottom so content always sits on near-black. */}
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgb(10_10_12/0.15)_0%,rgb(10_10_12/0.55)_40%,#0a0a0c_85%)]" />
      <div className="grain absolute inset-0" />
    </div>
  );
}
