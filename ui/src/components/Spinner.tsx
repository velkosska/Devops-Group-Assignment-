export function Spinner({ size = 16, label }: { size?: number; label?: string }) {
  return (
    <span
      className="spinner"
      style={{ width: size, height: size }}
      role={label ? "status" : undefined}
    >
      {label && <span className="visually-hidden">{label}</span>}
    </span>
  );
}
