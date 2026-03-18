# UX Frameworks

> **TL;DR:** Beyond Nielsen's 10: use the Honeycomb (useful, usable, desirable, findable, accessible, credible, valuable) for holistic evaluation, and the HEART framework (Happiness, Engagement, Adoption, Retention, Task success) for metrics.

## Core Principles

### Why Multiple Frameworks?
No single framework covers every angle of UX evaluation. Nielsen's 10 heuristics (see [Nielsen's 10](../heuristics/nielsen-10.md)) focus on usability -- whether users can complete tasks efficiently and without error. But usability is only one facet:
- A usable product can fail if it's not **useful** (solves the wrong problem)
- A useful, usable product can fail if it's not **desirable** (users don't want to use it)
- A desirable product can fail if it's not **findable** (users can't discover features)
- All of the above can fail if there's no **value** (business can't sustain it)

Each framework below illuminates different dimensions. Choose based on what you need to evaluate and what data you have.

### Framework Landscape
| Framework | Created by | Best for | Input needed |
|-----------|-----------|----------|-------------|
| UX Honeycomb | Peter Morville (2004) | Holistic product evaluation | Expert review |
| HEART | Google (Kerry Rodden et al., 2010) | Quantitative UX metrics | Analytics + surveys |
| SUS | John Brooke (1986) | Quick usability benchmarking | 10-question survey |
| PURE | Robier, 2016 | Evaluating persuasive design | Expert review |
| Nielsen's 10 | Jakob Nielsen (1994) | Heuristic usability evaluation | Expert review |

## Concrete Rules

### 1. Peter Morville's UX Honeycomb

The seven facets of user experience, each evaluated independently:

**Useful** -- Does it solve a real problem?
- The product addresses a validated user need
- Features map to user goals (not stakeholder wish lists)
- Core use case is completable within the product
- Measure: task completion rates for primary use cases should exceed **80%**

**Usable** -- Can users accomplish their goals efficiently?
- Primary tasks completable in **3 steps or fewer** where possible
- Error rate below **5%** for common tasks
- Time-on-task within **2x the expert benchmark** for new users
- Apply Nielsen's 10 heuristics here

**Desirable** -- Do users want to use it?
- Visual design creates positive emotional response (see [Aesthetic-Usability Effect](../foundations/aesthetic-usability.md))
- Brand identity is consistent and intentional
- Micro-interactions provide delight at key moments
- Measure: NPS above **30** indicates desirability; above **50** is excellent

**Findable** -- Can users find what they need?
- Navigation labels match user mental models (validated by card sorting)
- Search returns relevant results in the **top 3 listings** for common queries
- Key features discoverable within **2 clicks** from any page
- Information architecture passes the "trunk test" (users can identify where they are, where they can go, and how to get back)

**Accessible** -- Can all users access it regardless of ability?
- Meets **WCAG 2.1 AA** at minimum (4.5:1 contrast, keyboard navigation, screen reader support)
- Works with assistive technologies (screen readers, voice control, switch devices)
- Responsive across device sizes and input methods
- No information conveyed by color alone

**Credible** -- Do users trust it?
- Professional visual design (the aesthetic-usability effect builds trust)
- Transparent data practices (clear privacy policy, visible security indicators)
- Social proof present where appropriate (reviews, testimonials, user counts)
- Error-free content (typos and broken links destroy credibility)
- Response time under **3 seconds** (slow sites feel untrustworthy)

**Valuable** -- Does it deliver value to the business and user?
- Users achieve their goal (user value)
- Business metrics are met (revenue, engagement, conversion)
- The intersection of user value and business value is the product's sustainable sweet spot
- If user value and business value conflict, prioritize user value for long-term success

**How to use the Honeycomb:**
1. Rate each facet on a 1-5 scale based on evidence (not opinion)
2. Identify the weakest facet -- that's your highest-priority improvement area
3. A product that scores 3+ on all seven facets is generally sound
4. A score of 1-2 on any single facet is a critical issue, regardless of other scores

### 2. Google's HEART Framework

HEART is designed for **quantitative** UX measurement at scale. It uses a Goals-Signals-Metrics (GSM) process:

**Step 1: Define Goals** -- What UX outcome do you want?
**Step 2: Identify Signals** -- What user behavior indicates progress toward that goal?
**Step 3: Choose Metrics** -- How do you measure that signal?

| Category | What it measures | Example Goal | Example Signal | Example Metric |
|----------|-----------------|-------------|----------------|----------------|
| **Happiness** | Satisfaction, ease | Users find the app easy | Survey responses | SUS score, NPS, CSAT |
| **Engagement** | Depth of involvement | Users interact regularly | Feature usage frequency | DAU/MAU ratio, sessions/user/week |
| **Adoption** | New user uptake | New users complete onboarding | Onboarding completion | % new users completing setup in 7 days |
| **Retention** | Users coming back | Users stay beyond trial | Return visits | Week-1 retention rate, churn rate |
| **Task success** | Efficiency/effectiveness | Users complete core task | Task completion | Completion rate, time-on-task, error rate |

**Concrete benchmarks:**
- **DAU/MAU ratio:** above **20%** is healthy for most apps; above **50%** is exceptional (social media tier)
- **Week-1 retention:** above **40%** is good; above **60%** is excellent
- **Task completion rate:** above **80%** is acceptable; above **95%** for critical flows (checkout, sign-up)
- **NPS:** above **0** is acceptable; above **30** is good; above **50** is excellent
- **CSAT (1-5 scale):** above **4.0** is good; above **4.5** is excellent

**Rules for HEART:**
1. Don't measure all 5 categories -- pick **2-3** most relevant to your current stage
2. Early-stage products: focus on **Adoption** and **Task Success**
3. Growth-stage products: focus on **Engagement** and **Retention**
4. Mature products: focus on **Happiness** and **Retention**
5. Each metric must have a **target number** and a **measurement cadence** (weekly/monthly)

### 3. System Usability Scale (SUS)

A 10-question survey scored 0-100. Quick, cheap, validated across thousands of studies.

**The 10 questions** (each rated 1-5, Strongly Disagree to Strongly Agree):
1. I think that I would like to use this system frequently
2. I found the system unnecessarily complex
3. I thought the system was easy to use
4. I think that I would need the support of a technical person to use this system
5. I found the various functions in this system were well integrated
6. I thought there was too much inconsistency in this system
7. I would imagine that most people would learn to use this system very quickly
8. I found the system very cumbersome to use
9. I felt very confident using the system
10. I needed to learn a lot of things before I could get going with this system

**Scoring:**
- Odd-numbered questions: score = response - 1
- Even-numbered questions: score = 5 - response
- Sum all 10 scores, multiply by 2.5
- Result is 0-100

**Interpreting SUS scores:**

| Score | Percentile | Grade | Interpretation |
|-------|-----------|-------|---------------|
| 80+ | Top 10% | A | Excellent -- users love it |
| 68-80 | Above average | B-C | Good -- above industry average |
| 51-67 | Below average | D | OK -- usability issues present |
| Below 51 | Bottom 15% | F | Poor -- significant problems |

**The magic number: 68.** This is the average SUS score across hundreds of studies. Above 68 = above average usability. Below 68 = below average.

**Rules for SUS:**
1. Administer **after** the user has completed at least one task (not cold)
2. Minimum **12-14 respondents** for a reliable score (Tullis & Stetson, 2004)
3. Don't modify the questions -- the scoring formula depends on exact wording
4. Run SUS at regular intervals (quarterly) to track usability over time
5. Compare against your own baseline, not just the 68 average

### 4. PURE Method (Pragmatic Usability Rating by Experts)

A structured expert evaluation that assigns severity scores. More rigorous than ad-hoc review, less resource-intensive than user testing.

**The PURE dimensions:**
1. **Persuasiveness** -- Does the design motivate the desired action?
2. **Usability** -- Can users complete tasks without difficulty?
3. **Relevance** -- Is the content/functionality relevant to the user's goal?
4. **Efficiency** -- Can users accomplish goals with minimal effort?

**Scoring each issue found:**
- **0** -- No problem
- **1** -- Cosmetic problem (fix if time allows)
- **2** -- Minor problem (low priority fix)
- **3** -- Major problem (high priority fix)
- **4** -- Catastrophic (must fix before launch)

**Rules for PURE:**
1. Evaluate with **3-5 experts** independently, then merge findings
2. Any issue rated **3-4 by 2+ experts** is a confirmed critical issue
3. Focus on task flows, not individual screens
4. Document each issue with: location, description, severity, recommendation

## CSS/Implementation Patterns

### Honeycomb: Quick Credibility Checklist (CSS)
```css
/* Professional typography = credibility */
body {
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 1rem;             /* 16px minimum */
  line-height: 1.5;
  color: #1a1a1a;              /* Not pure black */
  -webkit-font-smoothing: antialiased;
}

/* Consistent spacing = perceived quality */
:root {
  --space-unit: 0.5rem;        /* 8px base unit */
}

/* Links that signal trustworthiness */
a {
  color: #1a56db;
  text-decoration: underline;  /* Visible links = findable */
  text-underline-offset: 2px;
}

a:visited {
  color: #6b21a8;              /* Differentiate visited = findable */
}

/* Clear interactive states = usable */
button:focus-visible,
a:focus-visible {
  outline: 2px solid #1a56db;
  outline-offset: 2px;
}

/* Accessible color contrast */
.text-secondary {
  color: #525252;              /* 7.4:1 on white = AAA */
}

.text-tertiary {
  color: #737373;              /* 4.6:1 on white = AA */
}
```

### HEART: Engagement Signals via CSS Animation Hooks
```css
/* Track meaningful interactions with data attributes
   that analytics tools can capture */

/* Feature discovery indicator */
[data-feature-new]::after {
  content: "";
  display: inline-block;
  width: 8px;
  height: 8px;
  background: #ef4444;
  border-radius: 50%;
  margin-left: 6px;
  vertical-align: super;
}

/* First-use highlight for adoption tracking */
.first-use-highlight {
  animation: pulse-highlight 2s ease-in-out;
  border-radius: 8px;
}

@keyframes pulse-highlight {
  0%, 100% { box-shadow: none; }
  50% { box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3); }
}

/* Task completion feedback for task success */
.task-complete {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: #f0fdf4;
  border: 1px solid #86efac;
  border-radius: 8px;
  color: #166534;
  animation: slide-in 300ms ease-out;
}

@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

## Common Mistakes

1. **Using frameworks as checklists instead of thinking tools** -- frameworks structure analysis, they don't replace it. Going through the Honeycomb mechanically without considering how the facets interact misses the point.

2. **Measuring everything in HEART** -- Google explicitly warns against this. Pick 2-3 HEART categories that align with your current business goals. Measuring all 5 creates data overload.

3. **Treating SUS as a usability test** -- SUS measures *perceived* usability, not *actual* usability. A product can score 80+ and still have undiscovered problems. Pair SUS with task-based testing.

4. **Comparing SUS scores across different products** -- SUS is most valuable when tracking the *same* product over time. Cross-product comparison is unreliable because context differs.

5. **Skipping the Goals step in HEART** -- jumping straight to metrics without defining goals leads to vanity metrics. Always start with: "What user experience outcome do we want?"

6. **Ignoring the "Valuable" facet** -- the Honeycomb's "Valuable" is often skipped because it feels like a business concern. But a product that delivers no business value will be defunded, no matter how usable it is.

7. **Expert-only evaluation** -- the Honeycomb, PURE, and Nielsen's 10 are expert methods. They find *predictable* problems. Real users find *unpredictable* ones. Always complement expert review with actual user testing.

8. **One-time assessment** -- frameworks are most valuable when used repeatedly to track progress. A single Honeycomb audit is useful; quarterly audits are transformative.

## Decision Tree

**"Which UX framework should I use?"**

```
What do you need to evaluate?
│
├── Overall product quality (holistic view)
│   --> UX Honeycomb
│   When: product planning, major redesign, stakeholder alignment
│   Input: expert review of each facet, supplemented by user data
│   Output: radar chart of 7 facets, weakest facet = priority
│
├── Quantitative UX metrics (data-driven)
│   --> HEART Framework
│   When: you have analytics data, need to set KPIs, track UX over time
│   Input: analytics, surveys, A/B test results
│   Process: Goals --> Signals --> Metrics for each HEART category
│   Output: dashboard with 2-3 key UX metrics and targets
│
├── Quick usability benchmark (fast, cheap)
│   --> SUS (System Usability Scale)
│   When: after usability testing, comparing design iterations,
│         need a single number to report to stakeholders
│   Input: 10-question survey from 12+ users
│   Output: score 0-100 (68 = average)
│
├── Expert usability review (no users available)
│   --> PURE Method or Nielsen's 10
│   When: pre-launch review, design critique, limited budget
│   Input: 3-5 experts evaluate independently
│   Output: prioritized list of issues with severity ratings
│
└── Not sure
    Start with:
    1. SUS survey (quick baseline number)
    2. Honeycomb assessment (find the weakest facet)
    3. HEART setup for the weakest facet (measure improvement)
```

**"What stage is my product in, and what should I measure?"**

```
Product stage?
│
├── Pre-launch / MVP
│   Framework: Honeycomb (expert review)
│   Focus: Useful, Usable, Findable
│   Skip: Retention, Engagement metrics (too early)
│   Key question: "Does this solve the right problem
│   in a way users can navigate?"
│
├── Early (0-6 months, finding fit)
│   Framework: HEART (Adoption + Task Success)
│   Focus: Are new users completing the core task?
│   Metrics: onboarding completion %, task success rate
│   Supplement: SUS after usability sessions
│
├── Growth (6-18 months)
│   Framework: HEART (Engagement + Retention)
│   Focus: Are users coming back and going deeper?
│   Metrics: DAU/MAU, week-1 retention, features per session
│   Supplement: Honeycomb check on Desirable + Credible
│
└── Mature (18+ months)
    Framework: HEART (Happiness + Retention)
    Focus: Are long-term users satisfied?
    Metrics: NPS, churn rate, SUS trend line
    Supplement: Full Honeycomb audit annually
```

## Sources

- Morville, P. (2004). *User Experience Design.* Semantic Studios. semanticstudios.com/user_experience_design/
- Rodden, K., Hutchinson, H., & Fu, X. (2010). *Measuring the User Experience on a Large Scale: User-Centered Metrics for Web Applications.* CHI 2010.
- Brooke, J. (1986). *SUS: A "Quick and Dirty" Usability Scale.* In P. W. Jordan et al. (Eds.), Usability Evaluation in Industry.
- Sauro, J. (2011). *A Practical Guide to the System Usability Scale.* Measuring Usability LLC.
- Tullis, T. S., & Stetson, J. N. (2004). *A Comparison of Questionnaires for Assessing Website Usability.* Usability Professionals Association Conference.
- Bangor, A., Kortum, P., & Miller, J. (2009). *Determining What Individual SUS Scores Mean: Adding an Adjective Rating Scale.* Journal of Usability Studies, 4(3), 114-123.
- Nielsen, J. (1994). *10 Usability Heuristics for User Interface Design.* Nielsen Norman Group.

---

*Related: [Nielsen's 10 Heuristics](../heuristics/nielsen-10.md) | [Design Review Checklist](../workflows/design-review-checklist.md)*
