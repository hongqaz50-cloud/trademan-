/**
 * discordAuthService.ts — Discord OAuth2 and Profile Management
 *
 * Supports:
 * 1. Official Discord OAuth2 Implicit Grant (Client-Side)
 * 2. Profile caching in localStorage (Username, Global Name, Avatar, ID)
 * 3. Quick connect for instant pilot tag synchronization
 */

export interface DiscordUser {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
  discriminator?: string;
}

export const DEFAULT_DISCORD_CLIENT_ID = '1563924967996002406';
export const DISCORD_CLIENT_ID_KEY = 'trademan_discord_client_id';
export const DISCORD_USER_KEY = 'trademan_discord_user';
export const DISCORD_TOKEN_KEY = 'trademan_discord_token';

export function getDiscordClientId(): string {
  try {
    return localStorage.getItem(DISCORD_CLIENT_ID_KEY) || DEFAULT_DISCORD_CLIENT_ID;
  } catch {
    return DEFAULT_DISCORD_CLIENT_ID;
  }
}

export function setDiscordClientId(clientId: string): void {
  try {
    localStorage.setItem(DISCORD_CLIENT_ID_KEY, clientId.trim());
  } catch {
    // Ignore storage errors
  }
}

export function getStoredDiscordUser(): DiscordUser | null {
  try {
    const raw = localStorage.getItem(DISCORD_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredDiscordUser(user: DiscordUser | null): void {
  try {
    if (user) {
      localStorage.setItem(DISCORD_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(DISCORD_USER_KEY);
      localStorage.removeItem(DISCORD_TOKEN_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function getDiscordAvatarUrl(user: DiscordUser): string {
  if (user.avatar) {
    if (user.avatar.startsWith('http')) return user.avatar;
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
  }
  // Default Discord avatar based on ID
  const index = (Math.abs(parseInt(user.id, 10)) || 0) % 5;
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

/** Get the current page origin and path for OAuth redirect URI */
export function getOAuthRedirectUri(): string {
  const origin = window.location.origin;
  const path = window.location.pathname || '/';
  return `${origin}${path.endsWith('/') ? path : path + '/'}`;
}

/** Initiates redirect to Discord OAuth2 authorize endpoint */
export function initiateDiscordLogin(clientId: string = DEFAULT_DISCORD_CLIENT_ID): void {
  const redirectUri = getOAuthRedirectUri();
  const params = new URLSearchParams({
    client_id: (clientId || DEFAULT_DISCORD_CLIENT_ID).trim(),
    redirect_uri: redirectUri,
    response_type: 'token',
    scope: 'identify',
  });
  window.location.href = `https://discord.com/oauth2/authorize?${params.toString()}`;
}

/** Fetch user profile from Discord REST API using access token */
export async function fetchDiscordUserProfile(accessToken: string): Promise<DiscordUser> {
  const res = await fetch('https://discord.com/api/users/@me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Lỗi kết nối Discord API: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/** Check URL hash and search params on page load for Discord OAuth redirect */
export async function handleDiscordAuthCallback(): Promise<{ user: DiscordUser | null; error?: string | null }> {
  const hash = window.location.hash;
  const search = window.location.search;

  const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.substring(1) : hash);
  const searchParams = new URLSearchParams(search.startsWith('?') ? search.substring(1) : search);

  const error = hashParams.get('error') || searchParams.get('error');
  const errorDesc = hashParams.get('error_description') || searchParams.get('error_description');

  if (error) {
    // Clean URL query and hash
    window.history.replaceState(null, '', window.location.pathname);
    if (error === 'access_denied') {
      return { user: null, error: 'Bạn đã từ chối cấp quyền truy cập trên Discord (Access Denied).' };
    }
    return { user: null, error: errorDesc || error };
  }

  const token = hashParams.get('access_token');
  if (!token) return { user: null };

  localStorage.setItem(DISCORD_TOKEN_KEY, token);

  // Clean hash from URL without reloading
  window.history.replaceState(null, '', window.location.pathname);

  try {
    const profile = await fetchDiscordUserProfile(token);
    setStoredDiscordUser(profile);
    return { user: profile };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Failed to fetch Discord profile:', err);
    return { user: null, error: msg };
  }
}
