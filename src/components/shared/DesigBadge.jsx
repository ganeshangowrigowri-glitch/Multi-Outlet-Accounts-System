export default function DesigBadge({ d }) {
  const m = {
    "Subject Clerk": "bg",
    "Trainee": "ba",
    "Operational Manager": "bb",
    "Accounts Assistant": "bp"
  };
  return (
    <span className={`badge ${m[d] || "bx"}`}>
      <span className="dot"/>{d}
    </span>
  );
}
