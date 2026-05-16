type Props = { size?: number };

export function QuoteworthyMark({ size = 28 }: Props) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        background: "#0A1628",
        display: "grid",
        placeItems: "center",
      }}
    >
      <svg
        viewBox="0 0 100 100"
        width={Math.round(size * 0.79)}
        height={Math.round(size * 0.79)}
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Quoteworthy"
      >
        <circle
          cx="46"
          cy="46"
          r="30"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="8"
        />
        <rect
          x="58"
          y="60"
          width="26"
          height="8"
          rx="2"
          fill="#FFFFFF"
          transform="rotate(45 71 64)"
        />
        <g fill="#10B981">
          <path d="M34 32 L44 32 L44 44 L38 58 L34 58 Z" />
          <path d="M48 32 L58 32 L58 44 L52 58 L48 58 Z" />
        </g>
      </svg>
    </div>
  );
}
