---
name: llm-council
description: "Run multi-perspective 'LLM Council' deliberation and peer-reviewed consensus on complex decisions, architectural trade-offs, critical bug diagnoses, or feature designs. Inspired by Andrej Karpathy's 3-stage council: Stage 1 (Diverse independent expert perspectives), Stage 2 (Rigorous peer review, ranking, and cross-critique), and Stage 3 (The Chairman's final synthesized verdict and action plan). Use whenever the user asks to 'ask the council', 'council review', 'deliberate', 'get a second opinion', or wants multi-model/multi-perspective peer review."
---

# LLM Council Skill

This skill implements Andrej Karpathy's **3-Stage LLM Council** deliberation protocol inside Antigravity. It transforms single-perspective reasoning into a structured, adversarial peer review by a panel of distinct experts, culminating in a definitive Chairman's synthesis.

---

## When to Activate

Trigger this protocol when:
- The user explicitly says **"ask the council"**, **"council review"**, **"deliberate this"**, or **"get the council's opinion"**.
- Evaluating high-stakes architectural choices (e.g., database selection, state management, auth architecture, migration strategy).
- Analyzing difficult bugs with conflicting explanations or hard-to-reproduce symptoms.
- Designing major product features where trade-offs between UX, performance, and complexity must be balanced.

---

## The 3-Stage Council Protocol

Whenever the council is convened, execute the following 3 stages systematically:

### Stage 1: First Opinions (Diverse Council Members)

Convene 4 distinct, senior specialist personas. Each member analyzes the user's prompt independently without seeing the others' opinions:

1. **🏛️ The Systems Architect (Pragmatism & Simplicity)**
   - Prioritizes boring, proven solutions, maintainability, minimal dependencies, and long-term tech debt reduction.
   - Core question: *"What is the simplest architecture that will actually survive in production for 3 years?"*

2. **⚡ The Performance & Systems Engineer (Speed & Scalability)**
   - Analyzes latency, throughput, concurrency, resource allocation, caching boundaries, and computational overhead.
   - Core question: *"Where are the bottlenecks, data serialization costs, and scaling cliffs?"*

3. **🎨 The Product & Developer Experience Champion (Ergonomics & Velocity)**
   - Evaluates developer ergonomics, API clarity, time-to-market, end-user feedback loops, and intuitive design.
   - Core question: *"Is this easy to build, read, maintain, and delightful for end-users?"*

4. **🛡️ The Adversarial Skeptic & Security Auditor (Edge Cases & Failure Modes)**
   - Actively tries to break the proposals. Hunts for race conditions, auth bypasses, edge cases, partial failure states, and hidden operational costs.
   - Core question: *"How will this catastrophically fail in production at 3:00 AM?"*

---

### Stage 2: Peer Review & Cross-Critique

In this stage, the council members review and challenge each other's proposals:

* **Blind Scoring & Ranking:** Rate each perspective (1–10) on:
  - *Technical Feasibility*
  - *Risk / Blind Spots*
  - *Long-Term Viability*
* **Direct Point-Counterpoint:**
  - Where do Members A and B clash? (e.g., Simplicity vs. Premature Optimization)
  - What fatal assumptions did Member C overlook that Member D caught?
  - Identify the trade-offs that cannot be avoided.

---

### Stage 3: The Chairman's Final Verdict & Action Plan

The **Council Chairman** synthesizes the entire deliberation into a single, cohesive decision:

1. **The Consensus:** Points where all members unanimously agreed.
2. **The Debate Resolution:** How the key disputes were decided and why certain compromises were chosen.
3. **The Final Verdict:** Clear, unambiguous recommendation.
4. **Actionable Implementation Steps:** Concrete, step-by-step instructions or code to implement the decision immediately.

---

## Output Formatting Template

Present the council's session in a structured, readable markdown format:

```markdown
# 🏛️ The LLM Council Convened
**Subject:** [Topic or Question]

---

### Stage 1: First Opinions
#### 🏛️ The Systems Architect
[Core opinion & proposed strategy]

#### ⚡ The Performance Engineer
[Analysis on bottlenecks, latency, and scaling]

#### 🎨 The DX & Product Lead
[Developer ergonomics & usability view]

#### 🛡️ The Adversarial Skeptic
[Attack vectors, hidden risks, and edge cases]

---

### Stage 2: Peer Review & Cross-Critique
| Member | Feasibility (1-10) | Risk Assessment | Key Objection |
| :--- | :--- | :--- | :--- |
| **Architect** | ... | ... | ... |
| **Performance** | ... | ... | ... |
| **DX/Product** | ... | ... | ... |
| **Skeptic** | ... | ... | ... |

**Key Tensions & Debates:**
- *Architect vs Performance:* [Summary of disagreement]
- *Skeptic's Challenge:* [Critical vulnerability identified]

---

### Stage 3: Chairman's Final Verdict
**The Verdict:** [Direct answer / recommendation]

**Why this won:**
- [Reason 1]
- [Reason 2]

**Next Steps / Implementation Plan:**
1. [Action step 1]
2. [Action step 2]
```
