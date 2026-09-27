import React from "react";
import ReactDOM from "react-dom/client";

function Pill() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "rgba(30, 30, 30, 0.95)",
        borderRadius: "48px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontSize: "14px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      VoxFlow Pill
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Pill />
  </React.StrictMode>
);
