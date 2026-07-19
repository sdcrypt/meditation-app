export const isUnauthorized = (response) => response.status === 401 || response.status === 403;

export const sessionExpiredMessage = "Your session has expired. Please sign in again.";
