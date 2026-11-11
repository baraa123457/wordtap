# Karpathy's LLM Council Protocol Reference

Reference: [karpathy/llm-council](https://github.com/karpathy/llm-council)

## Background

When solving non-trivial programming and architectural problems, a single LLM response often suffers from:
1. **Model Bias**: Leaning heavily into whatever pattern was most prevalent in training data.
2. **Optimistic Blindness**: Overlooking edge cases, failure states, or production operational burdens.
3. **Local Optima**: Providing a working solution that is subtly fragile or overly complex.

## The Council Mechanism

By structuring the deliberation into three sequential phases, the council eliminates these blind spots:

### 1. Blind First Opinions
Prevents groupthink. Each perspective evaluates the problem without anchoring on the others' outputs.

### 2. Adversarial Peer Review
Forces critical evaluation. Models or personas are notoriously better at critiquing another's solution than noticing flaws in their own.

### 3. Chairman's Synthesis
Avoids decision paralysis. The Chairman extracts the common truth from the consensus and makes the definitive call on disputed points.
