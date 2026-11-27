export function Mark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <defs>
        <linearGradient id="mk" x1="3" y1="2" x2="26" y2="27" gradientUnits="userSpaceOnUse">
          <stop stopColor="#b56cf2" /><stop offset=".55" stopColor="#9d4edd" /><stop offset="1" stopColor="#2cf08e" />
        </linearGradient>
      </defs>
      <path fill="url(#mk)" fillRule="evenodd" d="M4 3h9.5a10.5 10.5 0 0 1 0 21H9.2L4 27.5zM10 8.5h3.4a5 5 0 0 1 0 10H10z" />
    </svg>
  );
}

export default function Brand({ size = 56 }: { size?: number }) {
  return (
    <div className="brand">
      <Mark size={size} />
      <span style={{ fontSize: size * 1.05 }}>deluxe</span>
    </div>
  );
}
