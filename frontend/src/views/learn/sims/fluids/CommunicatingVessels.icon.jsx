/** A U-tube icon for the tab row, drawn like the lucide icons around it. */
export default function UTubeIcon({ size = 16, className, style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d="M5 3v11a7 7 0 0 0 14 0V3" />
      <path d="M9 3v11a3 3 0 0 0 6 0V3" />
      <path d="M15 9h4" />
    </svg>
  );
}
