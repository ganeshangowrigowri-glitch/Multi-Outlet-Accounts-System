import React, { useState, useMemo, useEffect,  useRef} from "react";
import { ls, lss } from "../../utils/helpers";
import { getInventoryMaster, saveInventoryMaster, addSupplier, saveOpeningStock, getOpeningStock, getSales, getPurchases, getTransfers, getReturns,saveEmptyInventoryMaster} from "../../db";
import { I } from "../../utils/icons";
import { SEED_INVENTORY, SEED_EMPTY, SUPPLIERS_LIST, SUP_COLOR, ITEM_TYPES, OUTLETS, OUTLET_INV_SEEDS } from "../../data/seeds";
import Modal from "../shared/Modal";

const fmt = n => Number(n||0).toLocaleString("en-LK",{minimumFractionDigits:2,maximumFractionDigits:2});
const today = () => new Date().toISOString().split("T")[0];
const oKey  = (outlet, mod) => `${outlet}_${mod}`;

// Key for per-outlet inventory overrides: stores { itemCode: { sellingPrice, unitCost, hidden } }
export const outletInvKey = (outlet) => `outlet_inv_${outlet}`;

// Key for per-outlet EMPTY inventory overrides
export const outletEmptyInvKey = (outlet) => `outlet_empty_inv_${outlet}`;

// Initialise outlet overrides from seeds (only if not already set)
export function initOutletSeeds() {
  if (!OUTLET_INV_SEEDS) return;
  Object.entries(OUTLET_INV_SEEDS).forEach(([outlet, overrides]) => {
    const key = outletInvKey(outlet);
    const existing = ls(key, null);
    if (!existing) lss(key, overrides);
  });
}


const SUP_ORDER = [
  "2001-DCSL","2003-UG","2005-ROCKLAND","2004-IDL","2006-DCSL BEER",
  "2002-LION BREWERY","2007-TODDY","2008-ROYAL CASK","2009-LUXURY BRAND",
  "2010-B LANKA","2011-USW","2012-PREMERA","2013-JSP","2014-SIGNATURE",
  "2015-VA","2016-VICTORY","2017-FAVOURITE","2018-FREE LANKA",
  "2019-BAG","2020-SODA","2021-GOLD LEAF","2022-BITE","2023-KASTHURI W/S",
];

function codeNum(code) {
  const m = (code||"").match(/\d+/);
  return m ? parseInt(m[0]) : 9999;
}

function sortInv(arr) {
  return [...arr].sort((a, b) => {
    const si = SUP_ORDER.indexOf(a.supplier);
    const sj = SUP_ORDER.indexOf(b.supplier);
    const oi = si === -1 ? 999 : si;
    const oj = sj === -1 ? 999 : sj;
    if (oi !== oj) return oi - oj;
    return codeNum(a.code) - codeNum(b.code);
  });
}

function loadInv() {
  const stored = ls("inv_main", null);
  if (!stored || stored.length < SEED_INVENTORY.length) {
    lss("inv_main", SEED_INVENTORY);
    return sortInv(SEED_INVENTORY);
  }
  return sortInv(stored);
}

async function loadInvFromSupabase() {
  const data = await getInventoryMaster();
  if (data && data.length > 0) {
    lss("inv_main", data);
    return sortInv(data);
  }
  return loadInv();
}

function getAllSupColors() {
  const extra = ls("extra_suppliers", []);
  const merged = { ...SUP_COLOR };
  extra.forEach(s => { merged[s.id] = s.color; });
  return merged;
}

function getAllSuppliersList() {
  const extra = ls("extra_suppliers", []);
  const extraIds = extra.map(s => s.id);
  const base = SUPPLIERS_LIST.filter(s => !extraIds.includes(s.id));
  const all = [...base, ...extra];
  return all.sort((a, b) => {
    const oi = SUP_ORDER.indexOf(a.id);
    const oj = SUP_ORDER.indexOf(b.id);
    return (oi === -1 ? 999 : oi) - (oj === -1 ? 999 : oj);
  });
}
// outlet inventory panel
function OutletInventoryPanel({ inv, toast_, allSupColors, adminOutlets }) {
  const outletList = adminOutlets?.length ? adminOutlets : OUTLETS;
  const [selOutlet, setSelOutlet] = useState(outletList[0]);
  const [supF,      setSupF]      = useState("ALL");
  const [search,    setSearch]    = useState("");
  const [editItem,  setEditItem]  = useState(null);
  const [ef,        setEf]        = useState({});
  const [openingDate, setOpeningDate] = useState(today()); 
  const [showOnly,  setShowOnly]  = useState("all");

// AFTER — no inv reference needed
const [overrides, setOverridesState] = useState(() => {
  initOutletSeeds();
  return ls(outletInvKey(outletList[0]), {});
});
// 2. useEffect — no pruning, just read directly
useEffect(() => {
  if (!outletList.includes(selOutlet)) setSelOutlet(outletList[0] || "");
}, [outletList, selOutlet]);
useEffect(() => {
  setOverridesState(ls(outletInvKey(selOutlet), {}));
}, [selOutlet]);

// 3. loadOutlet — no pruning, just read directly
function loadOutlet(o) {
  setSelOutlet(o);
  setOverridesState(ls(outletInvKey(o), {}));
  setSupF("ALL"); setSearch(""); setShowOnly("all");
}

async function saveOpeningQtyForDate(item, qty, dateStr, outlet) {
  const key1 = `${item.code}__${item.supplier}`;
  const existing = await getOpeningStock(outlet, dateStr);
  const mainMap = {
    ...(existing?.main || {}),
    [key1]: Number(qty) || 0,
  };
  await saveOpeningStock(outlet, dateStr, mainMap, existing?.emp || null);
}

async function openEdit(item) {
  const ovKey = `${item.code}__${item.supplier}`;
  const ov = overrides[ovKey] || {};
  
  const existing = await getOpeningStock(selOutlet, openingDate);
  const savedQty = existing?.main?.[ovKey] || existing?.main?.[item.code] || existing?.main?.[item.id] || "";
  
  setEf({
    sellingPrice: ov.sellingPrice !== undefined ? ov.sellingPrice : item.sellingPrice,
    unitCost:     ov.unitCost     !== undefined ? ov.unitCost     : item.unitCost,
    hidden:       ov.hidden || false,
    qty:          savedQty,
  });
  setOpeningDate(openingDate);     
  setEditItem(item);
}

   async function saveOverrides(newOv) {
  try {
    setOverridesState(newOv);
    lss(outletInvKey(selOutlet), newOv);
  } catch (err) {
    console.error("saveOverrides error:", err);
    toast_("Save failed — check console", "err");
  }
}

async function saveEdit() {
  try {
    const ovEntry = {
      unitCost:     Number(ef.unitCost)     || 0,
      sellingPrice: Number(ef.sellingPrice) || 0,
      hidden:       ef.hidden,
      // NOTE: qty is intentionally NOT stored here anymore —
      // it must only apply to the chosen date, not every date.
    };
    const newOv = {
      ...overrides,
      [`${editItem.code}__${editItem.supplier}`]: ovEntry,
    };
    setOverridesState(newOv);
    lss(outletInvKey(selOutlet), newOv);

    if (ef.qty !== "" && ef.qty != null) {
      await saveOpeningQtyForDate(editItem, ef.qty, openingDate, selOutlet);
    }

    toast_(`${editItem.code} updated for ${selOutlet} ✓`);
    setEditItem(null);
  } catch (err) {
    console.error("saveEdit error:", err);
    toast_("Save failed — check console", "err");
  }
}

  function resetOverride(itemKey) {
    const newOv = { ...overrides };
    delete newOv[itemKey];
    saveOverrides(newOv);
    toast_("Reset to main inventory price ✓");
  }

  const sups = useMemo(() => {
    const extra = ls("extra_suppliers", []);
    const extraIds = extra.map(s => s.id).filter(id => !SUP_ORDER.includes(id));
    const fullOrder = [...SUP_ORDER, ...extraIds];
    return ["ALL", ...fullOrder.filter(s => inv.some(i => i.supplier === s))];
  }, [inv]);

  const filtInv = useMemo(() => {
    let items = inv.filter(i =>
      (supF === "ALL" || i.supplier === supF) &&
      (!search || [i.code, i.name, i.description||""].some(v =>
        v.toLowerCase().includes(search.toLowerCase())
      ))
    );
    if (showOnly === "custom") items = items.filter(i => overrides[`${i.code}__${i.supplier}`]);
    if (showOnly === "hidden") items = items.filter(i => overrides[`${i.code}__${i.supplier}`]?.hidden);
     return sortInv(items);
}, [inv, supF, search, overrides, showOnly]);

  const customCount = Object.keys(overrides).length;
  const hiddenCount = Object.values(overrides).filter(o => o.hidden).length;
  const priceCount  = Object.entries(overrides).filter(([,o]) => !o.hidden).length;

  return (
    <>
      {/* Outlet selector + stats */}
      <div style={{display:"flex",gap:12,alignItems:"flex-end",marginBottom:14,flexWrap:"wrap"}}>
        <div style={{minWidth:220}}>
          <label style={{fontSize:10,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",
            color:"var(--mut)",display:"block",marginBottom:4}}>Select Outlet</label>
          <select value={selOutlet} onChange={e=>loadOutlet(e.target.value)}
            style={{padding:"7px 11px",background:"var(--s2)",border:"1px solid var(--bdr)",
              borderRadius:7,fontSize:12.5,color:"var(--txt)",outline:"none",width:"100%"}}>
            {outletList.map(o=><option key={o}>{o}</option>)}
          </select>
        </div>
        <div style={{display:"flex",gap:6,paddingBottom:2,flexWrap:"wrap"}}>
          <button onClick={()=>setShowOnly("all")}
            className={`btn btnsm ${showOnly==="all"?"btng":"btnd"}`}>
            All ({inv.length})
          </button>
          <button onClick={()=>setShowOnly("custom")}
            className={`btn btnsm ${showOnly==="custom"?"btng":"btnd"}`}
            style={priceCount?{borderColor:"var(--gld2)",color:"var(--gld2)"}:{}}>
            Custom Price ({priceCount})
          </button>
          {hiddenCount > 0 && (
            <button onClick={()=>setShowOnly("hidden")}
              className={`btn btnsm ${showOnly==="hidden"?"btng":"btnd"}`}
              style={{borderColor:"var(--red)",color:"var(--red)"}}>
              Hidden ({hiddenCount})
            </button>
          )}
        </div>
      </div>

      {/* Info banner */}
      <div style={{background:"rgba(99,102,241,.07)",border:"1px solid rgba(99,102,241,.15)",
        borderRadius:8,padding:"9px 14px",marginBottom:12,fontSize:11.5,color:"var(--mut)",lineHeight:1.6}}>
        <strong style={{color:"var(--acc2,#818cf8)"}}>Outlet Pricing</strong> — Items use main inventory prices by default.
        Override to customise prices or hide items for <strong style={{color:"var(--txt)"}}>{selOutlet}</strong> only.
        Staff at this outlet will see outlet prices where set.
      </div>

      {/* Supplier tabs */}
      <div className="stabs" style={{marginBottom:8,flexWrap:"wrap"}}>
        {sups.map(s => (
          <button key={s} className={`stab ${supF===s?"act":""}`} onClick={()=>setSupF(s)}>
            {s==="ALL" ? `All (${inv.length})` : `${s.replace(/^\d{4}-/,"")} (${inv.filter(i=>i.supplier===s).length})`}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="ctrls" style={{marginBottom:10}}>
        <div className="sbox">{I.search}
          <input placeholder="Search code, name or description…" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <div style={{marginLeft:"auto",fontSize:11,color:"var(--mut)",alignSelf:"center"}}>
          {filtInv.length} items
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="chd">
          <div>
            <h3>{selOutlet} — Outlet Inventory</h3>
            <p>{customCount} custom price{customCount!==1?"s":""}{hiddenCount?`, ${hiddenCount} hidden`:""}</p>
          </div>
        </div>
        <div style={{overflowX:"auto"}}>
          <table className="tbl">
            <thead>
              <tr>
                <th>#</th><th>Code</th><th>Name</th><th>Type</th><th>Supplier</th>
                <th>Main Cost</th><th>Main Price</th>
                <th>Outlet Cost</th><th>Outlet Price</th>
                <th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtInv.length===0 && (
               <tr><td colSpan={16}><div className="empty">No activity for this period.</div></td></tr>
              )}
              {filtInv.map((item, idx) => {
                const ovKey       = `${item.code}__${item.supplier}`;
                const ov          = overrides[ovKey];
                const hasOv       = !!ov;
                const isHidden    = ov?.hidden;
                const col         = allSupColors[item.supplier] || "#94a3b8";
                const outletCost  = hasOv ? ov.unitCost     : item.unitCost;
                const outletPrice = hasOv ? ov.sellingPrice : item.sellingPrice;
                const priceChanged = hasOv && (
                  Number(ov.sellingPrice) !== Number(item.sellingPrice) ||
                  Number(ov.unitCost)     !== Number(item.unitCost)
                );
                return (
                  <tr key={`${item.id}__${item.supplier}`} style={isHidden?{opacity:.4}:{}}>
                    <td style={{color:"var(--mut2)",fontSize:11,fontFamily:"monospace"}}>{idx+1}</td>
                    <td><span className="ctag">{item.code}</span></td>
                    <td className="bold">{item.name}</td>
                    <td><span className="tpill">{item.type}</span></td>
                    <td>
                      <span style={{fontSize:10,fontWeight:600,padding:"1px 7px",borderRadius:10,
                        background:`${col}15`,color:col,border:`1px solid ${col}22`}}>
                        {item.supplier.replace(/^\d{4}-/,"")}
                      </span>
                    </td>
                    <td className="mono" style={{color:"var(--mut)",fontSize:11}}>
                      {item.unitCost?`Rs.${fmt(item.unitCost)}`:"—"}
                    </td>
                    <td className="mono" style={{color:"var(--mut)",fontSize:11}}>
                      {item.sellingPrice?`Rs.${fmt(item.sellingPrice)}`:"—"}
                    </td>
                    <td className="mono" style={{fontWeight:priceChanged?700:400,color:priceChanged?"var(--gld2)":undefined}}>
                      {outletCost?`Rs.${fmt(outletCost)}`:"—"}
                    </td>
                    <td className="mono bold" style={{color:priceChanged?"var(--gld2)":undefined}}>
                      {outletPrice?`Rs.${fmt(outletPrice)}`:"—"}
                    </td>
                    <td>
                      {isHidden
                        ? <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:10,
                            background:"rgba(239,68,68,.12)",color:"var(--red)",border:"1px solid rgba(239,68,68,.2)"}}>Hidden</span>
                        : priceChanged
                          ? <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:10,
                              background:"rgba(251,191,36,.12)",color:"var(--gld2)",border:"1px solid rgba(251,191,36,.2)"}}>Custom</span>
                          : <span style={{fontSize:10,color:"var(--mut2)"}}>Default</span>
                      }
                    </td>
                    <td>
                      <div style={{display:"flex",gap:3}}>
                        <button className="btngh" title="Edit outlet price" onClick={()=>openEdit(item)}>
                          {I.edit}
                        </button>
                        {hasOv && (
                          <button className="btndel" title="Reset to main"
                            onClick={()=>{if(confirm("Reset to main inventory price?"))resetOverride(ovKey);}}>
                            {I.trash}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit modal */}
      {editItem && (
        <Modal
          title={`${selOutlet} — ${editItem.code} ${editItem.name}`}
          onClose={()=>setEditItem(null)}
          footer={<>
            <button className="btn btnd" onClick={()=>setEditItem(null)}>Cancel</button>
            <button className="btn btng" onClick={saveEdit}>{I.check} Save for {selOutlet}</button>
          </>}
        >
          <div style={{background:"var(--s2)",borderRadius:6,padding:"8px 12px",marginBottom:12,
            fontSize:11.5,color:"var(--mut)",border:"1px solid var(--bdr)",display:"flex",gap:24}}>
            <span>Main cost: <strong style={{color:"var(--txt)"}}>Rs.{fmt(editItem.unitCost)}</strong></span>
            <span>Main price: <strong style={{color:"var(--txt)"}}>Rs.{fmt(editItem.sellingPrice)}</strong></span>
          </div>
          <div className="fg">
            <div className="ff">
              <label>Outlet Unit Cost (Rs.)</label>
              <input type="number" value={ef.unitCost}
                onChange={e=>setEf({...ef,unitCost:e.target.value})} placeholder="0.00"/>
            </div>
            <div className="ff">
              <label>Outlet Selling Price (Rs.)</label>
              <input type="number" value={ef.sellingPrice}
                onChange={e=>setEf({...ef,sellingPrice:e.target.value})} placeholder="0.00"/>
            </div>
          </div>
                     {ef.unitCost && ef.sellingPrice && Number(ef.unitCost)>0 && (
            <div style={{background:"var(--s2)",borderRadius:6,padding:"7px 11px",fontSize:11.5,
              border:"1px solid var(--bdr)",marginBottom:10}}>
              Outlet margin: <strong style={{color:"var(--gld2)"}}>
                {(((ef.sellingPrice-ef.unitCost)/ef.unitCost)*100).toFixed(2)}%
              </strong>
            </div>
          )}
          {/* Opening Quantity — date-specific */}
          <div className="fg" style={{marginTop:4}}>
            <div className="ff">
              <label>Opening Date</label>
              <input
                type="date"
                value={openingDate}
                onChange={e => setOpeningDate(e.target.value)}
              />
            </div>
            <div className="ff">
              <label>Outlet Opening Quantity</label>
              <input
                type="number"
                value={ef.qty ?? ""}
                onChange={e => setEf({...ef, qty: e.target.value})}
                placeholder={`Main stock: ${editItem.qty ?? 0} — enter outlet qty`}
                min="0"
              />
            </div>
          </div>
          <div style={{fontSize:11,color:"var(--mut)",marginTop:-6,marginBottom:8}}>
            This quantity applies only to <strong>{openingDate}</strong> and won't appear on other dates.
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 0 2px",
            borderTop:"1px solid var(--bdr)",marginTop:4}}>
            <input type="checkbox" id="hide-item-ov" checked={ef.hidden}
              onChange={e=>setEf({...ef,hidden:e.target.checked})}
              style={{width:15,height:15,cursor:"pointer"}}/>
            <label htmlFor="hide-item-ov" style={{fontSize:12,cursor:"pointer",color:"var(--txt)"}}>
              Hide this item at <strong>{selOutlet}</strong> (won't appear for staff)
            </label>
          </div>
        </Modal>
      )}
    </>
  );
}

// ─────────────────────────────────────────────
// EMPTY SEED & LOADER — defined at module level so both
// EmptyStockPanel (Tab 2) and OutletEmptyPanel (Tab 4) can use them.
// ─────────────────────────────────────────────
const EMPTY_SEED = [
{ id:"DCSL_DEMPQ", code:"DEMP Q", name:"DES EMP",  supplier:"DCSL",           unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
{ id:"DCSL_DEMPP",  code:"DEMP P",  name:"DES EMP",  supplier:"DCSL",           unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
{ id:"DCSL_DEMPN",  code:"DEMP N",  name:"DES EMP",  supplier:"DCSL",           unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
{ id:"LION_BEMPQ",  code:"BEMP Q",  name:"BEER EMP", supplier:"LION BREWERY",   unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
{ id:"TODD_TEMPQ",  code:"TEMP Q",  name:"TOD EMP",  supplier:"TODDY",          unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
{ id:"UG_UEMPQ",    code:"UEMP Q",  name:"UG EMP",   supplier:"UG",             unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
{ id:"BEER_HEMPQ",  code:"HEMP Q",  name:"HEI EMP",  supplier:"DCSL BEER",      unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
{ id:"EP_DEMP1Q",   code:"DEMP1 Q", name:"DES EMP",  supplier:"EMPTY PURCHASE", unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
{ id:"EP_DEMPP",    code:"DEMP P",  name:"DES EMP",  supplier:"EMPTY PURCHASE", unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
{ id:"EP_DEMPN",    code:"DEMP N",  name:"DES EMP",  supplier:"EMPTY PURCHASE", unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
{ id:"EP_BEMPQ",    code:"BEMP Q",  name:"BEER EMP", supplier:"EMPTY PURCHASE", unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
{ id:"EP_TEMPQ",    code:"TEMP Q",  name:"TOD EMP",  supplier:"EMPTY PURCHASE", unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
{ id:"EP_UEMPQ",    code:"UEMP Q",  name:"UG EMP",   supplier:"EMPTY PURCHASE", unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
{ id:"EP_HEMPQ",    code:"HEMP Q",  name:"HEI EMP",  supplier:"EMPTY PURCHASE", unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
];

export function loadEmptyFromStorage() {
  const stored = ls("inv_empty_v2", null);
  if (!stored || stored.length === 0) {
    lss("inv_empty_v2", EMPTY_SEED);
    return EMPTY_SEED;
  }
  const merged = stored.map(item => {
    if (item.type) return item;
    const seed = EMPTY_SEED.find(s => s.code === item.code && s.supplier === item.supplier);
    return seed ? { ...item, type: seed.type } : { ...item, type: "EMP" };
  });
  lss("inv_empty_v2", merged);
  return merged;
}

// ─────────────────────────────────────────────
// OUTLET EMPTY INVENTORY PANEL
// ─────────────────────────────────────────────
function OutletEmptyPanel({ toast_, emptyInv: emptyInvProp }) {
  const [emptyInv, setEmptyInv] = useState(() => emptyInvProp || loadEmptyFromStorage());
  useEffect(() => {
    if (emptyInvProp) setEmptyInv(emptyInvProp);
  }, [emptyInvProp]);
useEffect(() => {
  setEmptyInv(loadEmptyFromStorage());
}, []); 

  const [selOutlet, setSelOutlet] = useState(OUTLETS[0]);
  const [supF,      setSupF]      = useState("ALL");
  const [search,    setSearch]    = useState("");
  const [editItem,  setEditItem]  = useState(null);
  const [ef,        setEf]        = useState({});
  const [openingDate, setOpeningDate] = useState(today()); 
  const [showOnly,  setShowOnly]  = useState("all");

  // AFTER
const [overrides, setOverridesState] = useState(() => {
  return ls(outletEmptyInvKey(OUTLETS[0]), {});
});

useEffect(() => {
  setOverridesState(ls(outletEmptyInvKey(selOutlet), {}));
}, [selOutlet]);

function loadOutlet(o) {
  setSelOutlet(o);
  setOverridesState(ls(outletEmptyInvKey(o), {}));
  setSupF("ALL"); setSearch(""); setShowOnly("all");
}
  async function saveOpeningQtyForDate(item, qty, dateStr, outlet) {
  const key1 = `${item.code}__${item.supplier}`;
  const existing = await getOpeningStock(outlet, dateStr);
  const empMap = {
    ...(existing?.emp || {}),
    [key1]: Number(qty) || 0,
  };
  await saveOpeningStock(outlet, dateStr, existing?.main || null, empMap);
}
  function saveOverrides(newOv) {
    setOverridesState(newOv);
    lss(outletEmptyInvKey(selOutlet), newOv);
  }

  
async function openEdit(item) {
  const ov = overrides[`${item.code}__${item.supplier}`] || {};
  
  const existing = await getOpeningStock(selOutlet, openingDate);  //  use openingDate
  const savedQty = existing?.emp?.[`${item.code}__${item.supplier}`] || 
                   existing?.emp?.[item.code] || 
                   existing?.emp?.[item.id] || "";
  
  setEf({
    sellingPrice: ov.sellingPrice !== undefined ? ov.sellingPrice : item.sellingPrice,
    unitCost:     ov.unitCost     !== undefined ? ov.unitCost     : item.unitCost,
    hidden:       ov.hidden || false,
    qty:          savedQty,
  });
  setOpeningDate(openingDate);  // Keep current selected date
  setEditItem(item);
}


 // AFTER
async function saveEdit() {
  try {
    const ovEntry = {
      unitCost:     Number(ef.unitCost)     || 0,
      sellingPrice: Number(ef.sellingPrice) || 0,
      hidden:       ef.hidden,
      // qty NOT stored permanently — only saved to specific date below
    };
    const newOv = {
      ...overrides,
      [`${editItem.code}__${editItem.supplier}`]: ovEntry,
    };
    saveOverrides(newOv);

    if (ef.qty !== "" && ef.qty != null) {
      await saveOpeningQtyForDate(editItem, ef.qty, openingDate, selOutlet);
    }

    toast_(`${editItem.code} updated for ${selOutlet} ✓`);
    setEditItem(null);
  } catch (err) {
    console.error("saveEdit error:", err);
    toast_("Save failed — check console", "err");
  }
}

  function resetOverride(code) {
    const newOv = { ...overrides };
    delete newOv[code];
    saveOverrides(newOv);
    toast_("Reset to main empty price ✓");
  }

  const BASE_SUP_COLORS = {
    "DCSL":"#6366f1","LION BREWERY":"#f59e0b","UG":"#10b981",
    "TODDY":"#f97316","HEINEKEN":"#22c55e",
  };
  function getSupColor(sup) {
    return BASE_SUP_COLORS[sup] || "#94a3b8";
  }

  const sups = useMemo(() => {
    const all = [...new Set(emptyInv.map(i => i.supplier))];
    return ["ALL", ...all];
  }, [emptyInv]);

  const filtInv = useMemo(() => {
    let items = emptyInv.filter(i =>
      (supF === "ALL" || i.supplier === supF) &&
      (!search || [i.code, i.name].some(v =>
        v.toLowerCase().includes(search.toLowerCase())
      ))
    );
    if (showOnly === "custom") items = items.filter(i => overrides[`${i.code}__${i.supplier}`]);
    if (showOnly === "hidden") items = items.filter(i => overrides[`${i.code}__${i.supplier}`]?.hidden);
    return items;
  }, [emptyInv, supF, search, overrides, showOnly]);

  const customCount = Object.keys(overrides).length;
  const hiddenCount = Object.values(overrides).filter(o => o.hidden).length;
  const priceCount  = Object.entries(overrides).filter(([,o]) => !o.hidden).length;

  return (
    <>
      {/* Outlet selector */}
      <div style={{display:"flex",gap:12,alignItems:"flex-end",marginBottom:14,flexWrap:"wrap"}}>
        <div style={{minWidth:220}}>
          <label style={{fontSize:10,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",
            color:"var(--mut)",display:"block",marginBottom:4}}>Select Outlet</label>
          <select value={selOutlet} onChange={e=>loadOutlet(e.target.value)}
            style={{padding:"7px 11px",background:"var(--s2)",border:"1px solid var(--bdr)",
              borderRadius:7,fontSize:12.5,color:"var(--txt)",outline:"none",width:"100%"}}>
            {OUTLETS.map(o=><option key={o}>{o}</option>)}
          </select>
        </div>
        <div style={{display:"flex",gap:6,paddingBottom:2,flexWrap:"wrap"}}>
          <button onClick={()=>setShowOnly("all")}
            className={`btn btnsm ${showOnly==="all"?"btng":"btnd"}`}>
            All ({emptyInv.length})
          </button>
          <button onClick={()=>setShowOnly("custom")}
            className={`btn btnsm ${showOnly==="custom"?"btng":"btnd"}`}
            style={priceCount?{borderColor:"var(--gld2)",color:"var(--gld2)"}:{}}>
            Custom Price ({priceCount})
          </button>
          {hiddenCount > 0 && (
            <button onClick={()=>setShowOnly("hidden")}
              className={`btn btnsm ${showOnly==="hidden"?"btng":"btnd"}`}
              style={{borderColor:"var(--red)",color:"var(--red)"}}>
              Hidden ({hiddenCount})
            </button>
          )}
        </div>
      </div>

      {/* Info banner */}
      <div style={{background:"rgba(99,102,241,.07)",border:"1px solid rgba(99,102,241,.15)",
        borderRadius:8,padding:"9px 14px",marginBottom:12,fontSize:11.5,color:"var(--mut)",lineHeight:1.6}}>
        <strong style={{color:"var(--acc2,#818cf8)"}}>Outlet Empty Pricing</strong> — Items use main empty prices by default.
        Override to customise prices or hide items for <strong style={{color:"var(--txt)"}}>{selOutlet}</strong> only.
        Staff at this outlet will see outlet prices where set.
      </div>

      {/* Supplier tabs */}
      <div className="stabs" style={{marginBottom:8,flexWrap:"wrap"}}>
        {sups.map(s => (
          <button key={s} className={`stab ${supF===s?"act":""}`} onClick={()=>setSupF(s)}>
            {s==="ALL" ? `All (${emptyInv.length})` : `${s} (${emptyInv.filter(i=>i.supplier===s).length})`}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="ctrls" style={{marginBottom:10}}>
        <div className="sbox">{I.search}
          <input placeholder="Search code or name…" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <div style={{marginLeft:"auto",fontSize:11,color:"var(--mut)",alignSelf:"center"}}>
          {filtInv.length} items
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="chd">
          <div>
            <h3>{selOutlet} — Outlet Empty Inventory</h3>
            <p>{customCount} custom price{customCount!==1?"s":""}{hiddenCount?`, ${hiddenCount} hidden`:""}</p>
          </div>
        </div>
        <div style={{overflowX:"auto"}}>
          <table className="tbl">
            <thead>
              <tr>
                <th>#</th><th>Code</th><th>Name</th><th>Type</th><th>Supplier</th>
                <th>Main Cost</th><th>Main Price</th>
                <th>Outlet Cost</th><th>Outlet Price</th>
                <th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtInv.length===0 && (
                <tr><td colSpan={11}><div className="empty">No items found.</div></td></tr>
              )}
              {filtInv.map((item, idx) => {
                const ov           = overrides[`${item.code}__${item.supplier}`];
                const hasOv        = !!ov;
                const isHidden     = ov?.hidden;
                const col          = getSupColor(item.supplier);
                const outletCost   = hasOv ? ov.unitCost     : item.unitCost;
                const outletPrice  = hasOv ? ov.sellingPrice : item.sellingPrice;
                const priceChanged = hasOv && (
                  Number(ov.sellingPrice) !== Number(item.sellingPrice) ||
                  Number(ov.unitCost)     !== Number(item.unitCost)
                );
                return (
                  <tr key={item.id} style={isHidden?{opacity:.4}:{}}>
                  <td style={{color:"var(--mut2)",fontSize:11,fontFamily:"monospace"}}>{idx+1}</td>
                  <td><span className="ctag">{item.code}</span></td>
                  <td className="bold">{item.name}</td>
                  <td><span className="tpill">{item.type||"—"}</span></td>
                  <td>
                  <span style={{fontSize:10,fontWeight:600,padding:"1px 7px",borderRadius:10,
                        background:`${col}15`,color:col,border:`1px solid ${col}22`}}>
                        {item.supplier}
                      </span>
                    </td>
                    <td className="mono" style={{color:"var(--mut)",fontSize:11}}>
                      {item.unitCost?`Rs.${fmt(item.unitCost)}`:"—"}
                    </td>
                    <td className="mono" style={{color:"var(--mut)",fontSize:11}}>
                      {item.sellingPrice?`Rs.${fmt(item.sellingPrice)}`:"—"}
                    </td>
                    <td className="mono" style={{fontWeight:priceChanged?700:400,color:priceChanged?"var(--gld2)":undefined}}>
                      {outletCost?`Rs.${fmt(outletCost)}`:"—"}
                    </td>
                    <td className="mono bold" style={{color:priceChanged?"var(--gld2)":undefined}}>
                      {outletPrice?`Rs.${fmt(outletPrice)}`:"—"}
                    </td>
                    <td>
                      {isHidden
                        ? <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:10,
                            background:"rgba(239,68,68,.12)",color:"var(--red)",border:"1px solid rgba(239,68,68,.2)"}}>Hidden</span>
                        : priceChanged
                          ? <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:10,
                              background:"rgba(251,191,36,.12)",color:"var(--gld2)",border:"1px solid rgba(251,191,36,.2)"}}>Custom</span>
                          : <span style={{fontSize:10,color:"var(--mut2)"}}>Default</span>
                      }
                    </td>
                    <td>
                      <div style={{display:"flex",gap:3}}>
                        <button className="btngh" title="Edit outlet price" onClick={()=>openEdit(item)}>
                          {I.edit}
                        </button>
                        {hasOv && (
                          <button className="btndel" title="Reset to main"
                            onClick={()=>{if(confirm("Reset to main empty price?"))resetOverride(`${item.code}__${item.supplier}`);}}>
                            {I.trash}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit modal */}
      {editItem && (
        <Modal
          title={`${selOutlet} — ${editItem.code} ${editItem.name}`}
          onClose={()=>setEditItem(null)}
          footer={<>
            <button className="btn btnd" onClick={()=>setEditItem(null)}>Cancel</button>
            <button className="btn btng" onClick={saveEdit}>{I.check} Save for {selOutlet}</button>
          </>}
        >
          <div style={{background:"var(--s2)",borderRadius:6,padding:"8px 12px",marginBottom:12,
            fontSize:11.5,color:"var(--mut)",border:"1px solid var(--bdr)",display:"flex",gap:24}}>
            <span>Main cost: <strong style={{color:"var(--txt)"}}>Rs.{fmt(editItem.unitCost)}</strong></span>
            <span>Main price: <strong style={{color:"var(--txt)"}}>Rs.{fmt(editItem.sellingPrice)}</strong></span>
          </div>
          <div className="fg">
            <div className="ff">
              <label>Outlet Unit Cost (Rs.)</label>
              <input type="number" value={ef.unitCost}
                onChange={e=>setEf({...ef,unitCost:e.target.value})} placeholder="0.00"/>
            </div>
            <div className="ff">
              <label>Outlet Selling Price (Rs.)</label>
              <input type="number" value={ef.sellingPrice}
                onChange={e=>setEf({...ef,sellingPrice:e.target.value})} placeholder="0.00"/>
            </div>
          </div>
          {ef.unitCost && ef.sellingPrice && Number(ef.unitCost)>0 && (
            <div style={{background:"var(--s2)",borderRadius:6,padding:"7px 11px",fontSize:11.5,
              border:"1px solid var(--bdr)",marginBottom:10}}>
              Outlet margin: <strong style={{color:"var(--gld2)"}}>
                {(((ef.sellingPrice-ef.unitCost)/ef.unitCost)*100).toFixed(2)}%
              </strong>
            </div>
          )}
    {/* Opening Quantity — date-specific (same as Tab 3) */}
<div className="fg" style={{marginTop:4}}>
  <div className="ff">
    <label>Opening Date</label>
    <input
      type="date"
      value={openingDate}
      onChange={e => setOpeningDate(e.target.value)}
    />
  </div>
  <div className="ff">
    <label>Outlet Opening Quantity</label>
    <input
      type="number"
      min="0"
      value={ef.qty ?? ""}
      onChange={e => setEf({...ef, qty: e.target.value})}
      placeholder={`Main stock: ${editItem.qty ?? 0} — enter outlet qty`}
    />
  </div>
</div>
<div style={{fontSize:11,color:"var(--mut)",marginTop:-6,marginBottom:8}}>
  This quantity applies only to <strong>{openingDate}</strong> and won't appear on other dates.
</div>

    {/* Opening qty override hint */}
    {ef.qty !== "" && ef.qty  != null && (
      <div style={{background:"var(--s2)",borderRadius:6,padding:"7px 11px",fontSize:11.5,
        border:"1px solid var(--bdr)",marginBottom:10,color:"var(--mut)"}}>
        Staff will see opening qty: <strong style={{color:"var(--txt)"}}>{ef.qty}</strong>
        {editItem.qty != null && Number(ef.ty) !== Number(editItem.qty) && (
          <span style={{color:"var(--gld2)",marginLeft:8}}>
            (overrides main: {editItem.qty})
          </span>
        )}
      </div>
    )}

          <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 0 2px",
            borderTop:"1px solid var(--bdr)",marginTop:4}}>
            <input type="checkbox" id="hide-empty-ov" checked={ef.hidden}
              onChange={e=>setEf({...ef,hidden:e.target.checked})}
              style={{width:15,height:15,cursor:"pointer"}}/>
            <label htmlFor="hide-empty-ov" style={{fontSize:12,cursor:"pointer",color:"var(--txt)"}}>
              Hide this item at <strong>{selOutlet}</strong> (won't appear for staff)
            </label>
          </div>
        </Modal>
      )}
    </>
  );
}

// ─────────────────────────────────────────────
// EMPTY STOCK PANEL
// ─────────────────────────────────────────────
function EmptyStockPanel({ toast_, isAdmin, onInventoryChange }) {
  const EMPTY_ITEM_TYPES = ["EMP"];
  // EMPTY_SEED and loadEmptyFromStorage() are now at module level (shared with Tab 4)
  function loadEmpty() { return loadEmptyFromStorage(); }


async function saveEmpty(data) {
    console.log("saveEmpty called:", data.length, "items"); 
  setItems(data);
  lss("inv_empty_v2", data);
  if (onInventoryChange) onInventoryChange(data);
  await saveEmptyInventoryMaster(data); 
    console.log("saveEmptyInventoryMaster done ✓");
}
  const [items,     setItems]     = useState(loadEmpty);
  useEffect(() => {
  const existing = loadEmptyFromStorage();
  if (existing && existing.length > 0) {
    console.log("Syncing empty inventory to Supabase:", existing.length, "items");
    saveEmptyInventoryMaster(existing).then(() => {
      console.log("Sync done ✓");
    });
  }
}, []); 
 
  const [supF,      setSupF]      = useState("ALL");
  const [search,    setSearch]    = useState("");
  const [modal,     setModal]     = useState(null);
  const [priceM,    setPriceM]    = useState(null);
  const [pf,        setPf]        = useState({});
  const [form,      setForm]      = useState({});
  const [supModal,  setSupModal]  = useState(false);
  const [supForm,   setSupForm]   = useState({ name:"", color:"#94a3b8" });
  const [extraSups, setExtraSups] = useState(() => ls("empty_extra_suppliers", []));

  const BASE_SUP_COLORS = {
    "DCSL":"#6366f1","LION BREWERY":"#f59e0b","UG":"#10b981",
    "TODDY":"#f97316","DCSL BEER":"#22c55e","EMPTY PURCHASE":"#94a3b8",
  };

  function getSupColor(sup) {
    const extra = extraSups.find(s => s.id === sup);
    return extra ? extra.color : (BASE_SUP_COLORS[sup] || "#94a3b8");
  }

  function getAllSups() {
    const base = [...new Set(EMPTY_SEED.map(i => i.supplier))];
    const extraIds = extraSups.map(s => s.id);
    const filtered = base.filter(id => !extraIds.includes(id));
    return [...filtered, ...extraSups.map(s => s.id)];
  }

  const sups = useMemo(() => {
    const all = [...new Set(items.map(i => i.supplier))];
    return ["ALL", ...all];
  }, [items]);

  const filtItems = useMemo(() => items.filter(i =>
    (supF === "ALL" || i.supplier === supF) &&
    (!search || [i.code, i.name].some(v =>
      v.toLowerCase().includes(search.toLowerCase())
    ))
  ), [items, supF, search]);

  const grouped = useMemo(() => {
    if (supF !== "ALL") return null;
    const groups = {};
    filtItems.forEach(item => {
      if (!groups[item.supplier]) groups[item.supplier] = [];
      groups[item.supplier].push(item);
    });
    return Object.entries(groups).map(([supplier, its]) => ({ supplier, items: its }));
  }, [filtItems, supF]);

   async function saveItem() {
    if (!form.code || !form.name || !form.supplier) {
      toast_("Fill code, name and supplier", "err"); return;
    }
    const item = {
  ...form,
  id: modal === "add" 
    ? `${form.supplier.replace(/\s/g,"_")}_${form.code.replace(/\s/g,"")}` 
    : form.id,
  unitCost:     Number(form.unitCost)     || 0,
  sellingPrice: Number(form.sellingPrice) || 0,
  qty:          Number(form.qty)          || 0,
  type:         form.type || "",
};

if (modal === "add") {
  if (items.find(i => i.code === form.code && i.supplier === form.supplier)) {
    toast_("Code already exists for this supplier", "err"); return;
  }
  await saveEmpty([...items, item]);
  toast_("Empty item added ✓");
} else {
  await saveEmpty(items.map(i => i.id === modal.id ? { ...i, ...item } : i));
  toast_("Updated ✓");
}
setModal(null);
}


async function savePrice() {
  await saveEmpty(items.map(i => i.id === priceM.id
    ? { ...i, unitCost: Number(pf.unitCost) || 0, sellingPrice: Number(pf.sellingPrice) || 0 }
    : i
  ));
  toast_("Prices updated ✓");
  setPriceM(null);
}

 function deleteItem(item) {
  if (!confirm(`Remove ${item.code} — ${item.name} (${item.supplier})?`)) return;
  saveEmpty(items.filter(i => i.id !== item.id));
  toast_("Removed ✓");
}
  function addSupplier() {
    if (!supForm.name) { toast_("Enter supplier name", "err"); return; }
    const id = supForm.name.toUpperCase().trim();
    if (getAllSups().includes(id)) { toast_("Supplier already exists", "err"); return; }
    const updated = [...extraSups, { id, color: supForm.color }];
    setExtraSups(updated);
    lss("empty_extra_suppliers", updated);
    toast_(`${id} added ✓`);
    setSupModal(false);
    setSupForm({ name:"", color:"#94a3b8" });
  }
  function renderEmptyRows(rowItems) {
  return rowItems.map((item, idx) => {
    const col = getSupColor(item.supplier);
    const mg  = item.sellingPrice && item.unitCost ? item.sellingPrice - item.unitCost : null;
    return (
      <tr key={item.id}>
        <td style={{color:"var(--mut2)",fontSize:11,fontFamily:"monospace"}}>{idx+1}</td>
        <td><span className="ctag">{item.code}</span></td>
        <td className="bold">{item.name}</td>
        <td><span className="tpill">{item.type||"—"}</span></td>
        <td>
          <span style={{fontSize:10,fontWeight:600,padding:"1px 7px",borderRadius:10,
            background:`${col}15`,color:col,border:`1px solid ${col}22`}}>
            {item.supplier}
          </span>
        </td>
        <td className="mono" style={{color:"var(--mut)"}}>
          {item.unitCost ? `Rs.${fmt(item.unitCost)}` : "—"}
        </td>
        <td className="mono bold">
          {item.sellingPrice ? `Rs.${fmt(item.sellingPrice)}` : "—"}
        </td>
        <td>
          {mg !== null
            ? <span style={{fontSize:10,fontWeight:600,padding:"1px 6px",borderRadius:10,
                background:mg>=0?"rgba(34,197,94,.1)":"rgba(239,68,68,.1)",
                color:mg>=0?"var(--grn)":"var(--red)"}}>
                {mg>=0?"+":""}Rs.{fmt(mg)}
              </span>
            : "—"}
        </td>
        {isAdmin && (
          <td>
            <div style={{display:"flex",gap:2}}>
              <button className="btngh" title="Change Price"
                onClick={()=>{ setPf({unitCost:item.unitCost, sellingPrice:item.sellingPrice}); setPriceM(item); }}>
                {I.tag}
              </button>
              <button className="btngh" title="Edit"
                onClick={()=>{ setForm({...item}); setModal(item); }}>
                {I.edit}
              </button>
              <button className="btndel" title="Delete" onClick={()=>deleteItem(item)}>
                {I.trash}
              </button>
            </div>
          </td>
        )}
      </tr>
    );
  });
}
  return (
    <>
      {/* Info banner */}
      <div style={{background:"rgba(251,191,36,.07)",border:"1px solid rgba(251,191,36,.15)",
        borderRadius:8,padding:"9px 14px",marginBottom:12,fontSize:11.5,color:"var(--mut)",lineHeight:1.6}}>
        <strong style={{color:"var(--gld2)"}}>Empty Stock</strong> — Manage empty bottle/container items, suppliers and pricing separately from main inventory.
      </div>

      {/* Supplier tabs + Add Supplier */}
      <div style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:6}}>
        <div className="stabs" style={{flex:1,flexWrap:"wrap"}}>
          {sups.map(s => (
            <button key={s} className={`stab ${supF===s?"act":""}`} onClick={()=>setSupF(s)}>
              {s==="ALL" ? `All (${items.length})` : `${s} (${items.filter(i=>i.supplier===s).length})`}
            </button>
          ))}
        </div>
        {isAdmin && (
          <button className="btn btnd btnsm" style={{flexShrink:0,marginTop:2}}
            onClick={()=>{ setSupForm({name:"",color:"#94a3b8"}); setSupModal(true); }}>
            {I.plus} Add Supplier
          </button>
        )}
      </div>

      {/* Search + Add Item */}
      <div className="ctrls" style={{marginBottom:10}}>
        <div className="sbox">{I.search}
          <input placeholder="Search code or name…" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        {isAdmin && (
          <div style={{marginLeft:"auto"}}>
            <button className="btn btng" onClick={()=>{
              setForm({
                code:"", name:"",
                supplier: supF!=="ALL" ? supF : (getAllSups()[0] || "DCSL"),
                unitCost:"", sellingPrice:"", qty:0,
              });
              setModal("add");
            }}>{I.plus} Add Empty Item</button>
          </div>
        )}
      </div>
      {/* Table */}
<div className="card">
  <div className="chd">
    <div>
      <h3>Empty Stock Items</h3>
      <p>{filtItems.length} items — {supF==="ALL"?"All Suppliers":supF}</p>
    </div>
  </div>
  <div style={{overflowX:"auto"}}>
    <table className="tbl">
      <thead>
        <tr>
          <th>#</th><th>Code</th><th>Name</th><th>Type</th><th>Supplier</th>
          <th>Unit Cost</th><th>Selling Price</th><th>Margin</th>
          {isAdmin && <th></th>}
        </tr>
      </thead>
      <tbody>
        {filtItems.length===0 && (
          <tr><td colSpan={isAdmin?9:8}><div className="empty">No items found.</div></td></tr>
        )}
        {supF==="ALL" && grouped && grouped.map(({supplier, items: gItems}) => {
          const col = getSupColor(supplier);
          return (
            <React.Fragment key={`grp-${supplier}`}>
              <tr style={{background:"var(--s2)"}}>
                <td colSpan={isAdmin?9:8} style={{padding:"7px 10px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{width:4,height:16,borderRadius:2,background:col,display:"inline-block"}}/>
                    <span style={{fontWeight:700,fontSize:12,color:col,letterSpacing:".04em"}}>{supplier}</span>
                    <span style={{fontSize:10,color:"var(--mut)",fontFamily:"monospace"}}>{gItems.length} items</span>
                  </div>
                </td>
              </tr>
              {renderEmptyRows(gItems)}
            </React.Fragment>
          );
        })}
        {supF !== "ALL" && renderEmptyRows(filtItems)}
      </tbody>
    </table>
  </div>
</div>
       {/* ── ADD / EDIT MODAL ── */}
{modal && isAdmin && (
  <Modal title={modal==="add" ? "Add Empty Item" : `Edit — ${modal.code}`}
    onClose={()=>setModal(null)}
    footer={<>
      <button className="btn btnd" onClick={()=>setModal(null)}>Cancel</button>
      <button className="btn btng" onClick={saveItem}>{I.check} {modal==="add"?"Add":"Save"}</button>
    </>}>
    <div className="fg">
      <div className="ff"><label>Item Code *</label>
        <input value={form.code}
          onChange={e=>setForm({...form,code:e.target.value.toUpperCase()})}
          placeholder="e.g. DEMP4"/>
      </div>
      <div className="ff"><label>Name *</label>
        <input value={form.name}
          onChange={e=>setForm({...form,name:e.target.value})}
          placeholder="e.g. DES EMP"/>
      </div>
      <div className="ff"><label>Description</label>
        <input value={form.description||""}
          onChange={e=>setForm({...form,description:e.target.value})}
          placeholder="e.g. EXTRA SPECIAL"/>
      </div>
      <div className="ff"><label>Item Type</label>
        <input list="empty-type-suggestions"
          value={form.type||""}
          onChange={e=>setForm({...form,type:e.target.value.toUpperCase()})}
          placeholder="Select or type…"
          style={{textTransform:"uppercase"}}/>
        <datalist id="empty-type-suggestions">
          {EMPTY_ITEM_TYPES.map(t=><option key={t} value={t}/>)}
        </datalist>
      </div>
      <div className="ff"><label>Supplier *</label>
        <select value={form.supplier} onChange={e=>setForm({...form,supplier:e.target.value})}>
          {getAllSups().map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
    </div>
    <div className="fg3">
      <div className="ff"><label>Unit Cost (Rs.)</label>
        <input type="number" value={form.unitCost}
          onChange={e=>setForm({...form,unitCost:e.target.value})} placeholder="0.00"/>
      </div>
      <div className="ff"><label>Selling Price (Rs.)</label>
        <input type="number" value={form.sellingPrice}
          onChange={e=>setForm({...form,sellingPrice:e.target.value})} placeholder="0.00"/>
      </div>
      
    </div>
    {form.unitCost && form.sellingPrice && Number(form.unitCost) > 0 && (
      <div style={{background:"var(--s2)",borderRadius:6,padding:"7px 11px",fontSize:11.5,
        border:"1px solid var(--bdr)",marginTop:4}}>
        Margin: <strong style={{color:"var(--gld2)"}}>
          {(((form.sellingPrice - form.unitCost) / form.unitCost) * 100).toFixed(2)}%
        </strong>
      </div>
    )}
  </Modal>
)}
     

      {/* ── PRICE CHANGE MODAL ── */}
      {priceM && isAdmin && (
        <Modal title={`Change Prices — ${priceM.code} ${priceM.name}`}
          onClose={()=>setPriceM(null)}
          footer={<>
            <button className="btn btnd" onClick={()=>setPriceM(null)}>Cancel</button>
            <button className="btn btng" onClick={savePrice}>{I.check} Update Price</button>
          </>}>
          <div style={{background:"rgba(251,191,36,.07)",borderRadius:6,padding:"8px 12px",marginBottom:10,
            fontSize:11.5,color:"var(--mut)",border:"1px solid rgba(251,191,36,.15)"}}>
            Current — Cost: <strong style={{color:"var(--txt)"}}>Rs.{fmt(priceM.unitCost)}</strong>
            &nbsp;&nbsp;Price: <strong style={{color:"var(--txt)"}}>Rs.{fmt(priceM.sellingPrice)}</strong>
          </div>
          <div className="fg">
            <div className="ff"><label>New Unit Cost (Rs.)</label>
              <input type="number" value={pf.unitCost}
                onChange={e=>setPf({...pf,unitCost:e.target.value})}/>
            </div>
            <div className="ff"><label>New Selling Price (Rs.)</label>
              <input type="number" value={pf.sellingPrice}
                onChange={e=>setPf({...pf,sellingPrice:e.target.value})}/>
            </div>
          </div>
          {pf.unitCost && pf.sellingPrice && Number(pf.unitCost) > 0 && (
            <div style={{background:"var(--s2)",borderRadius:6,padding:"9px 11px",fontSize:11.5,border:"1px solid var(--bdr)"}}>
              New margin: <strong style={{color:"var(--gld2)"}}>
                {(((pf.sellingPrice - pf.unitCost) / pf.unitCost) * 100).toFixed(2)}%
              </strong>
            </div>
          )}
        </Modal>
      )}

      {/* ── ADD SUPPLIER MODAL ── */}
      {supModal && isAdmin && (
        <Modal title="Add Empty Supplier" onClose={()=>setSupModal(false)}
          footer={<>
            <button className="btn btnd" onClick={()=>setSupModal(false)}>Cancel</button>
            <button className="btn btng" onClick={addSupplier}>{I.check} Add Supplier</button>
          </>}>
          <div className="fg">
            <div className="ff"><label>Supplier Name *</label>
              <input value={supForm.name}
                onChange={e=>setSupForm({...supForm,name:e.target.value.toUpperCase()})}
                placeholder="e.g. NEW BRAND"/>
            </div>
            <div className="ff"><label>Badge Color</label>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <input type="color" value={supForm.color}
                  onChange={e=>setSupForm({...supForm,color:e.target.value})}
                  style={{width:44,height:32,border:"none",background:"none",cursor:"pointer",padding:0}}/>
                <span style={{fontSize:11,color:"var(--mut)"}}>Supplier badge color</span>
              </div>
            </div>
          </div>
          {supForm.name && (
            <div style={{background:"var(--s2)",borderRadius:6,padding:"9px 12px",fontSize:11,
              border:"1px solid var(--bdr)",color:"var(--mut)",display:"flex",alignItems:"center",gap:10}}>
              Preview:
              <span style={{fontSize:11,fontWeight:600,padding:"2px 9px",borderRadius:10,
                background:`${supForm.color}20`,color:supForm.color,border:`1px solid ${supForm.color}33`}}>
                {supForm.name}
              </span>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

// ─────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────
export default function InventoryAdmin({ toast_, isAdmin, adminOutlets }) {
  const outletNames = adminOutlets?.length ? adminOutlets : OUTLETS;
  const [inv, setIR] = useState(() => loadInv());

useEffect(() => {
  loadInvFromSupabase().then(data => setIR(data));

  // Sync empty inventory to Supabase on admin load
  const existingEmpty = loadEmptyFromStorage();
  if (existingEmpty && existingEmpty.length > 0) {
    saveEmptyInventoryMaster(existingEmpty).then(() => {
      console.log("Empty inventory synced to Supabase ✓");
    });
  }
}, []);
  const [empty,    setER] = useState(() => ls("inv_empty", SEED_EMPTY));
  const [invTab,   setInvTab]  = useState("main");
  const [supF,     setSupF]    = useState("ALL");
  const [search,   setSearch]  = useState("");
  const [iModal,   setIModal]  = useState(null);
  const [iForm,    setIForm]   = useState({});
  const [priceM,   setPriceM]  = useState(null);
  const [pf,       setPf]      = useState({});
  const [eModal,   setEModal]  = useState(null);
  const [ef,       setEf]      = useState({});
  const [supModal, setSupModal]= useState(false);
  const [supForm,  setSupForm] = useState({id:"",name:"",color:"#94a3b8"});
  const [typeInput,setTypeInput]= useState("");
  const [csMode,   setCsMode]  = useState("monthly");
  const [repairOutlet, setRepairOutlet] = useState(outletNames[0] || "");
  const [repairDate,   setRepairDate]   = useState(today());
  const [repairing,    setRepairing]    = useState(false);
  const [csDate,   setCsDate]  = useState(today());
  const [csWeekOf, setCsWeekOf]= useState(today());
  const [csMonth,  setCsMonth] = useState(today().slice(0,7));
  const [csOutlet, setCsOutlet]= useState("ALL");
  const [physStock,setPhysStock]= useState({});
  const [statusDb, setStatusDb]   = useState({ sales: {}, purchases: {}, transfers: {}, returns: {} });
  const csWrapRef = useRef(null);
  // OutletEmptyPanel (Tab 4) loads its own data via loadEmptyFromStorage() on mount.
  // handleEmptyInventoryChange is kept so EmptyStockPanel's onInventoryChange prop works.
  function handleEmptyInventoryChange(_newData) { /* no-op: Tab 4 self-loads */ }

  const si = d  => {
  const s = sortInv(d);
  setIR(s); 
  lss("inv_main", s);
  saveInventoryMaster(s); // save to Supabase
};
  const se = d => { setER(d); lss("inv_empty", d); };

  const allTypes = useMemo(() => {
    const fromInv = inv.map(i => i.type).filter(Boolean);
    return [...new Set([...ITEM_TYPES, ...fromInv])].sort();
  }, [inv]);

  const sups = useMemo(() => {
    const extra = ls("extra_suppliers", []);
    const extraIds = extra.map(s => s.id).filter(id => !SUP_ORDER.includes(id));
    const fullOrder = [...SUP_ORDER, ...extraIds];
    return ["ALL", ...fullOrder.filter(s => inv.some(i => i.supplier === s))];
  }, [inv]);

  const allSupColors    = useMemo(() => getAllSupColors(),    [supModal, inv]);
  const allSuppliersList= useMemo(() => getAllSuppliersList(),[supModal, inv]);

  const filtInv = useMemo(() => inv.filter(i =>
    (supF === "ALL" || i.supplier === supF) &&
    (!search || [i.code, i.name, i.description||""].some(v =>
      v.toLowerCase().includes(search.toLowerCase())
    ))
  ), [inv, supF, search]);

  const groupedInv = useMemo(() => {
    if (supF !== "ALL") return null;
    const groups = {};
    filtInv.forEach(item => {
      if (!groups[item.supplier]) groups[item.supplier] = [];
      groups[item.supplier].push(item);
    });
    const extra = ls("extra_suppliers", []);
    const extraIds = extra.map(s => s.id).filter(id => !SUP_ORDER.includes(id));
    return [...SUP_ORDER, ...extraIds]
      .filter(sup => groups[sup])
      .map(sup => ({ supplier: sup, items: groups[sup] }));
  }, [filtInv, supF]);

  useEffect(() => {
    if (invTab !== "status") return;
    const toLoad = csOutlet === "ALL" ? outletNames : [csOutlet];
    (async () => {
      const sales = {}, purchases = {}, transfers = {}, returns = {};
      await Promise.all(toLoad.map(async o => {
        const [s, p, t, r] = await Promise.all([
          getSales(o), getPurchases(o), getTransfers(o), getReturns(o),
        ]);
        sales[o] = s; purchases[o] = p; transfers[o] = t; returns[o] = r;
      }));
      setStatusDb({ sales, purchases, transfers, returns });
    })();
  }, [invTab, csOutlet, csMode, csDate, csWeekOf, csMonth, outletNames]);

  const csData = useMemo(() => {
  let csFrom, csTo;
  if (csMode === "daily") {
    csFrom = csDate;
    csTo   = csDate;
  } else if (csMode === "weekly") {
    const d   = new Date(csWeekOf);
    const day = d.getDay();
    const mon = new Date(d); mon.setDate(d.getDate() - ((day + 6) % 7));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    csFrom = mon.toISOString().slice(0, 10);
    csTo   = sun.toISOString().slice(0, 10);
  } else {
    csFrom = csMonth + "-01";
    const lastDay = new Date(
      parseInt(csMonth.slice(0, 4)),
      parseInt(csMonth.slice(5, 7)),
      0
    ).getDate();
    csTo = csMonth + "-" + String(lastDay).padStart(2, "0");
  }

  const outlets = csOutlet === "ALL" ? outletNames : [csOutlet];

  return inv.map(item => {
    const sp = (() => {
      if (csOutlet !== "ALL") {
        const ov = ls(outletInvKey(csOutlet), {})[`${item.code}__${item.supplier}`];
        return ov?.sellingPrice !== undefined ? Number(ov.sellingPrice) : Number(item.sellingPrice) || 0;
      }
      return Number(item.sellingPrice) || 0;
    })();
    const uc = (() => {
      if (csOutlet !== "ALL") {
        const ov = ls(outletInvKey(csOutlet), {})[`${item.code}__${item.supplier}`];
        return ov?.unitCost !== undefined ? Number(ov.unitCost) : Number(item.unitCost) || 0;
      }
      return Number(item.unitCost) || 0;
    })();
    const mg = sp - uc;

    let totalPurchase = 0;
    let transferIn    = 0;
    let transferOut   = 0;
    let totalReturn   = 0;
    let adjStock      = 0;
    let firstOpening  = null;
    let lastEndStock  = null;
    let hasSaleEntry  = false;

    outlets.forEach(outlet => {
      const salesInRange = (statusDb.sales[outlet] || [])
        .filter(s => s.date && s.date >= csFrom && s.date <= csTo)
        .sort((a, b) => a.date.localeCompare(b.date));

      if (salesInRange.length > 0) {
        const firstRow = (salesInRange[0].items || salesInRange[0].mainRows || []).find(
          r => r.code === item.code && r.id === item.id && !r.isEmptyItem
        ) || (salesInRange[0].items || salesInRange[0].mainRows || []).find(
          r => r.code === item.code && r.supplier === item.supplier && !r.isEmptyItem
        );
        if (firstRow) firstOpening = Number(firstRow.openingStock) || 0;
      }

      for (let i = salesInRange.length - 1; i >= 0; i--) {
        const row = (salesInRange[i].items || salesInRange[i].mainRows || []).find(
          r => r.code === item.code && r.id === item.id && !r.isEmptyItem
        ) || (salesInRange[i].items || salesInRange[i].mainRows || []).find(
          r => r.code === item.code && r.supplier === item.supplier && !r.isEmptyItem
        );
        if (row) {
          hasSaleEntry = true;
          if (row.stkSE !== undefined) adjStock = Number(row.stkSE) || 0;
          if (row.endStock !== "" && row.endStock !== undefined) {
            lastEndStock = parseFloat(row.endStock);
            break;
          }
        }
      }

      (statusDb.purchases[outlet] || [])
        .filter(p => p.date && p.date >= csFrom && p.date <= csTo)
        .forEach(p => (p.items || p.lines || []).forEach(l => {
          if (l.itemCode === item.code && !l.isEmptyItem)
            totalPurchase += parseFloat(l.qty) || 0;
        }));

      (statusDb.transfers[outlet] || [])
        .filter(t => t.date && t.date >= csFrom && t.date <= csTo && t.from_outlet_id !== outlet)
        .forEach(t => (t.items || t.lines || []).forEach(l => {
          if (l.itemCode === item.code)
            transferIn += parseFloat(l.qty) || 0;
        }));

      (statusDb.transfers[outlet] || [])
        .filter(t => t.date && t.date >= csFrom && t.date <= csTo && t.from_outlet_id === outlet)
        .forEach(t => (t.items || t.lines || []).forEach(l => {
          if (l.itemCode === item.code)
            transferOut += parseFloat(l.qty) || 0;
        }));

      (statusDb.returns[outlet] || [])
        .filter(r => r.date && r.date >= csFrom && r.date <= csTo)
        .forEach(r => (r.items || r.lines || []).forEach(l => {
          if (l.itemCode === item.code)
            totalReturn += parseFloat(l.qty) || 0;
        }));
    });

    const openingFromOv = (() => {
      if (csOutlet !== "ALL") {
        const ov = ls(outletInvKey(csOutlet), {})[`${item.code}__${item.supplier}`];
        if (ov?.qty !== undefined) return Number(ov.qty) || 0;
      }
      return Number(item.qty) || 0;
    })();
    const opening         = firstOpening !== null ? firstOpening : openingFromOv;
    const inHandStock     = lastEndStock !== null ? lastEndStock : 0;
    const totalBottleSale = opening + totalPurchase - inHandStock;
    const physicalStock   = inHandStock * uc;
    const totalSaleAmt    = totalBottleSale - sp;
    const profit          = mg * totalBottleSale;
    const physKey         = `${item.code}_${csFrom}_${csTo}_${csOutlet}`;

    return {
      ...item,
      _hasSaleEntry: hasSaleEntry,
      opening,
      inHandStock,
      physicalStock,
      physicalStockOverride: physStock[physKey] ?? "",
      totalBottleSale,
      totalSaleAmt,
      profit,
      totalPurchase,
      transferIn,
      transferOut,
      totalReturn,
      adjStock,
      margin: mg,
      physKey,
      csFrom,
      csTo,
    };

   }).filter(r =>
    r._hasSaleEntry === true ||
    r.totalPurchase > 0 ||
    r.transferIn > 0 ||
    r.transferOut > 0 ||
    r.totalReturn > 0 ||
    r.opening > 0
  );
}, [inv, csMode, csDate, csWeekOf, csMonth, csOutlet, physStock, statusDb, outletNames]);

  function saveItem() {
    if (!iForm.code||!iForm.name){toast_("Fill code and name","err");return;}
    const finalType = typeInput.trim() || iForm.type || "Q";
    const item = { ...iForm, type:finalType, id:iForm.code,
      qty:Number(iForm.qty)||0, unitCost:Number(iForm.unitCost)||0,
      sellingPrice:Number(iForm.sellingPrice)||0 };
    if (iModal==="add") {
    if (inv.find(i=>i.code===iForm.code && i.supplier===iForm.supplier)){toast_("Code already exists for this supplier","err");return;}
      si([...inv, item]); toast_("Added ✓");
    } else {
      si(inv.map(i=>i.id===iModal.id?{...i,...item}:i)); toast_("Updated ✓");
    }
    setIModal(null); setTypeInput("");
  }

  // ── REPAIR OPENING STOCK ──
async function repairOpeningFromDate(outlet, fromDate) {
  const sales = await getSales(outlet);
  const targetSale = sales.find(s => s.date === fromDate);
  if (!targetSale) {
    toast_(`No sale found for ${fromDate} at ${outlet}`, "err");
    return;
  }
  const om = {};
  const oe = {};
  (targetSale.items || []).forEach(r => {
    if (r.isEmptyItem) {
      if (r.id) oe[r.id] = parseFloat(r.endStock) || 0;
    } else {
      const key = r.id || `${r.code}__${r.supplier}`;
      om[key] = parseFloat(r.endStock) || 0;
    }
  });
  for (let i = 1; i <= 30; i++) {
    const d = new Date(fromDate);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const existing = await getOpeningStock(outlet, dateStr);
    const mergedMain = Object.keys(om).length
      ? { ...(existing?.main || {}), ...om }
      : existing?.main || null;
    const mergedEmp = Object.keys(oe).length
      ? { ...(existing?.emp || {}), ...oe }
      : existing?.emp || null;
    await saveOpeningStock(outlet, dateStr, mergedMain, mergedEmp);
  }
  toast_(`Opening stock repaired from ${fromDate} for ${outlet} ✓`);
}
  // AFTER
async function saveSupplier() {
  if (!supForm.id||!supForm.name){toast_("Fill ID and Name","err");return;}
  const numId  = supForm.id.replace(/\D/g,"");
  const fullId = `${numId}-${supForm.name.toUpperCase().trim()}`;
  const existing = ls("extra_suppliers",[]);
  if ([...SUPPLIERS_LIST,...existing].find(s=>s.id===fullId)){toast_("Supplier already exists","err");return;}
  await addSupplier({ id:fullId, name:supForm.name.toUpperCase().trim(), color:supForm.color });
  lss("extra_suppliers",[...existing,{id:fullId,name:supForm.name.toUpperCase().trim(),color:supForm.color}]);
  toast_(`${supForm.name.toUpperCase()} added ✓`);
  setSupModal(false); setIR(prev=>[...prev]);
}
  

  function getRowNum(item) { return inv.findIndex(i=>i.id===item.id)+1; }

  function renderRows(items) {
    return items.map(item => {
       const mg = item.sellingPrice&&item.unitCost
         ? (item.sellingPrice-item.unitCost) : null;
      const col = allSupColors[item.supplier] || "#94a3b8";
      return (
        <tr key={`${item.id}__${item.supplier}`}>
          <td style={{color:"var(--mut2)",fontSize:11,fontFamily:"monospace",width:36}}>{getRowNum(item)}</td>
          <td><span className="ctag">{item.code}</span></td>
          <td className="bold">{item.name}</td>
          <td style={{fontSize:11,color:"var(--mut)",maxWidth:180,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
            {item.description||"—"}
          </td>
          <td><span className="tpill">{item.type}</span></td>
          <td>
            <span style={{fontSize:10,fontWeight:600,padding:"1px 7px",borderRadius:10,
              background:`${col}15`,color:col,border:`1px solid ${col}22`}}>
              {item.supplier.replace(/^\d{4}-/,"")}
            </span>
          </td>
          <td className="mono" style={{color:"var(--mut)"}}>{item.unitCost?`Rs.${fmt(item.unitCost)}`:"—"}</td>
          <td className="mono bold">{item.sellingPrice?`Rs.${fmt(item.sellingPrice)}`:"—"}</td>
          <td>
            {mg!==null
            ? <span style={{fontSize:10,fontWeight:600,padding:"1px 6px",borderRadius:10,
            background:mg>=0?"rgba(34,197,94,.1)":"rgba(239,68,68,.1)",
            color:mg>=0?"var(--grn)":"var(--red)"}}>
            {mg>=0?"+":""}Rs.{fmt(mg)}
            </span>
             : "—"}
          </td>
          {isAdmin && (
            <td>
              <div style={{display:"flex",gap:2}}>
                <button className="btngh" title="Change Price"
                  onClick={()=>{setPf({unitCost:item.unitCost,sellingPrice:item.sellingPrice});setPriceM(item);}}>
                  {I.tag}
                </button>
                <button className="btngh" title="Edit"
                  onClick={()=>{setIForm({...item});setTypeInput(item.type||"");setIModal(item);}}>
                  {I.edit}
                </button>
                <button className="btndel" title="Delete"
                  onClick={()=>{if(!confirm(`Remove ${item.code}?`))return;si(inv.filter(i=>i.id!==item.id));toast_("Removed");}}>
                  {I.trash}
                </button>
              </div>
            </td>
          )}
        </tr>
      );
    });
  }

  return (
    <>
      {/* ── TAB BUTTONS ── */}
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
        <button className={`btn ${invTab==="main"?"btng":"btnd"}`} onClick={()=>setInvTab("main")}>
          {I.pkg} Main Stock ({inv.length})
        </button>
        <button className={`btn ${invTab==="empty"?"btng":"btnd"}`} onClick={()=>setInvTab("empty")}
          style={{borderColor:"var(--gld2)",color:invTab==="empty"?undefined:"var(--gld2)"}}>
          {I.pkg} Empty Stock
        </button>
        <button className={`btn ${invTab==="outlet"?"btng":"btnd"}`} onClick={()=>setInvTab("outlet")}
          style={{borderColor:"var(--acc2,#818cf8)",color:invTab==="outlet"?undefined:"var(--acc2,#818cf8)"}}>
          {I.store} Outlet Inventory
        </button>
        <button className={`btn ${invTab==="outlet-empty"?"btng":"btnd"}`} onClick={()=>setInvTab("outlet-empty")}
          style={{borderColor:"var(--gld2)",color:invTab==="outlet-empty"?undefined:"var(--gld2)"}}>
          {I.store} Outlet Empty Inventory
        </button>
        <button className={`btn ${invTab==="status"?"btng":"btnd"}`} onClick={()=>setInvTab("status")}>
          {I.status} Current Status
        </button>
      </div>

      {/* ══════════ TAB 1 — MAIN STOCK ══════════ */}
      {invTab==="main" && (
        <>
          <div style={{background:"rgba(99,102,241,.07)",border:"1px solid rgba(99,102,241,.15)",
            borderRadius:8,padding:"8px 14px",marginBottom:10,fontSize:11.5,color:"var(--mut)"}}>
            <strong style={{color:"var(--acc2,#818cf8)"}}>Master Inventory</strong> — These items are visible to all outlets.
            Use <strong style={{color:"var(--txt)"}}>Outlet Inventory</strong> to customise prices per outlet.
          </div>
          {isAdmin && (
  <div style={{
    background:"rgba(239,68,68,.07)", border:"1px solid rgba(239,68,68,.2)",
    borderRadius:8, padding:"10px 14px", marginBottom:12,
    display:"flex", alignItems:"flex-end", gap:10, flexWrap:"wrap"
  }}>
    <div>
      <label style={{fontSize:10,fontWeight:700,textTransform:"uppercase",
        color:"var(--mut)",display:"block",marginBottom:3}}>
        🔧 Repair Opening Stock — From Date
      </label>
      <input
        type="date" value={repairDate}
        onChange={e => setRepairDate(e.target.value)}
        style={{padding:"6px 10px",background:"var(--s2)",border:"1px solid var(--bdr)",
          borderRadius:7,fontSize:12.5,color:"var(--txt)",outline:"none"}}
      />
    </div>
    <div>
      <label style={{fontSize:10,fontWeight:700,textTransform:"uppercase",
        color:"var(--mut)",display:"block",marginBottom:3}}>Outlet</label>
      <select value={repairOutlet} onChange={e => setRepairOutlet(e.target.value)}
        style={{padding:"6px 10px",background:"var(--s2)",border:"1px solid var(--bdr)",
          borderRadius:7,fontSize:12.5,color:"var(--txt)",outline:"none"}}>
        {outletNames.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
    <button
      className="btn btnd"
      style={{borderColor:"var(--red)",color:"var(--red)"}}
      disabled={repairing}
      onClick={async () => {
        if (!confirm(`Re-propagate opening from ${repairDate} for ${repairOutlet}?`)) return;
        setRepairing(true);
        await repairOpeningFromDate(repairOutlet, repairDate);
        setRepairing(false);
      }}
    >
      {repairing ? "Repairing…" : "🔧 Repair Opening"}
    </button>
    <span style={{fontSize:11,color:"var(--mut)",alignSelf:"center"}}>
      Use when a day was skipped and next day shows 0 opening.
    </span>
  </div>
)}

          <div style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:6}}>
            <div className="stabs" style={{flex:1,flexWrap:"wrap"}}>
              {sups.map(s => (
                <button key={s} className={`stab ${supF===s?"act":""}`} onClick={()=>setSupF(s)}>
                  {s==="ALL"?`All (${inv.length})`:`${s.replace(/^\d{4}-/,"")} (${inv.filter(i=>i.supplier===s).length})`}
                </button>
              ))}
            </div>
            {isAdmin && (
              <button className="btn btnd btnsm" style={{flexShrink:0,marginTop:2}}
                onClick={()=>{setSupForm({id:"",name:"",color:"#94a3b8"});setSupModal(true);}}>
                {I.plus} Add Supplier
              </button>
            )}
          </div>

          <div className="ctrls">
            <div className="sbox">{I.search}
              <input placeholder="Search code, name or description…" value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            {isAdmin && (
              <div style={{marginLeft:"auto"}}>
                <button className="btn btng" onClick={()=>{
                  setIForm({code:"",name:"",description:"",type:"Q",
                    supplier:supF!=="ALL"?supF:"2001-DCSL",unitCost:"",sellingPrice:"",qty:0});
                  setTypeInput("Q"); setIModal("add");
                }}>{I.plus} Add Item</button>
              </div>
            )}
          </div>

          <div className="card">
            <div className="chd">
              <div>
                <h3>Inventory Items</h3>
                <p>{filtInv.length} items — {supF==="ALL"?"All Suppliers":supF.replace(/^\d{4}-/,"")}</p>
              </div>
            </div>
            <div style={{overflowX:"auto"}}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>#</th><th>Code</th><th>Name</th><th>Description</th>
                    <th>Type</th><th>Supplier</th><th>Unit Cost</th><th>Selling Price</th><th>Margin</th>
                    {isAdmin && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {filtInv.length===0 && (
                    <tr><td colSpan={10}><div className="empty">No items found.</div></td></tr>
                  )}
                  {supF==="ALL" && groupedInv && groupedInv.map(({supplier, items}) => {
                    const col = allSupColors[supplier] || "#94a3b8";
                    const regularItems = items.filter(i => i.type !== "EM");
                    if (regularItems.length === 0) return null;
                    return (
                      <React.Fragment key={`grp-${supplier}`}>
                        <tr style={{background:"var(--s2)"}}>
                          <td colSpan={isAdmin?10:9} style={{padding:"7px 10px"}}>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <span style={{width:4,height:16,borderRadius:2,background:col,display:"inline-block"}}/>
                              <span style={{fontWeight:700,fontSize:12,color:col,letterSpacing:".04em"}}>
                                {supplier.replace(/^\d{4}-/,"")}
                              </span>
                              <span style={{fontSize:10,color:"var(--mut)",fontFamily:"monospace"}}>{regularItems.length} items</span>
                            </div>
                          </td>
                        </tr>
                        {renderRows(regularItems)}
                      </React.Fragment>
                    );
                  })}
                  {supF!=="ALL" && (() => {
                    const regularItems = filtInv.filter(i => i.type !== "EM");
                    return renderRows(regularItems);
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ══════════ TAB 2 — EMPTY STOCK ══════════ */}
      {invTab==="empty" && (
        // FIX: pass onInventoryChange so Tab 4 gets updated reactively
        <EmptyStockPanel toast_={toast_} isAdmin={isAdmin} onInventoryChange={handleEmptyInventoryChange} />
      )}

      {/* ══════════ TAB 3 — OUTLET INVENTORY ══════════ */}
      {invTab==="outlet" && (
        <OutletInventoryPanel inv={inv} toast_={toast_} allSupColors={allSupColors} adminOutlets={outletNames}/>
      )}

      {/* ══════════ TAB 4 — OUTLET EMPTY INVENTORY ══════════ */}
      {invTab==="outlet-empty" && (
        <OutletEmptyPanel toast_={toast_} />
      )}

      {/* ══════════ TAB 5 — CURRENT STATUS ══════════ */}
{invTab==="status" && (
  <>
    <style>{`
      @media print {
        @page { size: A3 landscape; margin: 8mm; }
        body * { visibility: hidden !important; }
        #cs-print-zone, #cs-print-zone * { visibility: visible !important; }
        #cs-print-zone {
          position: fixed !important;
          top: 0 !important; left: 0 !important;
          width: 100% !important;
          background: #fff !important;
          padding: 8mm !important;
          z-index: 99999 !important;
        }
        .cs-print-title {
          display: block !important;
          font-size: 13px !important;
          font-weight: 700 !important;
          margin-bottom: 6px !important;
          color: #000 !important;
        }
        .cs-tbl {
          width: 100% !important;
          border-collapse: collapse !important;
          font-size: 7.5px !important;
          color: #000 !important;
        }
        .cs-tbl th, .cs-tbl td {
          border: 1px solid #bbb !important;
          padding: 2px 4px !important;
          white-space: nowrap !important;
          color: #000 !important;
        }
        .cs-tbl th {
          background: #f0f0f0 !important;
          font-weight: 700 !important;
        }
        .cs-tbl .rt { text-align: right !important; }
        .cs-tbl .ctag {
          background: #e8e8e8 !important;
          color: #111 !important;
          border-radius: 3px;
          padding: 1px 3px;
          font-family: monospace;
          font-size: 7px;
        }
        .cs-tbl .tpill {
          background: #ddd !important;
          color: #333 !important;
          border-radius: 3px;
          padding: 1px 3px;
          font-size: 7px;
        }
        .cs-wrap::-webkit-scrollbar { display: none; }
    `}</style>

    {/* Controls */}
    <div className="ctrls no-print" style={{marginBottom:14,flexWrap:"wrap",gap:8}}>
      <div className="ff" style={{marginBottom:0}}>
        <label style={{fontSize:10,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",
          color:"var(--mut)",display:"block",marginBottom:3}}>View Mode</label>
        <div style={{display:"flex",gap:4}}>
          {["daily","weekly","monthly"].map(m=>(
            <button key={m} onClick={()=>setCsMode(m)}
              className={`btn btnsm ${csMode===m?"btng":"btnd"}`}
              style={{textTransform:"capitalize"}}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {csMode==="daily" && (
        <div className="ff" style={{marginBottom:0}}>
          <label style={{fontSize:10,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",
            color:"var(--mut)",display:"block",marginBottom:3}}>Date</label>
          <input type="date" value={csDate} onChange={e=>setCsDate(e.target.value)}
            style={{padding:"6px 10px",background:"var(--s2)",border:"1px solid var(--bdr)",
              borderRadius:7,fontSize:12.5,color:"var(--txt)",outline:"none"}}/>
        </div>
      )}
      {csMode==="weekly" && (
        <div className="ff" style={{marginBottom:0}}>
          <label style={{fontSize:10,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",
            color:"var(--mut)",display:"block",marginBottom:3}}>Any Day in Week</label>
          <input type="date" value={csWeekOf} onChange={e=>setCsWeekOf(e.target.value)}
            style={{padding:"6px 10px",background:"var(--s2)",border:"1px solid var(--bdr)",
              borderRadius:7,fontSize:12.5,color:"var(--txt)",outline:"none"}}/>
        </div>
      )}
      {csMode==="monthly" && (
        <div className="ff" style={{marginBottom:0}}>
          <label style={{fontSize:10,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",
            color:"var(--mut)",display:"block",marginBottom:3}}>Month</label>
          <input type="month" value={csMonth} onChange={e=>setCsMonth(e.target.value)}
            style={{padding:"6px 10px",background:"var(--s2)",border:"1px solid var(--bdr)",
              borderRadius:7,fontSize:12.5,color:"var(--txt)",outline:"none"}}/>
        </div>
      )}

      <div className="ff" style={{marginBottom:0}}>
        <label style={{fontSize:10,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",
          color:"var(--mut)",display:"block",marginBottom:3}}>Outlet</label>
        <select value={csOutlet} onChange={e=>setCsOutlet(e.target.value)}
          style={{padding:"6px 10px",background:"var(--s2)",border:"1px solid var(--bdr)",
            borderRadius:7,fontSize:12.5,color:"var(--txt)",outline:"none",minWidth:180}}>
          <option value="ALL">All Outlets</option>
          {outletNames.map(o=><option key={o}>{o}</option>)}
        </select>
      </div>

      <div style={{marginLeft:"auto",fontSize:11,color:"var(--mut)",alignSelf:"flex-end",paddingBottom:2}}>
        {csData.length} items with activity
      </div>
    </div>

    {/* Print zone — only this div is visible when printing */}
    <div id="cs-print-zone">
      <div className="card">
        <div className="chd">
          <div>
            <h3>Current Status</h3>
            <p>
              {csMode==="daily"   && csDate}
              {csMode==="weekly"  && csData[0] ? `${csData[0].csFrom} → ${csData[0].csTo}` : csMode==="weekly" ? "Week" : ""}
              {csMode==="monthly" && csMonth}
              {" · "}{csOutlet==="ALL"?"All Outlets":csOutlet}
            </p>
          </div>
          <button className="btn btnd btnsm no-print" onClick={()=>window.print()}>
            {I.print} Print
          </button>
        </div>

        {/* Scroll arrows */}
        <div className="no-print" style={{display:"flex",justifyContent:"space-between",padding:"4px 2px 2px"}}>
          <button
            onClick={()=>csWrapRef.current?.scrollBy({left:-350,behavior:"smooth"})}
            style={{width:28,height:24,borderRadius:5,border:"1px solid var(--bdr)",
              background:"var(--s2)",color:"var(--txt)",cursor:"pointer",fontSize:15,
              display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
          <button
            onClick={()=>csWrapRef.current?.scrollBy({left:350,behavior:"smooth"})}
            style={{width:28,height:24,borderRadius:5,border:"1px solid var(--bdr)",
              background:"var(--s2)",color:"var(--txt)",cursor:"pointer",fontSize:15,
              display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
        </div>

        {/* Print-only title */}
        <div className="cs-print-title" style={{display:"none"}}>
          Current Status — {csOutlet==="ALL"?"All Outlets":csOutlet} &nbsp;|&nbsp;
          {csMode==="daily" && csDate}
          {csMode==="weekly" && csData[0] ? `${csData[0].csFrom} → ${csData[0].csTo}` : ""}
          {csMode==="monthly" && csMonth}
        </div>

        <div
  ref={csWrapRef}
  className="cs-wrap"
  style={{overflowX:"auto",scrollbarWidth:"none",msOverflowStyle:"none"}}
>
  <table className="cs-tbl">
    <thead>
      <tr>
        <th>#</th>
        <th>Item Code</th>
        <th style={{width:160}}>Description</th>
        <th style={{width:90}}>Item Type</th>
        <th className="rt">Opening Stock</th>
        <th className="rt">Total Purchase</th>
        <th className="rt">In Hand Stock</th>
        <th className="rt">Total Bottle Sale</th>
        <th className="rt">Physical Stock (Rs.)</th>
        <th className="rt">Total Sale (Rs.)</th>
        <th className="rt">Profit (Rs.)</th>
        <th className="rt">Margin</th>
        <th className="rt">Transfer In</th>
        <th className="rt">Transfer Out</th>
        <th className="rt">Return</th>
        <th className="rt">Adj. to Stock</th>
      </tr>
    </thead>
            <tbody>
              {csData.length===0 && (
                <tr><td colSpan={16}><div className="empty">No activity for this period.</div></td></tr>
              )}
              {csData.map((row,idx)=>(
                <tr key={row.id}>
                  <td style={{color:"var(--mut2)",fontSize:11,fontFamily:"monospace",textAlign:"center"}}>{idx+1}</td>
                  <td><span className="ctag">{row.code}</span></td>
                  <td style={{fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:160}}>{row.name}</td>
                  <td style={{textAlign:"center"}}><span className="tpill">{row.type}</span></td>
                  <td className="rt mono">{row.opening ?? "—"}</td>
                  <td className="rt mono">{row.totalPurchase||"—"}</td>
                  <td className="rt mono bold" style={{color:row.inHandStock>=0?"var(--grn)":"var(--red)"}}>
                    {row.inHandStock}
                  </td>
                  <td className="rt mono">{row.totalBottleSale||"—"}</td>
                  <td className="rt mono">
                    Rs.{fmt(row.physicalStockOverride!==""?row.physicalStockOverride:row.physicalStock)}
                  </td>
                  <td className="rt mono cg">Rs.{fmt(row.totalSaleAmt)}</td>
                  <td className="rt mono cg bold">Rs.{fmt(row.profit)}</td>
                  <td className="rt mono">{row.margin!==undefined?`Rs.${fmt(row.margin)}`:"—"}</td>
                  <td className="rt mono cb">{row.transferIn||"—"}</td>
                  <td className="rt mono ca">{row.transferOut||"—"}</td>
                  <td className="rt mono cr">{row.totalReturn||"—"}</td>
                  <td className={`rt mono bold ${row.adjStock<0?"cr":row.adjStock>0?"cg":""}`}>
                    {row.adjStock!==0?`${row.adjStock>0?"+":""}${row.adjStock}`:"—"}
                  </td>
                </tr>
              ))}
            </tbody>
            {csData.length>0&&(
              <tfoot>
                <tr style={{background:"var(--s3)",fontWeight:700}}>
                  <td colSpan={8} className="rt" style={{paddingRight:11,fontSize:11.5}}>Totals:</td>
                  <td className="rt mono bold">
                    Rs.{fmt(csData.reduce((a,r)=>a+Number(r.physicalStockOverride!==""?r.physicalStockOverride:r.physicalStock),0))}
                  </td>
                  <td className="rt mono cg bold">Rs.{fmt(csData.reduce((a,r)=>a+r.totalSaleAmt,0))}</td>
                  <td className="rt mono cg bold">Rs.{fmt(csData.reduce((a,r)=>a+r.profit,0))}</td>
                  <td colSpan={5}/>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  </>
)}
      {/* ── ADD / EDIT ITEM MODAL ── */}
      {iModal && isAdmin && (
        <Modal title={iModal==="add"?"Add New Item":"Edit Item"}
          onClose={()=>{setIModal(null);setTypeInput("");}}
          footer={<>
            <button className="btn btnd" onClick={()=>{setIModal(null);setTypeInput("");}}>Cancel</button>
            <button className="btn btng" onClick={saveItem}>{I.check} {iModal==="add"?"Add":"Save"}</button>
          </>}>
          <div className="fg">
            <div className="ff"><label>Item Code *</label>
              <input value={iForm.code} onChange={e=>setIForm({...iForm,code:e.target.value.toUpperCase()})} placeholder="e.g. D0050"/>
              <div style={{fontSize:10,color:"var(--mut)",marginTop:3}}>Code determines sort order</div>
            </div>
            <div className="ff"><label>Name *</label>
              <input value={iForm.name} onChange={e=>setIForm({...iForm,name:e.target.value})} placeholder="e.g. DES Q"/>
            </div>
            <div className="ff"><label>Description</label>
              <input value={iForm.description||""} onChange={e=>setIForm({...iForm,description:e.target.value})} placeholder="e.g. EXTRA SPECIAL"/>
            </div>
            <div className="ff"><label>Item Type</label>
              <input list="type-suggestions" value={typeInput} onChange={e=>setTypeInput(e.target.value.toUpperCase())}
                placeholder="Q, WINE, RUM…" style={{textTransform:"uppercase"}}/>
              <datalist id="type-suggestions">{allTypes.map(t=><option key={t} value={t}/>)}</datalist>
            </div>
            <div className="ff"><label>Supplier</label>
              <select value={iForm.supplier} onChange={e=>setIForm({...iForm,supplier:e.target.value})}>
                {allSuppliersList.map(s=><option key={s.id} value={s.id}>{s.id} — {s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="fg">
            <div className="ff"><label>Unit Cost (Rs.)</label>
              <input type="number" value={iForm.unitCost} onChange={e=>setIForm({...iForm,unitCost:e.target.value})} placeholder="0.00"/>
            </div>
            <div className="ff"><label>Selling Price (Rs.)</label>
              <input type="number" value={iForm.sellingPrice} onChange={e=>setIForm({...iForm,sellingPrice:e.target.value})} placeholder="0.00"/>
            </div>
            
          </div>
        </Modal>
      )}

      {/* ── PRICE CHANGE MODAL (main inventory) ── */}
      {priceM && isAdmin && (
        <Modal title={`Change Prices — ${priceM.code} ${priceM.name}`} onClose={()=>setPriceM(null)}
          footer={<>
            <button className="btn btnd" onClick={()=>setPriceM(null)}>Cancel</button>
            <button className="btn btng" onClick={()=>{
              si(inv.map(i=>i.id===priceM.id?{...i,unitCost:Number(pf.unitCost),sellingPrice:Number(pf.sellingPrice)}:i));
              toast_("Main prices updated ✓"); setPriceM(null);
            }}>{I.check} Update Main Price</button>
          </>}>
          <div style={{background:"rgba(251,191,36,.07)",borderRadius:6,padding:"8px 12px",marginBottom:10,
            fontSize:11.5,color:"var(--mut)",border:"1px solid rgba(251,191,36,.15)"}}>
            ⚠ Updates the <strong>main inventory</strong> price for all outlets.
            Use <strong>Outlet Inventory</strong> tab to customise per-outlet prices.
          </div>
          <div className="fg">
            <div className="ff"><label>New Unit Cost (Rs.)</label>
              <input type="number" value={pf.unitCost} onChange={e=>setPf({...pf,unitCost:e.target.value})}/>
            </div>
            <div className="ff"><label>New Selling Price (Rs.)</label>
              <input type="number" value={pf.sellingPrice} onChange={e=>setPf({...pf,sellingPrice:e.target.value})}/>
            </div>
          </div>
          {pf.unitCost&&pf.sellingPrice&&Number(pf.unitCost)>0&&(
            <div style={{background:"var(--s2)",borderRadius:6,padding:"9px 11px",fontSize:11.5,border:"1px solid var(--bdr)"}}>
              New margin: <strong style={{color:"var(--gld2)"}}>{(((pf.sellingPrice-pf.unitCost)/pf.unitCost)*100).toFixed(2)}%</strong>
            </div>
          )}
        </Modal>
      )}

      {/* ── ADD / EDIT EMPTY MODAL ── */}
    
      {eModal && isAdmin && (
        <Modal title={eModal==="add"?"Add Empty Type":"Edit Empty"} onClose={()=>setEModal(null)}
          footer={<>
            <button className="btn btnd" onClick={()=>setEModal(null)}>Cancel</button>
            <button className="btn btng" onClick={()=>{
              if(!ef.code||!ef.name||!ef.rate){toast_("Fill all fields","err");return;}
              if(eModal==="add"){
                if(empty.find(e=>e.code===ef.code)){toast_("Code exists","err");return;}
                se([...empty,{...ef,id:ef.code,qty:Number(ef.qty)||0,rate:Number(ef.rate)}]);
              } else { se(empty.map(e=>e.id===eModal.id?{...e,...ef,rate:Number(ef.rate)}:e)); }
              toast_("Saved ✓"); setEModal(null);
            }}>{I.check} Save</button>
          </>}>
          <div className="fg">
            <div className="ff"><label>Code *</label><input value={ef.code} onChange={e=>setEf({...ef,code:e.target.value.toUpperCase()})} placeholder="DEMP1"/></div>
            <div className="ff"><label>Name *</label><input value={ef.name} onChange={e=>setEf({...ef,name:e.target.value})} placeholder="DES EMP"/></div>
            <div className="ff"><label>Rate *</label><input type="number" value={ef.rate} onChange={e=>setEf({...ef,rate:e.target.value})} placeholder="0.00"/></div>
            <div className="ff"><label>Opening Qty</label><input type="number" value={ef.qty} onChange={e=>setEf({...ef,qty:e.target.value})} placeholder="0"/></div>
          </div>
        </Modal>
      )}

      {/* ── ADD SUPPLIER MODAL ── */}
      {supModal && isAdmin && (
        <Modal title="Add New Supplier" onClose={()=>setSupModal(false)}
          footer={<>
            <button className="btn btnd" onClick={()=>setSupModal(false)}>Cancel</button>
            <button className="btn btng" onClick={saveSupplier}>{I.check} Add Supplier</button>
          </>}>
          <div className="fg">
            <div className="ff"><label>Supplier Number *</label>
              <input value={supForm.id} onChange={e=>setSupForm({...supForm,id:e.target.value.replace(/\D/g,"")})} placeholder="e.g. 2019"/>
              <div style={{fontSize:10,color:"var(--mut)",marginTop:3}}>Numbers only — full ID: {supForm.id||"2019"}-{supForm.name||"NAME"}</div>
            </div>
            <div className="ff"><label>Supplier Name *</label>
              <input value={supForm.name} onChange={e=>setSupForm({...supForm,name:e.target.value.toUpperCase()})} placeholder="e.g. NEW SUPPLIER"/>
            </div>
            <div className="ff"><label>Badge Color</label>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <input type="color" value={supForm.color} onChange={e=>setSupForm({...supForm,color:e.target.value})}
                  style={{width:44,height:32,border:"none",background:"none",cursor:"pointer",padding:0}}/>
                <span style={{fontSize:11,color:"var(--mut)"}}>Supplier badge color</span>
              </div>
            </div>
          </div>
          {supForm.name&&(
            <div style={{background:"var(--s2)",borderRadius:6,padding:"9px 12px",fontSize:11,
              border:"1px solid var(--bdr)",color:"var(--mut)",display:"flex",alignItems:"center",gap:10}}>
              Preview:
              <span style={{fontSize:11,fontWeight:600,padding:"2px 9px",borderRadius:10,
                background:`${supForm.color}20`,color:supForm.color,border:`1px solid ${supForm.color}33`}}>
                {supForm.name}
              </span>
              <span>ID: <strong style={{color:"var(--txt)"}}>{supForm.id||"?"}-{supForm.name}</strong></span>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
