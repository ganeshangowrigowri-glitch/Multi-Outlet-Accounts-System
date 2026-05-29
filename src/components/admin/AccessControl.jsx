import { useState } from "react";
import { ACCESS_OPTIONS } from "../../data/seeds";
import { I } from "../../utils/icons";

export default function AccessControl({ clerks, setClerks, toast_ }) {
  const [search, setSearch] = useState("");

  const filtered = clerks.filter(c =>
    !search ||
    c.username.toLowerCase().includes(search.toLowerCase()) ||
    (Array.isArray(c.outlets) ? c.outlets.join(" ") : c.outlet || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="ctrls">
        <div className="sbox">{I.search}
          <input placeholder="Search staff…" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <span style={{marginLeft:"auto",fontSize:10.5,color:"var(--mut)"}}>Changes save instantly</span>
      </div>

      <div className="card">
        <div className="chd"><h3>Access Control</h3><p>Set module access per clerk</p></div>
        {filtered.map(c => {
          const outletList = Array.isArray(c.outlets) ? c.outlets : c.outlet ? [c.outlet] : [];
          return (
            <div className="accrow" key={c.id}>
              <div style={{display:"flex",alignItems:"center",gap:9,flex:1,minWidth:0}}>
                <div className="accav">{c.username.slice(0,2).toUpperCase()}</div>
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:12.5}}>
                    {c.username}
                    <span style={{fontWeight:400,color:"var(--mut)",fontSize:11}}> — {c.designation}</span>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:3,marginTop:3}}>
                    {outletList.slice(0,4).map(o => (
                      <span key={o} style={{fontSize:9,fontWeight:600,padding:"1px 5px",borderRadius:8,background:"var(--s3)",color:"var(--mut)"}}>
                        {o}
                      </span>
                    ))}
                    {outletList.length > 4 && (
                      <span style={{fontSize:9,color:"var(--mut2)",padding:"1px 3px"}}>+{outletList.length-4}</span>
                    )}
                  </div>
                </div>
              </div>
              <select className="accsel" value={c.access}
                onChange={e => {
                  setClerks(clerks.map(x => x.id===c.id ? {...x, access:e.target.value} : x));
                  toast_("Access updated ✓");
                }}>
                {ACCESS_OPTIONS.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="empty">No staff found.</div>}
      </div>
    </>
  );
}
