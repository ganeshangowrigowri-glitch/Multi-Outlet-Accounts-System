import ChartOfAccounts from "./ChartOfAccounts";
import { useState, useMemo } from "react";
import SalesPage from "./SalesPage";
// ═══════════════════════════════════════════════════════
//  MOCK USER (replace with real session in full system)
// ═══════════════════════════════════════════════════════
const MOCK_USER = {
  username: "kishobana",
  outlet: "CARVELLO",
  designation: "Subject Clerk",
  access: "All windows",
};

// ═══════════════════════════════════════════════════════
//  SEED DATA
// ═══════════════════════════════════════════════════════
const SUPPLIERS = ["2001-DCSL","2002-LION BREWERY","2003-UG","2004-IDL","2005-ROCKLAND","2006-DCSL BEER","2007-TODDY","2008-LUXURY BRAND","2009-SIGNATURE","2010-JSP","2011-VA"];
const SUP_SHORT = {"2001-DCSL":"DCSL","2002-LION BREWERY":"LION BREWERY","2003-UG":"UG","2004-IDL":"IDL","2005-ROCKLAND":"ROCKLAND","2006-DCSL BEER":"DCSL BEER","2007-TODDY":"TODDY","2008-LUXURY BRAND":"LUXURY BRAND","2009-SIGNATURE":"SIGNATURE","2010-JSP":"JSP","2011-VA":"VA"};

const EXPENSE_CATS = [
  "Discount - Customer","N/Cooly","Transport","AM & Other Commission",
  "Mess","General","Shop Minor","Shop Inventory","Head Office",
  "Colombo Office","Badulla Office","N'Eliya Office","Electricity Bill",
  "Water Bill","Telephone Bill","Telecom Bill","Shop Insurance",
  "Photocopy","Stationery","Laundry Bill","Staff Salary","Extra Salary",
  "EPF/ETF","Medical","Security","Bank Charge","VAT","Income Tax","Other",
];

const SEED_ITEMS = [
  {code:"D0001",name:"DES Q",supplier:"2001-DCSL",unitCost:3322,sellingPrice:3680},
  {code:"D0002",name:"DES P",supplier:"2001-DCSL",unitCost:1665,sellingPrice:1890},
  {code:"D0003",name:"DES N",supplier:"2001-DCSL",unitCost:787,sellingPrice:950},
  {code:"D0006",name:"DVS Q",supplier:"2001-DCSL",unitCost:3988,sellingPrice:4400},
  {code:"D0010",name:"DWL Q",supplier:"2001-DCSL",unitCost:3530,sellingPrice:3890},
  {code:"D0021",name:"DBO Q",supplier:"2001-DCSL",unitCost:3621,sellingPrice:4000},
  {code:"D0033",name:"DGB Q",supplier:"2001-DCSL",unitCost:4949,sellingPrice:5450},
  {code:"B0001",name:"BLA Q",supplier:"2002-LION BREWERY",unitCost:463,sellingPrice:500},
  {code:"B0005",name:"BCB Q",supplier:"2002-LION BREWERY",unitCost:491,sellingPrice:540},
  {code:"B0009",name:"BST Q",supplier:"2002-LION BREWERY",unitCost:677,sellingPrice:730},
  {code:"U0001",name:"E Q",supplier:"2003-UG",unitCost:3430,sellingPrice:3080},
  {code:"U0007",name:"UL Q",supplier:"2003-UG",unitCost:3140,sellingPrice:2850},
  {code:"I0001",name:"IOR Q",supplier:"2004-IDL",unitCost:4757,sellingPrice:5200},
  {code:"I0004",name:"IOA Q",supplier:"2004-IDL",unitCost:3929,sellingPrice:4330},
  {code:"R0001",name:"RGC Q",supplier:"2005-ROCKLAND",unitCost:3620,sellingPrice:4000},
];

const EMPTY_ITEMS = [
  {code:"DEMP1",name:"DES EMP 1",rate:60},
  {code:"DEMP2",name:"DES EMP 2",rate:60},
  {code:"DEMP3",name:"DES EMP 3",rate:60},
  {code:"BEMP1",name:"BEER EMP",rate:100},
  {code:"TEMP1",name:"TOD EMP",rate:50},
  {code:"UEMP1",name:"UG EMP",rate:60},
  {code:"HEMP1",name:"HEI EMP",rate:100},
];

// ═══════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════
const ls  = (k,d) => { try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch{return d;} };
const lss = (k,v) => { try{localStorage.setItem(k,JSON.stringify(v));}catch{} };
const fmt = n => n!=null&&n!==""?Number(n).toLocaleString("en-LK",{minimumFractionDigits:2,maximumFractionDigits:2}):"0.00";
const today = () => new Date().toISOString().split("T")[0];
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,6);

// ═══════════════════════════════════════════════════════
//  ICONS
// ═══════════════════════════════════════════════════════
const Ic = {
  home:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  sale:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
  purchase: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
  transfer: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>,
  returns:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>,
  payment:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  expense:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  report:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  plus:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  trash:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>,
  check:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  x:        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  logout:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  print:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
  eye:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
};

// ═══════════════════════════════════════════════════════
//  CSS
// ═══════════════════════════════════════════════════════
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;0,9..144,600;1,9..144,400&family=DM+Sans:wght@300;400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#f5f0e8;--surf:#ffffff;--surf2:#f0ebe0;--border:#e0d8cc;
  --ink:#1a1612;--muted:#7a7166;--muted2:#a89f93;
  --amber:#c47d2a;--amber-dim:rgba(196,125,42,.12);--amber-dim2:rgba(196,125,42,.06);
  --green:#2d7a4f;--red:#c0392b;--blue:#2563a8;
  --r:10px;--rl:16px;
  --shadow:0 2px 12px rgba(26,22,18,.08);
  --shadow-lg:0 8px 40px rgba(26,22,18,.14);
}
body{font-family:'DM Sans',sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;}

/* Shell */
.shell{display:flex;height:100vh;overflow:hidden;}
.sidebar{width:238px;background:var(--ink);display:flex;flex-direction:column;flex-shrink:0;}
.sb-top{padding:22px 18px 16px;border-bottom:1px solid rgba(255,255,255,.08);}
.sb-outlet{display:inline-flex;align-items:center;gap:7px;background:rgba(196,125,42,.2);
  color:#f0c060;border-radius:20px;padding:4px 12px;font-size:11px;font-weight:600;
  letter-spacing:.04em;text-transform:uppercase;margin-bottom:10px;}
.sb-name{font-family:'Fraunces',serif;font-size:17px;color:#fff;line-height:1.2;}
.sb-role{font-size:11px;color:rgba(255,255,255,.4);margin-top:2px;}
.sb-nav{flex:1;padding:14px 10px;overflow-y:auto;}
.sb-label{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;
  color:rgba(255,255,255,.25);padding:0 8px;margin-bottom:5px;margin-top:14px;}
.sb-label:first-child{margin-top:0;}
.nav-btn{display:flex;align-items:center;gap:10px;width:100%;padding:9px 10px;
  border-radius:9px;border:none;background:none;cursor:pointer;
  font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;
  color:rgba(255,255,255,.5);text-align:left;transition:all .15s;}
.nav-btn svg{width:16px;height:16px;flex-shrink:0;}
.nav-btn:hover{background:rgba(255,255,255,.07);color:#fff;}
.nav-btn.act{background:rgba(196,125,42,.2);color:#f0c060;}
.sb-foot{padding:14px 12px;border-top:1px solid rgba(255,255,255,.08);}
.user-row{display:flex;align-items:center;gap:9px;padding:10px;
  background:rgba(255,255,255,.05);border-radius:10px;}
.u-av{width:32px;height:32px;border-radius:8px;background:var(--amber);
  display:flex;align-items:center;justify-content:center;
  font-size:12px;font-weight:700;color:#fff;flex-shrink:0;}
.u-name{font-size:13px;font-weight:600;color:#fff;flex:1;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.logout-btn{background:none;border:none;cursor:pointer;
  color:rgba(255,255,255,.35);width:18px;height:18px;padding:0;flex-shrink:0;}
.logout-btn svg{width:18px;height:18px;}
.logout-btn:hover{color:var(--red);}

/* Main */
.main{flex:1;display:flex;flex-direction:column;overflow:hidden;background:var(--bg);}
.topbar{background:var(--surf);border-bottom:1px solid var(--border);
  padding:18px 28px;display:flex;align-items:center;justify-content:space-between;
  box-shadow:var(--shadow);flex-shrink:0;}
.topbar-left h1{font-family:'Fraunces',serif;font-size:22px;color:var(--ink);}
.topbar-left p{font-size:12px;color:var(--muted);margin-top:3px;}
.page-content{flex:1;overflow-y:auto;padding:24px 28px;}

/* Home hero */
.hero{background:var(--ink);border-radius:var(--rl);padding:32px;margin-bottom:20px;
  position:relative;overflow:hidden;}
.hero::before{content:'';position:absolute;inset:0;
  background:repeating-linear-gradient(45deg,transparent,transparent 20px,rgba(196,125,42,.04) 20px,rgba(196,125,42,.04) 21px);}
.hero-greet{font-family:'Fraunces',serif;font-size:28px;color:#fff;position:relative;margin-bottom:6px;}
.hero-sub{font-size:13px;color:rgba(255,255,255,.5);position:relative;}
.hero-outlet{display:inline-flex;align-items:center;gap:6px;background:rgba(196,125,42,.2);
  color:#f0c060;border-radius:20px;padding:5px 14px;font-size:12px;font-weight:600;
  margin-top:14px;position:relative;}
.mod-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;}
.mod-card{background:var(--surf);border:1.5px solid var(--border);border-radius:var(--rl);
  padding:20px 16px;cursor:pointer;transition:all .18s;text-align:center;
  box-shadow:var(--shadow);}
.mod-card:hover{border-color:var(--amber);box-shadow:0 4px 20px rgba(196,125,42,.15);
  transform:translateY(-2px);}
.mod-icon{width:44px;height:44px;border-radius:12px;background:var(--amber-dim);
  display:flex;align-items:center;justify-content:center;margin:0 auto 12px;}
.mod-icon svg{width:20px;height:20px;color:var(--amber);}
.mod-label{font-size:13px;font-weight:600;color:var(--ink);}
.mod-sub{font-size:11px;color:var(--muted);margin-top:3px;}

/* Cards */
.card{background:var(--surf);border:1px solid var(--border);border-radius:var(--rl);
  overflow:hidden;margin-bottom:16px;box-shadow:var(--shadow);}
.card-hd{padding:16px 20px;border-bottom:1px solid var(--border);
  display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;}
.card-hd-left h3{font-family:'Fraunces',serif;font-size:17px;}
.card-hd-left p{font-size:12px;color:var(--muted);margin-top:2px;}
.card-body{padding:20px;}

/* Form */
.f-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
.f-grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;}
.field{margin-bottom:0;}
.field label{display:block;font-size:11px;font-weight:700;letter-spacing:.07em;
  text-transform:uppercase;color:var(--muted);margin-bottom:5px;}
.field input,.field select,.field textarea{width:100%;padding:10px 13px;
  background:var(--surf2);border:1.5px solid var(--border);border-radius:9px;
  font-size:13.5px;font-family:'DM Sans',sans-serif;color:var(--ink);outline:none;
  transition:border-color .15s;appearance:none;resize:vertical;}
.field input:focus,.field select:focus,.field textarea:focus{border-color:var(--amber);}
.field input::placeholder{color:var(--muted2);}
.full{grid-column:1/-1;}

/* Line items table */
.line-table{width:100%;border-collapse:collapse;font-size:13px;margin-top:4px;}
.line-table th{padding:9px 12px;text-align:left;font-size:10px;font-weight:700;
  letter-spacing:.07em;text-transform:uppercase;color:var(--muted);
  background:var(--surf2);border-bottom:1px solid var(--border);}
.line-table td{padding:8px 10px;border-bottom:1px solid var(--border);vertical-align:middle;}
.line-table tr:last-child td{border:none;}
.line-table input,.line-table select{width:100%;padding:7px 9px;background:var(--surf);
  border:1.5px solid var(--border);border-radius:7px;font-size:13px;
  font-family:'DM Sans',sans-serif;color:var(--ink);outline:none;appearance:none;}
.line-table input:focus,.line-table select:focus{border-color:var(--amber);}
.line-num{font-family:'DM Mono',monospace;font-size:12px;color:var(--muted);width:40px;}
.add-row-btn{display:flex;align-items:center;gap:6px;padding:9px 14px;
  background:var(--amber-dim2);border:1.5px dashed var(--amber);border-radius:9px;
  color:var(--amber);font-size:13px;font-weight:600;cursor:pointer;width:100%;
  font-family:'DM Sans',sans-serif;transition:all .15s;margin-top:10px;}
.add-row-btn:hover{background:var(--amber-dim);}
.add-row-btn svg{width:14px;height:14px;}

/* Totals */
.totals-box{background:var(--surf2);border:1px solid var(--border);border-radius:var(--r);
  padding:16px 18px;margin-top:14px;}
.total-row{display:flex;justify-content:space-between;align-items:center;
  padding:5px 0;font-size:13.5px;}
.total-row.grand{border-top:1.5px solid var(--border);margin-top:8px;padding-top:12px;
  font-size:16px;font-weight:700;}
.total-label{color:var(--muted);}
.total-val{font-family:'DM Mono',monospace;font-weight:600;}
.grand .total-val{color:var(--amber);font-size:18px;}

/* Buttons */
.btn{display:inline-flex;align-items:center;gap:7px;padding:10px 18px;
  border-radius:9px;font-size:13px;font-weight:600;cursor:pointer;border:none;
  font-family:'DM Sans',sans-serif;transition:all .15s;}
.btn svg{width:15px;height:15px;}
.btn-primary{background:var(--ink);color:#fff;}
.btn-primary:hover{background:#2d2820;}
.btn-amber{background:var(--amber);color:#fff;}
.btn-amber:hover{opacity:.9;}
.btn-outline{background:transparent;color:var(--ink);border:1.5px solid var(--border);}
.btn-outline:hover{border-color:var(--amber);color:var(--amber);}
.btn-ghost{background:none;border:none;cursor:pointer;color:var(--muted);
  padding:5px 7px;border-radius:6px;display:inline-flex;align-items:center;
  font-family:'DM Sans',sans-serif;}
.btn-ghost:hover{color:var(--red);background:rgba(192,57,43,.07);}
.btn-ghost svg{width:15px;height:15px;}
.btn-sm{padding:7px 12px;font-size:12px;}

/* History list */
.hist-item{padding:14px 18px;border-bottom:1px solid var(--border);
  display:flex;align-items:center;justify-content:space-between;gap:12px;}
.hist-item:last-child{border:none;}
.hist-date{font-size:11px;color:var(--muted);font-family:'DM Mono',monospace;
  background:var(--surf2);padding:3px 8px;border-radius:6px;flex-shrink:0;}
.hist-desc{font-size:13px;font-weight:600;flex:1;}
.hist-sub{font-size:12px;color:var(--muted);margin-top:2px;}
.hist-amt{font-family:'DM Mono',monospace;font-weight:700;font-size:15px;flex-shrink:0;}
.hist-amt.in{color:var(--green);}
.hist-amt.out{color:var(--red);}
.hist-amt.neutral{color:var(--amber);}

/* Badge */
.badge{display:inline-flex;align-items:center;padding:3px 10px;
  border-radius:20px;font-size:11px;font-weight:600;}
.b-green{background:rgba(45,122,79,.1);color:var(--green);}
.b-red{background:rgba(192,57,43,.1);color:var(--red);}
.b-amber{background:var(--amber-dim);color:var(--amber);}
.b-blue{background:rgba(37,99,168,.1);color:var(--blue);}

/* Section divider */
.section-title{font-family:'Fraunces',serif;font-size:16px;color:var(--ink);
  margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid var(--amber);
  display:inline-block;}

/* Stats strip */
.stats-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px;}
.stat-card{background:var(--surf);border:1px solid var(--border);border-radius:var(--rl);
  padding:16px 18px;box-shadow:var(--shadow);}
.stat-val{font-family:'Fraunces',serif;font-size:24px;color:var(--amber);}
.stat-lbl{font-size:11px;color:var(--muted);margin-top:3px;}

/* Report table */
.rep-table{width:100%;border-collapse:collapse;font-size:13px;}
.rep-table th{padding:10px 14px;text-align:left;font-size:10px;font-weight:700;
  letter-spacing:.07em;text-transform:uppercase;color:var(--muted);
  background:var(--surf2);border-bottom:2px solid var(--border);}
.rep-table td{padding:11px 14px;border-bottom:1px solid var(--border);}
.rep-table tr:last-child td{border:none;}
.rep-table tr:hover{background:var(--amber-dim2);}
.rep-table .mono{font-family:'DM Mono',monospace;}
.rep-total{background:var(--surf2);font-weight:700;}

/* Toast */
.toast{position:fixed;bottom:22px;right:22px;z-index:9999;
  background:var(--ink);color:#fff;border-radius:11px;
  padding:12px 18px;font-size:13px;font-weight:500;
  display:flex;align-items:center;gap:9px;
  box-shadow:var(--shadow-lg);animation:pop .2s;}
@keyframes pop{from{transform:translateY(12px);opacity:0}to{transform:translateY(0);opacity:1}}
.toast svg{width:16px;height:16px;flex-shrink:0;}
.t-ok{border-left:3px solid var(--green);}
.t-ok svg{color:var(--green);}
.t-err{border-left:3px solid var(--red);}
.t-err svg{color:var(--red);}

/* Empty state */
.empty-state{padding:40px;text-align:center;color:var(--muted);}
.empty-state svg{width:36px;height:36px;margin:0 auto 12px;display:block;opacity:.3;}
.empty-state p{font-size:14px;}
`;

// ═══════════════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════════════
function Toast({msg,type,onDone}){
  useState(()=>{const t=setTimeout(onDone,2800);return()=>clearTimeout(t);});
  return <div className={`toast ${type==="ok"?"t-ok":"t-err"}`}>{type==="ok"?Ic.check:Ic.x}{msg}</div>;
}

// ═══════════════════════════════════════════════════════
//  HOME PAGE
// ═══════════════════════════════════════════════════════
function HomePage({user, goTo}){
  const modules=[
    {id:"sales",     label:"Record Sales",      sub:"Daily sale entry",      icon:Ic.sale},
    {id:"purchase",  label:"Record Purchase",    sub:"Supplier invoices",     icon:Ic.purchase},
    {id:"transfer",  label:"Transfer In / Out",  sub:"Move stock",            icon:Ic.transfer},
    {id:"returns",   label:"Return Goods",       sub:"Customer returns",      icon:Ic.returns},
    {id:"payments",  label:"Record Payments",    sub:"Pay suppliers",         icon:Ic.payment},
    {id:"expenses",  label:"Record Expenses",    sub:"Daily expenses",        icon:Ic.expense},
    {id:"reports",   label:"View Reports",       sub:"Sales & summaries",     icon:Ic.report},
  ];
  const sales   = ls(`sales_${user.outlet}`,[]);
  const expenses= ls(`expenses_${user.outlet}`,[]);
  const today_sales = sales.filter(s=>s.date===today()).reduce((a,s)=>a+s.total,0);
  const month_exp   = expenses.filter(e=>e.date.slice(0,7)===today().slice(0,7)).reduce((a,e)=>a+e.amount,0);
  return(
    <>
      <div className="hero">
        <div className="hero-greet">Good day, {user.username.charAt(0).toUpperCase()+user.username.slice(1)} 👋</div>
        <div className="hero-sub">{new Date().toLocaleDateString("en-LK",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</div>
        <div className="hero-outlet">📍 {user.outlet}</div>
      </div>
      <div className="stats-strip">
        <div className="stat-card"><div className="stat-val">Rs.{fmt(today_sales)}</div><div className="stat-lbl">Today's Sales</div></div>
        <div className="stat-card"><div className="stat-val">{sales.filter(s=>s.date===today()).length}</div><div className="stat-lbl">Sales Entries Today</div></div>
        <div className="stat-card"><div className="stat-val">Rs.{fmt(month_exp)}</div><div className="stat-lbl">This Month Expenses</div></div>
      </div>
      <div className="mod-grid">
        {modules.map(m=>(
          <div className="mod-card" key={m.id} onClick={()=>goTo(m.id)}>
            <div className="mod-icon">{m.icon}</div>
            <div className="mod-label">{m.label}</div>
            <div className="mod-sub">{m.sub}</div>
          </div>
        ))}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════
//  SALES PAGE
// ═══════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════
//  PURCHASE PAGE
// ═══════════════════════════════════════════════════════
function PurchasePage({user,toast}){
  const key=`purchases_${user.outlet}`;
  const [records,setRecs]=useState(()=>ls(key,[]));
  const [date,setDate]=useState(today());
  const [supplier,setSupplier]=useState("2001-DCSL");
  const [invoiceNo,setInvoiceNo]=useState("");
  const [lines,setLines]=useState([{id:uid(),itemCode:"",itemName:"",type:"Q",qty:"",unitCost:"",discount:"",amount:0}]);
  const [lateCharge,setLateCharge]=useState("");

  function save(data){setRecs(data);lss(key,data);}

  function updateLine(id,field,val){
    setLines(prev=>prev.map(l=>{
      if(l.id!==id)return l;
      const u={...l,[field]:val};
      if(field==="itemCode"){
        const item=SEED_ITEMS.find(i=>i.code===val&&i.supplier===supplier);
        if(item){u.itemName=item.name;u.unitCost=item.unitCost;}
      }
      const gross=(parseFloat(u.qty)||0)*(parseFloat(u.unitCost)||0);
      const disc=(parseFloat(u.discount)||0);
      u.amount=gross-disc;
      return u;
    }));
  }
  function addLine(){setLines(p=>[...p,{id:uid(),itemCode:"",itemName:"",type:"Q",qty:"",unitCost:"",discount:"",amount:0}]);}
  function removeLine(id){setLines(p=>p.filter(l=>l.id!==id));}

  const subtotal=lines.reduce((s,l)=>s+(l.amount||0),0);
  const totalDiscount=lines.reduce((s,l)=>s+(parseFloat(l.discount)||0),0);
  const grandTotal=subtotal-(parseFloat(lateCharge)||0);

  function submit(){
    if(!invoiceNo){toast("Enter invoice number","err");return;}
    if(!lines[0].itemCode){toast("Add at least one item","err");return;}
    const rec={id:uid(),date,supplier,invoiceNo,lines,subtotal,totalDiscount,lateCharge:parseFloat(lateCharge)||0,grandTotal,outlet:user.outlet,by:user.username};
    save([rec,...records]);
    toast("Purchase recorded ✓");
    setLines([{id:uid(),itemCode:"",itemName:"",type:"Q",qty:"",unitCost:"",discount:"",amount:0}]);
    setInvoiceNo("");setLateCharge("");
  }

  return(
    <>
      <div className="card">
        <div className="card-hd"><div className="card-hd-left"><h3>Record Purchase</h3><p>Enter supplier invoice details</p></div></div>
        <div className="card-body">
          <div className="f-grid" style={{marginBottom:16}}>
            <div className="field"><label>Date</label><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
            <div className="field"><label>Supplier</label>
              <select value={supplier} onChange={e=>setSupplier(e.target.value)}>
                {SUPPLIERS.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="field"><label>Invoice No *</label><input placeholder="INV-0001" value={invoiceNo} onChange={e=>setInvoiceNo(e.target.value)}/></div>
          </div>
          <div style={{overflowX:"auto"}}>
            <table className="line-table">
              <thead><tr><th>#</th><th>Item Code</th><th>Description</th><th>Type</th><th>Qty</th><th>Unit Cost</th><th>Discount</th><th>Amount</th><th></th></tr></thead>
              <tbody>
                {lines.map((l,i)=>(
                  <tr key={l.id}>
                    <td className="line-num">{i+1}</td>
                    <td><select value={l.itemCode} onChange={e=>updateLine(l.id,"itemCode",e.target.value)}>
                      <option value="">Select…</option>
                      {SEED_ITEMS.filter(it=>it.supplier===supplier).map(it=><option key={it.code} value={it.code}>{it.code}</option>)}
                    </select></td>
                    <td style={{fontSize:12,color:"var(--muted)"}}>{l.itemName||"—"}</td>
                    <td style={{width:70}}><select value={l.type} onChange={e=>updateLine(l.id,"type",e.target.value)}>
                      {["Q","P","N","CN","5N","5Q"].map(t=><option key={t}>{t}</option>)}
                    </select></td>
                    <td style={{width:70}}><input type="number" placeholder="0" value={l.qty} onChange={e=>updateLine(l.id,"qty",e.target.value)}/></td>
                    <td style={{width:100}}><input type="number" placeholder="0.00" value={l.unitCost} onChange={e=>updateLine(l.id,"unitCost",e.target.value)}/></td>
                    <td style={{width:90}}><input type="number" placeholder="0.00" value={l.discount} onChange={e=>updateLine(l.id,"discount",e.target.value)}/></td>
                    <td style={{fontFamily:"'DM Mono',monospace",fontWeight:600}}>{fmt(l.amount)}</td>
                    <td><button className="btn-ghost" onClick={()=>removeLine(l.id)}>{Ic.trash}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="add-row-btn" onClick={addLine}>{Ic.plus} Add Item</button>
          <div className="totals-box">
            <div className="total-row"><span className="total-label">Subtotal</span><span className="total-val">Rs. {fmt(subtotal)}</span></div>
            <div className="total-row"><span className="total-label">Total Discount Received</span><span className="total-val" style={{color:"var(--green)"}}>-Rs. {fmt(totalDiscount)}</span></div>
            <div className="f-grid" style={{marginTop:10}}>
              <div className="field"><label>Late Payment Charge</label><input type="number" placeholder="0.00" value={lateCharge} onChange={e=>setLateCharge(e.target.value)}/></div>
            </div>
            <div className="total-row grand"><span className="total-label">Balance Due</span><span className="total-val">Rs. {fmt(grandTotal)}</span></div>
          </div>
          <div style={{marginTop:16}}><button className="btn btn-primary" onClick={submit}>{Ic.check} Save Purchase</button></div>
        </div>
      </div>
      <div className="card">
        <div className="card-hd"><div className="card-hd-left"><h3>Purchase History</h3><p>{records.length} records</p></div></div>
        {records.length===0
          ? <div className="empty-state">{Ic.purchase}<p>No purchases recorded yet.</p></div>
          : records.slice(0,15).map(r=>(
            <div className="hist-item" key={r.id}>
              <span className="hist-date">{r.date}</span>
              <div style={{flex:1}}>
                <div className="hist-desc">{SUP_SHORT[r.supplier]||r.supplier} · {r.invoiceNo}</div>
                <div className="hist-sub">{r.lines.length} item{r.lines.length!==1?"s":""} · By {r.by}</div>
              </div>
              <span className="hist-amt out">-Rs.{fmt(r.grandTotal)}</span>
            </div>
          ))
        }
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════
//  TRANSFER PAGE
// ═══════════════════════════════════════════════════════
function TransferPage({user,toast}){
  const key=`transfers_${user.outlet}`;
  const [records,setRecs]=useState(()=>ls(key,[]));
  const [type,setType]=useState("in");
  const [date,setDate]=useState(today());
  const [fromTo,setFromTo]=useState("");
  const [lines,setLines]=useState([{id:uid(),itemCode:"",itemName:"",qty:"",unitCost:"",stockValue:0}]);

  function save(d){setRecs(d);lss(key,d);}
  function updateLine(id,field,val){
    setLines(prev=>prev.map(l=>{
      if(l.id!==id)return l;
      const u={...l,[field]:val};
      if(field==="itemCode"){const it=SEED_ITEMS.find(i=>i.code===val);if(it){u.itemName=it.name;u.unitCost=it.unitCost;}}
      u.stockValue=(parseFloat(u.qty)||0)*(parseFloat(u.unitCost)||0);
      return u;
    }));
  }
  function addLine(){setLines(p=>[...p,{id:uid(),itemCode:"",itemName:"",qty:"",unitCost:"",stockValue:0}]);}
  function removeLine(id){setLines(p=>p.filter(l=>l.id!==id));}
  const total=lines.reduce((s,l)=>s+(l.stockValue||0),0);

  function submit(){
    if(!fromTo){toast(`Enter ${type==="in"?"from":"to"} outlet`,"err");return;}
    if(!lines[0].itemCode){toast("Add at least one item","err");return;}
    const rec={id:uid(),date,type,fromTo,lines,total,outlet:user.outlet,by:user.username};
    save([rec,...records]);
    toast(`Transfer ${type==="in"?"In":"Out"} recorded ✓`);
    setLines([{id:uid(),itemCode:"",itemName:"",qty:"",unitCost:"",stockValue:0}]);
    setFromTo("");
  }

  return(
    <>
      <div className="card">
        <div className="card-hd"><div className="card-hd-left"><h3>Transfer Goods</h3><p>Transfer stock between outlets</p></div></div>
        <div className="card-body">
          <div style={{display:"flex",gap:8,marginBottom:18}}>
            <button className={`btn ${type==="in"?"btn-primary":"btn-outline"}`} onClick={()=>setType("in")}>{Ic.transfer} Transfer In</button>
            <button className={`btn ${type==="out"?"btn-primary":"btn-outline"}`} onClick={()=>setType("out")}>{Ic.transfer} Transfer Out</button>
          </div>
          <div className="f-grid" style={{marginBottom:16}}>
            <div className="field"><label>Date</label><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
            <div className="field"><label>{type==="in"?"From Outlet":"To Outlet"}</label>
              <input placeholder="Outlet name" value={fromTo} onChange={e=>setFromTo(e.target.value)}/>
            </div>
          </div>
          <div style={{overflowX:"auto"}}>
            <table className="line-table">
              <thead><tr><th>#</th><th>Item Code</th><th>Description</th><th>Qty</th><th>Unit Cost</th><th>Stock Value</th><th></th></tr></thead>
              <tbody>
                {lines.map((l,i)=>(
                  <tr key={l.id}>
                    <td className="line-num">{i+1}</td>
                    <td><select value={l.itemCode} onChange={e=>updateLine(l.id,"itemCode",e.target.value)}>
                      <option value="">Select…</option>
                      {SEED_ITEMS.map(it=><option key={it.code} value={it.code}>{it.code} — {it.name}</option>)}
                    </select></td>
                    <td style={{fontSize:12,color:"var(--muted)"}}>{l.itemName||"—"}</td>
                    <td style={{width:80}}><input type="number" placeholder="0" value={l.qty} onChange={e=>updateLine(l.id,"qty",e.target.value)}/></td>
                    <td style={{width:110}}><input type="number" placeholder="0.00" value={l.unitCost} onChange={e=>updateLine(l.id,"unitCost",e.target.value)}/></td>
                    <td style={{fontFamily:"'DM Mono',monospace",fontWeight:600,color:type==="in"?"var(--green)":"var(--red)"}}>{fmt(l.stockValue)}</td>
                    <td><button className="btn-ghost" onClick={()=>removeLine(l.id)}>{Ic.trash}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="add-row-btn" onClick={addLine}>{Ic.plus} Add Item</button>
          <div className="totals-box">
            <div className="total-row grand">
              <span className="total-label">Total Stock Value</span>
              <span className="total-val">Rs. {fmt(total)}</span>
            </div>
          </div>
          <div style={{marginTop:16}}><button className="btn btn-primary" onClick={submit}>{Ic.check} Save Transfer {type==="in"?"In":"Out"}</button></div>
        </div>
      </div>
      <div className="card">
        <div className="card-hd"><div className="card-hd-left"><h3>Transfer History</h3><p>{records.length} records</p></div></div>
        {records.length===0
          ? <div className="empty-state">{Ic.transfer}<p>No transfers recorded yet.</p></div>
          : records.slice(0,15).map(r=>(
            <div className="hist-item" key={r.id}>
              <span className="hist-date">{r.date}</span>
              <div style={{flex:1}}>
                <div className="hist-desc">{r.type==="in"?"← From":"→ To"} {r.fromTo}</div>
                <div className="hist-sub">{r.lines.length} item{r.lines.length!==1?"s":""} · By {r.by}</div>
              </div>
              <span className={`hist-amt ${r.type==="in"?"in":"out"}`}>{r.type==="in"?"+":"-"}Rs.{fmt(r.total)}</span>
            </div>
          ))
        }
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════
//  RETURN GOODS PAGE
// ═══════════════════════════════════════════════════════
function ReturnsPage({user,toast}){
  const key=`returns_${user.outlet}`;
  const [records,setRecs]=useState(()=>ls(key,[]));
  const [date,setDate]=useState(today());
  const [lines,setLines]=useState([{id:uid(),itemCode:"",itemName:"",qty:"",sellingPrice:"",stockValue:0}]);
  const [reason,setReason]=useState("");

  function save(d){setRecs(d);lss(key,d);}
  function updateLine(id,field,val){
    setLines(prev=>prev.map(l=>{
      if(l.id!==id)return l;
      const u={...l,[field]:val};
      if(field==="itemCode"){const it=SEED_ITEMS.find(i=>i.code===val);if(it){u.itemName=it.name;u.sellingPrice=it.sellingPrice;}}
      u.stockValue=(parseFloat(u.qty)||0)*(parseFloat(u.sellingPrice)||0);
      return u;
    }));
  }
  function addLine(){setLines(p=>[...p,{id:uid(),itemCode:"",itemName:"",qty:"",sellingPrice:"",stockValue:0}]);}
  function removeLine(id){setLines(p=>p.filter(l=>l.id!==id));}
  const total=lines.reduce((s,l)=>s+(l.stockValue||0),0);

  function submit(){
    if(!lines[0].itemCode){toast("Add at least one item","err");return;}
    const rec={id:uid(),date,lines,total,reason,outlet:user.outlet,by:user.username};
    save([rec,...records]);
    toast("Return recorded ✓");
    setLines([{id:uid(),itemCode:"",itemName:"",qty:"",sellingPrice:"",stockValue:0}]);
    setReason("");
  }

  return(
    <>
      <div className="card">
        <div className="card-hd"><div className="card-hd-left"><h3>Return Goods</h3><p>Record customer returns</p></div></div>
        <div className="card-body">
          <div className="f-grid" style={{marginBottom:16}}>
            <div className="field"><label>Date</label><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
          </div>
          <div style={{overflowX:"auto"}}>
            <table className="line-table">
              <thead><tr><th>#</th><th>Item Code</th><th>Description</th><th>Qty</th><th>Selling Price</th><th>Return Value</th><th></th></tr></thead>
              <tbody>
                {lines.map((l,i)=>(
                  <tr key={l.id}>
                    <td className="line-num">{i+1}</td>
                    <td><select value={l.itemCode} onChange={e=>updateLine(l.id,"itemCode",e.target.value)}>
                      <option value="">Select…</option>
                      {SEED_ITEMS.map(it=><option key={it.code} value={it.code}>{it.code} — {it.name}</option>)}
                    </select></td>
                    <td style={{fontSize:12,color:"var(--muted)"}}>{l.itemName||"—"}</td>
                    <td style={{width:80}}><input type="number" placeholder="0" value={l.qty} onChange={e=>updateLine(l.id,"qty",e.target.value)}/></td>
                    <td style={{width:110}}><input type="number" placeholder="0.00" value={l.sellingPrice} onChange={e=>updateLine(l.id,"sellingPrice",e.target.value)}/></td>
                    <td style={{fontFamily:"'DM Mono',monospace",fontWeight:600,color:"var(--red)"}}>{fmt(l.stockValue)}</td>
                    <td><button className="btn-ghost" onClick={()=>removeLine(l.id)}>{Ic.trash}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="add-row-btn" onClick={addLine}>{Ic.plus} Add Item</button>
          <div className="totals-box">
            <div className="total-row grand"><span className="total-label">Total Return Value</span><span className="total-val" style={{color:"var(--red)"}}>Rs. {fmt(total)}</span></div>
          </div>
          <div className="field" style={{marginTop:14}}><label>Reason</label><textarea rows={2} placeholder="Return reason…" value={reason} onChange={e=>setReason(e.target.value)}/></div>
          <div style={{marginTop:16}}><button className="btn btn-primary" onClick={submit}>{Ic.check} Save Return</button></div>
        </div>
      </div>
      <div className="card">
        <div className="card-hd"><div className="card-hd-left"><h3>Returns History</h3><p>{records.length} records</p></div></div>
        {records.length===0
          ? <div className="empty-state">{Ic.returns}<p>No returns recorded yet.</p></div>
          : records.slice(0,15).map(r=>(
            <div className="hist-item" key={r.id}>
              <span className="hist-date">{r.date}</span>
              <div style={{flex:1}}>
                <div className="hist-desc">{r.lines.length} item{r.lines.length!==1?"s":""} returned</div>
                <div className="hist-sub">{r.reason||"No reason"} · By {r.by}</div>
              </div>
              <span className="hist-amt out">-Rs.{fmt(r.total)}</span>
            </div>
          ))
        }
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════
//  PAYMENTS PAGE
// ═══════════════════════════════════════════════════════
function PaymentsPage({user,toast}){
  const key=`payments_${user.outlet}`;
  const [records,setRecs]=useState(()=>ls(key,[]));
  const [date,setDate]=useState(today());
  const [supplier,setSupplier]=useState("2001-DCSL");
  const [invoiceDate,setInvoiceDate]=useState(today());
  const [invoiceNo,setInvoiceNo]=useState("");
  const [invoiceAmt,setInvoiceAmt]=useState("");
  const [payType,setPayType]=useState("Bank");
  const [payAmt,setPayAmt]=useState("");
  const [discount,setDiscount]=useState("");

  function save(d){setRecs(d);lss(key,d);}
  const balance=(parseFloat(invoiceAmt)||0)-(parseFloat(payAmt)||0)-(parseFloat(discount)||0);

  function submit(){
    if(!invoiceNo||!payAmt){toast("Fill invoice no & payment amount","err");return;}
    const rec={id:uid(),date,supplier,invoiceDate,invoiceNo,invoiceAmt:parseFloat(invoiceAmt)||0,
      payType,payAmt:parseFloat(payAmt)||0,discount:parseFloat(discount)||0,balance,outlet:user.outlet,by:user.username};
    save([rec,...records]);
    toast("Payment recorded ✓");
    setInvoiceNo("");setInvoiceAmt("");setPayAmt("");setDiscount("");
  }

  return(
    <>
      <div className="card">
        <div className="card-hd"><div className="card-hd-left"><h3>Record Payment</h3><p>Pay supplier invoices</p></div></div>
        <div className="card-body">
          <div className="f-grid" style={{marginBottom:14}}>
            <div className="field"><label>Payment Date</label><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
            <div className="field"><label>Supplier</label>
              <select value={supplier} onChange={e=>setSupplier(e.target.value)}>
                {SUPPLIERS.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="field"><label>Invoice Date</label><input type="date" value={invoiceDate} onChange={e=>setInvoiceDate(e.target.value)}/></div>
            <div className="field"><label>Invoice Number *</label><input placeholder="INV-0001" value={invoiceNo} onChange={e=>setInvoiceNo(e.target.value)}/></div>
            <div className="field"><label>Invoice Amount (Rs.)</label><input type="number" placeholder="0.00" value={invoiceAmt} onChange={e=>setInvoiceAmt(e.target.value)}/></div>
            <div className="field"><label>Payment Type</label>
              <select value={payType} onChange={e=>setPayType(e.target.value)}>
                {["Bank","Cash","Cheque","Online"].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="field"><label>Payment Amount (Rs.) *</label><input type="number" placeholder="0.00" value={payAmt} onChange={e=>setPayAmt(e.target.value)}/></div>
            <div className="field"><label>Discount (Rs.)</label><input type="number" placeholder="0.00" value={discount} onChange={e=>setDiscount(e.target.value)}/></div>
          </div>
          <div className="totals-box">
            <div className="total-row"><span className="total-label">Invoice Amount</span><span className="total-val">Rs. {fmt(invoiceAmt||0)}</span></div>
            <div className="total-row"><span className="total-label">Payment</span><span className="total-val" style={{color:"var(--green)"}}>-Rs. {fmt(payAmt||0)}</span></div>
            <div className="total-row"><span className="total-label">Discount</span><span className="total-val" style={{color:"var(--green)"}}>-Rs. {fmt(discount||0)}</span></div>
            <div className="total-row grand"><span className="total-label">Balance Due</span><span className="total-val" style={{color:balance>0?"var(--red)":"var(--green)"}}>{balance>0?`Rs. ${fmt(balance)}`:"✓ Settled"}</span></div>
          </div>
          <div style={{marginTop:16}}><button className="btn btn-primary" onClick={submit}>{Ic.check} Save Payment</button></div>
        </div>
      </div>
      <div className="card">
        <div className="card-hd"><div className="card-hd-left"><h3>Payment History</h3><p>{records.length} payments</p></div></div>
        {records.length===0
          ? <div className="empty-state">{Ic.payment}<p>No payments recorded yet.</p></div>
          : records.slice(0,15).map(r=>(
            <div className="hist-item" key={r.id}>
              <span className="hist-date">{r.date}</span>
              <div style={{flex:1}}>
                <div className="hist-desc">{SUP_SHORT[r.supplier]||r.supplier} · {r.invoiceNo}</div>
                <div className="hist-sub">{r.payType} · By {r.by}</div>
              </div>
              <span className="hist-amt out">-Rs.{fmt(r.payAmt)}</span>
            </div>
          ))
        }
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════
//  EXPENSES PAGE
// ═══════════════════════════════════════════════════════
function ExpensesPage({user,toast}){
  const key=`expenses_${user.outlet}`;
  const [records,setRecs]=useState(()=>ls(key,[]));
  const [date,setDate]=useState(today());
  const [category,setCategory]=useState("General");
  const [description,setDescription]=useState("");
  const [amount,setAmount]=useState("");
  const [payMethod,setPayMethod]=useState("Cash");

  function save(d){setRecs(d);lss(key,d);}

  function submit(){
    if(!amount||parseFloat(amount)<=0){toast("Enter a valid amount","err");return;}
    const rec={id:uid(),date,category,description,amount:parseFloat(amount),payMethod,outlet:user.outlet,by:user.username};
    save([rec,...records]);
    toast("Expense recorded ✓");
    setDescription("");setAmount("");
  }

  const monthTotal=records.filter(r=>r.date.slice(0,7)===today().slice(0,7)).reduce((s,r)=>s+r.amount,0);
  const byCat=useMemo(()=>{
    const m={};
    records.filter(r=>r.date.slice(0,7)===today().slice(0,7)).forEach(r=>{m[r.category]=(m[r.category]||0)+r.amount;});
    return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,5);
  },[records]);

  return(
    <>
      <div className="card">
        <div className="card-hd"><div className="card-hd-left"><h3>Record Expense</h3><p>Log daily expenses</p></div></div>
        <div className="card-body">
          <div className="f-grid" style={{marginBottom:14}}>
            <div className="field"><label>Date</label><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
            <div className="field"><label>Category</label>
              <select value={category} onChange={e=>setCategory(e.target.value)}>
                {EXPENSE_CATS.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="field"><label>Amount (Rs.) *</label><input type="number" placeholder="0.00" value={amount} onChange={e=>setAmount(e.target.value)}/></div>
            <div className="field"><label>Payment Method</label>
              <select value={payMethod} onChange={e=>setPayMethod(e.target.value)}>
                {["Cash","Bank","Visa Card"].map(m=><option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="field full"><label>Description</label><input placeholder="Details…" value={description} onChange={e=>setDescription(e.target.value)}/></div>
          </div>
          <button className="btn btn-primary" onClick={submit}>{Ic.check} Save Expense</button>
        </div>
      </div>
      {byCat.length>0&&(
        <div className="card">
          <div className="card-hd"><div className="card-hd-left"><h3>This Month Summary</h3><p>Total: Rs.{fmt(monthTotal)}</p></div></div>
          <div className="card-body">
            {byCat.map(([cat,amt])=>(
              <div key={cat} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                padding:"9px 0",borderBottom:"1px solid var(--border)"}}>
                <span style={{fontSize:13}}>{cat}</span>
                <span style={{fontFamily:"'DM Mono',monospace",fontWeight:600,color:"var(--red)"}}>Rs.{fmt(amt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="card">
        <div className="card-hd"><div className="card-hd-left"><h3>Expense History</h3><p>{records.length} entries</p></div></div>
        {records.length===0
          ? <div className="empty-state">{Ic.expense}<p>No expenses recorded yet.</p></div>
          : records.slice(0,20).map(r=>(
            <div className="hist-item" key={r.id}>
              <span className="hist-date">{r.date}</span>
              <div style={{flex:1}}>
                <div className="hist-desc">{r.category}</div>
                <div className="hist-sub">{r.description||"—"} · {r.payMethod}</div>
              </div>
              <span className="hist-amt out">-Rs.{fmt(r.amount)}</span>
            </div>
          ))
        }
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════
//  REPORTS PAGE
// ═══════════════════════════════════════════════════════
function ReportsPage({user}){
  const [period,setPeriod]=useState(today().slice(0,7));
  const sales    = ls(`sales_${user.outlet}`,[]).filter(r=>r.date.slice(0,7)===period);
  const purchases= ls(`purchases_${user.outlet}`,[]).filter(r=>r.date.slice(0,7)===period);
  const expenses = ls(`expenses_${user.outlet}`,[]).filter(r=>r.date.slice(0,7)===period);
  const returns  = ls(`returns_${user.outlet}`,[]).filter(r=>r.date.slice(0,7)===period);
  const payments = ls(`payments_${user.outlet}`,[]).filter(r=>r.date.slice(0,7)===period);
  const transfers= ls(`transfers_${user.outlet}`,[]).filter(r=>r.date.slice(0,7)===period);

  const totalSales    = sales.reduce((s,r)=>s+r.total,0);
  const totalPurchases= purchases.reduce((s,r)=>s+r.grandTotal,0);
  const totalExpenses = expenses.reduce((s,r)=>s+r.amount,0);
  const totalReturns  = returns.reduce((s,r)=>s+r.total,0);
  const totalPayments = payments.reduce((s,r)=>s+r.payAmt,0);
  const grossProfit   = totalSales - totalReturns;
  const netPosition   = grossProfit - totalExpenses - totalPayments;

  const expByCat=useMemo(()=>{
    const m={};
    expenses.forEach(r=>{m[r.category]=(m[r.category]||0)+r.amount;});
    return Object.entries(m).sort((a,b)=>b[1]-a[1]);
  },[expenses]);

  return(
    <>
      <div className="card">
        <div className="card-hd">
          <div className="card-hd-left"><h3>Report Period</h3></div>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <input type="month" value={period} onChange={e=>setPeriod(e.target.value)}
              style={{padding:"8px 12px",background:"var(--surf2)",border:"1.5px solid var(--border)",
                borderRadius:9,fontSize:13,fontFamily:"'DM Sans',sans-serif",color:"var(--ink)",outline:"none"}}/>
            <button className="btn btn-outline btn-sm" onClick={()=>window.print()}>{Ic.print} Print</button>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
        {[
          {label:"Total Sales",    val:totalSales,    color:"var(--green)"},
          {label:"Total Purchases",val:totalPurchases,color:"var(--red)"},
          {label:"Total Expenses", val:totalExpenses, color:"var(--red)"},
          {label:"Returns",        val:totalReturns,  color:"var(--amber)"},
          {label:"Payments Made",  val:totalPayments, color:"var(--red)"},
          {label:"Gross Profit",   val:grossProfit,   color:grossProfit>=0?"var(--green)":"var(--red)"},
        ].map(s=>(
          <div className="stat-card" key={s.label}>
            <div className="stat-val" style={{color:s.color,fontSize:20}}>Rs.{fmt(s.val)}</div>
            <div className="stat-lbl">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Sales Summary */}
      <div className="card">
        <div className="card-hd"><div className="card-hd-left"><h3>Sales Summary</h3><p>{sales.length} transactions</p></div></div>
        {sales.length===0
          ? <div className="empty-state"><p>No sales this period.</p></div>
          : <table className="rep-table">
              <thead><tr><th>Date</th><th>Items</th><th>By</th><th style={{textAlign:"right"}}>Amount</th></tr></thead>
              <tbody>
                {sales.map(r=><tr key={r.id}>
                  <td className="mono">{r.date}</td>
                  <td>{r.lines.length} item{r.lines.length!==1?"s":""}</td>
                  <td>{r.by}</td>
                  <td className="mono" style={{textAlign:"right",color:"var(--green)",fontWeight:600}}>Rs.{fmt(r.total)}</td>
                </tr>)}
                <tr className="rep-total">
                  <td colSpan={3} style={{fontWeight:700}}>Total</td>
                  <td className="mono" style={{textAlign:"right",color:"var(--green)"}}>Rs.{fmt(totalSales)}</td>
                </tr>
              </tbody>
            </table>
        }
      </div>

      {/* Expense Summary */}
      <div className="card">
        <div className="card-hd"><div className="card-hd-left"><h3>Expense Summary</h3><p>By category</p></div></div>
        {expByCat.length===0
          ? <div className="empty-state"><p>No expenses this period.</p></div>
          : <table className="rep-table">
              <thead><tr><th>Category</th><th style={{textAlign:"right"}}>Amount</th></tr></thead>
              <tbody>
                {expByCat.map(([cat,amt])=><tr key={cat}>
                  <td>{cat}</td>
                  <td className="mono" style={{textAlign:"right",color:"var(--red)",fontWeight:600}}>Rs.{fmt(amt)}</td>
                </tr>)}
                <tr className="rep-total">
                  <td style={{fontWeight:700}}>Total Expenses</td>
                  <td className="mono" style={{textAlign:"right",color:"var(--red)"}}>Rs.{fmt(totalExpenses)}</td>
                </tr>
              </tbody>
            </table>
        }
      </div>

      {/* Purchase Summary */}
      <div className="card">
        <div className="card-hd"><div className="card-hd-left"><h3>Purchase Summary</h3><p>{purchases.length} invoices</p></div></div>
        {purchases.length===0
          ? <div className="empty-state"><p>No purchases this period.</p></div>
          : <table className="rep-table">
              <thead><tr><th>Date</th><th>Supplier</th><th>Invoice</th><th style={{textAlign:"right"}}>Amount</th></tr></thead>
              <tbody>
                {purchases.map(r=><tr key={r.id}>
                  <td className="mono">{r.date}</td>
                  <td>{SUP_SHORT[r.supplier]||r.supplier}</td>
                  <td>{r.invoiceNo}</td>
                  <td className="mono" style={{textAlign:"right",fontWeight:600}}>Rs.{fmt(r.grandTotal)}</td>
                </tr>)}
                <tr className="rep-total">
                  <td colSpan={3} style={{fontWeight:700}}>Total</td>
                  <td className="mono" style={{textAlign:"right"}}>Rs.{fmt(totalPurchases)}</td>
                </tr>
              </tbody>
            </table>
        }
      </div>

      {/* Net Position */}
      <div className="card">
        <div className="card-hd"><div className="card-hd-left"><h3>Net Position</h3><p>Overall summary for {period}</p></div></div>
        <div className="card-body">
          {[
            {label:"Total Sales",            val:totalSales,     sign:"+",color:"var(--green)"},
            {label:"Less: Returns",          val:totalReturns,   sign:"-",color:"var(--red)"},
            {label:"Gross Revenue",          val:grossProfit,    sign:"=",color:"var(--amber)",bold:true},
            {label:"Less: Total Expenses",   val:totalExpenses,  sign:"-",color:"var(--red)"},
            {label:"Less: Supplier Payments",val:totalPayments,  sign:"-",color:"var(--red)"},
          ].map(row=>(
            <div key={row.label} style={{display:"flex",justifyContent:"space-between",
              padding:`${row.bold?"12px":"8px"} 0`,
              borderBottom:row.bold?"2px solid var(--border)":"1px solid var(--border)",
              fontWeight:row.bold?700:400}}>
              <span style={{fontSize:13,color:row.bold?"var(--ink)":"var(--muted)"}}>{row.sign} {row.label}</span>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:row.bold?16:14,color:row.color}}>Rs.{fmt(row.val)}</span>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",padding:"16px 0 4px",fontWeight:700}}>
            <span style={{fontSize:15}}>Net Position</span>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:20,
              color:netPosition>=0?"var(--green)":"var(--red)"}}>
              {netPosition>=0?"▲":"▼"} Rs.{fmt(Math.abs(netPosition))}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════
//  ROOT APP
// ═══════════════════════════════════════════════════════
export default function StaffPortal({ user, onLogout }) {
  const [page, setPage] = useState("home");
  const [toast, setToast] = useState(null);
  function showToast(msg,type="ok"){setToast({msg,type});}

  const pages = [
    {id:"home",     label:"Home",           icon:Ic.home},
    {id:"sales",    label:"Record Sales",   icon:Ic.sale},
    {id:"purchase", label:"Purchase",       icon:Ic.purchase},
    {id:"transfer", label:"Transfer",       icon:Ic.transfer},
    {id:"returns",  label:"Return Goods",   icon:Ic.returns},
    {id:"payments", label:"Payments",       icon:Ic.payment},
    {id:"expenses", label:"Expenses",       icon:Ic.expense},
    {id:"reports",  label:"Reports",        icon:Ic.report},
  ];

  const titles={
    home:"Dashboard",sales:"Record Sales",purchase:"Record Purchase",
    transfer:"Transfer Goods",returns:"Return Goods",
    payments:"Record Payments",expenses:"Record Expenses",reports:"View Reports",
  };

  return (
    <div className="shell" style={{width:"100vw", height:"100vh", overflow:"hidden", display:"flex"}}>
      <style>{CSS}</style>
   <aside className="sidebar" style={{width:"210px", minWidth:"210px", flexShrink:0}}>
        <div className="sb-top">
          <div className="sb-outlet">📍 {user.outlet}</div>
          <div className="sb-name">{user.username.charAt(0).toUpperCase()+user.username.slice(1)}</div>
          <div className="sb-role">{user.designation}</div>
        </div>
        <nav className="sb-nav">
          <div className="sb-label">Navigation</div>
          {pages.map(p=>(
            <button key={p.id} className={`nav-btn ${page===p.id?"act":""}`} onClick={()=>setPage(p.id)}>
              {p.icon}{p.label}
            </button>
          ))}
        </nav>
        <div className="sb-foot">
          <div className="user-row">
            <div className="u-av">{user.username.slice(0,2).toUpperCase()}</div>
            <span className="u-name">{user.username}</span>
            <button className="logout-btn" title="Logout" onClick={onLogout}>{Ic.logout}</button>
          </div>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <div className="topbar-left">
            <h1>{titles[page]}</h1>
            <p>{user.outlet} · {new Date().toLocaleDateString("en-LK",{month:"short",day:"numeric",year:"numeric"})}</p>
          </div>
        </div>
        <div className="page-content" style={{padding:"16px", width:"100%", boxSizing:"border-box"}}>
          {page==="home"     && <HomePage     user={user} goTo={setPage}/>}
          {page==="sales"    && <SalesPage    user={user} toast={showToast}/>}
          {page==="purchase" && <PurchasePage user={user} toast={showToast}/>}
          {page==="transfer" && <TransferPage user={user} toast={showToast}/>}
          {page==="returns"  && <ReturnsPage  user={user} toast={showToast}/>}
          {page==="payments" && <PaymentsPage user={user} toast={showToast}/>}
          {page==="expenses" && <ExpensesPage user={user} toast={showToast}/>}
          {page==="reports"  && <ReportsPage  user={user}/>}
        </div>
      </div>
      {toast&&<Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}
    </div>
  );
}

