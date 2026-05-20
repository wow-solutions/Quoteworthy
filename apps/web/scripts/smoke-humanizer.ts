// Smoke test for humanizer lib (skips DB / auth).
// Run: bun --env-file=.env.local apps/web/scripts/smoke-humanizer.ts

import { humanizeText } from "../lib/humanizer";

const INPUT = `Most AI projects inside service businesses fail. The tech is not the problem.

It is not just about the tools, it is about asking the right starting question. "What AI tool should we use?" is where projects go to stall — it skips past the only thing that matters: where in this specific business does AI move a real number?

I saw this clearly inside Xiaomi's service network, which serves as a testament to the transformative potential of focused engineering. With 90 people, 18 centers, and 80% of the warranty repair market in our category, we had no shortage of ideas. Chatbots, ticket routing, automated customer comms — additionally, every project that survived started with a concrete answer to that question.

In conclusion, the future looks bright for organizations that can navigate this evolving landscape.`;

const t0 = Date.now();
const result = await humanizeText(INPUT);
const ms = Date.now() - t0;

console.log("=== INPUT ===");
console.log(INPUT);
console.log("\n=== OUTPUT ===");
console.log(result.text);
console.log("\n=== USAGE ===");
console.log(`time:            ${ms}ms`);
console.log(`input tokens:    ${result.usage.input_tokens}`);
console.log(`output tokens:   ${result.usage.output_tokens}`);
console.log(`cache create:    ${result.usage.cache_creation_input_tokens}`);
console.log(`cache read:      ${result.usage.cache_read_input_tokens}`);

const cost =
  (result.usage.input_tokens * 3 +
    result.usage.cache_creation_input_tokens * 3.75 +
    result.usage.cache_read_input_tokens * 0.3 +
    result.usage.output_tokens * 15) /
  1_000_000;
console.log(`cost:            $${cost.toFixed(4)}`);
