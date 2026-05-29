import { useState, useMemo } from "react";
import { ls } from "../utils/helpers";
import { I } from "../utils/icons";
import { SEED_INVENTORY, SEED_EMPTY, COA_DEF, OUTLETS } from "../data/seeds";


const fmt  = n => Number(n||0).toLocaleString("en-LK",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtN = n => Number(n||0).toLocaleString("en-LK",{minimumFractionDigits:0,maximumFractionDigits:0});
const today = () => new Date().toISOString().split("T")[0];
const oKey  = (outlet, mod) => `${outlet}_${mod}`;
const monthOf = d => (d||"").slice(0,7);
const dayOf   = d => parseInt((d||"").slice(8,10))||0;

const MONTHS = Array.from({length:12},(_,i)=>({
  value: `${new Date().getFullYear()}-${String(i+1).padStart(2,"0")}`,
  label: new Date(new Date().getFullYear(),i,1).toLocaleString("en-LK",{month:"long",year:"numeric"})
}));

// ── section header style ──
const SH = ({children}) => (
  <tr style={{background:"var(--s3)"}}>
    <td colSpan={10} style={{padding:"7px 12px",fontWeight:700,fontSize:12,color:"var(--gld2)",fontFamily:"'Playfair Display',serif",letterSpacing:".03em"}}>
      {children}
    </td>
  </tr>
);
const TR = ({label,val,indent=0,bold=false,total=false,neg=false}) => (
  <tr style={total?{borderTop:"1.5px solid var(--bdr2)",background:"var(--s2)"}:{}}>
    <td style={{padding:"5px 12px 5px"+(indent*16+12)+"px",fontSize:12,fontWeight:bold||total?700:400,color:total?"var(--txt)":"var(--mut)",minWidth:280}}>
      {label}
    </td>
    <td/>
    <td style={{padding:"5px 14px",textAlign:"right",fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:bold||total?700:400,color:neg?"var(--red)":total?"var(--grn)":"var(--txt)"}}>
      {val !== undefined && val !== "" ? (neg?"(":"") + "Rs." + fmt(Math.abs(val)) + (neg?")":"") : ""}
    </td>
  </tr>
);
const TRSplit = ({label,col2,col3,indent=0,bold=false,total=false}) => (
  <tr style={total?{borderTop:"1.5px solid var(--bdr2)",background:"var(--s2)"}:{}}>
    <td style={{padding:"5px 12px 5px"+(indent*16+12)+"px",fontSize:12,fontWeight:bold||total?700:400,color:total?"var(--txt)":"var(--mut)",minWidth:280}}>{label}</td>
    <td style={{padding:"5px 14px",textAlign:"right",fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:"var(--txt)"}}>{col2!==undefined&&col2!==""?"Rs."+fmt(col2):""}</td>
    <td style={{padding:"5px 14px",textAlign:"right",fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:bold||total?700:400,color:total?"var(--grn)":"var(--txt)"}}>{col3!==undefined&&col3!==""?"Rs."+fmt(col3):""}</td>
  </tr>
);

// ══════════════════════════════════════════════════════
// DATA HOOK — reads localStorage for given outlet+month
// FIX: Properly scoped per outlet; opening stock from current status
// ══════════════════════════════════════════════════════
function useReportData(outlet, month) {
  return useMemo(() => {
    const outlets = outlet === "ALL" ? OUTLETS : [outlet];

    const inv   = ls("inv_main", SEED_INVENTORY);
    const empty = ls("inv_empty", SEED_EMPTY);
    const coa   = ls("coa_accounts", COA_DEF);

    let sales=[], purchases=[], payments=[], expenses=[], transfers=[], returns=[];
    let cashLedger=[], bankLedger=[], arLedger=[], apInvoices=[], apPayments=[];

    // ── Current Status aggregators (for Income Statement) ──
    // These come from Tab 2 Current Status, keyed per outlet+month
    let csOpeningStockVal = 0;
    let csPurchaseVal     = 0;
    let csEndStockVal     = 0;  // physical stock column
    let csSalesRevenue    = 0;  // total sale column

    // Per-item opening stock breakdown for display
    const openingStockByCode = {};

    outlets.forEach(o => {
      const filt = arr => arr.filter(r => !month || monthOf(r.date) === month);

      sales      = [...sales,      ...filt(ls(oKey(o, "sales"),       []))];
      purchases  = [...purchases,  ...filt(ls(oKey(o, "purchases"),   []))];
      expenses   = [...expenses,   ...filt(ls(oKey(o, "expenses"),    []))];
      transfers  = [...transfers,  ...filt(ls(oKey(o, "transfers"),   []))];
      returns    = [...returns,    ...filt(ls(oKey(o, "returns"),     []))];
      cashLedger = [...cashLedger, ...filt(ls(oKey(o, "cash_ledger"), []))];
      bankLedger = [...bankLedger, ...filt(ls(oKey(o, "bank_ledger"), []))];
      arLedger   = [...arLedger,   ...ls(oKey(o, "ar_ledger"), []).filter(r => !month || monthOf(r.date) === month)];
      apInvoices = [...apInvoices, ...ls(oKey(o, "ap_invoices"), [])];
      apPayments = [...apPayments, ...ls(oKey(o, "ap_payments"), [])];

      // ── Read Current Status for this outlet+month ──
      // Key pattern: {OUTLET}_current_status_{YYYY-MM}  OR  {OUTLET}_current_status
      // Try month-scoped first, fallback to global
      const csKey       = month ? oKey(o, `current_status_${month}`) : oKey(o, "current_status");
      const csFallback  = oKey(o, "current_status");
      const csRaw       = ls(csKey, null) ?? ls(csFallback, []);
      // csRaw is array of rows: { code, name, type, unitCost, openingQty, purchaseQty, physicalQty, totalSaleAmt, ... }

      csRaw.forEach(row => {
        const openQty  = parseFloat(row.openingQty  || row.opening_qty  || row.openQty  || 0);
        const purQty   = parseFloat(row.purchaseQty || row.purchase_qty || row.purQty   || 0);
        const physQty  = parseFloat(row.physicalQty || row.physical_qty || row.physQty  || row.endQty || 0);
        const saleAmt  = parseFloat(row.totalSaleAmt|| row.total_sale   || row.saleAmt  || 0);
        const uc       = parseFloat(row.unitCost     || row.unit_cost   || 0)
                      || parseFloat(inv.find(i => i.code === row.code || i.id === row.code)?.unitCost || 0);

        // Opening stock value per item
        const itemOpenVal = openQty * uc;
        csOpeningStockVal += itemOpenVal;

        // Purchase value: use purchaseQty × unitCost OR row.purchaseAmt if stored
        const purAmt = parseFloat(row.purchaseAmt || row.purchase_amt || 0) || (purQty * uc);
        csPurchaseVal += purAmt;

        // Physical/end stock value
        csEndStockVal += physQty * uc;

        // Sales revenue
        csSalesRevenue += saleAmt;

        // Per-item breakdown for Income Statement display
        if (openQty > 0 && uc > 0) {
          const code = row.code || row.id;
          openingStockByCode[code] = {
            qty:      (openingStockByCode[code]?.qty || 0) + openQty,
            unitCost: uc,
            name:     row.name || code,
          };
        }
      });
    });

    // ── Fallback: if Current Status is empty, compute from transactions ──
    // (keeps backward-compat for outlets that haven't used Tab 2 yet)
    const hasCsData = csOpeningStockVal > 0 || csPurchaseVal > 0 || csEndStockVal > 0 || csSalesRevenue > 0;

    if (!hasCsData) {
      // Legacy path — same logic as before
      outlets.forEach(o => {
        const prefix = o + "_opening_";
        const openingKeys = Object.keys(localStorage)
          .filter(k => k.startsWith(prefix) && (!month || k.slice(prefix.length, prefix.length + 7) === month))
          .sort();
        if (openingKeys.length === 0) return;
        const firstData = JSON.parse(localStorage.getItem(openingKeys[0]) || "{}");
        Object.entries(firstData.main || {}).forEach(([code, qty]) => {
          const uc = parseFloat(inv.find(i => i.code === code || i.id === code)?.unitCost || 0);
          const q  = parseFloat(qty) || 0;
          csOpeningStockVal += q * uc;
          if (q > 0 && uc > 0) {
            const master = inv.find(i => i.code === code || i.id === code);
            openingStockByCode[code] = {
              qty:      (openingStockByCode[code]?.qty || 0) + q,
              unitCost: uc,
              name:     master?.name || code,
            };
          }
        });
        const lastData = JSON.parse(localStorage.getItem(openingKeys[openingKeys.length - 1]) || "{}");
        Object.entries(lastData.main || {}).forEach(([code, qty]) => {
          csEndStockVal += (parseFloat(qty) || 0) * parseFloat(inv.find(i => i.code === code || i.id === code)?.unitCost || 0);
        });
      });
      csSalesRevenue = sales.reduce((a, s) => a + (s.totalSale || s.total || 0), 0);
      csPurchaseVal  = purchases.reduce((a, p) => a + p.grandTotal, 0);
    }

    const getUnitCost = code => parseFloat(inv.find(i => i.code === code || i.id === code)?.unitCost || 0);

    const emptyStockVal   = empty.reduce((a, e) => a + ((e.qty || 0) * e.rate), 0);
    const totalSalesAmt   = csSalesRevenue;
    const totalPurchase   = csPurchaseVal;
    const openingStockVal = csOpeningStockVal;
    const endStockVal     = csEndStockVal;

    // ── Expense by account ──
    const expByAcc = {};
    expenses.forEach(e => {
      expByAcc[e.accId] = (expByAcc[e.accId] || { name: e.accName, total: 0 });
      expByAcc[e.accId].total += e.amount;
      expByAcc[e.accId].name = e.accName;
    });

    const expRange  = (from, to) => Object.entries(expByAcc).filter(([id]) => id >= from && id <= to).reduce((a, [, v]) => a + v.total, 0);
    const expDetail = (from, to) => Object.entries(expByAcc).filter(([id]) => id >= from && id <= to).map(([id, v]) => ({ id, name: v.name, total: v.total }));

    const expSaleMkt = expRange("5501", "5649");
    const expAdmin   = expRange("5650", "5799");
    const expFinance = expRange("5800", "5899");
    const expOther   = expRange("5900", "5999");
    const totalExp   = expSaleMkt + expAdmin + expFinance + expOther;

    const discBySup = {};
    apPayments.forEach(p => { if (p.discount > 0) { discBySup[p.supId] = (discBySup[p.supId] || 0) + p.discount; } });

    const empSold   = {};
    const empReturn = {};
    const empPur    = {};
    sales.forEach(s => (s.empRows || []).forEach(e => {
      empSold[e.name]   = (empSold[e.name]   || 0) + (parseFloat(e.sold)     || 0) * e.rate;
      empReturn[e.name] = (empReturn[e.name] || 0) + (parseFloat(e.return_)  || 0) * e.rate;
      empPur[e.name]    = (empPur[e.name]    || 0) + (parseFloat(e.purchase) || 0) * e.rate;
    }));

    const cashBF  = outlets.reduce((a, o) => a + (parseFloat(ls(oKey(o, "cash_bf"), 0)) || 0), 0);
    const bankBF  = outlets.reduce((a, o) => a + (parseFloat(ls(oKey(o, "bank_bf"), 0)) || 0), 0);
    const cashBal = cashBF + cashLedger.reduce((a, t) => a + (t.type === "in" ? t.amount : -t.amount), 0);
    const bankBal = bankBF + bankLedger.reduce((a, t) => a + (t.type === "in" ? t.amount : -t.amount), 0);

    const arBal = arLedger.reduce((a, e) => a + (e.type === "dr" ? e.amount : -e.amount), 0);
    const apBal = apInvoices.reduce((a, i) => a + i.grandTotal, 0) - apPayments.reduce((a, p) => a + p.payAmt + p.discount, 0);

    const costOfSales = openingStockVal + totalPurchase - endStockVal;
    const grossProfit = totalSalesAmt - costOfSales;

    const totalOtherInc = Object.values(discBySup).reduce((a, v) => a + v, 0)
                        + Object.values(empSold).reduce((a, v) => a + v, 0);
    const totalIncome   = grossProfit + totalOtherInc;
    const netProfit     = totalIncome - totalExp;

    const transIn  = transfers.filter(t => t.type === "in").reduce((a, t) => a + t.total, 0);
    const transOut = transfers.filter(t => t.type === "out").reduce((a, t) => a + t.total, 0);
    const totalReturns = returns.reduce((a, r) => a + r.total, 0);

    const cosByItem = {};
    sales.forEach(s => (s.mainRows || []).forEach(r => {
      const sold = parseFloat(r.sold) || 0;
      if (sold > 0) {
        const item = inv.find(i => i.code === r.code || i.id === r.id);
        const uc   = item?.unitCost || 0;
        if (!cosByItem[r.code]) cosByItem[r.code] = { code: r.code, name: r.name || item?.name || r.code, type: r.type || item?.type || "", openStock: 0, purchase: 0, transIn: 0, transOut: 0, returns: 0, adj: 0, sold: 0, unitCost: uc };
        cosByItem[r.code].sold     += sold;
        cosByItem[r.code].purchase += parseFloat(r.purchase)    || 0;
        cosByItem[r.code].transIn  += parseFloat(r.transferIn)  || 0;
        cosByItem[r.code].transOut += parseFloat(r.transferOut) || 0;
        cosByItem[r.code].returns  += parseFloat(r.returns)     || 0;
        cosByItem[r.code].adj      += parseFloat(r.stkSE)       || 0;
      }
    }));

    const salesByDay = {};
    sales.forEach(s => { const d = dayOf(s.date); salesByDay[d] = (salesByDay[d] || 0) + (s.totalSale || s.total || 0); });

    const purBySup = {};
    purchases.forEach(p => { purBySup[p.supId] = (purBySup[p.supId] || []); purBySup[p.supId].push(p); });

    const expByDay = {};
    expenses.forEach(e => { const d = dayOf(e.date); expByDay[d] = (expByDay[d] || 0) + e.amount; });

    return {
      inv, empty, coa,
      totalSalesAmt, totalPurchase, totalReturns,
      expByAcc, expSaleMkt, expAdmin, expFinance, expOther, expDetail, totalExp,
      discBySup, empSold, empReturn, empPur,
      cashBal, bankBal, cashBF, bankBF, cashLedger, bankLedger,
      arBal, apBal, endStockVal, emptyStockVal,
      grossProfit, totalOtherInc, totalIncome, netProfit,
      transIn, transOut, cosByItem, salesByDay, purBySup,
      expByDay, sales, purchases, expenses,
      openingStockVal, costOfSales,
      openingStockByCode,
    };
  }, [outlet, month]);
}

// ══════════════════════════════════════════════════════
// REPORT WRAPPER
// ══════════════════════════════════════════════════════
function ReportWrap({title, outlet, month, children}) {
  const mo = month ? new Date(month + "-01").toLocaleString("en-LK", {month:"long", year:"numeric"}) : "All Periods";
  return (
    <div>
      <div className="no-print" style={{display:"flex", justifyContent:"flex-end", marginBottom:12}}>
        <button className="btn btnd btnsm" onClick={() => window.print()}>{I.print} Print</button>
      </div>
      <div style={{background:"var(--s1)", border:"1px solid var(--bdr)", borderRadius:"var(--rl)", overflow:"hidden"}}>
        <div style={{padding:"16px 18px", borderBottom:"1px solid var(--bdr)", background:"var(--s2)"}}>
          <div style={{fontFamily:"'Playfair Display',serif", fontSize:18, marginBottom:2}}>{title}</div>
          <div style={{fontSize:11, color:"var(--mut)"}}>{outlet === "ALL" ? "All Outlets" : outlet} &nbsp;·&nbsp; {mo}</div>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%", borderCollapse:"collapse", minWidth:480}}>
            <colgroup><col style={{width:"60%"}}/><col style={{width:"20%"}}/><col style={{width:"20%"}}/></colgroup>
            <tbody>{children}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// INDIVIDUAL REPORTS
// ══════════════════════════════════════════════════════

function IncomeStatement({ d, outlet, month }) {
  const {
    totalSalesAmt, openingStockVal, totalPurchase,
    endStockVal, costOfSales, grossProfit,
    discBySup, empSold, totalOtherInc, totalIncome,
    expDetail, expSaleMkt, expAdmin, expFinance, expOther, totalExp, netProfit,
    openingStockByCode,
  } = d;

  return (
    <ReportWrap title="Income Statement" outlet={outlet} month={month}>
      <TR label="Sales Revenue" val={totalSalesAmt} bold />
      <SH>Cost of Sales</SH>
      {/* Opening stock breakdown by item from current status */}
      <TR label="Opening Stock" val={openingStockVal} indent={1} />
      {Object.entries(openingStockByCode).filter(([, v]) => v.qty > 0).map(([code, v]) => (
        <TR key={code} label={`  ${v.name || code}  (${fmtN(v.qty)} × Rs.${fmt(v.unitCost)})`} val={v.qty * v.unitCost} indent={2} />
      ))}
      <TR label="Purchase"      val={totalPurchase}   indent={1} />
      <TR label="End Stock"     val={endStockVal}     indent={1} neg />
      <TR label="Cost of Sales" val={costOfSales}     neg total />
      <TR label="Gross Profit"  val={grossProfit}     bold total />
      <SH>Other Income</SH>
      <SH>Discount Received on Payment</SH>
      {["2001-DCSL","2002-LION BREWERY","2003-UG","2004-IDL","2005-ROCKLAND","2008-LUXURY BRAND","2009-SIGNATURE"].map(s => (
        <TR key={s} label={s.replace(/^\d{4}-/, "")} val={discBySup[s] || 0} indent={1}/>
      ))}
      <SH>Discount Received on Empty</SH>
      {Object.entries(empSold).map(([n, v]) => <TR key={n} label={n} val={v} indent={1}/>)}
      <TR label="Total Other Income" val={totalOtherInc} bold total />
      <TR label="Total Income"       val={totalIncome}   bold total />
      <SH>Sale & Marketing Expense</SH>
      {expDetail("5501","5649").map(e => <TR key={e.id} label={e.name} val={e.total} indent={1}/>)}
      <TR label="Total Sale & Marketing" val={expSaleMkt} bold />
      <SH>Administration Expense</SH>
      {expDetail("5650","5799").map(e => <TR key={e.id} label={e.name} val={e.total} indent={1}/>)}
      <TR label="Total Administration" val={expAdmin} bold />
      <SH>Finance Charge</SH>
      {expDetail("5800","5899").map(e => <TR key={e.id} label={e.name} val={e.total} indent={1}/>)}
      <TR label="Total Finance Charge" val={expFinance} bold />
      <SH>Other Expenses</SH>
      {expDetail("5900","5999").map(e => <TR key={e.id} label={e.name} val={e.total} indent={1}/>)}
      <TR label="Total Other Expenses" val={expOther} bold />
      <TR label="Total Expenses"       val={totalExp}  neg total />
      <TR label="Net Profit / (Loss)"  val={netProfit} bold total />
    </ReportWrap>
  );
}

function BalanceSheet({d, outlet, month}) {
  const {endStockVal, emptyStockVal, cashBal, bankBal, arBal, apBal, netProfit} = d;
  const totalAssets = endStockVal + emptyStockVal + cashBal + bankBal + arBal;
  const totalLiab   = apBal;
  const capital     = totalAssets - totalLiab;
  return (
    <ReportWrap title="Balance Sheet" outlet={outlet} month={month}>
      <SH>Assets</SH>
      <SH>Current Assets</SH>
      <TRSplit label="Main Stock"   col2={endStockVal}   indent={1}/>
      <TRSplit label="Empty Stock"  col2={emptyStockVal}  indent={1}/>
      <TRSplit label="Cash in Hand" col2={cashBal}        indent={1}/>
      <TRSplit label="Bank"         col2={bankBal}         indent={1}/>
      <TRSplit label="Accounts Receivable (1100)" col2={arBal} indent={1}/>
      <TRSplit label="Total Assets" col3={totalAssets} bold total/>
      <SH>Liabilities</SH>
      <SH>Capital</SH>
      <TRSplit label="Net Profit / (Loss)" col2={netProfit} indent={1}/>
      <SH>Current Liabilities</SH>
      <TRSplit label="Accounts Payable (2000)" col2={apBal} indent={1}/>
      <TRSplit label="Total Liabilities" col3={totalLiab} bold total/>
      <TRSplit label="Capital / Equity"  col3={capital}   bold total/>
    </ReportWrap>
  );
}

function CapitalSheet({d, outlet, month}) {
  const {netProfit, cashBal, bankBal} = d;
  const capital = cashBal + bankBal;
  return (
    <ReportWrap title="Capital Sheet" outlet={outlet} month={month}>
      <SH>Capital Summary</SH>
      <TR label="Opening Capital"     val={0}         indent={1}/>
      <TR label="Net Profit / (Loss)" val={netProfit} indent={1}/>
      <TR label="Personal Drawings"   val={0}         indent={1}/>
      <TR label="Closing Capital"     val={netProfit} bold total/>
      <SH>Capital Represented By</SH>
      <TR label="Cash in Hand" val={cashBal} indent={1}/>
      <TR label="Bank Balance" val={bankBal} indent={1}/>
      <TR label="Total"        val={capital} bold total/>
    </ReportWrap>
  );
}

function CashFlowStatement({d, outlet, month}) {
  const {totalSalesAmt, empSold, empReturn, cashLedger, bankLedger, totalExp, totalReturns, cashBal, cashBF} = d;
  const bankDeposit  = bankLedger.filter(t => t.type === "in").reduce((a, t) => a + t.amount, 0);
  const totalEmpSold = Object.values(empSold).reduce((a, v) => a + v, 0);
  const totalEmpRet  = Object.values(empReturn).reduce((a, v) => a + v, 0);
  const totalIn      = totalSalesAmt + totalEmpSold;
  const totalOut     = totalExp + totalEmpRet + bankDeposit + totalReturns;
  const netCash      = totalIn - totalOut;
  return (
    <ReportWrap title="Cash Flow Statement" outlet={outlet} month={month}>
      <SH>Cash Inflows</SH>
      <TR label="Total Sales Cash" val={totalSalesAmt} indent={1}/>
      <TR label="Empty Sold"       val={totalEmpSold}  indent={1}/>
      {Object.entries(empSold).map(([n, v]) => <TR key={n} label={`  BY ${n}`} val={v} indent={2}/>)}
      <TR label="(1) Total Cash Inflows" val={totalIn} bold total/>
      <SH>Cash Outflows</SH>
      <TR label="Day Sheet Expenses" val={totalExp}     indent={1}/>
      <TR label="Bank Deposit"       val={bankDeposit}  indent={1}/>
      <TR label="Empty Return"       val={totalEmpRet}  indent={1}/>
      {Object.entries(empReturn).map(([n, v]) => <TR key={n} label={`  TO ${n}`} val={v} indent={2}/>)}
      <TR label="Return Goods"            val={totalReturns} indent={1}/>
      <TR label="(2) Total Cash Outflows" val={totalOut}     bold total/>
      <TR label="(1) - (2) Net Cash Balance" val={netCash}  bold total/>
      <SH>Cash Balance Detail</SH>
      <TRSplit label=""          col2="B/F Balance" col3="End Balance"/>
      <TRSplit label="Cash"      col2={cashBF}      col3={cashBal}/>
      <TRSplit label="Net Cash"  col3={netCash} bold total/>
    </ReportWrap>
  );
}

function SalesSummary({d, outlet, month}) {
  const {salesByDay, totalSalesAmt, sales} = d;
  const days  = Array.from({length:31}, (_, i) => i + 1);
  const weeks = [[1,7],[8,14],[15,21],[22,28],[29,31]];
  const weekAvg = (s, e) => {
    const vals = days.filter(d => d >= s && d <= e && salesByDay[d]);
    return vals.length ? vals.reduce((a, d) => a + salesByDay[d], 0) / vals.length : 0;
  };
  return (
    <ReportWrap title="Sales Summary" outlet={outlet} month={month}>
      <tr style={{background:"var(--s3)"}}>
        {["Day","Daily Sale","Sale Ave.","Sold Items","Purchase"].map(h => (
          <td key={h} style={{padding:"6px 10px",fontSize:9,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",color:"var(--mut2)",borderBottom:"1px solid var(--bdr)"}}>{h}</td>
        ))}
      </tr>
      {days.map(d => {
        const dayTotal  = salesByDay[d] || 0;
        const soldItems = sales.filter(s => dayOf(s.date) === d).reduce((a, s) => a + (s.mainRows || []).filter(r => parseFloat(r.sold) > 0).length, 0);
        return (
          <tr key={d} style={{borderBottom:"1px solid rgba(63,63,70,.3)"}}>
            <td style={{padding:"5px 10px",fontSize:11.5,fontWeight:600,color:"var(--mut2)",width:40}}>{d}</td>
            <td style={{padding:"5px 10px",fontFamily:"'JetBrains Mono',monospace",fontSize:11.5,color:dayTotal>0?"var(--grn)":"var(--mut2)"}}>{dayTotal>0?`Rs.${fmt(dayTotal)}`:""}</td>
            <td style={{padding:"5px 10px",fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:"var(--mut)"}}>{dayTotal>0?`Rs.${fmt(dayTotal)}`:"—"}</td>
            <td style={{padding:"5px 10px",fontSize:11.5,color:"var(--mut)"}}>{soldItems>0?soldItems:""}</td>
            <td style={{padding:"5px 10px",fontSize:11.5,color:"var(--mut)"}}></td>
          </tr>
        );
      })}
      {weeks.map(([s, e]) => (
        <tr key={`avg${s}`} style={{background:"var(--gd2)",borderBottom:"1px solid var(--bdr)"}}>
          <td style={{padding:"5px 10px",fontSize:11,fontWeight:700,color:"var(--gld2)"}}>Avg {s}–{e}</td>
          <td style={{padding:"5px 10px",fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:"var(--gld2)"}}>Rs.{fmt(weekAvg(s,e))}</td>
          <td colSpan={3}/>
        </tr>
      ))}
      <tr style={{background:"var(--s3)",borderTop:"2px solid var(--bdr2)"}}>
        <td style={{padding:"7px 10px",fontWeight:700,fontSize:12}}>Total</td>
        <td style={{padding:"7px 10px",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:13,color:"var(--grn)"}}>Rs.{fmt(totalSalesAmt)}</td>
        <td colSpan={3}/>
      </tr>
    </ReportWrap>
  );
}

function ExpenseSummary({d, outlet, month}) {
  const {expByAcc, expByDay, totalExp} = d;
  const expCats = Object.values(expByAcc);
  return (
    <ReportWrap title="Expense Summary" outlet={outlet} month={month}>
      <tr style={{background:"var(--s3)"}}>
        <td style={{padding:"6px 10px",fontSize:9,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",color:"var(--mut2)",borderBottom:"1px solid var(--bdr)"}}>Description</td>
        <td style={{padding:"6px 10px",fontSize:9,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",color:"var(--mut2)",borderBottom:"1px solid var(--bdr)",textAlign:"right"}}>Total</td>
        <td/>
      </tr>
      {expCats.length === 0 && <tr><td colSpan={3} style={{padding:24,textAlign:"center",color:"var(--mut)"}}>No expenses recorded.</td></tr>}
      {expCats.sort((a, b) => b.total - a.total).map((e, i) => (
        <tr key={i} style={{borderBottom:"1px solid rgba(63,63,70,.3)"}}>
          <td style={{padding:"6px 12px",fontSize:12,color:"var(--txt)"}}>{e.name}</td>
          <td style={{padding:"6px 12px",fontFamily:"'JetBrains Mono',monospace",fontSize:12,textAlign:"right",color:"var(--red)"}}>Rs.{fmt(e.total)}</td>
          <td/>
        </tr>
      ))}
      <tr style={{background:"var(--s3)",borderTop:"2px solid var(--bdr2)"}}>
        <td style={{padding:"7px 12px",fontWeight:700,fontSize:12}}>Total Expenses</td>
        <td style={{padding:"7px 12px",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:13,color:"var(--red)",textAlign:"right"}}>Rs.{fmt(totalExp)}</td>
        <td/>
      </tr>
    </ReportWrap>
  );
}

function PurchaseSummary({d, outlet, month}) {
  const {purBySup, totalPurchase} = d;
  return (
    <ReportWrap title="Purchase Summary" outlet={outlet} month={month}>
      {Object.entries(purBySup).map(([supId, purs]) => (
        <>
          <SH key={supId + "h"}>{supId}</SH>
          <tr key={supId + "th"} style={{background:"var(--s2)"}}>
            {["Date","Invoice No","Description","Type","Qty","Value"].map(h => (
              <td key={h} style={{padding:"5px 10px",fontSize:9,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",color:"var(--mut2)",borderBottom:"1px solid var(--bdr)"}}>{h}</td>
            ))}
          </tr>
          {purs.map(p => (p.lines || []).map((l, i) => (
            <tr key={p.id + i} style={{borderBottom:"1px solid rgba(63,63,70,.3)"}}>
              <td style={{padding:"5px 10px",fontSize:11,color:"var(--mut)",fontFamily:"'JetBrains Mono',monospace"}}>{i === 0 ? p.date : ""}</td>
              <td style={{padding:"5px 10px",fontSize:11,color:"var(--mut)"}}>{i === 0 ? p.invoiceNo : ""}</td>
              <td style={{padding:"5px 10px",fontSize:11.5,fontWeight:600}}>{l.itemName || l.itemCode}</td>
              <td style={{padding:"5px 10px"}}><span className="tpill">{l.type}</span></td>
              <td style={{padding:"5px 10px",fontSize:11.5,textAlign:"right",fontFamily:"'JetBrains Mono',monospace"}}>{l.qty}</td>
              <td style={{padding:"5px 10px",fontSize:11.5,textAlign:"right",fontFamily:"'JetBrains Mono',monospace",color:"var(--grn)"}}>Rs.{fmt(l.amount || 0)}</td>
            </tr>
          )))}
          <tr style={{background:"var(--gd2)"}}>
            <td colSpan={5} style={{padding:"5px 10px",fontSize:11,fontWeight:700,color:"var(--gld2)",textAlign:"right"}}>Subtotal {supId.replace(/^\d{4}-/, "")}:</td>
            <td style={{padding:"5px 10px",fontSize:12,fontWeight:700,color:"var(--gld2)",textAlign:"right",fontFamily:"'JetBrains Mono',monospace"}}>Rs.{fmt(purs.reduce((a, p) => a + p.grandTotal, 0))}</td>
          </tr>
        </>
      ))}
      {Object.keys(purBySup).length === 0 && <tr><td colSpan={6} style={{padding:24,textAlign:"center",color:"var(--mut)"}}>No purchases recorded.</td></tr>}
      <tr style={{background:"var(--s3)",borderTop:"2px solid var(--bdr2)"}}>
        <td colSpan={5} style={{padding:"7px 10px",fontWeight:700,fontSize:12,textAlign:"right"}}>Total Purchase:</td>
        <td style={{padding:"7px 10px",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:13,color:"var(--grn)",textAlign:"right"}}>Rs.{fmt(totalPurchase)}</td>
      </tr>
    </ReportWrap>
  );
}

function CostOfSalesSummary({d, outlet, month}) {
  const {cosByItem} = d;
  const items    = Object.values(cosByItem);
  const totalCOS = items.reduce((a, i) => a + i.sold * i.unitCost, 0);
  return (
    <ReportWrap title="Cost of Sales Summary" outlet={outlet} month={month}>
      <tr style={{background:"var(--s3)"}}>
        {["Description","Type","Opening","Purchase","Trans In","Trans Out","Return","Adj","Sold","Unit Cost","Cost of Sales"].map(h => (
          <td key={h} style={{padding:"5px 8px",fontSize:8.5,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",color:"var(--mut2)",borderBottom:"1px solid var(--bdr)",whiteSpace:"nowrap"}}>{h}</td>
        ))}
      </tr>
      {items.length === 0 && <tr><td colSpan={11} style={{padding:24,textAlign:"center",color:"var(--mut)"}}>No sold items this period.</td></tr>}
      {items.map(item => {
        const cos = item.sold * item.unitCost;
        return (
          <tr key={item.code} style={{borderBottom:"1px solid rgba(63,63,70,.3)"}}>
            <td style={{padding:"5px 8px",fontSize:11.5,fontWeight:600}}>{item.name} <span className="ctag">{item.code}</span></td>
            <td style={{padding:"5px 8px"}}><span className="tpill">{item.type}</span></td>
            <td style={{padding:"5px 8px",fontSize:11,textAlign:"right",fontFamily:"'JetBrains Mono',monospace"}}>{item.openStock || 0}</td>
            <td style={{padding:"5px 8px",fontSize:11,textAlign:"right",fontFamily:"'JetBrains Mono',monospace"}}>{item.purchase || 0}</td>
            <td style={{padding:"5px 8px",fontSize:11,textAlign:"right",fontFamily:"'JetBrains Mono',monospace",color:"var(--blu)"}}>{item.transIn || 0}</td>
            <td style={{padding:"5px 8px",fontSize:11,textAlign:"right",fontFamily:"'JetBrains Mono',monospace",color:"var(--gld2)"}}>{item.transOut || 0}</td>
            <td style={{padding:"5px 8px",fontSize:11,textAlign:"right",fontFamily:"'JetBrains Mono',monospace",color:"var(--red)"}}>{item.returns || 0}</td>
            <td style={{padding:"5px 8px",fontSize:11,textAlign:"right",fontFamily:"'JetBrains Mono',monospace"}}>{item.adj || 0}</td>
            <td style={{padding:"5px 8px",fontSize:11.5,textAlign:"right",fontFamily:"'JetBrains Mono',monospace",fontWeight:600,color:"var(--grn)"}}>{item.sold}</td>
            <td style={{padding:"5px 8px",fontSize:11,textAlign:"right",fontFamily:"'JetBrains Mono',monospace",color:"var(--mut)"}}>Rs.{fmt(item.unitCost)}</td>
            <td style={{padding:"5px 8px",fontSize:11.5,textAlign:"right",fontFamily:"'JetBrains Mono',monospace",fontWeight:600,color:"var(--grn)"}}>Rs.{fmt(cos)}</td>
          </tr>
        );
      })}
      <tr style={{background:"var(--s3)",borderTop:"2px solid var(--bdr2)"}}>
        <td colSpan={10} style={{padding:"7px 8px",fontWeight:700,fontSize:12,textAlign:"right"}}>Total Cost of Sales:</td>
        <td style={{padding:"7px 8px",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:13,color:"var(--grn)",textAlign:"right"}}>Rs.{fmt(totalCOS)}</td>
      </tr>
      <tr><td colSpan={11} style={{padding:"8px 8px",fontSize:10.5,color:"var(--mut)",fontStyle:"italic"}}>
        Formula: Opening Stock + Total Purchase + Transfer In − Transfer Out − Return − Adj = Total Sold &nbsp;·&nbsp; Total Sold × Unit Cost = Cost of Sales
      </td></tr>
    </ReportWrap>
  );
}

// ══════════════════════════════════════════════════════
// EMPTY BOTTLES
// FIX: Corrected column headers to match spec exactly
// ══════════════════════════════════════════════════════
function EmptyBottles({ d, outlet, month }) {
  const { empty, sales } = d;

  // FIX: Corrected column definitions per spec
  // DATE | B/F | PUR | IN PUR | REC | RET | EX | IN ISS | ISS | SOL | SHO | BAL
  const COLS = ["B/F", "PUR", "IN PUR", "REC", "RET", "EX", "IN ISS", "ISS", "SOL", "SHO", "BAL"];

  const suppliers = useMemo(() => {
    const groups = {};
    sales.forEach(s =>
      (s.empRows || []).forEach(e => {
        if (!groups[e.name]) groups[e.name] = { name: e.name };
      })
    );
    empty.forEach(e => {
      if (!groups[e.name]) groups[e.name] = { name: e.name };
    });
    return Object.values(groups);
  }, [empty, sales]);

  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  const dailyData = useMemo(() => {
    const data = {};
    suppliers.forEach(sup => { data[sup.name] = {}; });
    sales.forEach(s => {
      const day = dayOf(s.date);
      (s.empRows || []).forEach(e => {
        if (!data[e.name]) data[e.name] = {};
        if (!data[e.name][day]) data[e.name][day] = { sold: 0, return_: 0, purchase: 0 };
        data[e.name][day].sold     += parseFloat(e.sold)     || 0;
        data[e.name][day].return_  += parseFloat(e.return_)  || 0;
        data[e.name][day].purchase += parseFloat(e.purchase) || 0;
      });
    });
    return data;
  }, [suppliers, sales]);

  const totals = useMemo(() => {
    const t = {};
    suppliers.forEach(sup => {
      const dd = dailyData[sup.name] || {};
      t[sup.name] = { sold: 0, return_: 0, purchase: 0 };
      Object.values(dd).forEach(v => {
        t[sup.name].sold     += v.sold     || 0;
        t[sup.name].return_  += v.return_  || 0;
        t[sup.name].purchase += v.purchase || 0;
      });
    });
    return t;
  }, [suppliers, dailyData]);

  const thStyle = {
    padding: "5px 6px",
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: ".06em",
    textTransform: "uppercase",
    color: "var(--mut2)",
    borderBottom: "1px solid var(--bdr)",
    borderRight: "1px solid var(--bdr)",
    textAlign: "center",
    whiteSpace: "nowrap",
    background: "var(--s3)",
  };
  const tdStyle = (bold, color) => ({
    padding: "3px 6px",
    fontSize: 10.5,
    fontFamily: "'JetBrains Mono',monospace",
    textAlign: "right",
    borderRight: "1px solid rgba(63,63,70,.2)",
    borderBottom: "1px solid rgba(63,63,70,.15)",
    fontWeight: bold ? 700 : 400,
    color: color || "var(--txt)",
    minWidth: 38,
  });
  const dayTdStyle = {
    padding: "3px 7px",
    fontSize: 11,
    fontWeight: 600,
    color: "var(--mut2)",
    borderRight: "1px solid var(--bdr)",
    borderBottom: "1px solid rgba(63,63,70,.15)",
    textAlign: "center",
    background: "var(--s2)",
  };

  if (suppliers.length === 0) {
    return (
      <ReportWrap title="Empty Bottles" outlet={outlet} month={month}>
        <tr>
          <td colSpan={10} style={{ padding: 24, textAlign: "center", color: "var(--mut)" }}>
            No empty bottle data. Record empty bottle transactions in Sales day sheets.
          </td>
        </tr>
      </ReportWrap>
    );
  }

  const mo = month
    ? new Date(month + "-01").toLocaleString("en-LK", { month: "long", year: "numeric" })
    : "All Periods";

  return (
    <div>
      <div className="no-print" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button className="btn btnd btnsm" onClick={() => window.print()}>🖨 Print</button>
      </div>
      <div style={{ background: "var(--s1)", border: "1px solid var(--bdr)", borderRadius: "var(--rl)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--bdr)", background: "var(--s2)" }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, marginBottom: 2 }}>Empty Bottles</div>
          <div style={{ fontSize: 11, color: "var(--mut)" }}>
            {outlet === "ALL" ? "All Outlets" : outlet} &nbsp;·&nbsp; {mo}
          </div>
        </div>

        {/* Scrollable table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              {/* Row 1: DATE header + supplier name groups */}
              <tr>
                <th rowSpan={3} style={{ ...thStyle, minWidth: 42, fontSize: 11 }}>DATE</th>
                {suppliers.map(sup => (
                  <th key={sup.name} colSpan={COLS.length} style={{
                    ...thStyle,
                    background: "var(--gd2)",
                    color: "var(--gld2)",
                    fontSize: 11,
                    borderBottom: "1px solid var(--bdr2)",
                  }}>
                    {sup.name}
                  </th>
                ))}
              </tr>
              {/* Row 2: EMPTY BOTTLE label */}
              <tr>
                {suppliers.map(sup => (
                  <th key={sup.name + "eb"} colSpan={COLS.length} style={{
                    ...thStyle,
                    background: "var(--s3)",
                    color: "var(--mut2)",
                    fontSize: 8.5,
                  }}>
                    EMPTY BOTTLE
                  </th>
                ))}
              </tr>
              {/* Row 3: Column headers — FIX: matching exact spec */}
              <tr>
                {suppliers.map(sup =>
                  COLS.map(col => (
                    <th key={sup.name + col} style={thStyle}>{col}</th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {days.map(day => (
                <tr key={day}>
                  <td style={dayTdStyle}>{day}</td>
                  {suppliers.map(sup => {
                    const dd  = (dailyData[sup.name] || {})[day] || {};
                    const sold = dd.sold    || 0;
                    const ret  = dd.return_ || 0;
                    const pur  = dd.purchase || 0;
                    const bal  = pur + ret - sold;
                    return COLS.map(col => {
                      let val = "";
                      // FIX: map columns to correct data fields
                      if (col === "SOL"    && sold > 0) val = fmtN(sold);
                      if (col === "RET"    && ret  > 0) val = fmtN(ret);
                      if (col === "PUR"    && pur  > 0) val = fmtN(pur);
                      if (col === "BAL")                val = fmtN(bal);
                      // B/F, IN PUR, REC, EX, IN ISS, ISS, SHO — available when your data model tracks them
                      return (
                        <td key={sup.name + col + day} style={tdStyle(
                          col === "BAL",
                          col === "SOL" ? "var(--grn)"
                            : col === "BAL" ? (bal >= 0 ? "var(--grn)" : "var(--red)")
                            : "var(--txt)"
                        )}>
                          {val}
                        </td>
                      );
                    });
                  })}
                </tr>
              ))}

              {/* TOTAL row */}
              <tr style={{ borderTop: "2px solid var(--bdr2)", background: "var(--s3)" }}>
                <td style={{ ...dayTdStyle, fontWeight: 700, fontSize: 10, color: "var(--txt)" }}>TOTAL</td>
                {suppliers.map(sup => {
                  const t = totals[sup.name] || {};
                  return COLS.map(col => {
                    let val = "";
                    if (col === "SOL") val = fmtN(t.sold     || 0);
                    if (col === "RET") val = fmtN(t.return_  || 0);
                    if (col === "PUR") val = fmtN(t.purchase || 0);
                    if (col === "BAL") val = fmtN((t.purchase || 0) + (t.return_ || 0) - (t.sold || 0));
                    return (
                      <td key={"tot" + sup.name + col} style={tdStyle(true,
                        col === "SOL" ? "var(--grn)" : col === "BAL" ? "var(--gld2)" : "var(--txt)"
                      )}>
                        {val}
                      </td>
                    );
                  });
                })}
              </tr>

              {/* Summary rows */}
              {["RECIVED", "ISSUED", "LOAN / OI"].map(label => (
                <tr key={label} style={{ background: "var(--s2)" }}>
                  <td style={{ ...dayTdStyle, fontSize: 9, whiteSpace: "nowrap" }}>{label}</td>
                  {suppliers.map(sup =>
                    COLS.map(col => (
                      <td key={label + sup.name + col} style={tdStyle(false)}>
                        {col === "BAL" ? "0" : ""}
                      </td>
                    ))
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function EmptyPlasticCrates({d, outlet, month}) {
  const {empty} = d;
  const plasticItems = empty.filter(e =>
    e.name.toLowerCase().includes("crate") ||
    e.code.toLowerCase().includes("crt")  ||
    e.name.toLowerCase().includes("plastic")
  );
  return (
    <ReportWrap title="Empty Plastic Crates" outlet={outlet} month={month}>
      <tr style={{background:"var(--s3)"}}>
        {["Code","Name","Rate","On Hand Qty","Value"].map(h => (
          <td key={h} style={{padding:"6px 10px",fontSize:9,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",color:"var(--mut2)",borderBottom:"1px solid var(--bdr)"}}>{h}</td>
        ))}
      </tr>
      {plasticItems.length === 0 && (
        <tr><td colSpan={5} style={{padding:24,textAlign:"center",color:"var(--mut)"}}>No plastic crate items configured. Add items with "CRATE" or "PLASTIC" in name from Inventory → Empty Stock.</td></tr>
      )}
      {plasticItems.map(e => (
        <tr key={e.id} style={{borderBottom:"1px solid rgba(63,63,70,.3)"}}>
          <td style={{padding:"6px 10px"}}><span className="ctag">{e.code}</span></td>
          <td style={{padding:"6px 10px",fontSize:12,fontWeight:600}}>{e.name}</td>
          <td style={{padding:"6px 10px",fontFamily:"'JetBrains Mono',monospace",fontSize:11.5,color:"var(--gld2)"}}>Rs.{fmt(e.rate)}</td>
          <td style={{padding:"6px 10px",fontFamily:"'JetBrains Mono',monospace",fontSize:11.5,textAlign:"right"}}>{e.qty}</td>
          <td style={{padding:"6px 10px",fontFamily:"'JetBrains Mono',monospace",fontSize:11.5,textAlign:"right",color:"var(--grn)"}}>Rs.{fmt(e.qty * e.rate)}</td>
        </tr>
      ))}
    </ReportWrap>
  );
}

// ══════════════════════════════════════════════════════
// MAIN REPORTS COMPONENT
// FIX: Staff outlet locked to their own outlet; admin can filter
// ══════════════════════════════════════════════════════
export default function Reports({ user }) {
  const isAdmin   = user?.role === "admin";
  // FIX: Staff outlet is locked — they cannot change it
  const userOutlet = user?.outlet || OUTLETS[0];

  const [report, setReport] = useState("income");
  // FIX: Admin defaults to "ALL", staff locked to their outlet
  const [outlet, setOutlet] = useState(isAdmin ? "ALL" : userOutlet);
  const [month,  setMonth]  = useState(today().slice(0, 7));

  // FIX: If staff changes outlet externally, reset back to their outlet
  const effectiveOutlet = isAdmin ? outlet : userOutlet;

  const d = useReportData(effectiveOutlet, month);

  const reportList = [
    { id:"income",    label:"Income Statement",      icon:"📊" },
    { id:"balance",   label:"Balance Sheet",         icon:"⚖️"  },
    { id:"capital",   label:"Capital Sheet",         icon:"💰" },
    { id:"cashflow",  label:"Cash Flow Statement",   icon:"💸" },
    { id:"sales",     label:"Sales Summary",         icon:"📈" },
    { id:"expenses",  label:"Expense Summary",       icon:"📉" },
    { id:"purchase",  label:"Purchase Summary",      icon:"🛒" },
    { id:"cos",       label:"Cost of Sales Summary", icon:"📦" },
    { id:"emptybott", label:"Empty Bottles",         icon:"🍾" },
    { id:"emptycrat", label:"Empty Plastic Crates",  icon:"📫" },
  ];

  return (
    <div className="shell">
      {/* ── Reports Sidebar ── */}
      <aside style={{width:210, background:"var(--s1)", borderRight:"1px solid var(--bdr)", display:"flex", flexDirection:"column", flexShrink:0}}>
        <div style={{padding:"14px 12px 10px", borderBottom:"1px solid var(--bdr)"}}>
          <div style={{fontFamily:"'Playfair Display',serif", fontSize:13, color:"var(--txt)"}}>Reports</div>
          <div style={{fontSize:9.5, color:"var(--mut2)", marginTop:1}}>View & Print</div>
        </div>

        {/* Filters */}
        <div style={{padding:"10px 10px 6px", borderBottom:"1px solid var(--bdr)"}}>
          <div style={{marginBottom:7}}>
            <div style={{fontSize:9, fontWeight:700, letterSpacing:".1em", textTransform:"uppercase", color:"var(--mut2)", marginBottom:3}}>Month</div>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)}
              style={{width:"100%", padding:"5px 8px", background:"var(--s2)", border:"1px solid var(--bdr)", borderRadius:6, fontSize:11.5, fontFamily:"'Inter',sans-serif", color:"var(--txt)", outline:"none"}}/>
          </div>

          {/* FIX: Admin sees outlet selector; staff sees read-only outlet label */}
          {isAdmin ? (
            <div>
              <div style={{fontSize:9, fontWeight:700, letterSpacing:".1em", textTransform:"uppercase", color:"var(--mut2)", marginBottom:3}}>Outlet</div>
              <select value={outlet} onChange={e => setOutlet(e.target.value)}
                style={{width:"100%", padding:"5px 8px", background:"var(--s2)", border:"1px solid var(--bdr)", borderRadius:6, fontSize:11, fontFamily:"'Inter',sans-serif", color:"var(--txt)", outline:"none", appearance:"none"}}>
                <option value="ALL">All Outlets</option>
                {OUTLETS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <div style={{fontSize:9, fontWeight:700, letterSpacing:".1em", textTransform:"uppercase", color:"var(--mut2)", marginBottom:3}}>Outlet</div>
              <div style={{padding:"5px 8px", background:"var(--s3)", border:"1px solid var(--bdr)", borderRadius:6, fontSize:11, color:"var(--gld2)", fontWeight:600}}>
                {userOutlet}
              </div>
            </div>
          )}
        </div>

        {/* Report List */}
        <nav style={{flex:1, overflowY:"auto", padding:"6px 6px"}}>
          {reportList.map(r => (
            <button key={r.id}
              className={`ni ${report === r.id ? "act" : ""}`}
              onClick={() => setReport(r.id)}
              style={{width:"100%", marginBottom:2}}>
              <span style={{fontSize:13}}>{r.icon}</span>
              <span style={{fontSize:11.5}}>{r.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Report Content ── */}
      <div style={{flex:1, overflow:"hidden", display:"flex", flexDirection:"column"}}>
        <div style={{background:"var(--s1)", borderBottom:"1px solid var(--bdr)", padding:"0 20px", height:52, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0}}>
          <div>
            <h1 style={{fontFamily:"'Playfair Display',serif", fontSize:17}}>{reportList.find(r => r.id === report)?.label}</h1>
            <p style={{fontSize:10.5, color:"var(--mut)", marginTop:1}}>
              {effectiveOutlet === "ALL" ? "All Outlets" : effectiveOutlet} &nbsp;·&nbsp;
              {month ? new Date(month + "-01").toLocaleString("en-LK", {month:"long", year:"numeric"}) : "All Periods"}
            </p>
          </div>
          <button className="btn btnd btnsm no-print" onClick={() => window.print()}>{I.print} Print</button>
        </div>
        <div className="page">
          {report === "income"    && <IncomeStatement    d={d} outlet={effectiveOutlet} month={month}/>}
          {report === "balance"   && <BalanceSheet       d={d} outlet={effectiveOutlet} month={month}/>}
          {report === "capital"   && <CapitalSheet       d={d} outlet={effectiveOutlet} month={month}/>}
          {report === "cashflow"  && <CashFlowStatement  d={d} outlet={effectiveOutlet} month={month}/>}
          {report === "sales"     && <SalesSummary       d={d} outlet={effectiveOutlet} month={month}/>}
          {report === "expenses"  && <ExpenseSummary     d={d} outlet={effectiveOutlet} month={month}/>}
          {report === "purchase"  && <PurchaseSummary    d={d} outlet={effectiveOutlet} month={month}/>}
          {report === "cos"       && <CostOfSalesSummary d={d} outlet={effectiveOutlet} month={month}/>}
          {report === "emptybott" && <EmptyBottles       d={d} outlet={effectiveOutlet} month={month}/>}
          {report === "emptycrat" && <EmptyPlasticCrates d={d} outlet={effectiveOutlet} month={month}/>}
        </div>
      </div>
    </div>
  );
}
