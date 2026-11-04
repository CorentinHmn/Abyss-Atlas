# ADR 0004 — AI provider

Status: Accepted
Date: 2026-11-04
Deciders: founder

## 1. Context
- The AI assistant suggests mappings, joins and rules; every suggestion is accepted or rejected by a person
  (`docs/00-vision.md` principle 6, UC-016).
- What is sent: project metadata only (target definitions, source tables and columns, rules). Atlas holds no
  customer data, so none can be sent.
- Constraints: processing in the EU; no training on customer inputs; one more sub-processor for customers to accept.

## 2. Options considered
| Option | Pros | Cons |
|---|---|---|
| **Claude (Anthropic) on Amazon Bedrock, EU region** | Strong reasoning on structured and SQL-like tasks; EU region; Bedrock terms exclude training on inputs; AWS is also used for the worker (ADR 0006), so no extra sub-processor. | AWS is US-headquartered (CLOUD Act, as for Vercel and Supabase). |
| Mistral (EU company) | European company, EU hosting. | To be benchmarked on mapping tasks; one more sub-processor. |
| Azure OpenAI, EU region | EU region, widely accepted by large enterprises. | One more sub-processor; US-headquartered. |

## 3. Decision
**Claude on Amazon Bedrock**, in an EU region (Frankfurt), with inference kept inside the EU.

1. All calls go through one **AI gateway** in `apps/web` (and the worker for batch jobs). No other component calls
   the provider.
2. The gateway is provider-neutral: changing provider or model is a configuration change, not a refactor.
3. AI is **off by default**; an Admin turns it on for the organization.
4. The gateway logs metadata of each call (organization, user, size, duration), never the prompt or the answer.
5. Usage is limited per organization (quotas), to keep costs under control.

## 4. Consequences
- Positive: one cloud vendor for AI and the worker; EU processing; provider can be swapped.
- Negative: model costs grow with usage, so quotas and possibly a paid add-on are needed; the AWS terms (no
  training, no retention of prompts) must be checked in the data processing agreement before launch.

## 5. Follow-up decisions
- Quotas per tier, and whether AI is included in all tiers or sold as an add-on.
- A small benchmark of real mapping tasks before launch, to choose the model.
