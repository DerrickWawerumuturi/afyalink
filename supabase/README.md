# Database ownership — Dev 2

The schema contract is in the root README. No database has been provisioned or migrated. `migrations/` and `seed.sql` are placeholders.

Create a reviewed migration using the team's installed Supabase CLI (`supabase migration new initial_schema`) and document the pinned CLI version, exact target, prerequisites and apply/reset commands here. Review current CLI help before hosted operations. Use a development project; keep connection strings private.

Implement constraints, indexes, timestamps, trusted provider memberships and RLS for exposed schemas. Configure a least-privilege Express database role and enforce ownership in the API. Test cross-user access denial and confirmation transactions. Populate only fictional providers/items/listings and demo user references; never seed real patient records or credentials. Add repeatable seed instructions and counts once implemented.
