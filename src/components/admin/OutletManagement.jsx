import { useState, useMemo } from "react";
import { I } from "../../utils/icons";
import { AREAS, UNASSIGNED_AREA, AREA_COLORS, getOutletArea, setOutletAreaOverride, groupOutletsByArea } from "../../data/areas";

const clerkAtOutlet = (c, o) => {
  const list = Array.isArray(c.outlets) ? c.outlets : c.outlet ? [c.outlet] : [];
  return list.includes(o);
};

const selStyle = {padding:"7px 10px",background:"var(--s2)",border:"1px solid var(--bdr)",borderRadius:7,fontSize:12.5,fontFamily:"'Inter',sans-serif",color:"var(--txt)",outline:"none"};

export default function OutletManagement({ outlets, onAddOutlet, onDeleteOutlet, clerks, toast_ }) {
  const [newOutlet, setNewOutlet] = useState("");
  const [newArea, setNewArea] = useState("");
  const [areaFilter, setAreaFilter] = useState("All Areas");
  const [, forceRerender] = useState(0); // re-render after a local area override change

  async function addOutlet() {
    const n = newOutlet.trim().toUpperCase();
    if (!n) return;
    if (outlets.includes(n)) { toast_("Already exists","err"); return; }
    const result = await onAddOutlet(n);
    if (!result?.ok) { toast_(result?.message || "Failed to save outlet", "err"); return; }
    if (newArea) setOutletAreaOverride(n, newArea);
    setNewOutlet(""); setNewArea("");
    toast_(`"${n}" added ✓`);
  }

  function changeArea(o, area) {
    setOutletAreaOverride(o, area);
    forceRerender(x => x + 1);
  }

  const visibleOutlets = areaFilter === "All Areas" ? outlets : outlets.filter(o => getOutletArea(o) === areaFilter);
  const grouped = useMemo(() => groupOutletsByArea(visibleOutlets), [visibleOutlets, outlets]);

  return (
    <>
      <div className="card" style={{marginBottom:12}}>
        <div className="chd"><h3>Add New Outlet</h3></div>
        <div style={{padding:"12px 14px",display:"flex",gap:8,flexWrap:"wrap"}}>
          <input style={{flex:1,minWidth:160,...selStyle}}
            value={newOutlet} onChange={e=>setNewOutlet(e.target.value)}
            placeholder="OUTLET NAME" onKeyDown={e=>e.key==="Enter"&&addOutlet()}/>
          <select style={selStyle} value={newArea} onChange={e=>setNewArea(e.target.value)}>
            <option value="">No Area</option>
            {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button className="btn btng" onClick={addOutlet}>{I.plus} Add</button>
        </div>
      </div>
      <div className="card" style={{marginBottom:12}}>
        <div className="chd">
          <h3>All Outlets</h3>
          <p>{outlets.length} registered</p>
        </div>
        <div style={{padding:"12px 14px",display:"flex",alignItems:"center",gap:8}}>
          <label style={{fontSize:11.5,color:"var(--mut)"}}>Area:</label>
          <select style={selStyle} value={areaFilter} onChange={e=>setAreaFilter(e.target.value)}>
            <option value="All Areas">All Areas</option>
            {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>
      {Object.entries(grouped).filter(([,list]) => list.length).map(([area, list]) => (
        <div className="card" style={{marginBottom:12}} key={area}>
          <div className="chd" style={{borderLeft:`3px solid ${AREA_COLORS[area]||"var(--bdr)"}`}}>
          <h3 style={{color:AREA_COLORS[area]||"var(--txt)",display:"flex",alignItems:"center",gap:7}}>
          <span style={{width:7,height:7,borderRadius:"50%",background:AREA_COLORS[area]||"var(--mut)",display:"inline-block",flexShrink:0}}/>
          {area}
          </h3>
         <p>{list.length} outlet{list.length!==1?"s":""}</p>
         </div>
          <div className="ogrid">
            {list.map(o => {
              const n = clerks.filter(c => clerkAtOutlet(c, o)).length;
              return (
                <div className="ocard" key={o}>
                  <div className="onum">{outlets.indexOf(o)+1}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div className="oname">{o}</div>
                    <div className="osub">{n} clerk{n!==1?"s":""}</div>
                    <select style={{...selStyle,marginTop:5,fontSize:10.5,padding:"3px 6px"}}
                      value={getOutletArea(o)} onChange={e=>changeArea(o, e.target.value)}>
                      <option value={UNASSIGNED_AREA}>{UNASSIGNED_AREA}</option>
                      {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <button className="btndel" onClick={async ()=>{
                    if(clerks.some(c=>clerkAtOutlet(c,o))){toast_("Clerks assigned","err");return;}
                    if(!confirm(`Remove "${o}"?`))return;
                    const result = await onDeleteOutlet(o);
                    if (!result?.ok) { toast_(result?.message || "Failed to remove outlet", "err"); return; }
                    toast_("Removed");
                  }}>{I.trash}</button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}