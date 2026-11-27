import { ApiError, forbidden } from '../errors.js';
import { query } from '../db/pool.js';
import { asyncHandler } from '../http.js';

export const requireProvider = asyncHandler(async (request, _response, next) => {
  const result = await query(
    `SELECT pm.provider_id, p.name, p.type, p.location, p.verified
       FROM provider_memberships pm
       JOIN providers p ON p.id = pm.provider_id
      WHERE pm.user_id = $1
      ORDER BY pm.provider_id`,
    [request.user.id],
  );

  if (result.rowCount === 0) throw forbidden('Provider access denied');

  const selected = request.get('x-provider-id');
  let membership;
  if (result.rowCount === 1) {
    membership = result.rows[0];
    if (selected && selected !== membership.provider_id) throw forbidden('Provider access denied');
  } else {
    if (!selected) {
      throw new ApiError(
        400,
        'PROVIDER_REQUIRED',
        'x-provider-id header is required for users with multiple providers',
      );
    }
    membership = result.rows.find((row) => row.provider_id === selected);
    if (!membership) throw forbidden('Provider access denied');
  }

  request.provider = {
    id: membership.provider_id,
    name: membership.name,
    type: membership.type,
    location: membership.location,
    verified: membership.verified,
  };
  next();
});
