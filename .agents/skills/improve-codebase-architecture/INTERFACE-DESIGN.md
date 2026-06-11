# Interface Design

When the user wants to explore alternative interfaces for a chosen deepening candidate, use this parallel sub-agent pattern. Based on "Design It Twice" (Ousterhout) — your first idea is unlikely to be the best.

Uses the vocabulary in [LANGUAGE.md](LANGUAGE.md) — **module**, **interface**, **seam**, **adapter**, **leverage**.

## When to Use This

Activate this pattern when:
- The grilling loop surfaces **2+ viable seam placements** for the same module.
- The user says "I'm not sure which interface shape is better."
- The deepened module has **3+ distinct caller profiles** with conflicting needs.
- A dependency category change (e.g., in-process to remote) fundamentally alters the interface shape.

Do NOT use this when:
- There is only one obvious interface (proceed straight to implementation).
- The disagreement is about naming or minor syntax rather than structure.

## Process

### 1. Frame the problem space

Before spawning sub-agents, write a user-facing explanation of the problem space for the chosen candidate:

- The constraints any new interface would need to satisfy
- The dependencies it would rely on, and which category they fall into (see [DEEPENING.md](DEEPENING.md))
- A rough illustrative code sketch to ground the constraints — not a proposal, just a way to make the constraints concrete

Show this to the user, then immediately proceed to Step 2. The user reads and thinks while the sub-agents work in parallel.

### 2. Spawn sub-agents

Spawn 3+ sub-agents in parallel using the Agent tool. Each must produce a **radically different** interface for the deepened module.

Prompt each sub-agent with a separate technical brief (file paths, coupling details, dependency category from [DEEPENING.md](DEEPENING.md), what sits behind the seam). The brief is independent of the user-facing problem-space explanation in Step 1. Give each agent a different design constraint:

- **Agent 1**: "Minimize the interface — aim for 1–3 entry points max. Maximise leverage per entry point. **Sacrifice**: Flexibility. If a use case doesn't fit, it's out."
- **Agent 2**: "Maximise flexibility — support many use cases and extension. **Sacrifice**: Simplicity. Accept a larger interface if needed."
- **Agent 3**: "Optimise for the most common caller — make the default case trivial. **Sacrifice**: Uncommon callers may need workarounds or separate configuration."
- **Agent 4 (if applicable)**: "Design around ports & adapters for cross-seam dependencies. **Sacrifice**: Direct performance (due to indirection layers)."

Include both [LANGUAGE.md](LANGUAGE.md) vocabulary and CONTEXT.md vocabulary in the brief so each sub-agent names things consistently with the architecture language and the project's domain language.

Each sub-agent outputs:

1. **Interface**: Types, methods, params, invariants, ordering, and error modes. Include the number of entry points, config knobs, and an estimated learning curve description.
2. **Usage example**: Showing how callers use it.
3. **What the implementation hides**: Details kept behind the seam.
4. **Dependency strategy and adapters**: See [DEEPENING.md](DEEPENING.md).
5. **Trade-offs**: Where leverage is high, and where it's thin.

### 3. Present and compare

Present designs sequentially so the user can absorb each one, then compare them in prose using the comparison framework below.

#### Comparison Framework

For each design, evaluate on these axes:

| Axis | What to assess |
|------|---------------|
| **Depth** | Leverage at the interface — how much behavior per unit of interface? |
| **Locality** | Where does change concentrate? One place or scattered? |
| **Seam placement** | Where is the seam? Does it align with where things actually vary? |
| **Testability** | Can you test at the interface without mocks? What dependency category? |
| **Migration cost** | How many callers change? How risky is the transition? |
| **Deletion test** | If you deleted this module, where does complexity reappear? |

After comparing, give your own recommendation: which design you think is strongest and why. 

#### Hybrid Protocol

If proposing a hybrid:
1. **Name the base**: Which design is the structural foundation?
2. **Name the graft**: Which specific element comes from another design?
3. **Justify the seam**: Does the grafted element sit at a natural seam, or does it create a new one?
4. **Apply the deletion test**: If you deleted the grafted element, does the base still work? (It should.)
5. **Re-evaluate depth**: Is the hybrid deeper or shallower than the base?

Be opinionated — the user wants a strong recommendation, not just a menu of options.

### 4. Return to grilling loop

After the user picks a design (or hybrid):
- Return to the main `SKILL.md` Step 3 (grilling loop) with the chosen interface.
- Update `CONTEXT.md` if the design introduced new domain vocabulary.
- If designs were rejected with load-bearing reasons, offer to record them as an ADR (same protocol as `SKILL.md` Step 3).

## Convergence Handling

If sub-agent designs are substantially similar:
1. **Acknowledge it**: Tell the user "All designs converged, which suggests the problem space is narrow."
2. **Identify the shared core**: What is common across all designs? That is likely the right interface shape.
3. **Don't force divergence**: If the problem has one good answer, accept it. The "Design It Twice" process verified the answer; it just happened to be obvious.

