# Privacy Policy Compliance Report (Google Play)

Policy URL reviewed: `https://promethean-games.github.io/par-privacy-policy/`  
HTTP check: `200 OK`  
Date reviewed: 2026-07-08

## Result

The page is reachable, but the current content is **too minimal** for reliable Google Play policy review. It should be expanded before/while updating your Play listing.

## Checklist

- [x] Policy URL is public and accessible
- [ ] Developer/legal entity name and effective date clearly listed
- [ ] Full data inventory (device ID, gameplay data, billing metadata, logs)
- [ ] Clear purposes for each data type
- [ ] Third-party processors disclosed (Google Play Billing)
- [ ] Data retention period and deletion process documented
- [ ] User rights/contact path documented
- [ ] Children/age statement
- [ ] Security statement
- [ ] International transfer statement (if applicable)
- [ ] Change-notice / policy update statement

## Required Changes (High Priority)

1. **Replace generic language** like "may collect minimal user data" with specific data categories.
2. **Add Google Play Billing disclosure** and state payment card data is handled by Google, not your app.
3. **Add retention/deletion policy** for local data and server-side tournament/billing records.
4. **Align wording with Play Data Safety form** (must be consistent, not contradictory).
5. **Add contact + rights workflow** (how users request deletion/access corrections).

## App-Specific Data to Explicitly Disclose

- Local game data: player names, scores, settings.
- Online feature data: room code, tournament entries, score sync payloads.
- Device identifier used for entitlement/trial and device-scoped access.
- Billing verification metadata: purchase token / transaction identifiers, product ID, package/bundle ID, entitlement status.
- Technical logs used for security/troubleshooting (if collected).

## Google Play Alignment Notes

- If Data Safety says you collect device identifiers or app activity, the policy must explicitly mention that.
- If Data Safety says no sharing, the policy should not imply broad sharing.
- If using one-time purchase via Google Play, disclose that billing is processed by Google Play Billing.

## Workspace Updates Already Applied

- Updated in-app privacy copy in `index.html` to reference Google Play Billing and the published policy URL.
- Updated docs to use `https://promethean-games.github.io/par-privacy-policy/` instead of the old URL.

## Next Action

Publish an expanded policy version at the same URL using `PRIVACY_POLICY_TEMPLATE.md` as the source text, then re-check Play Console Data Safety consistency.

