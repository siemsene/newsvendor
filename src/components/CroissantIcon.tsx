export function CroissantIcon({ size = 42 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" fill="none" aria-label="croissant">
      <path d="M24 72c0-20 18-36 40-36s40 16 40 36-18 30-40 30S24 92 24 72Z" fill="#E6B566"/>
      <path d="M34 72c0-14 14-26 30-26s30 12 30 26-14 22-30 22S34 86 34 72Z" fill="#F2CC85"/>
      <path d="M46 58c8 6 28 6 36 0" stroke="#D59C46" strokeWidth="6" strokeLinecap="round"/>
      <path d="M44 74c10 7 30 7 40 0" stroke="#D59C46" strokeWidth="6" strokeLinecap="round"/>
      <path d="M50 90c8 5 20 5 28 0" stroke="#D59C46" strokeWidth="6" strokeLinecap="round"/>
    </svg>
  );
}
