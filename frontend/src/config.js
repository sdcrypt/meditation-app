export const API_BASE_URL = "http://127.0.0.1:8000/api/v1";

export const DEVICE_ID =
  localStorage.getItem("device_id") ||
  (() => {
    const id = Math.floor(Math.random() * 1000000);
    localStorage.setItem("device_id", id);
    return id;
  })();
