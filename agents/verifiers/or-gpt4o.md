---
model: gpt-4o
env: |
  OPENAI_BASE_URL=https://openrouter.ai/api/v1
---

Verifier scoring backend for llm-as-a-verifier runs.

Chosen on measured evidence, 20260827. The bridge preflight demands more than
"returns logprobs": it needs >= 3 distinct A-T score-token letters at both
<score_A> and <score_B>, and a canary where an obviously-good trace outranks an
obviously-bad one.

Passed:  gpt-4o        coverage A=16 B=9, canary good 0.622 vs bad 0.036, margin 0.586
Failed:  gpt-4o-mini, gpt-4.1, gpt-4.1-mini, gpt-4.1-nano — each returns rich raw
         top_logprobs but collapses to 1 letter at the score tokens, canary margin 0.
Failed:  zai/glm-5.3, openrouter/deepseek-chat, nahcrof deepseek-v4-flash and
         deepseek-v4-pro — no logprobs at all.
Rejected: Cloudflare Workers AI returns logprobs, but its model ids look like
         @cf/vendor/model and the verifier ref grammar accepts at most one "/".

The model id is written bare because the profile ref grammar strips a provider
prefix; OpenRouter resolves bare gpt-4o to openai/gpt-4o. The env block is a
complete backend door, so no pi provider entry is needed.

Cost note: about 72 scoring calls per 3-candidate run with the code-change criteria.
