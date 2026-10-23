# Security review checklist

The reviewer reads this file in every batch review, and in a slice review when the diff touches auth, permissions, input parsing, queries, file paths, secrets, or calls to outside services. Check each item on the changed code paths only. Tag findings `security`.

- **Identity and permission:** every new route, handler, job, and query checks the caller's identity and permission on the server; queries filter by tenant or owner.
- **Input:** untrusted input is validated at the boundary (schema, type, size) before use.
- **Injection:** queries use parameters or the query builder; shell commands pass input as arguments, never interpolated into a command string; HTML output is escaped; input never reaches eval or a template compiler.
- **Paths:** a path built from input is resolved and kept under an allowed root.
- **Secrets:** secrets come from the environment or the secret store, and stay out of code, logs, client bundles, and error messages.
- **Outbound calls:** a URL or host from input is checked against an allowlist; calls have timeouts; TLS verification stays on.
- **Data exposure:** responses and logs carry only the fields the caller may see; personal data stays out of logs.
- **Sessions and crypto:** standard libraries only; cookies are HttpOnly, Secure, and SameSite; state-changing requests carry CSRF protection where cookies authenticate.
- **New dependencies:** maintained, pinned in the lockfile, and needed.

Severity: P0 = proven exploitable; P1 = likely exploitable or a missing check on a sensitive path; P2 = hardening.
