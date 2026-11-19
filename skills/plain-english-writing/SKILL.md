---
name: plain-english-writing
description: Writes prose in plain English that someone outside the team understands on first read - everyday words, translated abbreviations and jargon, consequences over mechanisms, short. Use when writing any prose a person will read - status updates, reports, summaries, analyses, artifact text, documentation, explanations - especially when the source material contains abbreviations, internal status codes, or domain jargon
---

# Plain-English Writing

Readers of your prose are rarely the people who produced the source data. Write so someone outside the team understands it on first read, and keep it short.

## The Recipe

Every piece of prose you produce is:

1. **Plain words.** Everyday English instead of technical shorthand. Translate internal or domain terms into what they mean for the reader: "has merge conflicts", not "CONFLICTING"; "rounding to whole seconds", not "bucket quantization".
2. **Expanded notation.** Every abbreviation, internal metric name, or statistical shorthand from the source appears in reader terms: "a 3σ spike" becomes "an unusually large spike". Common metric labels the reader already uses, such as p50 or p99, stay as they are. Keep the number, translate the label.
3. **Consequences, not mechanisms.** After any technical fact, say what it means for the reader ("checkout stayed up, but the slowest requests took longer"), not only what happened internally.
4. **Short.** A few short sentences beat a paragraph. Trim headers, section notes, and footers the same way. Cut anything that doesn't change what the reader knows or does next.

If the source text is jargon-dense, the output matching this recipe will look very different from the source. That is the point - never mirror the source's vocabulary just because it's precise.

## Example

Source notes:

```
p99 +40ms post-deploy. RCA: conn pool exhaustion during GC pauses. SLO burn 3x.
```

Prose:

> After the deploy, p99 latency rose by 40 ms. The cause was the database connection pool running out during garbage-collection pauses, so the slowest requests waited for a free connection. At this rate we use up our reliability budget three times faster than planned.

## Exceptions

Text that acts as an identifier or has a fixed voice stays verbatim: code, commands, quoted text, stable titles/keys, and paste-ready messages written in someone else's voice.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Copying "RCA", "SLO" from source notes | "the cause was", "our reliability target" |
| Defining jargon in parentheses but leading with it | Lead with the plain phrase; drop the jargon term entirely unless the reader must search for it |
| Explaining the mechanism in full | One clause of mechanism, then the consequence |
| Long intro/outro sentences around a short core | Start at the fact; stop when the facts stop |

## Before You Finish

Re-read the draft once. Translate or cut any abbreviation or internal term the reader wouldn't use, and drop any sentence that doesn't change what the reader knows or does next.
