import axios from "axios";

const BASE = process.env.REACT_APP_BACKEND_URL;

export const api = axios.create({
  baseURL: `${BASE}/api`,
  timeout: 60000,
});

export const getQuiz = (category) => api.get(`/quiz/${category}`).then((r) => r.data);

export const submitQuiz = (payload) =>
  api.post(`/quiz/submit`, payload).then((r) => r.data);

export const getRecommendations = (payload) =>
  api.post(`/recommendations`, payload).then((r) => r.data);

export const getIngredients = (category, dosha) =>
  api.get(`/ingredients/${category}/${dosha}`).then((r) => r.data);

export const getDoshaMeta = () => api.get(`/dosha/meta`).then((r) => r.data);
