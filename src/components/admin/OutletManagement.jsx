import { useState } from "react";
import { I } from "../../utils/icons";

const clerkAtOutlet = (c, o) => {
  const list = Array.isArray(c.outlets) ? c.outlets : c.outlet ? [c.outlet] : [];
  return list.includes(o);
};

export default function OutletManagement({ outlets, onAddOutlet, onDeleteOutlet, clerks, toast_ }) {
  const [newOutlet, setNewOutlet] = useState("");

  async function addOutlet() {
    const n = newOutlet.trim().toUpperCase();
    if (!n) return;
    if (outlets.includes(n)) { toast_("Already exists","err"); return; }
    const result = await onAddOutlet(n);
    if (!result?.ok) { toast_(result?.message || "Failed to save outlet", "err"); return; }
    setNewOutlet("");
    toast_(`"${n}" added ✓`);
  }

  return (
    <>
      <div className="card" style={{marginBottom:12}}>
        <div className="chd"><h3>Add New Outlet</h3></div>
        <div style={{padding:"12px 14px",display:"flex",gap:8}}>
          <input style={{flex:1,padding:"7px 10px",background:"var(--s2)",border:"1px solid var(--bdr)",borderRadius:7,fontSize:12.5,fontFamily:"'Inter',sans-serif",color:"var(--txt)",outline:"none"}}
            value={newOutlet} onChange={e=>setNewOutlet(e.target.value)}
            placeholder="OUTLET NAME" onKeyDown={e=>e.key==="Enter"&&addOutlet()}/>
          <button className="btn btng" onClick={addOutlet}>{I.plus} Add</button>
        </div>
      </div>
      <div className="card">
        <div className="chd"><h3>All Outlets</h3><p>{outlets.length} registered</p></div>
        <div className="ogrid">
          {outlets.map(o => {
            const n = clerks.filter(c => clerkAtOutlet(c, o)).length;
            return (
              <div className="ocard" key={o}>
                <div className="onum">{outlets.indexOf(o)+1}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div className="oname">{o}</div>
                  <div className="osub">{n} clerk{n!==1?"s":""}</div>
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
    </>
  );
}
