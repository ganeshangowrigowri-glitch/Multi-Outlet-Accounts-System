import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ls, lss, fmt, oKey, today } from "../../utils/helpers";
import { uid, postCash, postGL } from "../../utils/helpers";
import { I } from "../../utils/icons";
import { SEED_INVENTORY } from "../../data/seeds";
import { outletInvKey, outletEmptyInvKey } from "../admin/InventoryAdmin";

// ─────────────────────────────────────────────────────────────
//  OUTLET MAIN INVENTORY
//  Reads master + outlet overrides (Tab 3).
//  Override key is `code__supplier` (composite) to allow same
//  code to exist under different suppliers (e.g. LION BREWERY
//  and KASTHURI W/S sharing the same item codes).
// ─────────────────────────────────────────────────────────────
function getOutletInventory(outlet) {
  const master    = ls("inv_main", SEED_INVENTORY);
  const overrides = ls(outletInvKey(outlet), {});
  return master
    .filter(item => {
      const ovKey = `${item.code}__${item.supplier}`;
      return item.type !== "EM" && !overrides[ovKey]?.hidden;
    })
    .map(item => {
      const ovKey = `${item.code}__${item.supplier}`;
      const ov    = overrides[ovKey];
      if (!ov) return item;
      return {
        ...item,
        unitCost:     ov.unitCost     !== undefined ? ov.unitCost     : item.unitCost,
        sellingPrice: ov.sellingPrice !== undefined ? ov.sellingPrice : item.sellingPrice,
      };
    });
}

// ─────────────────────────────────────────────────────────────
//  EMPTY STOCK SEED
//  Each row has a UNIQUE `id` (supplierId__code pattern) so
//  React keys never clash even when the same code appears under
//  multiple suppliers (DCSL and EMPTY PURCHASE both have DEMP Q).
// ─────────────────────────────────────────────────────────────
const EMPTY_SEED_STAFF = [
  // ── DCSL ──
  { id:"DCSL__DEMP_Q",  code:"DEMP Q",  name:"DES EMP",  supplier:"DCSL",           unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
  { id:"DCSL__DEMP_P",  code:"DEMP P",  name:"DES EMP",  supplier:"DCSL",           unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
  { id:"DCSL__DEMP_N",  code:"DEMP N",  name:"DES EMP",  supplier:"DCSL",           unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
  // ── LION BREWERY ──
  { id:"LION__BEMP_Q",  code:"BEMP Q",  name:"BEER EMP", supplier:"LION BREWERY",   unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
  // ── TODDY ──
  { id:"TODD__TEMP_Q",  code:"TEMP Q",  name:"TOD EMP",  supplier:"TODDY",          unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
  // ── UG ──
  { id:"UG__UEMP_Q",    code:"UEMP Q",  name:"UG EMP",   supplier:"UG",             unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
  // ── DCSL BEER ──
  { id:"BEER__HEMP_Q",  code:"HEMP Q",  name:"HEI EMP",  supplier:"DCSL BEER",      unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
  // ── EMPTY PURCHASE (independent supplier — includes all of the above items) ──
  { id:"EP__DEMP_Q",    code:"DEMP Q",  name:"DES EMP",  supplier:"EMPTY PURCHASE", unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
  { id:"EP__DEMP_P",    code:"DEMP P",  name:"DES EMP",  supplier:"EMPTY PURCHASE", unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
  { id:"EP__DEMP_N",    code:"DEMP N",  name:"DES EMP",  supplier:"EMPTY PURCHASE", unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
  { id:"EP__BEMP_Q",    code:"BEMP Q",  name:"BEER EMP", supplier:"EMPTY PURCHASE", unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
  { id:"EP__TEMP_Q",    code:"TEMP Q",  name:"TOD EMP",  supplier:"EMPTY PURCHASE", unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
  { id:"EP__UEMP_Q",    code:"UEMP Q",  name:"UG EMP",   supplier:"EMPTY PURCHASE", unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
  { id:"EP__HEMP_Q",    code:"HEMP Q",  name:"HEI EMP",  supplier:"EMPTY PURCHASE", unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
];

// ─────────────────────────────────────────────────────────────
//  OUTLET EMPTY INVENTORY
//  Override key is item.id (unique) NOT item.code, because the
//  same code can exist under different empty suppliers.
// ─────────────────────────────────────────────────────────────
function getOutletEmptyInventory(outlet) {
  let master = ls("inv_empty_v2", null);
  if (!master || master.length === 0) {
    lss("inv_empty_v2", EMPTY_SEED_STAFF);
    master = EMPTY_SEED_STAFF;
  }
  const overrides = ls(outletEmptyInvKey(outlet), {});
  return master
    .filter(item => !overrides[item.id]?.hidden)
    .map(item => {
      const ov = overrides[item.id];
      if (!ov) return item;
      return {
        ...item,
        unitCost:     ov.unitCost     !== undefined ? ov.unitCost     : item.unitCost,
        sellingPrice: ov.sellingPrice !== undefined ? ov.sellingPrice : item.sellingPrice,
      };
    });
}

// ─────────────────────────────────────────────────────────────
//  OPENING STOCK HELPER
//  Priority: explicit opening for this date → yesterday's
//  saved end stock → seed qty (first-time).
// ─────────────────────────────────────────────────────────────
function prevDate(dateStr) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function getOpeningForDate(outlet, date, seedMain, seedEmp) {
  // 1. Explicit opening saved for today
  const todayOpening = ls(oKey(outlet, `opening_${date}`), null);
  if (todayOpening) return todayOpening;

  // 2. Yesterday's end stock from saved daily sale
  const yDate    = prevDate(date);
  const yOpening = ls(oKey(outlet, `opening_${yDate}`), null);
  if (yOpening) return yOpening;

  const yesSales = ls(oKey(outlet, "sales"), []).find(s => s.date === yDate);
  if (yesSales) {
    const main = {}, emp = {};
    (yesSales.mainRows || []).forEach(r => {
      const es = r.endStock !== "" && r.endStock !== undefined
        ? parseFloat(r.endStock) || 0
        : null;
      if (es !== null) main[r.code] = es;
    });
    // For empty rows key by unique id
    (yesSales.empRows || []).forEach(r => {
      const es = r.endStock !== "" && r.endStock !== undefined
        ? parseFloat(r.endStock) || 0
        : null;
      if (es !== null) emp[r.id] = es;
    });
    if (Object.keys(main).length || Object.keys(emp).length) return { main, emp };
  }

  // 3. Fall back to seed qty
  const main = {}, emp = {};
  seedMain.forEach(i => { main[i.code] = Number(i.qty) || 0; });
  seedEmp.forEach(e  => { emp[e.id]   = Number(e.qty) || 0; });
  return { main, emp };
}

// ─────────────────────────────────────────────────────────────
//  SCROLL ARROWS
// ─────────────────────────────────────────────────────────────
function ScrollArrows({ scrollBy }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
      <button onClick={() => scrollBy(-300)} style={{
        width:28, height:24, borderRadius:5,
        border:"1px solid var(--s3,#444)",
        background:"var(--s2,#252540)", color:"var(--txt,#ccc)",
        cursor:"pointer", fontSize:15,
        display:"flex", alignItems:"center", justifyContent:"center",
      }}>‹</button>
      <button onClick={() => scrollBy(300)} style={{
        width:28, height:24, borderRadius:5,
        border:"1px solid var(--s3,#444)",
        background:"var(--s2,#252540)", color:"var(--txt,#ccc)",
        cursor:"pointer", fontSize:15,
        display:"flex", alignItems:"center", justifyContent:"center",
      }}>›</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  MAIN COMPONENT
//  subTab  → "daily" | "status"
//  dailyTab → "main"  | "empty"
// ─────────────────────────────────────────────────────────────
function CsTotals({ csData, fmt, physStock }) {
  const totSale   = csData.reduce((a, r) => a + r.totalSaleAmt,   0);
  const totProfit = csData.reduce((a, r) => a + r.profit,         0);
  const totPhys   = csData.reduce((a, r) =>
    a + Number(r.physicalStockOverride !== "" ? r.physicalStockOverride : r.physicalStock), 0);
  const totTBS    = csData.reduce((a, r) => a + r.totalBottleSale, 0);
  return (
    <tfoot>
      <tr style={{ background:"var(--s3)", fontWeight:700 }}>
        <td colSpan={7} className="rt" style={{ paddingRight:11, fontSize:11.5 }}>Totals:</td>
        <td className="rt mono bold">{totTBS}</td>
        <td className="rt mono bold">Rs.{fmt(totPhys)}</td>
        <td className="rt mono cg bold">Rs.{fmt(totSale)}</td>
        <td className="rt mono cg bold">Rs.{fmt(totProfit)}</td>
        <td colSpan={5} />
      </tr>
    </tfoot>
  );
}
export default function S_Inventory({ outlet, user, toast_, subTab, dailyTab }) {

  const [mainDate,      setMainDate]      = useState(today());
  const [mainSupFilter, setMainSupFilter] = useState("ALL");
  const [empDate,       setEmpDate]       = useState(today());
  const [empSupFilter,  setEmpSupFilter]  = useState("ALL");
  const [csFrom,        setCsFrom]        = useState(() => today().slice(0, 7) + "-01");
  const [csTo,          setCsTo]          = useState(today);
  const [physStock,     setPhysStock]     = useState({});

  const mainTableRef = useRef(null);
  const empTableRef  = useRef(null);
  const csTableRef = useRef(null);
  const mainScrollBy = useCallback(d => mainTableRef.current?.scrollBy({ left:d, behavior:"smooth" }), []);
  const empScrollBy  = useCallback(d => empTableRef.current?.scrollBy({ left:d, behavior:"smooth" }), []);

  // Stable seed references
  const seedMain = useMemo(() => getOutletInventory(outlet),      [outlet]);
  const seedEmp  = useMemo(() => getOutletEmptyInventory(outlet), [outlet]);

  // ── Supplier dropdown for Main tab (strip numeric prefix for display) ──
  const mainSuppliers = useMemo(() => {
    const stripped = seedMain.map(i => (i.supplier || "").replace(/^\d{4}-/, "").trim() || "—");
    return ["ALL", ...[...new Set(stripped)].sort()];
  }, [seedMain]);

  // ── Supplier dropdown for Empty tab (use full supplier name) ──
  const empSuppliers = useMemo(() => {
    const sups = seedEmp.map(i => (i.supplier || "").trim() || "EMP");
    return ["ALL", ...[...new Set(sups)].sort()];
  }, [seedEmp]);

  // ── Main rows state ──
  const [mainRows, setMR] = useState(() =>
    seedMain.map(i => ({
      ...i,
      adminSellingPrice: Number(i.sellingPrice) || 0,
      openingStock: Number(i.qty) || 0,
      purchase:0, transferIn:0, transferOut:0, returns:0,
      sold:"", rate: Number(i.sellingPrice) || 0, endStock:"",
    }))
  );

  // ── Empty rows state ──
  const [empRows, setER] = useState(() =>
    seedEmp.map(e => ({
      ...e,
      adminSellingPrice: Number(e.sellingPrice) || Number(e.rate) || 0,
      openingStock: Number(e.qty) || 0,
      purchase:0, invPurchase:"", received:"",
      return_:"", invIssue:"", issue:"",
      sold:"", rate: Number(e.sellingPrice) || Number(e.rate) || 0, endStock:"",
    }))
  );

  // ── Reload mainRows when outlet or date changes ──
  useEffect(() => {
    const lsMain = getOutletInventory(outlet);
    const lsEmp  = getOutletEmptyInventory(outlet);
    const opening = getOpeningForDate(outlet, mainDate, lsMain, lsEmp);
    const savedSale = ls(oKey(outlet, "sales"), [])
      .find(s => s.date === mainDate && (s.mainRows || []).length > 0);
    const savedMap = savedSale
      ? Object.fromEntries((savedSale.mainRows || []).map(r => [r.id, r]))
      : {};

    setMR(() => lsMain.map(i => {
      const adminSP = Number(i.sellingPrice) || 0;
      // Opening keyed by code for main items
      const op = opening.main?.[i.code] ?? Number(i.qty) ?? 0;
      const saved = savedMap[i.id];
      if (saved) {
        return {
          ...i, adminSellingPrice:adminSP, openingStock:op,
          purchase:    saved.purchase    || 0,
          transferIn:  saved.transferIn  || 0,
          transferOut: saved.transferOut || 0,
          returns:     saved.returns     || 0,
          sold:        saved.sold        ?? "",
          rate:        Number(saved.rate) || adminSP,
          endStock:    saved.endStock    ?? "",
        };
      }
      return {
        ...i, adminSellingPrice:adminSP, openingStock:op,
        purchase:0, transferIn:0, transferOut:0, returns:0,
        sold:"", rate:adminSP, endStock:"",
      };
    }));
  }, [outlet, mainDate]); // eslint-disable-line

  // ── Reload empRows when outlet or empDate changes ──
  useEffect(() => {
    const lsMain = getOutletInventory(outlet);
    const lsEmp  = getOutletEmptyInventory(outlet);
    const opening = getOpeningForDate(outlet, empDate, lsMain, lsEmp);
    const savedSale = ls(oKey(outlet, "sales"), [])
      .find(s => s.date === empDate && (s.empRows || []).length > 0);
    // Key by unique id — codes repeat across suppliers (DEMP Q under DCSL AND EMPTY PURCHASE)
    const savedMap = savedSale
      ? Object.fromEntries((savedSale.empRows || []).map(r => [r.id, r]))
      : {};

    setER(() => lsEmp.map(e => {
      const adminSP = Number(e.sellingPrice) || Number(e.rate) || 0;
      // Opening keyed by unique id for empty items
      const op = opening.emp?.[e.id] ?? Number(e.qty) ?? 0;
      const saved = savedMap[e.id];
      if (saved) {
        return {
          ...e, adminSellingPrice:adminSP, openingStock:op,
          purchase:    saved.purchase    || 0,
          invPurchase: saved.invPurchase || "",
          received:    saved.received    || "",
          return_:     saved.return_     || "",
          invIssue:    saved.invIssue    || "",
          issue:       saved.issue       || "",
          sold:        saved.sold        || "",
          rate:        Number(saved.rate) || adminSP,
          endStock:    saved.endStock    || "",
        };
      }
      return {
        ...e, adminSellingPrice:adminSP, openingStock:op,
        purchase:0, invPurchase:"", received:"",
        return_:"", invIssue:"", issue:"",
        sold:"", rate:adminSP, endStock:"",
      };
    }));
  }, [outlet, empDate]); // eslint-disable-line

  // ── Auto-populate Purchase / TransferIn / TransferOut / Returns for Main ──
  useEffect(() => {
    const pV={}, tiV={}, toV={}, rV={};
    ls(oKey(outlet, "purchases"), [])
      .filter(r => r.date === mainDate)
      .forEach(rec => (rec.lines || []).forEach(l => {
        if (!l.itemCode || l.isEmptyItem) return;
        pV[l.itemCode] = (pV[l.itemCode] || 0) + (parseFloat(l.qty) || 0);
      }));
    ls(oKey(outlet, "transfers"), [])
      .filter(r => r.date === mainDate && r.type === "in")
      .forEach(rec => (rec.lines || []).forEach(l => {
        if (!l.itemCode) return;
        tiV[l.itemCode] = (tiV[l.itemCode] || 0) + (parseFloat(l.qty) || 0);
      }));
    ls(oKey(outlet, "transfers"), [])
      .filter(r => r.date === mainDate && r.type === "out")
      .forEach(rec => (rec.lines || []).forEach(l => {
        if (!l.itemCode) return;
        toV[l.itemCode] = (toV[l.itemCode] || 0) + (parseFloat(l.qty) || 0);
      }));
    ls(oKey(outlet, "returns"), [])
      .filter(r => r.date === mainDate)
      .forEach(rec => (rec.lines || []).forEach(l => {
        if (!l.itemCode) return;
        rV[l.itemCode] = (rV[l.itemCode] || 0) + (parseFloat(l.qty) || 0);
      }));
    setMR(prev => prev.map(r => ({
      ...r,
      purchase:    pV[r.code]  || 0,
      transferIn:  tiV[r.code] || 0,
      transferOut: toV[r.code] || 0,
      returns:     rV[r.code]  || 0,
    })));
  }, [outlet, mainDate]); // eslint-disable-line

  // ── Auto-populate Purchase / InvPurchase for Empty ──
  useEffect(() => {
    const codes = new Set(seedEmp.map(e => e.code));
    const pQ = {}, ipQ = {};
    ls(oKey(outlet, "purchases"), [])
      .filter(r => r.date === empDate)
      .forEach(rec => (rec.lines || []).forEach(l => {
        if (!l.itemCode || !codes.has(l.itemCode)) return;
        const qty = parseFloat(l.qty) || 0;
        if (!qty) return;
        const sid = rec.supId || rec.supplier || rec.supplierId || "";
        if (l.emptyRoute === "purchase") {
          pQ[l.itemCode] = (pQ[l.itemCode] || 0) + qty;
        } else if (l.emptyRoute === "invPurchase") {
          ipQ[l.itemCode] = (ipQ[l.itemCode] || 0) + qty;
        } else {
          // Route by supplier: EMPTY PURCHASE → purchase col; others → invPurchase col
          if (sid === "EMPTY PURCHASE") {
            pQ[l.itemCode]  = (pQ[l.itemCode]  || 0) + qty;
          } else {
            ipQ[l.itemCode] = (ipQ[l.itemCode] || 0) + qty;
          }
        }
      }));
    setER(prev => prev.map(r => ({
      ...r,
      purchase:    pQ[r.code]  || 0,
      invPurchase: ipQ[r.code] || 0,
    })));
  }, [outlet, empDate]); // eslint-disable-line

  // ─────────────────────────────────────────────────────────
  //  DERIVE FUNCTIONS
  // ─────────────────────────────────────────────────────────

  /**
   * MAIN STOCK derivation (doc page 4):
   *   Total   = Opening + Purchase + TransferIn − TransferOut + Returns
   *             NOTE: Returns are ADDED (goods returned TO the outlet)
   *   Balance = Total − Sold
   *   Amount  = Sold × Rate
   *   End Stock → defaults to Balance, editable by staff
   *   Stock Short/Ex  = End Stock − Balance
   *   Amount Short/Ex:
   *     if sold=0 → stkSE × adminSellingPrice
   *     if sold>0 → (stkSE × adminSellingPrice) + ((rate − adminSellingPrice) × sold)
   */
  function deriveMain(r) {
    const opening     = Number(r.openingStock) || 0;
    const purchase    = Number(r.purchase)     || 0;
    const transferIn  = Number(r.transferIn)   || 0;
    const transferOut = Number(r.transferOut)  || 0;
    const returns     = Number(r.returns)      || 0;
    // ✅ Returns ADDED (not subtracted) — doc: Opening+Purchase+TransIn−TransOut+Returns
    const total       = opening + purchase + transferIn - transferOut + returns;
    const sold        = parseFloat(r.sold) || 0;
    const balance     = total - sold;
    const amount      = sold * r.rate;
    const endStock    = r.endStock !== "" && r.endStock !== undefined
      ? parseFloat(r.endStock) || 0
      : balance;
    const stkSE  = endStock - balance;
    const amtSE  = sold === 0
      ? stkSE * r.adminSellingPrice
      : (stkSE * r.adminSellingPrice) + ((r.rate - r.adminSellingPrice) * sold);
    return { total, sold, balance, amount, endStock, amtSE, stkSE };
  }

  /**
   * EMPTY STOCK derivation (doc page 5):
   *   Balance = Opening + Purchase + InvPurchase + Received + Return
   *             − InvIssue − Issue − Sold
   *             NOTE: sold IS deducted from balance
   *   Amount  = Sold × Rate
   *   End Stock → defaults to Balance, editable by staff
   */
  function deriveEmp(r) {
    const opening     = Number(r.openingStock) || 0;
    const purchase    = parseFloat(r.purchase)    || 0;
    const invPurchase = parseFloat(r.invPurchase) || 0;
    const received    = parseFloat(r.received)    || 0;
    const return_     = parseFloat(r.return_)     || 0;
    const invIssue    = parseFloat(r.invIssue)    || 0;
    const issue       = parseFloat(r.issue)       || 0;
    const sold        = parseFloat(r.sold)        || 0;
    // ✅ Sold deducted from balance — doc: purchase+invPurchase+received+return−invIssue−issue−sold
    const balance  = opening + purchase + invPurchase + received + return_ - invIssue - issue - sold;
    const amount   = sold * r.rate;
    const endStock = r.endStock !== "" && r.endStock !== undefined
      ? parseFloat(r.endStock) || 0
      : balance;
    const stkSE = endStock - balance;
    const amtSE = sold === 0
      ? stkSE * r.adminSellingPrice
      : (stkSE * r.adminSellingPrice) + ((r.rate - r.adminSellingPrice) * sold);
    return { purchase, invPurchase, received, return_, invIssue, issue, sold, balance, amount, endStock, amtSE, stkSE };
  }

  // ─────────────────────────────────────────────────────────
  //  FIELD UPDATERS
  // ─────────────────────────────────────────────────────────
  const updM = (id, field, val) => setMR(prev => prev.map(r =>
    r.id !== id ? r : {
      ...r,
      [field]: field === "sold" || field === "endStock" ? val : parseFloat(val) || 0,
    }
  ));

  const updE = (id, field, val) => setER(prev => prev.map(r =>
    r.id !== id ? r : { ...r, [field]: val }
  ));

  // ─────────────────────────────────────────────────────────
  //  SAVE MAIN DAILY SALE
  // ─────────────────────────────────────────────────────────
  function saveMainSale() {
    const totalSale = mainRows.reduce((a, r) => a + deriveMain(r).amount, 0);

    // Embed derived stkSE into each row so Current Status can read it back
    const mainRowsWithDerived = mainRows.map(r => {
      const { stkSE, endStock } = deriveMain(r);
      return { ...r, stkSE, endStock };
    });

    const allSalesM = ls(oKey(outlet, "sales"), []);
    const existingIdx = allSalesM.findIndex(
      s => s.date === mainDate && (s.mainRows || []).length > 0
    );
    if (existingIdx >= 0) {
      allSalesM[existingIdx] = { ...allSalesM[existingIdx], mainRows: mainRowsWithDerived, totalSale, by:user.username };
    } else {
      allSalesM.unshift({
        id: uid(), date: mainDate,
        mainRows: mainRowsWithDerived, empRows: [], totalSale,
        outlet, by: user.username,
      });
    }
    lss(oKey(outlet, "sales"), allSalesM);

    // Carry end stock to next day's opening (keyed by code for main)
    const nd = new Date(mainDate);
    nd.setDate(nd.getDate() + 1);
    const nextDay = nd.toISOString().slice(0, 10);
    const om = {};
    mainRowsWithDerived.forEach(r => { om[r.code] = r.endStock; });
    lss(
      oKey(outlet, `opening_${nextDay}`),
      { ...ls(oKey(outlet, `opening_${nextDay}`), { main:{}, emp:{} }), main: om }
    );

    // Cash & GL postings
    postCash(outlet, { date:mainDate, description:"Daily Sale", type:"in", amount:totalSale });
    postGL(outlet, { date:mainDate, accountId:"4001", description:"Sales Revenue", debit:0, credit:totalSale });

    toast_("Main stock daily sale saved ✓");
  }

  // ─────────────────────────────────────────────────────────
  //  SAVE EMPTY DAILY SALE
  // ─────────────────────────────────────────────────────────
  function saveEmpSale() {
    const allSalesE = ls(oKey(outlet, "sales"), []);
    const existingIdx = allSalesE.findIndex(
      s => s.date === empDate && (s.empRows || []).length > 0
    );
    if (existingIdx >= 0) {
      allSalesE[existingIdx] = { ...allSalesE[existingIdx], empRows, by:user.username };
    } else {
      allSalesE.unshift({
        id: uid(), date: empDate,
        mainRows: [], empRows, totalSale: 0,
        outlet, by: user.username,
      });
    }
    lss(oKey(outlet, "sales"), allSalesE);

    // Carry end stock to next day's opening (keyed by unique id for empty)
    const nd = new Date(empDate);
    nd.setDate(nd.getDate() + 1);
    const nextDay = nd.toISOString().slice(0, 10);
    const oe = {};
    empRows.forEach(r => { oe[r.id] = deriveEmp(r).endStock; });
    lss(
      oKey(outlet, `opening_${nextDay}`),
      { ...ls(oKey(outlet, `opening_${nextDay}`), { main:{}, emp:{} }), emp: oe }
    );

    // Cash postings for empty items
    empRows.forEach(e => {
      const s    = parseFloat(e.sold)    || 0;
      const rr   = parseFloat(e.return_) || 0;
      const p    = parseFloat(e.purchase)|| 0;
      const rate = parseFloat(e.rate)    || 0;

      if (s > 0) postCash(outlet, {
        date: empDate,
        description: `Empty Sold: ${e.name} (${e.supplier})`,
        type: "in",
        amount: s * rate,
      });
      if (rr > 0) postCash(outlet, {
        date: empDate,
        description: `Empty Return: ${e.name} (${e.supplier})`,
        type: "out",
        amount: rr * rate,
      });
      if (p > 0) postCash(outlet, {
        date: empDate,
        description: `Empty Purchase: ${e.name} (${e.supplier})`,
        type: "out",
        amount: p * rate,
      });
    });

    toast_("Empty stock daily sale saved ✓");
  }

  // ─────────────────────────────────────────────────────────
  //  CURRENT STATUS DATA (Tab 5 logic)
  //  Total Bottle Sale = Opening + Total Purchase − In Hand Stock
  //  Physical Stock    = In Hand Stock × Unit Cost
  //  Profit            = Margin × Total Bottle Sale
  //  Margin            = Selling Price − Unit Cost
  // ─────────────────────────────────────────────────────────
  const inv = useMemo(() => getOutletInventory(outlet), [outlet]);

  const csData = useMemo(() => inv.map(item => {
  const sp = Number(item.sellingPrice) || 0;
  const uc = Number(item.unitCost)     || 0;
  const mg = sp - uc; // margin = selling price − unit cost

  // ── Aggregate from daily sales in date range ──
  let totalBottleSold = 0; // sum of sold qty (for reference)
  let adjStock        = 0;
  let firstOpening    = null;
  let lastEndStock    = null;

  const salesInRange = ls(oKey(outlet, "sales"), [])
    .filter(s => s.date && s.date >= csFrom && s.date <= csTo)
    .sort((a, b) => a.date.localeCompare(b.date));

  salesInRange.forEach(s => {
    const row = (s.mainRows || []).find(r => r.code === item.code && r.id === item.id);
    if (row) {
      // First opening in range
      if (firstOpening === null) {
        firstOpening = parseFloat(row.openingStock) || 0;
      }
      totalBottleSold += parseFloat(row.sold)   || 0;
      adjStock        += parseFloat(row.stkSE)  || 0;  // now populated from saved row
      const es = parseFloat(row.endStock);
      if (!isNaN(es)) lastEndStock = es;
    }
  });

  // ── Purchases in range ──
  let totalPurchase = 0;
  ls(oKey(outlet, "purchases"), [])
    .filter(p => p.date && p.date >= csFrom && p.date <= csTo)
    .forEach(p => (p.lines || []).forEach(l => {
      if (l.itemCode === item.code && !l.isEmptyItem)
        totalPurchase += parseFloat(l.qty) || 0;
    }));

  // ── Transfers in range ──
  let transferIn = 0;
  ls(oKey(outlet, "transfers"), [])
    .filter(t => t.date && t.date >= csFrom && t.date <= csTo && t.type === "in")
    .forEach(t => (t.lines || []).forEach(l => {
      if (l.itemCode === item.code) transferIn += parseFloat(l.qty) || 0;
    }));

  let transferOut = 0;
  ls(oKey(outlet, "transfers"), [])
    .filter(t => t.date && t.date >= csFrom && t.date <= csTo && t.type === "out")
    .forEach(t => (t.lines || []).forEach(l => {
      if (l.itemCode === item.code) transferOut += parseFloat(l.qty) || 0;
    }));

  // ── Returns in range ──
  let totalReturn = 0;
  ls(oKey(outlet, "returns"), [])
    .filter(r => r.date && r.date >= csFrom && r.date <= csTo)
    .forEach(r => (r.lines || []).forEach(l => {
      if (l.itemCode === item.code) totalReturn += parseFloat(l.qty) || 0;
    }));

  // ── In Hand Stock = last known end stock from daily sale ──
  const inHandStock = lastEndStock !== null ? lastEndStock : 0;

  // ── Opening = first opening found in range (fallback: seed qty) ──
  const opening = firstOpening !== null ? firstOpening : (Number(item.qty) || 0);

  // ── Total Bottle Sale = Opening + Total Purchase − In Hand Stock ──
  // (doc formula; transfers & returns are internal movements, not added here)
  const totalBottleSale = opening + totalPurchase - inHandStock;

  // ── Physical Stock = End Stock × Unit Cost ──
  const physicalStock = inHandStock * uc;

  // ── Total Sale = Total Bottle Sale -  Selling Price (outlet-assigned) ──
  const totalSaleAmt = totalBottleSale - sp;

  // ── Profit = Margin × Total Bottle Sale ──
  const profit = mg * totalBottleSale;

  const pk = `${item.id}_${csFrom}_${csTo}`;

  return {
    ...item,
    opening,
    inHandStock,
    physicalStock,
    physicalStockOverride: physStock[pk] ?? "",
    totalBottleSale,
    totalSaleAmt,
    totalPurchase,
    transferIn,
    transferOut,
    totalReturn,
    adjStock,
    profit,
    margin: mg,
    physKey: pk,
  };
}).filter(r =>
  r.totalBottleSale > 0 || r.totalPurchase > 0 ||
  r.transferIn > 0 || r.transferOut > 0 || r.totalReturn > 0
), [inv, outlet, csFrom, csTo, physStock]);
  // ─────────────────────────────────────────────────────────
  //  FILTERED VIEWS
  // ─────────────────────────────────────────────────────────
  const roStyle  = { background:"var(--s2)", cursor:"not-allowed", opacity:0.75 };
  const iS       = { padding:"4px 8px", background:"var(--s2)", border:"1px solid var(--bdr)", borderRadius:6, fontSize:12, color:"var(--txt)", outline:"none" };
  const lbl      = { fontSize:9, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase", color:"var(--mut)", display:"block", marginBottom:2 };
  const tblWrap  = { flex:1, minHeight:0, overflowX:"auto", overflowY:"auto", scrollbarWidth:"none", msOverflowStyle:"none" };

  const filteredMain = useMemo(() => {
    if (mainSupFilter === "ALL") return mainRows;
    return mainRows.filter(r => {
      const sup = (r.supplier || "").replace(/^\d{4}-/, "").trim();
      return sup === mainSupFilter.trim();
    });
  }, [mainRows, mainSupFilter]);

  const filteredEmp = useMemo(() => {
    if (empSupFilter === "ALL") return empRows;
    return empRows.filter(r => {
      const key = (r.supplier || "").trim() || "EMP";
      return key === empSupFilter.trim();
    });
  }, [empRows, empSupFilter]);

  // ─────────────────────────────────────────────────────────
  //  CONTROL BAR (shared by main and empty tabs)
  // ─────────────────────────────────────────────────────────
  function CtrlBar({ date, setDate, supFilter, setSupFilter, suppliers, onSave, saveLabel, count, supLabel }) {
    return (
      <div style={{ display:"flex", alignItems:"flex-end", gap:8, flexWrap:"wrap", padding:"6px 0" }}>
        <div>
          <label style={lbl}>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...iS, width:148 }} />
        </div>
        <div>
          <label style={lbl}>{supLabel || "Supplier"}</label>
          <select value={supFilter} onChange={e => setSupFilter(e.target.value)} style={{ ...iS, minWidth:130 }}>
            {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button className="btn btng" style={{ marginBottom:0 }} onClick={onSave}>
          {I.check} {saveLabel}
        </button>
        <button className="btn btnd btnsm no-print" style={{ marginBottom:0 }} onClick={() => window.print()}>
          {I.print} Print
        </button>
        <span style={{ marginLeft:"auto", fontSize:11, color:"var(--mut)", alignSelf:"center" }}>
          {count} items{supFilter !== "ALL" ? ` · ${supFilter}` : ""}
        </span>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <div style={{ display:"flex", flexDirection:"column", flex:1, minHeight:0, width:"100%" }}>

      <style>{`
        [data-inv-tbl]::-webkit-scrollbar { display:none }
        @media print {
          .no-print, button, select, input[type=date] { display:none !important; }
          body, html { background:#fff !important; color:#000 !important; }
          table { width:100% !important; font-size:9px !important; border-collapse:collapse !important; }
          th, td { border:1px solid #ccc !important; padding:3px 5px !important; }
          [data-inv-tbl] { overflow:visible !important; height:auto !important; }
          input[type=number] { border:none !important; background:transparent !important; font-size:9px !important; width:auto !important; }
          .tpill { background:#eee !important; color:#333 !important; border-radius:3px; padding:1px 4px; }
        }
      `}</style>

      {/* ════════════════ DAILY SALE ════════════════ */}
      {subTab === "daily" && (
        <div style={{ display:"flex", flexDirection:"column", flex:1, minHeight:0 }}>

          {/* ── MAIN STOCK TAB ── */}
          {dailyTab === "main" && (
            <div style={{ display:"flex", flexDirection:"column", flex:1, minHeight:0 }}>
              <CtrlBar
                date={mainDate} setDate={setMainDate}
                supFilter={mainSupFilter} setSupFilter={setMainSupFilter}
                suppliers={mainSuppliers}
                onSave={saveMainSale} saveLabel="Save Daily Sale"
                count={filteredMain.length} supLabel="Supplier"
              />
              <ScrollArrows scrollBy={mainScrollBy} />
              <div data-inv-tbl ref={mainTableRef} style={tblWrap}>
                <table className="tbl tin" style={{ minWidth:1100, width:"100%" }}>
                  <thead style={{ position:"sticky", top:0, zIndex:5, background:"var(--s2,#1e1e3a)" }}>
                    <tr>
                      <th>Code</th>
                      <th>Item</th>
                      <th>Type</th>
                      <th>Supplier</th>
                      <th>Opening</th>
                      <th>Purchase</th>
                      <th>Trans.In</th>
                      <th>Trans.Out</th>
                      <th>Returns</th>
                      <th>Total</th>
                      <th>Sold</th>
                      <th>Balance</th>
                      <th>Rate</th>
                      <th>Amount</th>
                      <th>Amt ±</th>
                      <th>Stk ±</th>
                      <th>End Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMain.length === 0 && (
                      <tr><td colSpan={17}><div className="empty">No items.</div></td></tr>
                    )}
                    {filteredMain.map(r => {
                      const { total, sold, balance, amount, endStock, amtSE, stkSE } = deriveMain(r);
                      return (
                        <tr key={r.id}>
                          <td className="mono" style={{ fontSize:10 }}>{r.code}</td>
                          <td style={{ fontWeight:600 }}>{r.name}</td>
                          <td><span className="tpill">{r.type}</span></td>
                          <td style={{ fontSize:10, whiteSpace:"nowrap", color:"var(--mut)" }}>
                            {r.supplier?.replace(/^\d{4}-/, "") || "—"}
                          </td>
                          <td className="mono" style={{ textAlign:"right" }}>{r.openingStock || "—"}</td>
                          <td className="mono cg" style={{ textAlign:"right", ...roStyle, padding:"3px 6px" }}>{r.purchase || "—"}</td>
                          <td className="mono cb" style={{ textAlign:"right", ...roStyle, padding:"3px 6px" }}>{r.transferIn || "—"}</td>
                          <td className="mono ca" style={{ textAlign:"right", ...roStyle, padding:"3px 6px" }}>{r.transferOut || "—"}</td>
                          <td className="mono cr" style={{ textAlign:"right", ...roStyle, padding:"3px 6px" }}>{r.returns || "—"}</td>
                          <td className="mono bold" style={{ textAlign:"right" }}>{fmt(total)}</td>
                          <td>
                            <input
                              type="number" value={r.sold}
                              onChange={e => updM(r.id, "sold", e.target.value)}
                              style={{ width:53, borderColor:"var(--gld)" }}
                            />
                          </td>
                          <td className="mono" style={{ textAlign:"right" }}>{fmt(balance)}</td>
                          <td>
                            <input
                              type="number" value={r.rate}
                              onChange={e => updM(r.id, "rate", e.target.value)}
                              style={{ width:63 }}
                            />
                          </td>
                          <td className="mono cg bold">Rs.{fmt(amount)}</td>
                          <td className={`mono bold ${amtSE < 0 ? "cr" : amtSE > 0 ? "cg" : ""}`}>
                            {amtSE !== 0 ? `${amtSE < 0 ? "−" : "+"}Rs.${fmt(Math.abs(amtSE))}` : "—"}
                          </td>
                          <td className={`mono bold ${stkSE < 0 ? "cr" : stkSE > 0 ? "cg" : ""}`}>
                            {stkSE !== 0 ? `${stkSE < 0 ? "−" : "+"}${Math.abs(stkSE)}` : "—"}
                          </td>
                          <td>
                            <input
                              type="number"
                              value={r.endStock !== "" && r.endStock !== undefined ? r.endStock : balance}
                              onChange={e => updM(r.id, "endStock", e.target.value)}
                              style={{ width:53, borderColor:"var(--acc,#f59e0b)" }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                    <tr style={{ background:"var(--s3)", fontWeight:700 }}>
                      <td colSpan={13} style={{ textAlign:"right", paddingRight:10, fontSize:12 }}>Total Sale:</td>
                      <td className="mono cg">Rs.{fmt(filteredMain.reduce((a, r) => a + deriveMain(r).amount, 0))}</td>
                      <td colSpan={3} />
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── EMPTY STOCK TAB ── */}
          {dailyTab === "empty" && (
            <div style={{ display:"flex", flexDirection:"column", flex:1, minHeight:0 }}>
              <CtrlBar
                date={empDate} setDate={setEmpDate}
                supFilter={empSupFilter} setSupFilter={setEmpSupFilter}
                suppliers={empSuppliers}
                onSave={saveEmpSale} saveLabel="Save Empty Sale"
                count={filteredEmp.length} supLabel="Supplier / Type"
              />
              <ScrollArrows scrollBy={empScrollBy} />
              <div data-inv-tbl ref={empTableRef} style={tblWrap}>
                <table className="tbl tin" style={{ minWidth:1200, width:"100%" }}>
                  <thead style={{ position:"sticky", top:0, zIndex:5, background:"var(--s2,#1e1e3a)" }}>
                    <tr>
                      <th>Code</th>
                      <th>Description</th>
                      <th>Supplier</th>
                      <th>Opening</th>
                      <th>Rate</th>
                      <th>Purchase</th>
                      <th>Inv.Purchase</th>
                      <th>Received</th>
                      <th>Return</th>
                      <th>Inv.Issue</th>
                      <th>Issue</th>
                      <th>Sold</th>
                      <th>Balance</th>
                      <th>Amount</th>
                      <th>Amt ±</th>
                      <th>Stk ±</th>
                      <th>End Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmp.length === 0 && (
                      <tr><td colSpan={17}><div className="empty">No empty stock items.</div></td></tr>
                    )}
                    {filteredEmp.map(r => {
                      const { purchase, invPurchase, received, return_, invIssue, issue, sold, balance, amount, endStock, amtSE, stkSE } = deriveEmp(r);
                      return (
                        <tr key={r.id}>
                          <td className="mono" style={{ fontSize:10 }}>{r.code}</td>
                          <td style={{ fontWeight:600, whiteSpace:"nowrap" }}>{r.name}</td>
                          <td><span className="tpill">{r.supplier || "EMP"}</span></td>
                          <td className="mono" style={{ textAlign:"right", ...roStyle, padding:"3px 8px" }}>{r.openingStock || "—"}</td>
                          <td>
                            <input
                              type="number" value={r.rate}
                              onChange={e => updE(r.id, "rate", e.target.value)}
                              style={{ width:60 }}
                            />
                          </td>
                          <td className="mono cg" style={{ textAlign:"right", ...roStyle, padding:"3px 6px" }}>{purchase || "—"}</td>
                          <td className="mono cg" style={{ textAlign:"right", ...roStyle, padding:"3px 6px" }}>{invPurchase || "—"}</td>
                          <td>
                            <input
                              type="number" value={r.received}
                              onChange={e => updE(r.id, "received", e.target.value)}
                              style={{ width:53, borderColor:"var(--cb,#60a5fa)" }}
                            />
                          </td>
                          <td>
                            <input
                              type="number" value={r.return_}
                              onChange={e => updE(r.id, "return_", e.target.value)}
                              style={{ width:53, borderColor:"var(--cr,#f87171)" }}
                            />
                          </td>
                          <td>
                            <input
                              type="number" value={r.invIssue}
                              onChange={e => updE(r.id, "invIssue", e.target.value)}
                              style={{ width:53, borderColor:"var(--ca,#fb923c)" }}
                            />
                          </td>
                          <td>
                            <input
                              type="number" value={r.issue}
                              onChange={e => updE(r.id, "issue", e.target.value)}
                              style={{ width:53, borderColor:"var(--ca,#fb923c)" }}
                            />
                          </td>
                          <td>
                            <input
                              type="number" value={r.sold}
                              onChange={e => updE(r.id, "sold", e.target.value)}
                              style={{ width:53, borderColor:"var(--gld)" }}
                            />
                          </td>
                          <td className="mono bold" style={{ textAlign:"right" }}>{fmt(balance)}</td>
                          <td className="mono cg bold">{amount ? `Rs.${fmt(amount)}` : "—"}</td>
                          <td className={`mono bold ${amtSE < 0 ? "cr" : amtSE > 0 ? "cg" : ""}`}>
                            {amtSE !== 0 ? `${amtSE < 0 ? "−" : "+"}Rs.${fmt(Math.abs(amtSE))}` : "—"}
                          </td>
                          <td className={`mono bold ${stkSE < 0 ? "cr" : stkSE > 0 ? "cg" : ""}`}>
                            {stkSE !== 0 ? `${stkSE < 0 ? "−" : "+"}${Math.abs(stkSE)}` : "—"}
                          </td>
                          <td>
                            <input
                              type="number"
                              value={r.endStock !== "" && r.endStock !== undefined ? r.endStock : balance}
                              onChange={e => updE(r.id, "endStock", e.target.value)}
                              style={{ width:53, borderColor:"var(--acc,#f59e0b)" }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
{/* ════════════════ CURRENT STATUS ════════════════ */}
{subTab === "status" && (
  <div style={{ display:"flex", flexDirection:"column", flex:1, minHeight:0 }}>

    <style>{`
      @media print {
        @page { size: legal landscape; margin: 8mm; }
        .no-print, button, select, input[type=date] { display:none !important; }
        body, html { background:#fff !important; color:#000 !important; }
        .cs-tbl { width:100% !important; font-size:7.5px !important; border-collapse:collapse !important; table-layout:fixed !important; }
        .cs-tbl th, .cs-tbl td { border:1px solid #bbb !important; padding:2px 4px !important; word-break:break-word !important; }
        .cs-tbl th { background:#f0f0f0 !important; color:#000 !important; font-weight:700 !important; }
        .cs-tbl .rt { text-align:right !important; }
        .cs-tbl .mono { font-family:monospace !important; }
        .cs-tbl .bold { font-weight:700 !important; }
        .ctag { background:#e8e8e8 !important; color:#111 !important; border-radius:3px; padding:1px 4px; font-family:monospace; font-size:7px; }
        .tpill { background:#ddd !important; color:#333 !important; border-radius:3px; padding:1px 4px; font-size:7px; }
        [data-cs-tbl] { overflow:visible !important; height:auto !important; }
        .cs-print-header { display:block !important; font-size:11px; font-weight:700; margin-bottom:4px; }
      }
      .cs-print-header { display:none; }
      [data-cs-tbl]::-webkit-scrollbar { display:none; }
    `}</style>

    {/* ── Controls ── */}
    <div style={{ display:"flex", alignItems:"flex-end", gap:8, flexWrap:"wrap", padding:"6px 0" }}>
      <div>
        <label style={lbl}>From Date</label>
        <input type="date" value={csFrom} onChange={e => setCsFrom(e.target.value)} style={iS} />
      </div>
      <div>
        <label style={lbl}>To Date</label>
        <input type="date" value={csTo} onChange={e => setCsTo(e.target.value)} style={iS} />
      </div>
      <button
        className="btn btnd btnsm no-print"
        style={{ marginBottom:0 }}
        onClick={() => window.print()}
      >
        {I.print} Print
      </button>
      <span style={{ marginLeft:"auto", fontSize:11, color:"var(--mut)", alignSelf:"center" }}>
        {csData.length} items with activity
      </span>
    </div>

    {/* ── Scroll Arrows ── */}
    <div className="no-print" style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
      <button
        onClick={() => csTableRef.current?.scrollBy({ left:-350, behavior:"smooth" })}
        style={{
          width:28, height:24, borderRadius:5,
          border:"1px solid var(--s3,#444)",
          background:"var(--s2,#252540)", color:"var(--txt,#ccc)",
          cursor:"pointer", fontSize:15,
          display:"flex", alignItems:"center", justifyContent:"center",
        }}
      >‹</button>
      <button
        onClick={() => csTableRef.current?.scrollBy({ left:350, behavior:"smooth" })}
        style={{
          width:28, height:24, borderRadius:5,
          border:"1px solid var(--s3,#444)",
          background:"var(--s2,#252540)", color:"var(--txt,#ccc)",
          cursor:"pointer", fontSize:15,
          display:"flex", alignItems:"center", justifyContent:"center",
        }}
      >›</button>
    </div>

    {/* ── Print header (only visible when printing) ── */}
    <div className="cs-print-header">
      Current Status Report &nbsp;|&nbsp; {outlet} &nbsp;|&nbsp; {csFrom} to {csTo}
    </div>

    {/* ── Table ── */}
    <div data-cs-tbl ref={csTableRef} style={tblWrap}>
      <table className="cs-tbl" style={{ width:"100%", minWidth:1100 }}>
        <thead>
          <tr>
            <th style={{ width:30 }}>#</th>
            <th style={{ width:72 }}>Item Code</th>
            <th>Description</th>
            <th style={{ width:70 }}>Item Type</th>
            <th className="rt" style={{ width:82 }}>Opening Stock</th>
            <th className="rt" style={{ width:82 }}>Total Purchase</th>
            <th className="rt" style={{ width:82 }}>In Hand Stock</th>
            <th className="rt" style={{ width:90 }}>Total Bottle Sale</th>
            <th className="rt" style={{ width:108 }}>Physical Stock (Rs.)</th>
            <th className="rt" style={{ width:100 }}>Total Sale (Rs.)</th>
            <th className="rt" style={{ width:100 }}>Profit (Rs.)</th>
            <th className="rt" style={{ width:80 }}>Margin</th>
            <th className="rt" style={{ width:76 }}>Transfer In</th>
            <th className="rt" style={{ width:76 }}>Transfer Out</th>
            <th className="rt" style={{ width:70 }}>Return</th>
            <th className="rt" style={{ width:80 }}>Adj. to Stock</th>
          </tr>
        </thead>
        <tbody>
          {csData.length === 0 && (
            <tr><td colSpan={16}><div className="empty">No activity for this period.</div></td></tr>
          )}
          {csData.map((row, idx) => (
            <tr key={row.id}>
              <td style={{ color:"var(--mut2)", fontSize:11, fontFamily:"monospace" }}>{idx + 1}</td>
              <td><span className="ctag">{row.code}</span></td>
              <td className="bold">{row.name}</td>
              <td><span className="tpill">{row.type}</span></td>
              <td className="rt mono">{row.opening ?? "—"}</td>
              <td className="rt mono">{row.totalPurchase || "—"}</td>
              <td className="rt mono bold" style={{ color: row.inHandStock >= 0 ? "var(--grn)" : "var(--red)" }}>
                {row.inHandStock}
              </td>
              <td className="rt mono">{row.totalBottleSale || "—"}</td>
              <td className="rt mono">
                Rs.{fmt(row.physicalStockOverride !== "" ? row.physicalStockOverride : row.physicalStock)}
              </td>
              <td className="rt mono cg">Rs.{fmt(row.totalSaleAmt)}</td>
              <td className="rt mono cg bold">Rs.{fmt(row.profit)}</td>
              <td className="rt mono">{row.margin !== undefined ? `Rs.${fmt(row.margin)}` : "—"}</td>
              <td className="rt mono cb">{row.transferIn || "—"}</td>
              <td className="rt mono ca">{row.transferOut || "—"}</td>
              <td className="rt mono cr">{row.totalReturn || "—"}</td>
              <td className={`rt mono bold ${row.adjStock < 0 ? "cr" : row.adjStock > 0 ? "cg" : ""}`}>
                {row.adjStock !== 0 ? `${row.adjStock > 0 ? "+" : ""}${row.adjStock}` : "—"}
              </td>
            </tr> 
          ))}
        </tbody>
        {csData.length > 0 && (
          <CsTotals csData={csData} fmt={fmt} physStock={physStock} />
        )}
      </table>
    </div>
  </div>
)}
 </div>
  );
}