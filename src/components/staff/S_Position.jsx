// src/components/staff/S_Position.jsx
// ─────────────────────────────────────────────────────────────
//  Staff › Position Ledger
//  Feeds Stock Summary's Other Credits Outstanding, Liabilities,
//  and extra Assets (Staff Loan Receivable, Damage Receivable).
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { fmt, today } from "../../utils/helpers";
import { I } from "../../utils/icons";
import { getPositionLedger, addPositionEntry, deletePositionEntry, POSITION_CATEGORIES, getCOA } from "../../db";
const GROUP_LABELS = { asset: "Asset", other_credit: "Other Credit Outstanding" };
export default function S_Position({ outlet, toast_ }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [coa, setCoa] = useState([]);

  function reload() {
    setLoading(true);
    getPositionLedger(outlet).then(data => { setEntries(data || []); setLoading(false); });
  }
  useEffect(() => { reload(); }, [outlet]);
  useEffect(() => { getCOA().then(list => setCoa(list || [])); }, []);

  // Live Chart of Accounts categories for Asset / Liability groups — any
  // account the admin adds in Chart of Accounts shows up here automatically.
  // Ranges match Reports.jsx's Balance Sheet convention: Assets 1000–1999,
  // Liabilities 2000–2999 (current + non-current).
    // Restricted to 1000–1499 (Current Assets) only — 1500–1999 is Fixed
  // Assets, a separate Balance Sheet category already listed on its own
  // (coaNonCurrentAssets), so it must not appear in Position Entry.
    // Restricted to 1000–1499 (Current Assets) only — 1500–1999 is Fixed
  // Assets, a separate Balance Sheet category already listed on its own
  // (coaNonCurrentAssets), so it must not appear in Position Entry.
  // 1100 (Account Receivable) and 1400 (Empty) are also excluded — both
  // already have dedicated, auto-computed values elsewhere.
  const EXCLUDED_ASSET_IDS = ["1100", "1400"];
  const coaAssetCats = coa
    .filter(a => a.id >= "1000" && a.id <= "1499")
    .filter(a => !EXCLUDED_ASSET_IDS.includes(a.id))
    .map(a => ({ key: a.id, label: a.name }));
    // "Damage" removed from Other Credit Outstanding — filtered here so
  // POSITION_CATEGORIES itself is untouched for any other consumer.
  const OTHER_CREDIT_CATS = POSITION_CATEGORIES.other_credit
    .filter(c => c.key !== "damage" && !/damage/i.test(c.label));

  const categoryOptions = group =>
    group === "asset" ? coaAssetCats
    : group === "other_credit" ? OTHER_CREDIT_CATS
    : POSITION_CATEGORIES[group];

  const blank = {
    date: today(), categoryGroup: "other_credit",
    category: OTHER_CREDIT_CATS[0]?.key || "",
    direction: "in", amount: "", notes: "",
  };
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
    function set(k, v) {
    setForm(f => {
      const next = { ...f, [k]: v };
      // Keep category in sync with whichever group is selected.
      if (k === "categoryGroup") next.category = categoryOptions(v)[0]?.key || "";
      return next;
    });
  }
  async function save() {
    if (saving) return;
    if (!form.amount || parseFloat(form.amount) <= 0) { toast_?.("Enter valid amount", "err"); return; }
    setSaving(true);
    await addPositionEntry(outlet, {
      date: form.date,
      categoryGroup: form.categoryGroup,
      category: form.category,
      direction: form.direction,
      amount: parseFloat(form.amount),
      notes: form.notes,
    });
    toast_?.("Entry saved ✓");
    setForm(f => ({ ...blank, categoryGroup: f.categoryGroup, category: f.category, direction: f.direction }));
    await reload();
    setSaving(false);
  }
  async function remove(id) {
    if (!window.confirm("Delete this entry?")) return;
    await deletePositionEntry(id);
    reload();
  }

  const period = entries
    .filter(e => (!from || e.date >= from) && (!to || e.date <= to))
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

    const label = (group, key) =>
    categoryOptions(group)?.find(c => c.key === key)?.label
    || POSITION_CATEGORIES[group]?.find(c => c.key === key)?.label
    || key;
  const th = { padding: "6px 10px", fontSize: 10, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--mut2,var(--mut))", background: "var(--s3)", borderBottom: "1px solid var(--bdr)" };
  const td = { padding: "6px 10px", fontSize: 12 };

  return (
    <div>
      {/* ── New Entry ── */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="chd"><div><h3>New Position Entry</h3><p>{outlet}</p></div></div>
        <div style={{ padding: 14 }}>
          <div className="fg">
            <div className="ff">
              <label>Date *</label>
              <input type="date" value={form.date} onChange={e => set("date", e.target.value)} />
            </div>
            <div className="ff">
              <label>Group *</label>
              <select value={form.categoryGroup} onChange={e => set("categoryGroup", e.target.value)}>
                {Object.keys(GROUP_LABELS).map(g => <option key={g} value={g}>{GROUP_LABELS[g]}</option>)}
              </select>
            </div>
              <div className="ff">
              <label>Category *</label>
              <select value={form.category} onChange={e => set("category", e.target.value)}>
                {categoryOptions(form.categoryGroup).map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div className="ff">
              <label>Direction *</label>
              <select value={form.direction} onChange={e => set("direction", e.target.value)}>
                <option value="in">Increase balance</option>
                <option value="out">Decrease / recover balance</option>
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
          <h3>Position Ledger</h3>
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
                <th style={{ ...th, textAlign: "left" }}>Group</th>
                <th style={{ ...th, textAlign: "left" }}>Category</th>
                <th style={{ ...th, textAlign: "left" }}>Notes</th>
                <th style={{ ...th, textAlign: "right" }}>Increase</th>
                <th style={{ ...th, textAlign: "right" }}>Decrease</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} style={{ padding: 20, textAlign: "center", color: "var(--mut)" }}>Loading…</td></tr>}
              {!loading && period.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 20, textAlign: "center", color: "var(--mut)" }}>No entries in this period</td></tr>
              )}
              {period.map(e => (
                <tr key={e.id} style={{ borderBottom: "1px solid rgba(63,63,70,.15)" }}>
                  <td style={td}>{e.date}</td>
                  <td style={td}>{GROUP_LABELS[e.category_group] || e.category_group}</td>
                  <td style={td}>{label(e.category_group, e.category)}</td>
                  <td style={{ ...td, color: "var(--mut)" }}>{e.notes || "—"}</td>
                  <td style={{ ...td, textAlign: "right" }}>{e.direction === "in" ? fmt(e.amount) : ""}</td>
                  <td style={{ ...td, textAlign: "right" }}>{e.direction === "out" ? fmt(e.amount) : ""}</td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <button className="btn btnsm no-print" title="Delete" style={{ color: "var(--red)" }} onClick={() => remove(e.id)}>{I.trash}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}