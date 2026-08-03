"use client";
import { useState } from "react";
import { C, APP_NAME } from "@/lib/constants";
import { NeoButton, NeoCard } from "@/components/ui";
import { IconLock } from "@/components/icons";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      const params = new URLSearchParams(window.location.search);
      window.location.href = params.get("next") || "/admin";
    } else {
      setError("Password salah, coba lagi.");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-20">
      <div className="text-center mb-4">
        <h1 className="ff-display text-3xl" style={{ color: C.grape }}>{APP_NAME}</h1>
        <p className="text-xs opacity-60">Khusus admin</p>
      </div>
      <NeoCard accent={C.grape}>
        <form onSubmit={handleSubmit}>
          <label className="text-xs font-semibold block mb-1">Password Admin</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full mb-3 px-3 py-2"
            style={{ border: `2px solid ${C.midnight}`, borderRadius: 0 }}
            autoFocus
          />
          {error && <p className="text-xs mb-3" style={{ color: C.grape }}>{error}</p>}
          <NeoButton full color={C.grape} disabled={!password || loading} type="submit">
            {loading ? "Memeriksa..." : <><IconLock /> Masuk</>}
          </NeoButton>
        </form>
      </NeoCard>
    </div>
  );
}
