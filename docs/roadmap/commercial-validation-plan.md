# FRAME/12 Studio — Agent Review Kit: Commercial Validation & Architecture Boundary Plan

> **Document Type:** Internal Product Strategy & Validation Plan for Review — **Not an Implementation Commitment**  
> **Candidate Product:** *FRAME/12 Studio — Agent Review Kit*  
> **Open-Source Counterpart:** `@frame12/agent-review-console` (planned free MIT `registry:block` with deterministic local fixtures)  
> **Baseline Release:** `v0.2.0` (`271c1fb`)

---

## 1. Purpose & Non-Commitment Boundary

This document defines how we will evaluate whether **FRAME/12 Studio — Agent Review Kit** warrants engineering investment as an optional commercial product.

1. **Strategy document only:** Nothing in this document represents shipped software, a public promise, or an approved implementation commitment.
2. **Open-source core remains self-sufficient:** The existing 31 MIT components, 3 MIT application blocks (`DeveloperConsole`, `WorkspaceSettings`, `AnalyticsDashboard`), and the planned open-source `agent-review-console` block (`registry:block` with local fixtures) remain permanently free under the MIT License. Nobody needs to purchase any commercial kit to use FRAME/12.
3. **Evidence before engineering:** No billing system, private registry, or proprietary codebase will be built unless customer discovery and willingness-to-pay (WTP) validation pass the go/no-go gates defined below.

---

## 2. Commercial Opportunity Evaluation

### 2.1 Target Customer

- **Primary Persona:** Senior full-stack/AI engineers, founding engineers, and technical leads at seed-to-Series B AI-native startups or internal platform teams (2–25 engineers) building **agentic workflows with privileged tool execution** (e.g., database mutations, infrastructure deployments, financial/billing actions, outbound customer communications, or code merges).
- **Technical Stack:** Next.js App Router / React 19 + TypeScript, using agent orchestration frameworks or tool protocols such as the Vercel AI SDK, LangGraph, MCP tool servers, or custom durable execution queues.
- **Buyer Trigger:** The team is moving an agent workflow from an internal demo (where tool calls auto-execute or rely on a toy client-side button) to a production environment where human-in-the-loop (HITL) operator review, auditability, and tamper-resistant approval state are mandatory.

### 2.2 Problems the Target Customer Currently Faces

1. **Client-Side Approval Theatre:** Many teams wire up a React "Approve / Reject" button that simply resumes a client callback without binding the approval on a trusted server to a cryptographic digest of the exact tool name, schema version, and arguments—leaving the workflow vulnerable to payload mutation, stale-state approval, or replay.
2. **Event-Stream Fragmentation:** Every agent runtime (AI SDK `toolCall` streams, LangGraph interrupt checkpoints, MCP tool invocations) emits different streaming shapes, partial JSON states, and cancellation signals. Normalizing these into a deterministic timeline and review queue takes weeks of glue code.
3. **Edge-Case State Management:** Production human-in-the-loop queues require durable state transitions (`PENDING -> APPROVED | REJECTED | EXPIRED | REVOKED -> EXECUTED`), TTL expiration handling, duplicate-click/idempotency protection, and concurrent operator conflict resolution.
4. **High-Noise, Low-Hierarchy UI:** Default dashboard templates bury critical approval parameters inside generic cards or raw JSON dumps, increasing operator fatigue and the risk of rubber-stamping destructive tool calls.

### 2.3 Existing Alternatives

| Alternative | Strengths | Limitations |
| :--- | :--- | :--- |
| **Build in-house on raw `shadcn/ui` + custom API routes** | Zero license cost; full control. | Typically takes 2–4 engineering weeks to design the review UI, normalize streaming events, build version-bound server state, and write security/idempotency tests. |
| **Open-source `@frame12/agent-review-console` (planned MIT block)** | Free, MIT-licensed, distinctive FRAME/12 comic/storyboard hierarchy, deterministic local fixtures. | Intentionally scoped as a frontend `registry:block` with local fixtures; does not include production event-stream adapters, server-enforced approval persistence, or security test harnesses. |
| **Hosted observability platforms (LangSmith, Braintrust, Arize, Humanloop)** | Turnkey hosted trace logging and evals. | SaaS subscription lock-in, external data residency concerns, and UI that cannot be embedded natively into the customer's own product or internal control plane. |
| **Generic workflow engines (Temporal / Inngest / Trigger.dev UI)** | Strong durable execution primitives on the backend. | Provide generic developer dashboards rather than an embeddable, operator-grade human-in-the-loop review interface with version-bound payload verification. |

### 2.4 Differentiation

**FRAME/12 Studio — Agent Review Kit** would differentiate on two axes simultaneously:

1. **Visual & Cognitive Clarity (The FRAME/12 Storyboard Grammar):** Sequential cut numbering (`C-01` Active Approval Gate -> `C-02` Execution Trace Timeline -> `C-03` Argument Diff & Blast Radius), asymmetric chamfered hero framing, and strict single-marker-yellow discipline (`AWAITING OPERATOR APPROVAL`) direct operator attention to the exact destructive parameters under review.
2. **Server-Enforced Approval Integrity (Beyond Frontend Templates):** Unlike pure aesthetic UI kits, the commercial kit would pair the FRAME/12 review interface with a reference server verification layer, tested framework adapters, and an automated security/idempotency test suite.

---

## 3. Minimum Credible Commercial Product (MCCP) Scope

To be worth paying for—while keeping maintenance bounded—the **Minimum Credible Commercial Product** must not be "more static React mockups." It must solve the integration and security boundary between the open-source UI and a real backend.

### Candidate Capabilities (Research Candidates Subject to Validation)

1. **Tested Event-Stream Adapters:**
   - Normalized TypeScript adapters translating live agent tool-call interrupts and streaming steps into the FRAME/12 review data contract (starting with the 1–2 most requested runtimes validated in customer interviews, e.g., Vercel AI SDK and MCP tool calls).
2. **Reference Backend for Version-Bound Approvals:**
   - Server-side handlers/modules that compute a canonical SHA-256 digest over `(toolName, toolVersion, canonicalJsonArgs, runId)` when an approval request is created, and verify that the operator's signed/authenticated approval decision matches that exact digest before releasing execution.
3. **Durable Approval State Machine:**
   - Enforced server state transitions (`PENDING -> APPROVED | REJECTED | EXPIRED | REVOKED -> EXECUTED`) with storage adapter interfaces (e.g., Postgres / Drizzle / Prisma / Upstash Redis reference implementations).
4. **Replay & Duplicate-Action Protection:**
   - Idempotency keys, atomic compare-and-swap transitions, and single-use execution tokens so concurrent operator clicks or network retries cannot trigger double execution.
5. **Expiration & Revocation Handling:**
   - Configurable TTL windows on pending tool calls and operator revocation prior to downstream execution.
6. **Automated Integration & Security Test Suite:**
   - Vitest/Playwright verification suite testing payload tampering rejection (`409 Conflict`), expired approval rejection (`410 Gone`), duplicate execution prevention, and unauthorized actor rejection (`403 Forbidden`).
7. **End-to-End Reference Workflows & Production Integration Docs:**
   - Complete runnable Next.js App Router reference app plus threat-model and auth-boundary documentation.

---

## 4. Security, Maintenance, Scope & Cost Assessment

### 4.1 Security & Maintenance Responsibilities

> [!WARNING]
> **Server-Side Enforcement Mandate:** Security-sensitive approvals must **always** be enforced by a trusted server, never solely by a client-side React component.

Selling a security-adjacent workflow kit carries explicit ongoing responsibilities that must be factored into the go/no-go decision:

- **Clear Threat-Model Disclaimer:** Documentation must explicitly state that the customer is responsible for their own authentication/authorization provider (e.g., Clerk, Auth.js, Better Auth, custom session middleware) and database infrastructure; the kit provides reference server enforcement patterns and source code, not a managed security guarantee or SOC2-hosted service.
- **Upstream Agent Framework Churn:** AI SDKs and agent frameworks evolve rapidly. Supporting 5+ frameworks would create unsustainable maintenance drag; the MCCP must cap adapter support to **at most 1–2 validated runtimes** at launch.
- **Security Patch SLA:** If a flaw is discovered in the reference approval-verification logic, customers must receive a clear advisory and updated registry/repo release promptly.

### 4.2 Estimated Implementation Scope (If Approved After Validation)

Assuming the open-source `v0.3`/`v0.4` primitives (`CommandPalette`, `Drawer`, `CodeBlock`, `TraceTimeline`, `ApprovalGate`) and the free `@frame12/agent-review-console` block already exist:

| Workstream | Estimated Effort (1 Senior Engineer) | Notes |
| :--- | :--- | :--- |
| **1. Server-Enforced Approval State Machine & Digest Verification** | ~5–7 engineering days | Canonical payload hashing, atomic state transitions, TTL expiration, idempotency tokens, and storage interface. |
| **2. Live Framework Event-Stream Adapters (1–2 Runtimes)** | ~4–6 engineering days | Streaming tool-call pause/resume adapters + deterministic fallback mocks. |
| **3. Automated Security & Integration Test Suite** | ~3–4 engineering days | Tamper, replay, race-condition, expiration, and E2E Playwright approval tests. |
| **4. Reference App, Threat-Model Docs & Private Delivery Setup** | ~3–4 engineering days | End-to-end Next.js reference workflow, integration guide, and authenticated registry/repo setup. |
| **Total Estimated MCCP Build Scope** | **~3–4 weeks (15–21 engineering days)** | Strictly gated on completing customer validation first. |

### 4.3 Potential Delivery & Support Costs

- **Infrastructure Cost:** Near zero (`< \$20/month`) if delivered via a separate private GitHub repository and/or a lightweight authenticated static/edge `shadcn` registry worker.
- **Payment Processing / Merchant of Record:** Standard transaction fees (e.g., Polar.sh, Lemon Squeezy, or Stripe at `~3%–5% + \$0.30–\$0.50` per transaction) if commercial checkout is ever enabled.
- **Support Load Risk:** The largest hidden cost is **framework-specific debugging support** from buyers trying to wire custom backends. Mitigation: sell as **self-contained, well-tested source code with explicit framework version bounds** and issue-tracker support rather than open-ended consulting or SLA support.

---

## 5. Willingness-to-Pay (WTP) Validation Approach & Pricing Hypotheses

### 5.1 Pricing Hypotheses to Test (Not Approved Public Prices)

During customer discovery interviews, we will test the following one-time license hypotheses (positioned against the cost of 2–4 weeks of senior engineering time to build equivalent UI + server approval infrastructure):

| License Tier Hypothesis | Test Price Hypothesis | Target Buyer & Scope Under Evaluation |
| :--- | :--- | :--- |
| **Individual Developer (Initial Test Hypothesis)** | **`\$99` one-time** | Solo builders, indie hackers, or individual engineers prototyping/shipping an agentic application. |
| **Individual / Standard Price Hypothesis** | **`\$149` one-time** | Standard single-developer commercial license if customer interviews confirm strong demand for the server-enforced approval backend and framework adapters. |
| **Team License (Separate Investigation)** | **Investigate separately during discovery** | Multi-developer engineering teams (e.g., up to 10–25 engineers in one organization) who need shared repository access, team token access, and commercial invoice support. |

> [!NOTE]
> The figures above (`\$99` initial individual test price, `\$149` possible standard price, and separate team licensing investigation) are **internal validation hypotheses only**. Do not publish a pricing page or checkout flow until validation gates are met.

### 5.2 Four-Step Validation Protocol

1. **Ship & Measure the Free Baseline First:**
   - Monitor adoption of the existing 3 MIT blocks (`DeveloperConsole`, `WorkspaceSettings`, `AnalyticsDashboard`) and community feedback on the `v0.3`/`v0.4` roadmap via GitHub Discussions (`Agentic UI & Production Workflows`).
2. **Conduct 10–15 Structured Technical Discovery Interviews:**
   - Interview engineers actively building AI agent interfaces or internal developer consoles.
   - Ask non-leading questions about their current human-in-the-loop approval architecture:
     - *How do you currently pause an agent run for human approval and verify the arguments weren't modified before execution?*
     - *How much engineering time did your team spend building trace inspection and tool approval UI/backend logic?*
     - *Which runtime (Vercel AI SDK, LangGraph, MCP, custom queue) emits your tool-call events?*
3. **Van Westendorp / Direct Price-Sensitivity Check:**
   - Present the exact MCCP scope (open-source `agent-review-console` UI stays free under MIT; **FRAME/12 Studio — Agent Review Kit** adds tested stream adapters, version-bound server approval state machine, replay/expiration protection, and security test suite) and test reactions at the `\$99` individual and `\$149` standard price points, plus team licensing expectations.
4. **Go / No-Go Decision Gate Before Writing Commercial Code:**
   - **GO Criteria:** At least **5 qualified developers/teams** confirm they have an active production need for server-enforced agent approvals on a shared runtime (e.g., Vercel AI SDK + Next.js) and express concrete willingness to purchase at the `\$99–\$149` individual level (or team equivalent).
   - **NO-GO / PIVOT Criteria:** If developers only want the visual React components and prefer to write their own bespoke backend logic, **do not build the commercial backend kit**—keep focus on growing the open-source MIT component and block ecosystem.

---

## 6. Clean Repository & Private Registry Boundary Architecture (Section 7 Recommendation)

**No private registry or commercial code is being built now.** If and only if the Go criteria in Section 5.2 are met in the future, commercial distribution must follow a strict physical and licensing separation from the open-source repository:

### 6.1 Repository & Deployment Separation

1. **Keep `lbrodie11/frame12` 100% Open Source (MIT):**
   - Never commit proprietary code, license-key validators, billing webhooks, or gated components into the public `lbrodie11/frame12` repository.
   - All public `@frame12/*` registry manifests (`site/public/r/*.json`) remain static, unauthenticated, and MIT-licensed on `https://frame12.dev/r/{name}.json`.
2. **Separate Private Repository & Independent Deployment:**
   - Any future commercial extensions must live in a dedicated private repository (e.g., `frame12-studio`) deployed to an independent origin or subdomain (e.g., `https://studio.frame12.dev/r/{name}.json`).

### 6.2 Compatibility with Official `shadcn` Private Registry Authentication

Per the official `shadcn` registry authentication specification ([`https://ui.shadcn.com/docs/registry/authentication`](https://ui.shadcn.com/docs/registry/authentication)), the `shadcn` CLI natively supports authenticated private namespaces alongside public namespaces inside a consumer's `components.json` without custom CLI wrappers:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "registries": {
    "@frame12-studio": {
      "url": "https://studio.frame12.dev/r/{name}.json",
      "headers": {
        "Authorization": "Bearer ${FRAME12_STUDIO_LICENSE_KEY}"
      }
    }
  }
}
```

- **Why this boundary works cleanly:**
  - The public `@frame12` namespace remains registered globally in `https://ui.shadcn.com/r/registries.json` with zero authentication required (`npx shadcn@latest add @frame12/sheet`).
  - A future commercial kit in `@frame12-studio` can declare `registryDependencies` that reference open-source `@frame12/*` primitives (`@frame12/sheet`, `@frame12/panel`, `@frame12/dialog`) while serving its proprietary server-adapter and workflow files over standard Bearer-token header authentication.
  - Open-source users never encounter auth prompts, environment variables, or commercial upsells when using `@frame12`.
