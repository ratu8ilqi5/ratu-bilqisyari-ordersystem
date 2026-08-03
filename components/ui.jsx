"use client";
import { useState } from "react";
import { C } from "@/lib/constants";

export function NeoButton({ children, color = C.midnight, onClick, disabled, full, small, textColor, type = "button" }) {
  const [pressed, setPressed] = useState(false);
  const offset = small ? 6 : 9;
  const shown = pressed ? 3 : offset;
  return (
    <button
      type={type}
      disabled={disabled}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onClick={onClick}
      className={`ff-body font-bold uppercase inline-flex items-center justify-center gap-2 ${full ? "w-full" : ""} ${
        small ? "text-xs px-3 py-2" : "text-sm px-5 py-3"
      } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
      style={{
        background: disabled ? "#ddd" : C.white,
        color: textColor || C.midnight,
        border: `3px solid ${C.midnight}`,
        borderRadius: 0,
        boxShadow: disabled ? "none" : `${shown}px ${shown}px 0px ${color}`,
        transform: pressed ? `translate(${offset - 3}px,${offset - 3}px)` : "translate(0,0)",
        transition: "transform 80ms ease, box-shadow 80ms ease",
      }}
    >
      {children}
    </button>
  );
}

export function NeoCard({ children, accent, style }) {
  return (
    <div
      className="p-4"
      style={{
        background: C.white,
        border: `3px solid ${C.midnight}`,
        borderRadius: 0,
        boxShadow: `9px 9px 0px ${accent || C.midnight}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Badge({ status }) {
  // fills mapped to text colors that are guaranteed readable against each fill
  const map = {
    pending: { bg: C.coffee, text: C.midnight, label: "MENUNGGU REVIEW" }, // butter bg needs dark text
    reviewed: { bg: C.grape, text: C.white, label: "MENUNGGU BAYAR" },
    verified: { bg: C.olive, text: C.coffee, label: "LUNAS" },
  };
  const m = map[status] || map.pending;
  return (
    <span
      className="ff-display text-lg px-3 py-1 inline-block"
      style={{ background: m.bg, color: m.text, border: `2px solid ${C.midnight}`, borderRadius: 0 }}
    >
      {m.label}
    </span>
  );
}
