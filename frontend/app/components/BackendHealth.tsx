"use client";

import { useEffect, useState } from "react";

const API_URL = "http://localhost:8000";

export function BackendHealth() {
  const [status, setStatus] = useState<"checking" | "ok" | "error">("checking");

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((res) => (res.ok ? setStatus("ok") : setStatus("error")))
      .catch(() => setStatus("error"));
  }, []);

  return (
    <p className="text-xs text-[var(--foreground)]/40">
      API {status === "ok" ? "connected" : status === "error" ? "offline" : "…"}
    </p>
  );
}
