# Security Policy

## Reporting a Vulnerability

If you believe you have discovered a security vulnerability or security-sensitive issue within InquireX, please report it privately rather than opening a public issue:

- Use GitHub's [Private Vulnerability Reporting](https://github.com/BhaskaraRao-Aerupilli/InquireX/security/advisories/new), **or**
- Email the maintainer at **bhaskararao1012005@gmail.com** with details and, if possible, a reproducible proof-of-concept.

We aim to acknowledge reports within 48 hours and work with you on a resolution before any public disclosure.

## Threat Model & Deployment Architecture

InquireX is an **autonomous agentic deep research engine and intelligence platform that operators run in their chosen environment (local or cloud).** Understanding the intended deployment model avoids duplicate reports for behavior that is by design.

### Backend & Endpoint Security

The InquireX backend server (FastAPI, WebSocket `/ws`, and REST endpoints) includes built-in authentication and session guards using Supabase PostgreSQL, Bcrypt salted password hashing, and stateless JWT tokens.

When deploying InquireX in public or multi-user environments:
- Operators must configure secure JWT secrets (`JWT_SECRET`) and Supabase service credentials in `.env`.
- Production deployments should sit behind a TLS reverse proxy (e.g. Nginx, Caddy, Cloudflare) with rate limiting and strict CORS origins.
- Endpoint exposure for MCP tool servers: MCP server commands and configurations are intended for trusted administrative operators. Do not expose MCP server configuration endpoints to unauthenticated users.

The following are considered **operator configuration responsibilities**:
- Running the application with default/insecure environment secrets in a public network.
- Granting arbitrary MCP command execution access to untrusted external callers.
- Unrestricted outbound network access in sensitive sandboxed environments where SSRF controls are required at the firewall/gateway level.

### In-Scope Vulnerabilities

We treat the following as high-priority, in-scope security vulnerabilities:

- **Cross-site scripting (XSS) / Unsafe rendering** of untrusted web content (e.g. scraped website content, academic paper PDFs, or LLM-synthesized tokens) in the InquireX frontend.
- **Denial of Service (DoS)** or resource exhaustion triggered by untrusted web payloads (e.g. decompression bombs or malicious HTML structures during scraping).
- **Authentication / Session bypass** in the JWT verification, cookie handling, or Supabase auth workflows.
- **Path traversal, arbitrary file disclosure, or remote code execution** triggered by user research inputs.
- **Vulnerabilities in pinned core dependencies** that can be triggered through normal research execution.

Reports in these categories are highly valued — please submit them via the private reporting channels above.

## Supported Versions

Security updates and patches are actively applied to the latest release on the `main` branch. Please ensure your report is reproducible on the latest `main` commit.
