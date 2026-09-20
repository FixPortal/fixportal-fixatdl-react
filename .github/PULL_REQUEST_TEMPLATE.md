## Summary

<!-- What changed, and why does a consumer need it? -->

## Verification

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run test:coverage`
- [ ] `npm run build`
- [ ] Distribution gates and workspace checks run when applicable

## Contract impact

- [ ] No public API or DTO change
- [ ] Public API/DTO change is documented in `README.md` and `docs/api.md`
- [ ] `CHANGELOG.md` and migration notes updated when consumer behavior changes

## Safety

- [ ] No credentials, broker data, or generated local artifacts are included
- [ ] Documentation states any host/backend responsibility introduced by this change
