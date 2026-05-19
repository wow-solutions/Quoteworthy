type Props = {
  status: string;
  label: string;
};

export function StatusBadge({ status, label }: Props) {
  const styles =
    status === "published"
      ? {
          bg: "var(--pass-bg)",
          color: "var(--pass)",
          border: "rgba(122,160,121,0.30)",
        }
      : status === "pending_approval"
        ? {
            bg: "var(--borderline-bg)",
            color: "var(--borderline)",
            border: "rgba(201,166,107,0.30)",
          }
        : {
            bg: "var(--raised)",
            color: "var(--ink-muted)",
            border: "var(--border-subtle)",
          };

  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        background: styles.bg,
        color: styles.color,
        border: `1px solid ${styles.border}`,
        padding: "2px 8px",
        borderRadius: 4,
        fontWeight: 500,
      }}
    >
      {label}
    </span>
  );
}
