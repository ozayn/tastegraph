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
    <p className="text-[11px] tracking-wide text-[var(--muted-subtle)]">
      API {status === "ok" ? "connected" : status === "error" ? "offline" : "…"}
    </p>
  );
}
