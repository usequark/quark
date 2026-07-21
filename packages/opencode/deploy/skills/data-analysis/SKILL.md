---
name: data-analysis
description: Analytics interpretation, trend detection, performance reporting, and data-driven recommendations
---

Analyze performance data to derive actionable insights and support data-driven decision-making.

## Metric Selection
- Align metrics to the specific business goal: awareness (reach, impressions, share of voice), engagement (CTR, time on page, bounce rate), conversion (CVR, CPA, ROAS), retention (churn rate, LTV, repeat rate).
- Distinguish between vanity metrics (total visits, followers) and actionable metrics (conversion rate, customer acquisition cost).
- Prefer ratios and rates over raw counts for fair comparison across periods/segments.

## Trend Identification
- Compare period-over-period (MoM, QoQ, YoY) with a minimum of 3 data points to establish direction.
- Use rolling averages (7-day, 28-day) to smooth noise and reveal underlying trends.
- Flag statistically significant changes - not every up/down is meaningful. Note confidence intervals where possible.
- Look for seasonal patterns and normalize for them before drawing conclusions.

## Benchmark Comparison
- Compare metrics against: historical performance (same period last year), industry benchmarks (published reports), and internal goals/KPIs.
- Contextualize variance: "17% above industry average" is more useful than "CTR was 2.4%".
- When benchmarks are unavailable, use relative comparisons (top quartile vs. bottom quartile segments).

## Visualization Recommendations
- Time series: line charts for trends over time. Never use bar charts for continuous time data.
- Comparisons: bar charts for categorical comparison, dot plots for ranked data.
- Distributions: histograms for spread, box plots for outlier detection.
- Compositions: stacked bar charts for part-to-whole over time, donut charts for single time period (one chart per page max).
- Avoid: pie charts with more than 5 slices, 3D charts, dual y-axes without clear justification.

## Avoiding Common Statistical Pitfalls
- **Survivorship bias** - don't analyze only the successes; include failures in the dataset.
- **Confirmation bias** - actively look for data that contradicts your hypothesis.
- **Small sample sizes** - n ≥ 30 for any meaningful inference; flag sub-30 conclusions as tentative.
- **Correlation vs. causation** - never claim causation without controlled experiments (A/B tests) or causal inference methods.
- **Data dredging** - if you test 20 metrics, expect 1 to be significant at p=0.05 by chance. Apply Bonferroni correction or similar.
