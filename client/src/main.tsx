import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initConnection } from "./services/room";
import { redirectOffIpAddress } from "./utils/hostRedirect";
import "./index.css";

redirectOffIpAddress().then((redirecting) => {
  if (redirecting) return;
  initConnection();
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
