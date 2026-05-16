type Props = {
  color: string;
  size?: number;
};

export function BrandDot({ color, size = 8 }: Props) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: 2,
        background: color,
        flexShrink: 0,
      }}
    />
  );
}
