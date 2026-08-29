import axios from "axios";
import { API_URL } from "./config";

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(async (config) => {
  if (typeof window === "undefined") {
    try {
      const { headers } = await import("next/headers");
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
