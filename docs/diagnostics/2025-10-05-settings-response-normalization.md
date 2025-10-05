# Settings Response Normalization (2025-10-05)

## Summary
GET /api/settings/:key previously returned `undefined` (empty body) when a setting did not exist. This caused the client fetch layer to receive HTTP 200 with an empty (or whitespace-only) body, triggering JSON.parse errors before recent client hardening.

## Change
Route updated in `server/routes.ts` to always return a normalized JSON object:

```jsonc
// When setting exists
{
  "key": "portal_title",
  "value": "پرتال عمومی نماینده",
  "exists": true,
  "updatedAt": "2025-10-05T09:12:34.000Z"
}

// When setting does NOT exist
{
  "key": "some_missing_key",
  "value": null,
  "exists": false
}
```

## Rationale
- Prevent empty-body 200 responses (ambiguous for generic fetch wrappers)
- Enable the UI to distinguish between “missing” vs “present with empty string”
- Avoid reliance on heuristic fallbacks in `apiRequest`.

## Client Impact
Current client logic reading `(setting as any)?.value` continues to work. For missing settings it now gets `null` instead of `undefined` or parse error. Optional enhancement (future): explicitly check `exists` flag to decide default form population.

## Backward Compatibility
No breaking contract for existing consumers expecting a JSON object; undefined → structured object is a soft addition. No consumer (outside current repo) known to depend on empty body semantic.

## Verification Steps
1. Start server and authenticate.
2. Request a known key: `/api/settings/portal_title` → expect `exists: true`.
3. Request a missing key: `/api/settings/does_not_exist` → expect `exists: false`, `value: null`.
4. Load Settings UI; ensure no JSON.parse errors; forms keep defaults.

## Rollback Plan
Revert patch in `server/routes.ts` to previous `res.json(setting);`. Keep client hardening to avoid reintroducing parse spam.

## Related Files
- `server/routes.ts`
- `client/src/lib/queryClient.ts` (empty-body + whitespace tolerance)
- `client/src/pages/settings.tsx`

## Future Enhancements
- Add bulk endpoint `/api/settings?keys=a,b,c` to reduce N requests.
- Add caching layer with ETag/If-None-Match for rarely changing settings.
- Provide setting schema metadata endpoint for dynamic forms.
