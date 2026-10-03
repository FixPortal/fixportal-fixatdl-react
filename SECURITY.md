# Security policy

Report suspected vulnerabilities privately through [GitHub Security Advisories](https://github.com/FixPortal/fixportal-fixatdl-react/security/advisories/new).

Only the latest npm release is supported. The supported consumer floor is Node
22+ with React and React DOM 19.2+. The relevant surfaces are externally supplied
strategy definitions, rule evaluation and user-entered values. Broker text is rendered
as React text. Hosts must validate strategy definitions and submitted values on the
server; browser validation and FIX previews are deliberately incomplete.

Please allow time to investigate and release a fix before public disclosure.
