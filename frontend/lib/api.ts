import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add interceptor to handle auth tokens if needed in the future
api.interceptors.request.use((config) => {
  // You can add logic here to add headers like Authorization
  return config;
});

export default api;
