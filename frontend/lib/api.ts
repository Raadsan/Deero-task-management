import axios from "axios";
import { headers } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7003";

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 8000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(async (config) => {
  if (typeof window === "undefined") {
    try {
      const cookieHeader = (await headers()).get("cookie");
      if (cookieHeader) {
        config.headers = config.headers ?? ({} as any);
        (config.headers as any).Cookie = cookieHeader;
      }
    } catch {
      // headers() unavailable outside a request context
    }
  }
  return config;
});

export default api;
