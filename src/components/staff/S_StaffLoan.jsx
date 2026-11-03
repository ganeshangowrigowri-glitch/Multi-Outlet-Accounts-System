import { useState, useEffect } from "react";
import { fmt, today } from "../../utils/helpers";
import { I } from "../../utils/icons";
import { getPositionLedger, getCOA } from "../../db";
import { supabase } from "../../supabase";

const keyOf = s => (s || "").trim().replace(/\s+/g, " ").toUpperCase();
// Staff name from a Tab 1 note: "Name" or "Name - description"
const nameOf = notes => {
  const n = (notes || "").trim(), i = n.indexOf(" - ");
  return (i < 0 ? n : n.slice(0, i).trim()) || "(NO NAME)";
};

export default function S_StaffLoan({ outlet, toast_ }) {
  const [month, setMonth] = useState(today().slice(0, 7));
  const [loanKey, setLoanKey] = useState(null);
  const [entries, setEntries] = useState([]);
  const [bf, setBf] = useState({});            // staff_key -> row
  const [draft, setDraft] = useState({});      // staff_key -> typed B/F
  const [lines, setLines] = useState([]);
  const [ldraft, setLdraft] = useState({});
  const setL = (k, f, v) => setLdraft(x => ({ ...x, [k]: { ...(x[k] || {}), [f]: v } }));

  useEffect(() => {
    getCOA().then(l => setLoanKey((l || []).find(a => a.id >= "1000" && a.id <= "1499" && /staff\s*loan/i.test(a.name))?.id || ""));
  }, []);
  useEffect(() => { getPositionLedger(outlet, ["asset"]).then(d => setEntries(d || [])); }, [outlet]);

  const loadBf = () => supabase.from("staff_loan_bf").select("*")
    .eq("outlet_id", outlet).eq("period", month)
    .then(({ data }) => { setBf(Object.fromEntries((data || []).map(r => [r.staff_key, r]))); setDraft({}); });
  const loadLines = () => supabase.from("staff_loan_lines").select("*")
    .eq("outlet_id", outlet).eq("period", month).order("line_date")
    .then(({ data }) => setLines(data || []));
  useEffect(() => { loadBf(); loadLines(); }, [outlet, month]); // eslint-disable-line

  // ── Staff list: NAMES ONLY from Tab 1 (Asset > Staff Loan, selected month). Amounts are not used. ──
  const staff = {};
  entries
    .filter(e => e.category_group === "asset" && loanKey && e.category === loanKey && (e.date || "").slice(0, 7) === month)
    .forEach(e => { const n = nameOf(e.notes); staff[keyOf(n)] ??= { name: n, lines: [] }; });
  // staff who already have saved B/F or detail lines this month stay visible
  Object.values(bf).forEach(r => { staff[r.staff_key] ??= { name: r.staff_name, lines: [] }; });
  lines.forEach(l => {
    (staff[l.staff_key] ??= { name: l.staff_name, lines: [] })
      .lines.push({ id: l.id, date: l.line_date, desc: l.description, amount: Number(l.amount) });
  });
  const keys = Object.keys(staff).sort();

const val = (k, f, col) => { const v = draft[k]?.[f]; return v !== undefined ? v : (bf[k]?.[col] ?? ""); };
async function saveBf(k) {
  const bv = parseFloat(val(k, "bf", "bf_amount") || 0);
  const lv = parseFloat(val(k, "loan", "loan_amount") || 0);
  if (isNaN(bv) || isNaN(lv)) { toast_?.("Enter valid amounts", "err"); return; }
  const { error } = await supabase.from("staff_loan_bf").upsert(
    { outlet_id: outlet, staff_key: k, staff_name: staff[k].name, period: month,
      bf_amount: bv, loan_amount: lv, updated_at: new Date().toISOString() },
    { onConflict: "outlet_id,staff_key,period" });
  if (error) { toast_?.("Save failed", "err"); return; }
  toast_?.("Saved ✓"); loadBf();
}
  async function addLine(k) {
    const d = ldraft[k] || {}, amt = parseFloat(d.amount), date = d.date || month + "-01";
    if (isNaN(amt) || amt <= 0) { toast_?.("Enter valid amount", "err"); return; }
    if (date.slice(0, 7) !== month) { toast_?.("Date must be in " + month, "err"); return; }
    const { error } = await supabase.from("staff_loan_lines").insert({
      outlet_id: outlet, staff_key: k, staff_name: staff[k].name, period: month,
      line_date: date, description: d.desc || "", amount: amt });
    if (error) { toast_?.("Save failed", "err"); return; }
    setLdraft(x => ({ ...x, [k]: {} })); loadLines();
  }
  async function delLine(id) {
    if (!window.confirm("Delete this line?")) return;
    await supabase.from("staff_loan_lines").delete().eq("id", id).eq("outlet_id", outlet);
    loadLines();
  }

  const th = { padding: "6px 10px", fontSize: 11, textAlign: "left", borderBottom: "1px solid #999" };
  const td = { padding: "5px 10px", fontSize: 12 };
  const R = { textAlign: "right", fontVariantNumeric: "tabular-nums" };

  return (
    <div>
      <style>{`
        .sl-po{display:none}
        @media print{
          @page{size:A4;margin:14mm}
          body *{visibility:hidden}
          #sl-print,#sl-print *{visibility:visible;color:#000!important}
          #sl-print{position:absolute;left:0;top:0;width:100%}
          .sl-np{display:none!important}
          .sl-po{display:inline!important}
          .sl-sec{break-inside:avoid}
        }`}</style>

      <div className="card sl-np" style={{ padding: 12, marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}>
        <input type="month" className="btn btnsm" value={month} onChange={e => setMonth(e.target.value)} />
        <button className="btn btnd btnsm" style={{ marginLeft: "auto" }} onClick={() => window.print()}>{I.print} Print</button>
        {loanKey === "" && <span style={{ color: "var(--red)" }}>No "Staff Loan" category found in COA</span>}
      </div>

      <div id="sl-print">
        <h3 style={{ margin: "0 0 10px" }}>Staff Loan Details — {outlet} — {month}</h3>
        {keys.length === 0 && <p style={{ color: "var(--mut)" }}>No Staff Loan entries in Position Entry for this month</p>}

        {keys.map(k => {
  const s = staff[k];
  const b = parseFloat(val(k, "bf", "bf_amount")) || 0;
  const l = parseFloat(val(k, "loan", "loan_amount")) || 0;
  const dirty = draft[k] !== undefined;
  const inp = { width: 150, textAlign: "right", padding: "4px 8px", fontSize: 13 };
  return (
    <div key={k} className="card sl-sec" style={{ padding: 0, marginBottom: 16 }}>
      <h4 style={{ margin: 0, padding: "10px 12px" }}>{s.name}</h4>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          <tr style={{ borderTop: "1px solid #999" }}>
            <td style={td}>B/F</td>
            <td style={{ ...td, ...R }}>
              <input className="sl-np" type="number" step="0.01" placeholder="0.00" style={inp}
                value={val(k, "bf", "bf_amount")} onChange={e => setDraft(d => ({ ...d, [k]: { ...(d[k] || {}), bf: e.target.value } }))} />
              <span className="sl-po">{fmt(b)}</span>
            </td>
          </tr>
          <tr>
            <td style={td}>STAFF LOAN</td>
            <td style={{ ...td, ...R }}>
              <input className="sl-np" type="number" step="0.01" placeholder="0.00" style={inp}
                value={val(k, "loan", "loan_amount")} onChange={e => setDraft(d => ({ ...d, [k]: { ...(d[k] || {}), loan: e.target.value } }))} />
              <span className="sl-po">{fmt(l)}</span>
            </td>
          </tr>
          <tr style={{ fontWeight: 700, borderTop: "2px solid #999" }}>
            <td style={td}>Balance C/D</td>
            <td style={{ ...td, ...R }}>{fmt(b - l)}</td>
          </tr>
        </tbody>
      </table>
      <div className="sl-np" style={{ padding: "6px 12px", textAlign: "right" }}>
        <button className="btn btnsm" onClick={() => saveBf(k)} disabled={!dirty}>{dirty ? "Save" : "Saved"}</button>
      </div>
    </div>
  );
})}
      </div>
    </div>
  );
}