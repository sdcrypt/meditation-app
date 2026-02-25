export const getToken = () => {
  const token = localStorage.getItem("token");
  console.log("[auth] getToken called, token present:", !!token);
  return token;
};

export const setToken = (token) => {
  console.log("[auth] setToken called, token length:", token ? token.length : 0);
  localStorage.setItem("token", token);
};

export const logout = () => {
  console.log("[auth] logout called, removing token");
  localStorage.removeItem("token");
};

export const isAuthenticated = () => {
  const authenticated = !!getToken();
  console.log("[auth] isAuthenticated called, result:", authenticated);
  return authenticated;
};
