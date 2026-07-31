export function Kpi({
  label,
  value,
  icon,
  hero,
  delta,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  hero?: boolean;
  delta?: React.ReactNode;
}) {
  return (
    <div className={`kpi${hero ? " hero" : ""}`}>
      <div className="k-top">
        <div className="k-label">{label}</div>
        {icon && <div className="k-icon">{icon}</div>}
      </div>
      <div className="k-value">{value}</div>
      {delta}
    </div>
  );
}
