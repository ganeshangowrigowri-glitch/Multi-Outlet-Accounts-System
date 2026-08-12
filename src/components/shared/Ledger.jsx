import { today } from "../../utils/helpers";
import { fmt } from "../../utils/helpers";

        export default function Ledger({ rows, bfBal = 0, bfDate }) {
  let bal = Number(bfBal) || 0;
        return (
    <div>
      <div className="lhd">
        <div className="lhc">Date</div>
        <div className="lhc">Description</div>
        <div className="lhc rt">Cash Out</div>
        <div className="lhc rt">Cash In</div>
        <div className="lhc rt">Balance</div>
      </div>
      <div className="lrow lbf">
        <div className="lc mono">{bfDate || today()}</div>
        <div className="lc">Balance B/F</div>
        <div className="lc"/>
        <div className="lc"/>
        <div className="lc lbal">Rs{fmt(bfBal)}</div>
      </div>
      {rows.length === 0 && <div className="empty">No entries yet.</div>}
      {rows.map(e => {
        const debit  = e.debit  ?? (e.type === "in"  ? e.amount : 0) ?? 0;
        const credit = e.credit ?? (e.type === "out" ? e.amount : 0) ?? 0;
        bal += debit - credit;
        return (
          <div className="lrow" key={e.id || Math.random()}>
            <div className="lc mono">{e.date}</div>
            <div className="lc">{e.description}</div>
            <div className="lc lout">{credit ? `Rs.${fmt(credit)}` : ""}</div>
            <div className="lc lin">{debit ? `Rs.${fmt(debit)}` : ""}</div>
            <div className="lc lbal" style={{ color: bal >= 0 ? "var(--txt)" : "var(--red)" }}>
              Rs.{fmt(bal)}
            </div>
          </div>
        );
      })}
      <div className="lrow lcd">
        <div className="lc mono">{today()}</div>
        <div className="lc">Balance C/D</div>
        <div className="lc"/>
        <div className="lc"/>
        <div className="lc lbal" style={{ color: bal >= 0 ? "var(--grn)" : "var(--red)" }}>
          Rs.{fmt(bal)}
        </div>
      </div>
    </div>
  );
}
