import backgroundArt from "@assets/editions/background.jpg";

// Static scenery: stays fixed while cards move so only the carousel animates.
export function SceneBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <img
        src={backgroundArt}
        alt=""
        draggable={false}
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: "50% 100%" }}
      />
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/50 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/45 to-transparent" />
    </div>
  );
}