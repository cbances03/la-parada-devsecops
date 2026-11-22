import { authService } from './auth-runtime';
import { createMarketHandlers } from './market-http';
import { marketStore } from './market-store.mjs';

export const marketHandlers = createMarketHandlers(authService, marketStore);
