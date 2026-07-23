// src/components/staff/S_Capital.jsx
// ─────────────────────────────────────────────────────────────
//  Staff › Capital Ledger
//  Tracks named partner contributions (BY) and drawings (TO),
//  matching the Excel CAPITAL sheet's "BY MR.K.K/K.J/K.M" and
//  "TO MR.K.K.Personal/K.J/K.M/Building Owner/Licensee/Manager Loan" lines.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { fmt, today } from "../../utils/helpers";
import { I } from "../../utils/icons";
import { getCapitalLedger, addCapitalEntry, deleteCapitalEntry } from "../../db";

// Same partners/parties across every outlet.
const PARTIES = [
  { name: "K.K", kind: "partner" },
  { name: "K.J", kind: "partner" },
  { name: "K.M", kind: "partner" },
  { name: "Building Owner", kind: "other" },
  { name: "Licensee", kind: "other" },
  { name: "Manager Loan", kind: "other" },
];

// ════════════════════════════════════════════════════════════
export default function S_Capital({ outlet, toast_ }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  function reload() {
    setLoading(true);
    getCapitalLedger(outlet).then(data => { setEntries(data || []); setLoading(false); });
  }

  useEffect(() => { reload(); }, [outlet]);

 const blank = { date: today(), party: PARTIES[0].name, direction: "in", amount: "", notes: "" };
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function save() {
    if (saving) return; // prevent double-click double-insert
    if (!form.party) { toast_?.("Select a party", "err"); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast_?.("Enter valid amount", "err"); return; }

    setSaving(true);
    await addCapitalEntry(outlet, {
      date: form.date,
      party: form.party,
      direction: form.direction,
      amount: parseFloat(form.amount),
      notes: form.notes,
    });
    toast_?.("Entry saved ✓");
    setForm(f => ({ ...blank, party: f.party, direction: f.direction }));
    await reload();
    setSaving(false);
  }
  async function remove(id) {
    if (!window.confirm("Delete this entry?")) return;
    await deleteCapitalEntry(id);
    reload();
  }

  const period = entries
    .filter(e => (!from || e.date >= from) && (!to || e.date <= to))
    .sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.created_at || "").localeCompare(b.created_at || ""));

  const totalIn  = period.filter(e => e.direction === "in").reduce((a, e) => a + Number(e.amount || 0), 0);
  const totalOut = period.filter(e => e.direction === "out").reduce((a, e) => a + Number(e.amount || 0), 0);

  // Per-party totals, split by direction — mirrors the Excel BY/TO breakdown.
  const byParty = {};
  period.forEach(e => {
    if (!byParty[e.party]) byParty[e.party] = { in: 0, out: 0 };
    byParty[e.party][e.direction] += Number(e.amount || 0);
  });

  const th = { padding: "6px 10px", fontSize: 10, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--mut2,var(--mut))", background: "var(--s3)", borderBottom: "1px solid var(--bdr)" };
  const td = { padding: "6px 10px", fontSize: 12 };

  return (
    <div>
      {/* ── New Entry ── */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="chd">
          <div>
            <h3>New Capital Entry</h3>
            <p>{outlet}</p>
          </div>
        </div>
        <div style={{ padding: 14 }}>
          <div className="fg">
            <div className="ff">
              <label>Date *</label>
              <input type="date" value={form.date} onChange={e => set("date", e.target.value)} />
            </div>
            <div className="ff">
              <label>Party *</label>
              <select value={form.party} onChange={e => set("party", e.target.value)}>
                {PARTIES.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            <div className="ff">
              <label>Direction *</label>
              <select value={form.direction} onChange={e => set("direction", e.target.value)}>
                <option value="in">Contribution (BY) — money in</option>
                <option value="out">Drawing (TO) — money out</option>
              </select>
            </div>
            <div className="ff">
              <label>Amount *</label>
              <input type="number" step="0.01" placeholder="0.00" value={form.amount} onChange={e => set("amount", e.target.value)} />
            </div>
            <div className="ff" style={{ minWidth: 220 }}>
              <label>Notes</label>
              <input placeholder="Optional note" value={form.notes} onChange={e => set("notes", e.target.value)} />
            </div>
          </div>
          <div style={{ marginTop: 12, textAlign: "right" }}>
            <button className="btn btng" onClick={save} disabled={saving}>{I.check} {saving ? "Saving…" : "Save Entry"}</button>
          </div>
        </div>
      </div>

      {/* ── Ledger ── */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="chd" style={{ padding: "12px 14px" }}>
          <h3>Capital Ledger</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="date" className="btn btnsm" value={from} onChange={e => setFrom(e.target.value)} />
            <input type="date" className="btn btnsm" value={to} onChange={e => setTo(e.target.value)} />
            <button className="btn btnd btnsm no-print" onClick={() => window.print()}>{I.print} Print</button>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left" }}>Date</th>
                <th style={{ ...th, textAlign: "left" }}>Party</th>
                <th style={{ ...th, textAlign: "left" }}>Notes</th>
                <th style={{ ...th, textAlign: "right" }}>Contribution (BY)</th>
                <th style={{ ...th, textAlign: "right" }}>Drawing (TO)</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} style={{ padding: 20, textAlign: "center", color: "var(--mut)" }}>Loading…</td></tr>}
              {!loading && period.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 20, textAlign: "center", color: "var(--mut)" }}>No entries in this period</td></tr>
              )}
              {period.map(e => (
                <tr key={e.id} style={{ borderBottom: "1px solid rgba(63,63,70,.15)" }}>
                  <td style={td}>{e.date}</td>
                  <td style={td}>{e.party}</td>
                  <td style={{ ...td, color: "var(--mut)" }}>{e.notes || "—"}</td>
                  <td style={{ ...td, textAlign: "right" }}>{e.direction === "in" ? fmt(e.amount) : ""}</td>
                  <td style={{ ...td, textAlign: "right" }}>{e.direction === "out" ? fmt(e.amount) : ""}</td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <button className="btn btnsm no-print" title="Delete" style={{ color: "var(--red)" }} onClick={() => remove(e.id)}>{I.trash}</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {Object.keys(byParty).map(p => (
                <tr key={p} style={{ background: "var(--s2)" }}>
                  <td style={td} colSpan={3}>{p} — Total</td>
                  <td style={{ ...td, textAlign: "right" }}>{fmt(byParty[p].in)}</td>
                  <td style={{ ...td, textAlign: "right" }}>{fmt(byParty[p].out)}</td>
                  <td style={td}></td>
                </tr>
              ))}
              <tr style={{ background: "var(--s3)", borderTop: "2px solid var(--bdr2,var(--bdr))" }}>
                <td style={{ ...td, fontWeight: 700 }} colSpan={3}>Total</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{fmt(totalIn)}</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{fmt(totalOut)}</td>
                <td style={td}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}