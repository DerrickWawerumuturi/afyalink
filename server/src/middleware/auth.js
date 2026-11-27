import crypto from 'node:crypto';
import { ApiError, unauthorized } from '../errors.js';
import { asyncHandler } from '../http.js';

function parseJwt(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return {
      header,
      payload,
      signingInput: `${parts[0]}.${parts[1]}`,
      signature: Buffer.from(parts[2], 'base64url'),
    };
  } catch {
    return null;
  }
}

function claimsAreValid(payload) {
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp !== undefined && payload.exp <= now) return false;
  if (payload.nbf !== undefined && payload.nbf > now + 30) return false;
  if (payload.role === 'anon' || payload.role === 'service_role') return false;
  return true;
}

function verifyHs256(token, secret) {
  const parsed = parseJwt(token);
  if (!parsed || parsed.header.alg !== 'HS256') return null;
  const expected = crypto.createHmac('sha256', secret).update(parsed.signingInput).digest();
  const signature = parsed.signature;
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(signature, expected)) return null;
  if (!claimsAreValid(parsed.payload)) return null;
  return parsed.payload;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function verifyWithSupabase(token, url, anonKey) {
  const endpoint = `${url.replace(/\/+$/, '')}/auth/v1/user`;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response;
    try {
      response = await fetch(endpoint, {
        headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      if (attempt === 0) {
        await sleep(200);
        continue;
      }
      throw new ApiError(503, 'AUTH_UNAVAILABLE', 'Authentication service is unavailable');
    }

    if (response.status >= 500) {
      if (attempt === 0) {
        await sleep(200);
        continue;
      }
      throw new ApiError(503, 'AUTH_UNAVAILABLE', 'Authentication service is unavailable');
    }
    if (!response.ok) return null;

    let user;
    try {
      user = await response.json();
    } catch {
      return null;
    }
    if (!user || !user.id) return null;
    if (user.role === 'anon' || user.role === 'service_role') return null;
    return { sub: user.id, email: user.email, role: user.role };
  }
  return null;
}

export async function verifyToken(token) {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (url && anonKey) return verifyWithSupabase(token, url, anonKey);

  const secret = process.env.SUPABASE_JWT_SECRET;
  if (secret) return verifyHs256(token, secret);

  throw new ApiError(503, 'AUTH_NOT_CONFIGURED', 'Authentication is not configured');
}

export const requireAuth = asyncHandler(async (request, _response, next) => {
  const header = request.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw unauthorized('Authentication required');

  const claims = await verifyToken(token);
  if (!claims || !claims.sub) throw unauthorized('Invalid or expired token');

  request.user = { id: claims.sub, email: claims.email };
  next();
});
