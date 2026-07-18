import axios from "axios";

const BASE = process.env.REACT_APP_BACKEND_URL;

export const api = axios.create({
  baseURL: `${BASE}/api`,
  timeout: 120000,
});

// Intake
export const getIntakeSchema = (category) =>
  api.get(`/intake/${category}`).then((r) => r.data);

export const submitIntake = (payload) =>
  api.post(`/intake/submit`, payload).then((r) => r.data);

// Uploads
export const uploadSelfie = (sessionId, file) => {
  const fd = new FormData();
  fd.append("session_id", sessionId);
  fd.append("file", file);
  return api
    .post(`/upload/selfie`, fd, { headers: { "Content-Type": "multipart/form-data" } })
    .then((r) => r.data);
};

export const uploadLabReport = (sessionId, file) => {
  const fd = new FormData();
  fd.append("session_id", sessionId);
  fd.append("file", file);
  return api
    .post(`/upload/lab-report`, fd, { headers: { "Content-Type": "multipart/form-data" } })
    .then((r) => r.data);
};

// Free hook
export const getFreeHook = (payload) =>
  api.post(`/free-hook`, payload).then((r) => r.data);

// Payments
export const createPaymentLink = (payload) =>
  api.post(`/payments/create-link`, payload).then((r) => r.data);

export const verifyPayment = (session_id, reference_id) =>
  api.post(`/payments/verify`, { session_id, reference_id }).then((r) => r.data);

export const getPaymentStatus = (session_id) =>
  api.get(`/payments/status/${session_id}`).then((r) => r.data);

// Report
export const getFullReport = (payload) =>
  api.post(`/report/full`, payload).then((r) => r.data);

// Session state
export const getSessionState = (session_id) =>
  api.get(`/session/${session_id}/state`).then((r) => r.data);
