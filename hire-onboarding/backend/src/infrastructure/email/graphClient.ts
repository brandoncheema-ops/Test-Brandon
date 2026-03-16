import { Client } from '@microsoft/microsoft-graph-client';
import { getEnv } from '../../config/env';
import { getLogger } from '../../config/logger';
import { ExternalServiceError } from '../../shared/errors';

const logger = getLogger('graph-client');

// =============================================================================
// Microsoft Graph API Client
// Uses client credentials flow (app-only) for daemon/service access.
// =============================================================================

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Acquires an access token using client credentials flow.
 * Caches the token and refreshes before expiry.
 */
async function getAccessToken(): Promise<string> {
  const now = Date.now();

  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }

  const env = getEnv();
  const tokenUrl = `https://login.microsoftonline.com/${env.AZURE_TENANT_ID}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    client_id: env.AZURE_CLIENT_ID,
    client_secret: env.AZURE_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ExternalServiceError('Azure AD', `Token request failed: ${response.status} ${errorText}`);
    }

    const data: TokenResponse = await response.json();
    cachedToken = {
      token: data.access_token,
      expiresAt: now + data.expires_in * 1000,
    };

    logger.debug('Azure AD access token acquired');
    return cachedToken.token;
  } catch (error) {
    if (error instanceof ExternalServiceError) throw error;
    throw new ExternalServiceError('Azure AD', `Failed to acquire token: ${(error as Error).message}`);
  }
}

/**
 * Creates a Microsoft Graph client using app-only authentication.
 */
export function getGraphClient(): Client {
  return Client.init({
    authProvider: async (done) => {
      try {
        const token = await getAccessToken();
        done(null, token);
      } catch (error) {
        done(error as Error, null);
      }
    },
  });
}
