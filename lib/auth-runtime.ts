import { createAuthService } from './auth';
import { createAuthHandlers } from './auth-http';
import { authStore } from './auth-store.mjs';

export const authService = createAuthService(authStore);
export const authHandlers = createAuthHandlers(authService);
