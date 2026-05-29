import { useState } from "react";
import { I } from "../utils/icons";

export default function Toast({ msg, type, onDone }) {
  useState(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  });
  return (
    <div className={`toast ${type === "ok" ? "t-ok" : "t-err"}`}>
      {type === "ok" ? I.check : I.x}
      {msg}
    </div>
  );
}
