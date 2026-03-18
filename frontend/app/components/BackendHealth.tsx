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
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
        Backend health:{" "}
      </span>
      <span
        className={`text-sm font-medium ${
          status === "ok"
            ? "text-emerald-600 dark:text-emerald-400"
            : status === "error"
              ? "text-red-600 dark:text-red-400"
              : "text-zinc-500 dark:text-zinc-500"
        }`}
      >
        {status === "checking" && "Checking…"}
        {status === "ok" && "Reachable"}
        {status === "error" && "Unreachable"}
      </span>
    </div>
  );
}
