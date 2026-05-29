import { useEffect } from "react";
import { I } from "../../utils/icons";

export default function Toast({ msg, type, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className={`toast ${type === "ok" ? "tok" : "terr"}`}>
      {type === "ok" ? I.check : I.x}{msg}
    </div>
  );
}
