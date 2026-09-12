# Draft: FixPortal.FixAtdl.React announcement

> Internal draft. This file is intentionally unlinked from public documentation.
> It is visible in the public source repository but is not approved for
> publication, release notes, social media, or customer communication.

We have published `@fix-portal/fixatdl-react`, a React 19 component library
for rendering FIXatdl strategy forms in browser hosts.

The package accepts a host-provided `AtdlStrategyDto` and provides form state,
validation, state-rule evaluation and a `StrategyParametersGrp` preview. It
does not parse uploaded XML, call APIs, authenticate users, persist orders,
submit orders or authoritatively serialize FIX; those remain host and backend
responsibilities.

Install the public package from npm:

```sh
npm install @fix-portal/fixatdl-react
```

It complements the headless .NET
[`FixPortal.FixAtdl`](https://github.com/FixPortal/fixportal-fixatdl) core and
the separate desktop
[`FixPortal.FixAtdl.Wpf`](https://github.com/FixPortal/fixportal-fixatdl-wpf)
adapter. It does not replace either package.

Before publishing this text, confirm the npm release is live, choose approved
channels and wording, and obtain publication approval.
