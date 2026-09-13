import axios from "axios";
import { API_URL } from "../apis/config";

const api = axios.create({
  baseURL: API_URL.endsWith("/api") ? API_URL : `${API_URL}/api`,
  withCredentials: true,
  timeout: 90000,
  headers: {
    "Content-Type": "application/json",
  },
});

export { api };
export default api;
