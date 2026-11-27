// hand-picked tints, not a generated hue wheel
const TINTS = ["#7c3aed", "#9d4edd", "#5b2a9e", "#0e9f6e", "#2bb673", "#b56cf2"];
export const tintOf = (name: string) => TINTS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % TINTS.length];

export default function Avatar({ name, group, size = 44, src, ring }: { name: string; group: boolean; size?: number; src?: string | null; ring?: boolean }) {
  return (
    <span className={`av ${group ? "sq" : ""} ${ring ? "vr" : ""}`} style={{ width: size, height: size, background: `linear-gradient(150deg, ${tintOf(name)}, #24103f 135%)` }}>
      {src ? <img src={src} alt="" referrerPolicy="no-referrer" /> : name.slice(0, 1).toUpperCase()}
    </span>
  );
}
