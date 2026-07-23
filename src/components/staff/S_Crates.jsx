// src/components/staff/S_Crates.jsx
// ─────────────────────────────────────────────────────────────
//  Staff › Crate Ledger
//  Mirrors Excel EMPTY PL sheet's "PLASTIC CRATES" and "WOOD CRATES"
//  blocks: per crate type, daily B/F, Purchase, Received, Returned,
//  Ex, Issued, Sold, Short, Balance columns.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { fmt, today } from "../../utils/helpers";
import { I } from "../../utils/icons";
import { getCrateLedger, upsertCrateEntry, deleteCrateEntry, getCrateBF, setCrateBF } from "../../db";

const CRATE_TYPES = [
  { value: "plastic_wh",     label: "Plastic — W/H",    group: "Plastic Crates" },
  { value: "plastic_ug",     label: "Plastic — UG",     group: "Plastic Crates" },
  { value: "plastic_toddy",  label: "Plastic — Toddy",  group: "Plastic Crates" },
  { value: "plastic_beer",   label: "Plastic — Beer",   group: "Plastic Crates" },
  { value: "wood_ugn",       label: "Wood — UG N",      group: "Wood Crates" },
  { value: "wood_q",         label: "Wood — Q",         group: "Wood Crates" },
  { value: "wood_p",         label: "Wood — P",         group: "Wood Crates" },
  { value: "wood_n",         label: "Wood — N",         group: "Wood Crates" },
];

// ════════════════════════════════════════════════════════════
export default function S_Crates({ outlet, toast_ }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [crateType, setCrateType] = useState(CRATE_TYPES[0].value);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [bf, setBf] = useState(0);
  const [bfInput, setBfInput] = useState("");
  const [saving, setSaving] = useState(false);

  function reload() {
    setLoading(true);
    getCrateLedger(outlet).then(data => { setEntries(data || []); setLoading(false); });
  }
  useEffect(() => { reload(); }, [outlet]);
  useEffect(() => { getCrateBF(outlet, crateType).then(v => { setBf(v); setBfInput(v); }); }, [outlet, crateType]);

  const blank = { date: today(), purchase: "", received: "", returned: "", ex: "", issued: "", sold: "", short: "", notes: "" };
  const [form, setForm] = useState(blank);
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function save() {
    if (saving) return;
    if (!form.date) { toast_?.("Select a date", "err"); return; }
    setSaving(true);
    await upsertCrateEntry(outlet, {
      date: form.date, crateType,
      purchase: parseFloat(form.purchase) || 0,
      received: parseFloat(form.received) || 0,
      returned: parseFloat(form.returned) || 0,
      ex:       parseFloat(form.ex)       || 0,
      issued:   parseFloat(form.issued)   || 0,
      sold:     parseFloat(form.sold)     || 0,
      short:    parseFloat(form.short)    || 0,
      notes:    form.notes,
    });
    toast_?.("Entry saved ✓");
    setForm({ ...blank, date: form.date });
    await reload();
    setSaving(false);
  }

  async function remove(id) {
    if (!window.confirm("Delete this day's entry?")) return;
    await deleteCrateEntry(id);
    reload();
  }

  async function saveBf() {
    await setCrateBF(outlet, crateType, parseFloat(bfInput) || 0);
    setBf(parseFloat(bfInput) || 0);
    toast_?.("Opening balance saved ✓");
    reload();
  }

  const typeRows = entries
    .filter(e => e.crate_type === crateType && e.balance_type !== "bf")
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  const before = from ? typeRows.filter(e => e.date < from) : [];
  const bfAtFrom = bf + before.reduce((a, e) =>
    a + Number(e.purchase||0) + Number(e.received||0) - Number(e.returned||0) - Number(e.ex||0) - Number(e.issued||0) - Number(e.sold||0) - Number(e.short||0), 0);

  const period = typeRows.filter(e => (!from || e.date >= from) && (!to || e.date <= to));

  let running = bfAtFrom;
  const totals = { purchase: 0, received: 0, returned: 0, ex: 0, issued: 0, sold: 0, short: 0 };
  period.forEach(e => { Object.keys(totals).forEach(k => totals[k] += Number(e[k] || 0)); });

  const th = { padding: "6px 8px", fontSize: 10, fontWeight: 700, letterSpacing: ".03em", textTransform: "uppercase", color: "var(--mut2,var(--mut))", background: "var(--s3)", borderBottom: "1px solid var(--bdr)" };
  const td = { padding: "6px 8px", fontSize: 12 };

  return (
    <div>
      {/* ── Crate Type + Opening Balance ── */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="chd">
          <div>
            <h3>Crate Ledger</h3>
            <p>{outlet}</p>
          </div>
        </div>
        <div style={{ padding: 14, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="ff" style={{ minWidth: 200 }}>
            <label>Crate Type *</label>
            <select value={crateType} onChange={e => setCrateType(e.target.value)}>
              {["Plastic Crates", "Wood Crates"].map(g => (
                <optgroup key={g} label={g}>
                  {CRATE_TYPES.filter(t => t.group === g).map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="ff">
            <label>Opening Balance (B/F)</label>
            <input type="number" step="1" value={bfInput} onChange={e => setBfInput(e.target.value)} />
          </div>
          <button className="btn btnsm" onClick={saveBf}>{I.check} Save Opening Balance</button>
        </div>
      </div>

      {/* ── New Entry ── */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="chd">
          <h3>New Daily Entry</h3>
          <p>{CRATE_TYPES.find(t => t.value === crateType)?.label}</p>
        </div>
        <div style={{ padding: 14 }}>
          <div className="fg">
            <div className="ff">
              <label>Date *</label>
              <input type="date" value={form.date} onChange={e => set("date", e.target.value)} />
            </div>
            <div className="ff">
              <label>Purchase</label>
              <input type="number" step="1" placeholder="0" value={form.purchase} onChange={e => set("purchase", e.target.value)} />
            </div>
            <div className="ff">
              <label>Received</label>
              <input type="number" step="1" placeholder="0" value={form.received} onChange={e => set("received", e.target.value)} />
            </div>
            <div className="ff">
              <label>Returned</label>
              <input type="number" step="1" placeholder="0" value={form.returned} onChange={e => set("returned", e.target.value)} />
            </div>
            <div className="ff">
              <label>Ex</label>
              <input type="number" step="1" placeholder="0" value={form.ex} onChange={e => set("ex", e.target.value)} />
            </div>
            <div className="ff">
              <label>Issued</label>
              <input type="number" step="1" placeholder="0" value={form.issued} onChange={e => set("issued", e.target.value)} />
            </div>
            <div className="ff">
              <label>Sold</label>
              <input type="number" step="1" placeholder="0" value={form.sold} onChange={e => set("sold", e.target.value)} />
            </div>
            <div className="ff">
              <label>Short</label>
              <input type="number" step="1" placeholder="0" value={form.short} onChange={e => set("short", e.target.value)} />
            </div>
            <div className="ff" style={{ minWidth: 200 }}>
              <label>Notes</label>
              <input placeholder="Optional note" value={form.notes} onChange={e => set("notes", e.target.value)} />
            </div>
          </div>
          <div style={{ marginTop: 12, textAlign: "right" }}>
            <button className="btn btng" onClick={save} disabled={saving}>{I.check} {saving ? "Saving…" : "Save Entry"}</button>
          </div>
          <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 6 }}>
            One entry per date — saving again for the same date updates that day's row.
          </div>
        </div>
      </div>

      {/* ── Ledger ── */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="chd" style={{ padding: "12px 14px" }}>
          <h3>{CRATE_TYPES.find(t => t.value === crateType)?.label} — Ledger</h3>
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
                <th style={{ ...th, textAlign: "right" }}>Purchase</th>
                <th style={{ ...th, textAlign: "right" }}>Received</th>
                <th style={{ ...th, textAlign: "right" }}>Returned</th>
                <th style={{ ...th, textAlign: "right" }}>Ex</th>
                <th style={{ ...th, textAlign: "right" }}>Issued</th>
                <th style={{ ...th, textAlign: "right" }}>Sold</th>
                <th style={{ ...th, textAlign: "right" }}>Short</th>
                <th style={{ ...th, textAlign: "right" }}>Balance</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ background: "var(--s2)" }}>
                <td style={td} colSpan={8}><strong>Balance B/F</strong></td>
                <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{fmt(bfAtFrom)}</td>
                <td style={td}></td>
              </tr>

              {loading && <tr><td colSpan={10} style={{ padding: 20, textAlign: "center", color: "var(--mut)" }}>Loading…</td></tr>}
              {!loading && period.length === 0 && (
                <tr><td colSpan={10} style={{ padding: 20, textAlign: "center", color: "var(--mut)" }}>No entries in this period</td></tr>
              )}

              {period.map(e => {
                running += Number(e.purchase||0) + Number(e.received||0) - Number(e.returned||0) - Number(e.ex||0) - Number(e.issued||0) - Number(e.sold||0) - Number(e.short||0);
                return (
                  <tr key={e.id} style={{ borderBottom: "1px solid rgba(63,63,70,.15)" }}>
                    <td style={td}>{e.date}</td>
                    <td style={{ ...td, textAlign: "right" }}>{e.purchase > 0 ? fmt(e.purchase) : ""}</td>
                    <td style={{ ...td, textAlign: "right" }}>{e.received > 0 ? fmt(e.received) : ""}</td>
                    <td style={{ ...td, textAlign: "right" }}>{e.returned > 0 ? fmt(e.returned) : ""}</td>
                    <td style={{ ...td, textAlign: "right" }}>{e.ex > 0 ? fmt(e.ex) : ""}</td>
                    <td style={{ ...td, textAlign: "right" }}>{e.issued > 0 ? fmt(e.issued) : ""}</td>
                    <td style={{ ...td, textAlign: "right" }}>{e.sold > 0 ? fmt(e.sold) : ""}</td>
                    <td style={{ ...td, textAlign: "right" }}>{e.short > 0 ? fmt(e.short) : ""}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{fmt(running)}</td>
                    <td style={{ ...td, textAlign: "center" }}>
                      <button className="btn btnsm no-print" title="Delete" style={{ color: "var(--red)" }} onClick={() => remove(e.id)}>{I.trash}</button>
                    </td>
                  </tr>
                );
              })}

              <tr style={{ background: "var(--s2)" }}>
                <td style={td} colSpan={8}><strong>Balance C/D</strong></td>
                <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{fmt(running)}</td>
                <td style={td}></td>
              </tr>
              <tr style={{ background: "var(--s3)", borderTop: "2px solid var(--bdr2,var(--bdr))" }}>
                <td style={{ ...td, fontWeight: 700 }}>Total</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{fmt(totals.purchase)}</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{fmt(totals.received)}</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{fmt(totals.returned)}</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{fmt(totals.ex)}</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{fmt(totals.issued)}</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{fmt(totals.sold)}</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{fmt(totals.short)}</td>
                <td style={td}></td>
                <td style={td}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}