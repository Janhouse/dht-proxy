## Vulnerability triage (osv-scanner.toml)

`[[IgnoredVulns]]` in `osv-scanner.toml` are NOT_AFFECTED decisions: CI
(sbom-tools-action/scan) reports them to dtrack-panel, which marks them
NOT_AFFECTED in Dependency-Track for this repo's own dependencies. They do not
expire on their own. When you change code that uses a package listed there
(new call sites, new input reaching it, a version bump), re-check that the
reason still holds, and update or remove the entry. Start the reason with a
CycloneDX justification when one fits, e.g.
`reason = "code_not_reachable: we never parse untrusted XML"`.
