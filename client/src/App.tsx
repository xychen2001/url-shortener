import { useEffect, useState } from "react";

export const App = () => {
  const [status, setStatus] = useState<string>("loading...");

  useEffect(() => {
    fetch("http://localhost:3000/health")
      .then((r) => r.json())
      .then((data) => setStatus(JSON.stringify(data)))
      .catch((err) => setStatus(`error: ${err.message}`));
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-4">
          URL Shortener
        </h1>
        <p className="text-sm text-slate-600">Server health: {status}</p>
      </div>
    </div>
  );
};
