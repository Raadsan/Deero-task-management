"use client";

import { Toaster } from "react-hot-toast";

export default function AppToaster() {
  return (
    <Toaster
      position="top-right"
      reverseOrder={false}
      gutter={14}
      containerClassName="app-toast-container"
      toastOptions={{
        duration: 4000,
        className: "app-toast",
        style: {
          minWidth: "360px",
          maxWidth: "420px",
          borderRadius: "12px",
          padding: "16px 20px",
          fontSize: "14px",
          fontWeight: 500,
          lineHeight: "1.45",
          border: "none",
        },
        success: {
          className: "app-toast app-toast-success",
          iconTheme: {
            primary: "#16a34a",
            secondary: "#ecfdf5",
          },
        },
        error: {
          className: "app-toast app-toast-error",
          iconTheme: {
            primary: "#dc2626",
            secondary: "#fef2f2",
          },
        },
      }}
    />
  );
}
