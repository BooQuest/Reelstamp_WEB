import 'server-only';
import { unavailableAuth } from './server-errors';

export function googleWebConfig() {
  // Read the existing client ID at runtime in both authorization and code exchange.
  const { NEXT_PUBLIC_GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: clientSecret, GOOGLE_WEB_BFF_SECRET: bffSecret } = process.env;
  if (!clientId || !clientSecret || !bffSecret || !/^[\x21-\x7e]{32,256}$/.test(bffSecret)) {
    throw unavailableAuth();
  }
  return { clientId, clientSecret, bffSecret };
}
