// src/components/staff/S_Dashboard.jsx
import { useState, useEffect, useMemo } from "react";
import { fmt } from "../../utils/helpers";
import { supabase } from "../../supabase";

/* ───────────────────────── Theme ─────────────────────────
   Surfaces, borders and text come from the app's own CSS variables
   (--s1, --bdr, --txt, --mut ...) so this page follows the same theme
   as every other window. The fallbacks only apply if a variable is missing.
   Accent = amber (same as the sidebar highlight). One hue per meaning:
   sales amber · expenses rose · bank blue · payables violet ·
   cash green · receivables teal                                        */
const MONO  = "'JetBrains Mono','IBM Plex Mono','Space Mono',ui-monospace,SFMono-Regular,Menlo,monospace";
const SERIF = "'Playfair Display',serif";

const SURF = "var(--s1, #121214)";
const BORD = "var(--bdr, #2a2a30)";
const MUT  = "var(--mut, #9a9aa6)";
const TXT  = "var(--txt, #ececf0)";

const tone = (hex) => ({
  bg:  `linear-gradient(160deg,color-mix(in srgb,${hex} 11%,${SURF}) 0%,${SURF} 70%)`,
  bd:  `color-mix(in srgb,${hex} 30%,${BORD})`,
  val: hex,
  btn: hex,
});

const T = {
  sales: tone("#fbbf24"),
  exp:   tone("#fb7185"),
  bank:  tone("#60a5fa"),
  ap:    tone("#a78bfa"),
  cash:  tone("#34d399"),
  ar:    tone("#2dd4bf"),
};

const DONUT = ["#f59e0b", "#60a5fa", "#34d399", "#fb7185", "#a78bfa", "#2dd4bf", "#fb923c"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* ───────────────────────── Helpers ───────────────────────── */
const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const sum = (rows, key) => rows.reduce((a, r) => a + (Number(r[key]) || 0), 0);
const net = (rows) => rows.reduce((a, r) => a + ((Number(r.debit) || 0) - (Number(r.credit) || 0)), 0);

// Expense category: adjust the field names here if your expenses table uses another column
const catOf = (e) =>
  
String(e.category || e.expense_type || e.type || e.head || e.account || e.account_id || "Uncategorised").trim() || "Uncategorised";
// Same rule as the In Hand Cash page's "Cash Balance": opening B/F (earliest
// month only) + all entries, Daily Sale de-duplicated per date, and
// Day Sheet count rows excluded.
const cashNet = (rows) => {
  const per = (r) => r.period || String(r.date).slice(0, 7);
  const bfs = rows.filter(r => r.balance_type === "bf")
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const first = bfs.length ? per(bfs[0]) : null;
  const bf = bfs.filter(r => per(r) === first);

  const lastSale = {};
  rows.forEach((e, i) => { if (e.description === "Daily Sale") lastSale[e.date] = i; });
  const body = rows.filter((e, i) =>
    e.balance_type !== "bf" && e.balance_type !== "daysheet" &&
    (e.description !== "Daily Sale" || lastSale[e.date] === i));

   // Same as the In Hand Cash top bar: restart from the latest Day Sheet count,
  // then add only entries dated after it. No Day Sheet → plain formula.
  const ds = rows.filter(r => r.balance_type === "daysheet")
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const last = ds[ds.length - 1];
  if (last) {
    const lastAmt = (Number(last.debit) || 0) - (Number(last.credit) || 0);
    return lastAmt + net(body.filter(e => String(e.date) > String(last.date)));
  }
  return net(bf) + net(body);
};

// Smooth curve through points (horizontal-tangent cubic segments, no overshoot)
const smoothPath = (pts) =>
  pts.reduce((d, [x, y], i) => {
    if (i === 0) return `M${x.toFixed(1)},${y.toFixed(1)}`;
    const [px, py] = pts[i - 1];
    const mx = ((px + x) / 2).toFixed(1);
    return `${d} C${mx},${py.toFixed(1)} ${mx},${y.toFixed(1)} ${x.toFixed(1)},${y.toFixed(1)}`;
  }, "");

/* ───────────────────────── Icons ───────────────────────── */
function Icon({ name, size = 14 }) {
  const paths = {
    up: (<><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></>),
    down: (<><polyline points="22 17 13.5 8.5 8.5 13.5 2 7" /><polyline points="16 17 22 17 22 11" /></>),
    bank: (<><path d="M3 21h18" /><path d="M5 21V10M9.5 21V10M14.5 21V10M19 21V10" /><path d="M2.5 10 12 4l9.5 6" /></>),
    bars: (<path d="M5 21V11M12 21V4M19 21v-7" />),
    gear: (
      <>
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
  }[name];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {paths}
    </svg>
  );
}

/* ───────────────────────── Small pieces ───────────────────────── */
function Btn({ color, icon, onClick, children }) {
  return (
    <button type="button" className="sd-btn" onClick={onClick} style={{ "--c": color }}>
      <Icon name={icon} />
      {children}
    </button>
  );
}

function Card({ t, style, children }) {
  return (
    <div style={{ background: t.bg, border: `1px solid ${t.bd}`, borderRadius: 14, padding: "16px 18px", ...style }}>
      {children}
    </div>
  );
}

function Metric({ label, value, color, size = 22 }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: TXT, opacity: 0.72, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: size, fontWeight: 600, color, letterSpacing: ".01em" }}>Rs.{fmt(value)}</div>
    </div>
  );
}

/* ───────────────────────── Charts (pure SVG) ───────────────────────── */
function TrendChart({ data, id }) {
  const W = 300, H = 104, PX = 10, PT = 10, PB = 22;
  const iw = W - PX * 2, ih = H - PT - PB;
  const max = Math.max(...data.map((d) => d.value), 0) || 1;
  const x = (i) => PX + (data.length < 2 ? iw / 2 : (i * iw) / (data.length - 1));
  const y = (v) => PT + ih - (v / max) * ih * 0.92;
  const pts = data.map((d, i) => [x(i), y(d.value)]);
  const line = smoothPath(pts);
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${PT + ih} L${pts[0][0].toFixed(1)},${PT + ih} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity=".45" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke="#f5a524" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={pts[i][0]} cy={pts[i][1]} r="7" fill="transparent">
            <title>{`${d.label}: Rs.${fmt(d.value)}`}</title>
          </circle>
          {i === data.length - 1 && (
            <circle cx={pts[i][0]} cy={pts[i][1]} r="3.5" fill="#14120c" stroke="#fbbf24" strokeWidth="2" pointerEvents="none" />
          )}
          <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="8.5" fill="#8a8a96">{d.label}</text>
        </g>
      ))}
    </svg>
  );
}

function Ring({ segs, size = 80 }) {
  const R = 30, SW = 14, Ct = 2 * Math.PI * R;
  const total = segs.reduce((a, s) => a + s.value, 0);
  let acc = 0;
  return (
    <svg viewBox="0 0 80 80" width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx="40" cy="40" r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={SW} />
      {total > 0 &&
        segs.map((s) => {
          const len = (s.value / total) * Ct;
          const el = (
            <circle
              key={s.label} cx="40" cy="40" r={R} fill="none" stroke={s.color} strokeWidth={SW}
              strokeDasharray={`${Math.max(len - 1.5, 0)} ${Ct}`} strokeDashoffset={-acc}
              transform="rotate(-90 40 40)"
            >
              <title>{`${s.label}: Rs.${fmt(s.value)} (${((s.value / total) * 100).toFixed(0)}%)`}</title>
            </circle>
          );
          acc += len;
          return el;
        })}
    </svg>
  );
}
function SalesBars({ data }) {
  const W = 640, H = 150, PX = 24, PT = 34, PB = 24;
  const iw = W - PX * 2, ih = H - PT - PB;
  const max = Math.max(...data.map((d) => d.value), 0) || 1;
  const slot = iw / Math.max(data.length, 1);
  const bw = Math.min(40, slot * 0.55), rx = bw / 2, ry = 4.5;
  const base = PT + ih;
  const short = (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : `${(v / 1e3).toFixed(0)}k`);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <linearGradient id="sd-cyl" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#a66a0c" />
          <stop offset="30%"  stopColor="#fbd96a" />
          <stop offset="55%"  stopColor="#f2b223" />
          <stop offset="100%" stopColor="#8f5a08" />
        </linearGradient>
        <linearGradient id="sd-arrow" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%"   stopColor="#f2b223" stopOpacity="0" />
          <stop offset="100%" stopColor="#e0a31a" stopOpacity=".55" />
        </linearGradient>
        <radialGradient id="sd-coin" cx=".35" cy=".3" r=".8">
          <stop offset="0%" stopColor="#fff1a8" />
          <stop offset="100%" stopColor="#d99a12" />
        </radialGradient>
      </defs>

      {/* faint rising arrow (decorative, not data) */}
      <path d={`M${PX},${base - 4} C${W * 0.45},${base - 8} ${W * 0.7},${PT + 6} ${W - PX - 26},${PT - 8}`}
            fill="none" stroke="url(#sd-arrow)" strokeWidth="5" strokeLinecap="round" />
      <polygon points={`${W - PX - 34},${PT - 18} ${W - PX - 8},${PT - 14} ${W - PX - 22},${PT + 4}`}
               fill="#e0a31a" opacity=".55" />

      <line x1={PX} x2={W - PX} y1={base} y2={base} stroke="rgba(255,255,255,.15)" />

      {data.map((d, i) => {
        const h = Math.max((d.value / max) * ih, 8);
        const cx = PX + slot * i + slot / 2;
        const x = cx - rx, y = base - h;
        const last = i === data.length - 1;
        return (
          <g key={d.id ?? i}>
            <ellipse cx={cx} cy={base} rx={rx} ry={ry} fill="#8f5a08" />
            <rect x={x} y={y} width={bw} height={h} fill="url(#sd-cyl)">
              <title>{`${d.date}: Rs.${fmt(d.value)}`}</title>
            </rect>
            <ellipse cx={cx} cy={y} rx={rx} ry={ry} fill="#fff0a6" />
            {last && (
              <g>
                <circle cx={cx} cy={y - 11} r="9" fill="url(#sd-coin)" stroke="#c98a0c" strokeWidth="1" />
                <text x={cx} y={y - 7.5} textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff8d6">$</text>
              </g>
            )}
            <text x={cx} y={y - (last ? 26 : 9)} textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#fde68a">{short(d.value)}</text>
            <text x={cx} y={H - 8} textAnchor="middle" fontSize="8.5" fill="#8a8a96">{d.date.slice(5)}</text>
          </g>
        );
      })}
    </svg>
  );
}
/* ───────────────────────── Main component ─────────────────────────
   onNavigate(key) is optional. Keys used by the buttons:
   "sales" · "expenses" · "bank" · "ap" · "settings"                  */
const EMPTY = { sales: [], expenses: [], cash: [], bank: [], apInv: [], apPay: [], ar: [], card: [], suppliers: [] };

export default function S_Dashboard({ outlet, user, onNavigate }) {
  const [data, setData]       = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!outlet) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    // Sales chart shows the last 8 months, so only fetch that window
    const from = new Date();
    from.setDate(1);
    from.setMonth(from.getMonth() - 7);

    const q = (table) => supabase.from(table).select("*").eq("outlet_id", outlet);

    Promise.all([
      q("sales").gte("date", ymd(from)).order("date", { ascending: false }),
      q("expenses"),
      q("cash_ledger"),
      q("bank_ledger"),
      q("ap_invoices"),
      q("ap_payments"),
            q("ar_ledger"),
           q("card_ledger"),
      supabase.from("suppliers").select("*"),
    ])
      .then((res) => {
        if (cancelled) return;
        const failed = res.find((r) => r.error);
        if (failed) setError(failed.error.message);
          const [sales, expenses, cash, bank, apInv, apPay, ar, card, suppliers] = res.map((r) => r.data || []);
        setData({ sales, expenses, cash, bank, apInv, apPay, ar, card, suppliers });
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [outlet]);

  const m = useMemo(() => {
    const now = new Date();
    const todayStr = ymd(now);
    const monthKey = todayStr.slice(0, 7);

    // 8-month sales trend
    const trend = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      trend.push({ label: MONTHS[d.getMonth()], value: sum(data.sales.filter((s) => String(s.date).slice(0, 7) === key), "total") });
    }

    // Expense breakdown by category (top 6 + Other)
        // Current month only; card interest (from card_ledger) counts as an expense, same as Reports
    const monthExp      = data.expenses.filter((e) => String(e.date).slice(0, 7) === monthKey);
    const monthInterest = sum(data.card.filter((c) => String(c.date).slice(0, 7) === monthKey), "interest");
    const monthTotal    = sum(monthExp, "amount") + monthInterest;
    const cats = {};
    monthExp.forEach((e) => { cats[catOf(e)] = (cats[catOf(e)] || 0) + (Number(e.amount) || 0); });
    if (monthInterest > 0) cats["Card Interest"] = monthInterest;
    const sorted = Object.entries(cats).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    const top = sorted.slice(0, 6);
    const rest = sorted.slice(6).reduce((a, c) => a + c.value, 0);
    if (rest > 0) top.push({ label: "Other", value: rest });
    const segs = top.map((s, i) => ({ ...s, color: DONUT[i % DONUT.length] }));

    const arBilled   = sum(data.ar, "debit");
    const arReceived = sum(data.ar, "credit");

    return {
      trend, segs,
      // newest first (already sorted by the query); skip zero-value sales
      recent: data.sales.filter((s) => Number(s.total) > 0).slice(0, 8),
      todaySales: sum(data.sales.filter((s) => String(s.date).slice(0, 10) === todayStr), "total"),
       mExp:       monthTotal,
      expTotal:   monthTotal,
      cashBal:    cashNet(data.cash),
      bankBal:    net(data.bank),
      // Same as AP window → Suppliers tab: per supplier, invoices − (payments + discount), then total
      apOut:      data.suppliers.reduce((t, s) =>
        t + sum(data.apInv.filter((i) => i.supplier_id === s.id), "amount")
      - sum(data.apPay.filter((p) => p.supplier_id === s.id), "amount")
      - sum(data.apPay.filter((p) => p.supplier_id === s.id), "discount"), 0),
      arBal:      arBilled - arReceived,
      arPct:      arBilled > 0 ? Math.max(0, Math.min(100, (arReceived / arBilled) * 100)) : 0,
      hasAr:      arBilled > 0,
    };
  }, [data]);

  const hour    = new Date().getHours();
  const greet   = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const dateStr = new Date().toLocaleDateString("en-LK", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const name    = user?.username ? user.username.charAt(0).toUpperCase() + user.username.slice(1) : "Staff";
  const go      = (key) => () => onNavigate && onNavigate(key);

  return (
    <>
      <style>{`
        @import url("https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;600&display=swap");
        .sd-btn{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;font-size:11.5px;font-weight:500;
          color:var(--c);background:transparent;border:1px solid var(--c);
          background:color-mix(in srgb,var(--c) 10%,transparent);border:1px solid color-mix(in srgb,var(--c) 75%,transparent);
          cursor:pointer;white-space:nowrap;font-family:inherit;transition:background .15s}
        .sd-btn:hover{background:color-mix(in srgb,var(--c) 24%,transparent)}
        .sd-row1{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:12px}
        .sd-row2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:14px}
        .sd-col3{display:flex;flex-direction:column;gap:12px}
        .sd-col3>*{flex:1}
        .sd-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap}
        @media(max-width:900px){
          .sd-row1{grid-template-columns:repeat(2,minmax(0,1fr))}
          .sd-col3{grid-column:1/-1;flex-direction:row}
        }
        @media(max-width:620px){
          .sd-row1,.sd-row2{grid-template-columns:1fr}
          .sd-col3{flex-direction:column}
        }
      `}</style>

      {/* ── Welcome banner ── */}
      <div style={{ position: "relative", overflow: "hidden", background: `linear-gradient(135deg,color-mix(in srgb,#f59e0b 14%,${SURF}) 0%,${SURF} 65%)`, border: `1px solid color-mix(in srgb,#f59e0b 28%,${BORD})`, borderRadius: 16, padding: "22px 24px", marginBottom: 12 }}>
        <div style={{ position: "absolute", top: -70, right: -40, width: 300, height: 300, background: "radial-gradient(circle,rgba(245,158,11,.16) 0%,transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 10.5, color: MUT, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 6 }}>{greet} 👋</div>
            <div style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 700, color: TXT, marginBottom: 6 }}>{name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: MUT }}>{user?.designation || "Staff"} &nbsp;•&nbsp; {dateStr}</span>
              <button type="button" onClick={go("settings")} title="Settings"
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 9, border: `1px solid ${BORD}`, background: "rgba(255,255,255,.04)", color: MUT, cursor: "pointer" }}>
                <Icon name="gear" size={15} />
              </button>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(155, 153, 19, 0.12)", border: "1px solid rgba(245,158,11,.30)", borderRadius: 9, padding: "8px 16px" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 6px #34d399" }} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "#7f9715", letterSpacing: ".08em", textTransform: "uppercase" }}>{outlet}</span>
            </div>
            <div style={{ fontSize: 11, color: MUT }}>Access: {user?.access || "All windows"}</div>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ background: "rgba(251,113,133,.1)", border: "1px solid rgba(251,113,133,.3)", color: "#fb7185", borderRadius: 10, padding: "10px 14px", fontSize: 12, marginBottom: 12 }}>
          Some data could not be loaded ({error}). Figures below may be incomplete.
        </div>
      )}

      <div style={{ opacity: loading ? 0.55 : 1, transition: "opacity .2s" }}>
        {/* ── Row 1: sales / expenses / bank + AP ── */}
        <div className="sd-row1">
          <Card t={T.sales}>
            <div className="sd-top">
              <Metric label="Today's Sales" value={m.todaySales} color={T.sales.val} />
              <Btn color={T.sales.btn} icon="up" onClick={go("sales")}>View Sales Report</Btn>
            </div>
            <div style={{ marginTop: 14 }}>
              <TrendChart data={m.trend} id="sd-trend" />
            </div>
          </Card>

          <Card t={T.exp}>
            <div className="sd-top">
              <Metric label="Month Expenses" value={m.mExp} color={T.exp.val} />
              <Btn color={T.exp.btn} icon="down" onClick={go("expenses")}>View Expense Log</Btn>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 18 }}>
              <Metric label="Expense Breakdown" value={m.expTotal} color={T.exp.val} size={19} />
              <Ring segs={m.segs} size={72} />
            </div>
          </Card>

          <div className="sd-col3">
            <Card t={T.bank}>
              <div className="sd-top">
                <Metric label="Bank Balance" value={m.bankBal} color={T.bank.val} />
                <Btn color={T.bank.btn} icon="bank" onClick={go("bank")}>Add Transaction</Btn>
              </div>
            </Card>
            <Card t={T.ap}>
              <div className="sd-top">
                <Metric label="Accounts Payable Outstanding" value={m.apOut} color={T.ap.val} />
                <Btn color={T.ap.btn} icon="bars" onClick={go("ap")}>View AP Details</Btn>
              </div>
            </Card>
          </div>
        </div>

        {/* ── Row 2: cash + AR ── */}
        <div className="sd-row2">
          <Card t={T.cash}>
            <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 20 }}>
              <Metric label="Cash in Hand" value={m.cashBal} color={T.cash.val} size={20} />
              <Metric label="AR Balance" value={m.arBal} color={T.ar.val} size={20} />
            </div>
          </Card>
          <Card t={T.ar}>
            <div style={{ fontSize: 13, color: TXT, opacity: 0.72, marginBottom: 12 }}>Accounts Receivable Balance</div>
            <div style={{ height: 12, borderRadius: 8, background: "rgba(255,255,255,.12)", overflow: "hidden" }}>
              <div style={{ width: `${m.arPct}%`, height: "100%", borderRadius: 8, background: "linear-gradient(90deg,#2dd4bf,#5eead4)", transition: "width .6s ease" }} />
            </div>
            <div style={{ fontSize: 10.5, color: MUT, marginTop: 7, textAlign: "right" }}>
              {m.hasAr ? `${m.arPct.toFixed(0)}% collected` : "No receivables yet"}
            </div>
          </Card>
        </div>
                 {/* ── Recent sales (chart) ── */}
        <div style={{ background: SURF, border: `1px solid ${BORD}`, borderRadius: 16, overflow: "hidden" }}>
          <div style={{ padding: "10px 16px 0", fontFamily: SERIF, fontSize: 14, fontWeight: 700, color: TXT }}>Recent Sales</div>
          <div style={{ padding: "2px 16px 8px", maxWidth: 760 }}>
            {!loading && m.recent.length === 0 ? (
              <div style={{ padding: 28, textAlign: "center", color: MUT, fontSize: 13 }}>No sales yet.</div>
            ) : (
              <SalesBars
                data={[...m.recent].reverse().map((s) => ({ id: s.id, date: String(s.date).slice(0, 10), value: Number(s.total) || 0 }))}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}