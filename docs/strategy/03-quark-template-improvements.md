# Quark Template & Component Improvements

> Implementation-ready spec. Philosophy: better defaults, not more complexity.
> Composable primitives, no vendor lock-in, Tailwind-only, accessible by default.

---

## 1. New Design Tokens (`globals.css`)

Add to `apps/web/src/app/globals.css` inside the `:root` block. These are infrastructure tokens - no opinionated design values. All bridge to Tailwind v4 via `@theme inline`.

### 1.1 Typography Tokens

```css
/* Typography */
--font-display: system-ui, sans-serif;
--font-body: system-ui, sans-serif;
--font-mono: 'JetBrains Mono', monospace;

--text-xs: 0.75rem;
--text-sm: 0.875rem;
--text-base: 1rem;
--text-lg: 1.125rem;
--text-xl: 1.25rem;
--text-2xl: 1.5rem;
--text-3xl: 1.875rem;
--text-4xl: 2.25rem;
--text-5xl: 3rem;
--text-6xl: 3.75rem;

--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;

--leading-tight: 1.25;
--leading-snug: 1.375;
--leading-normal: 1.5;
--leading-relaxed: 1.625;

--tracking-tighter: -0.05em;
--tracking-tight: -0.025em;
--tracking-normal: 0;
--tracking-wide: 0.025em;
--tracking-wider: 0.05em;
--tracking-widest: 0.1em;
```

### 1.2 Shadow Tokens

```css
/* Shadows */
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
--shadow-2xl: 0 25px 50px -12px rgb(0 0 0 / 0.25);
--shadow-card: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
```

### 1.3 Animation Tokens

```css
/* Animation */
--duration-fast: 150ms;
--duration-normal: 300ms;
--duration-slow: 500ms;
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
```

### 1.4 Spacing Tokens (Phase 3)

```css
/* Section spacing */
--space-section-sm: 2rem;
--space-section: 3rem;
--space-section-lg: 4rem;
--space-section-xl: 5rem;
--space-section-2xl: 6rem;
```

### 1.5 Tailwind v4 Bridge

Add to the existing `@theme inline` block in `globals.css`:

```css
@theme inline {
  /* ... existing color/radius tokens ... */

  /* Typography */
  --font-display: var(--font-display);
  --font-body: var(--font-body);
  --font-mono: var(--font-mono);

  /* Shadows */
  --shadow-sm: var(--shadow-sm);
  --shadow-md: var(--shadow-md);
  --shadow-lg: var(--shadow-lg);
  --shadow-xl: var(--shadow-xl);
  --shadow-2xl: var(--shadow-2xl);
  --shadow-card: var(--shadow-card);

  /* Animation */
  --duration-fast: var(--duration-fast);
  --duration-normal: var(--duration-normal);
  --duration-slow: var(--duration-slow);
  --ease-out: var(--ease-out);
  --ease-in-out: var(--ease-in-out);

  /* Spacing (Phase 3) */
  --space-section-sm: var(--space-section-sm);
  --space-section: var(--space-section);
  --space-section-lg: var(--space-section-lg);
  --space-section-xl: var(--space-section-xl);
  --space-section-2xl: var(--space-section-2xl);
}
```

---

## 2. New Components

All components live in `packages/ui/src/`. Each gets a co-located `*.test.js` file. Export from `packages/ui/src/index.js`.

### 2.1 Hero (`hero.js`)

Composable hero section. Provides structure without dictating design.

#### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `variant` | `"image" \| "video" \| "split"` | `"image"` | Layout variant |
| `headline` | `string` | required | Main heading text |
| `highlightedWords` | `string[]` | `[]` | Words in headline to render italic + brand color |
| `subtitle` | `string` | `""` | Supporting paragraph below headline |
| `cta` | `{ label: string, href: string }` | `null` | Primary call-to-action |
| `secondaryCta` | `{ label: string, href: string }` | `null` | Secondary call-to-action |
| `backgroundImage` | `string` | `""` | URL for background image (image/video variants) |
| `backgroundOverlay` | `boolean` | `true` | Whether to apply a dark overlay on background |
| `stats` | `{ value: string, label: string }[]` | `[]` | Stat counters below CTAs |
| `trustBadges` | `string[]` | `[]` | Trust badge text strings |
| `className` | `string` | `""` | Override classes on root element |
| `children` | `ReactNode` | `null` | Slot for split variant media content |

#### Implementation Notes

- **No `"use client"`** - this is a server-safe presentational component.
- `highlightedWords` matching: split the headline string, wrap matching words in `<em>` with `text-primary italic not-italic` styling.
- `variant="split"`: two-column grid (`lg:grid-cols-2`), children slot renders in the right column.
- `variant="image"`: full-width background image via inline `style={{ backgroundImage }}`, overlay div with `bg-black/50`.
- `variant="video"`: same as image but with a video element slot expectation (pass video as children).
- Stats render as a flex row below CTAs: `text-3xl font-bold` for value, `text-sm text-text-muted` for label.
- Trust badges render as a horizontal flex row of small text badges.
- Responsive: stacks vertically on mobile, side-by-side on desktop.
- Works with Navbar/MobileNavbar above it - no conflicting z-index or positioning.

#### Skeleton

```js
import React from "react";

const base = "relative flex items-center overflow-hidden";

const VARIANTS = {
  image: "min-h-[60vh]",
  video: "min-h-[60vh]",
  split: "min-h-[50vh]",
};

function renderHeadline(text, highlightedWords) {
  if (!highlightedWords.length) return text;
  const pattern = new RegExp(`(${highlightedWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join("|")})`, "gi");
  const parts = text.split(pattern);
  return parts.map((part, i) => {
    if (highlightedWords.some(w => w.toLowerCase() === part.toLowerCase())) {
      return React.createElement("em", { key: i, className: "text-primary not-italic" }, part);
    }
    return part;
  });
}

export function Hero({
  variant = "image",
  headline,
  highlightedWords = [],
  subtitle = "",
  cta = null,
  secondaryCta = null,
  backgroundImage = "",
  backgroundOverlay = true,
  stats = [],
  trustBadges = [],
  className = "",
  children,
  ...props
}) {
  const variantCls = VARIANTS[variant] ?? VARIANTS.image;
  const cls = `${base} ${variantCls} ${className}`.trim();

  const bgStyle = (variant === "image" || variant === "video") && backgroundImage
    ? { backgroundImage: `url(${backgroundImage})`, backgroundSize: "cover", backgroundPosition: "center" }
    : {};

  const content = React.createElement("div", { className: "relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24" },
    React.createElement("div", { className: variant === "split" ? "grid gap-12 lg:grid-cols-2 lg:items-center" : "max-w-3xl" },
      React.createElement("div", { className: "space-y-8" },
        headline && React.createElement("h1", { className: "text-4xl font-bold tracking-tight text-text sm:text-5xl lg:text-6xl" },
          renderHeadline(headline, highlightedWords)),
        subtitle && React.createElement("p", { className: "text-lg leading-relaxed text-text-muted sm:text-xl" }, subtitle),
        (cta || secondaryCta) && React.createElement("div", { className: "flex flex-wrap gap-4" },
          cta && React.createElement("a", {
            href: cta.href,
            className: "inline-flex items-center justify-center h-11 px-6 text-sm font-medium tracking-wide text-white bg-primary-hover border border-primary-hover rounded-[--radius-default] transition-all duration-200 hover:brightness-95 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          }, cta.label),
          secondaryCta && React.createElement("a", {
            href: secondaryCta.href,
            className: "inline-flex items-center justify-center h-11 px-6 text-sm font-medium tracking-wide text-text border border-border-hover bg-surface rounded-[--radius-default] transition-all duration-200 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-hover"
          }, secondaryCta.label)),
        stats.length > 0 && React.createElement("div", { className: "flex flex-wrap gap-x-12 gap-y-4" },
          stats.map((s) => React.createElement("div", { key: s.label },
            React.createElement("p", { className: "text-3xl font-bold text-text" }, s.value),
            React.createElement("p", { className: "text-sm text-text-muted" }, s.label)))),
        trustBadges.length > 0 && React.createElement("div", { className: "flex flex-wrap items-center gap-3" },
          trustBadges.map((b) => React.createElement("span", {
            key: b,
            className: "inline-flex items-center rounded-[--radius-default] border border-border px-3 py-1 text-xs text-text-muted"
          }, b)))),
      variant === "split" && children && React.createElement("div", null, children)));

  return React.createElement("section", { className: cls, style: bgStyle, ...props },
    backgroundOverlay && (variant === "image" || variant === "video") && backgroundImage
      && React.createElement("div", { className: "absolute inset-0 bg-black/50", "aria-hidden": "true" }),
    content);
}
```

---

### 2.2 TestimonialCard (`testimonial-card.js`)

Simple testimonial display. Server-safe presentational component.

#### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `quote` | `string` | required | Testimonial quote text |
| `author` | `string` | required | Author name |
| `role` | `string` | `""` | Author role/company |
| `avatar` | `string` | `""` | Avatar image URL |
| `rating` | `number` (1-5) | `null` | Star rating |
| `companyLogo` | `string` | `""` | Company logo URL |
| `variant` | `"card" \| "minimal"` | `"card"` | Display variant |
| `className` | `string` | `""` | Override classes |

#### Implementation Notes

- `variant="card"`: bordered card with padding, bg-surface, shadow.
- `variant="minimal"`: no border/bg, just text with author attribution.
- Rating renders as filled/empty star characters (★/☆) using `aria-label="X out of 5 stars"`.
- Avatar renders as a rounded image with fallback initials.
- Quote uses `text-lg leading-relaxed italic` styling.

#### Skeleton

```js
import React from "react";

const VARIANTS = {
  card: "border border-border bg-surface p-6 rounded-[--radius-default]",
  minimal: "",
};

function renderStars(rating) {
  if (rating == null) return null;
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(React.createElement("span", {
      key: i,
      "aria-hidden": "true",
      className: i <= rating ? "text-warning" : "text-text-faint"
    }, i <= rating ? "\u2605" : "\u2606"));
  }
  return React.createElement("div", {
    className: "flex gap-0.5 text-sm",
    "aria-label": `${rating} out of 5 stars`,
    role: "img"
  }, ...stars);
}

export function TestimonialCard({
  quote,
  author,
  role = "",
  avatar = "",
  rating = null,
  companyLogo = "",
  variant = "card",
  className = "",
  ...props
}) {
  const cls = `${VARIANTS[variant] ?? VARIANTS.card} ${className}`.trim();

  const children = [];

  if (companyLogo) {
    children.push(React.createElement("img", {
      key: "logo",
      src: companyLogo,
      alt: "",
      className: "h-8 w-auto mb-4",
      "aria-hidden": "true"
    }));
  }

  children.push(React.createElement("blockquote", { key: "quote", className: "text-lg leading-relaxed italic text-text" },
    React.createElement("p", null, "\u201C", quote, "\u201D")));

  children.push(React.createElement("div", { key: "author", className: "mt-4 flex items-center gap-3" },
    avatar && React.createElement("img", {
      src: avatar,
      alt: author,
      className: "h-10 w-10 rounded-full object-cover"
    }),
    !avatar && React.createElement("div", {
      className: "flex h-10 w-10 items-center justify-center rounded-full bg-primary-muted text-sm font-semibold text-primary",
      "aria-hidden": "true"
    }, author.charAt(0).toUpperCase()),
    React.createElement("div", null,
      React.createElement("p", { className: "text-sm font-semibold text-text" }, author),
      role && React.createElement("p", { className: "text-sm text-text-muted" }, role))));

  if (rating != null) {
    children.splice(1, 0, renderStars(rating));
  }

  return React.createElement("figure", { className: cls, ...props }, ...children);
}
```

---

### 2.3 TestimonialCarousel (`testimonial-carousel.js`)

Wraps multiple TestimonialCards. Client component (`"use client"`).

#### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | required | TestimonialCard elements |
| `autoPlay` | `boolean` | `false` | Auto-advance slides |
| `interval` | `number` | `5000` | Auto-play interval in ms |
| `className` | `string` | `""` | Override classes |

#### Implementation Notes

- Uses `useState` for current index, `useEffect` + `setInterval` for auto-play.
- Pauses auto-play on hover via `onMouseEnter`/`onMouseLeave`.
- Keyboard navigation: left/right arrow keys advance slides.
- Renders prev/next buttons with `aria-label="Previous testimonial"` / `aria-label="Next testimonial"`.
- Renders dot indicators with `aria-label="Go to testimonial X"` and `aria-current={index === current ? "true" : undefined}`.
- Wrapper has `role="region"` and `aria-label="Testimonials"`.
- Respects `prefers-reduced-motion` - disables auto-play if `window.matchMedia('(prefers-reduced-motion: reduce)').matches`.
- Only one slide visible at a time; uses CSS transition for slide change.

#### Skeleton

```js
"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";

export function TestimonialCarousel({
  children,
  autoPlay = false,
  interval = 5000,
  className = "",
  ...props
}) {
  const items = React.Children.toArray(children);
  const [current, setCurrent] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const timerRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const goTo = useCallback((index) => {
    setCurrent((index + items.length) % items.length);
  }, [items.length]);

  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  useEffect(() => {
    if (!autoPlay || reducedMotion || items.length <= 1) return;
    timerRef.current = setInterval(next, interval);
    return () => clearInterval(timerRef.current);
  }, [autoPlay, reducedMotion, interval, next, items.length]);

  const pause = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const resume = useCallback(() => {
    if (!autoPlay || reducedMotion || items.length <= 1) return;
    pause();
    timerRef.current = setInterval(next, interval);
  }, [autoPlay, reducedMotion, interval, next, pause, items.length]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "ArrowLeft") prev();
    if (e.key === "ArrowRight") next();
  }, [prev, next]);

  if (items.length === 0) return null;

  return React.createElement("div", {
    ref: containerRef,
    className: `relative ${className}`.trim(),
    role: "region",
    "aria-label": "Testimonials",
    "aria-roledescription": "carousel",
    tabIndex: 0,
    onKeyDown: handleKeyDown,
    onMouseEnter: pause,
    onMouseLeave: resume,
    ...props
  },
    React.createElement("div", { className: "overflow-hidden" },
      React.createElement("div", {
        className: "transition-transform duration-[--duration-normal] ease-[--ease-out] motion-reduce:transition-none",
        style: { transform: `translateX(-${current * 100}%)` },
        "aria-live": "polite"
      },
        React.createElement("div", { className: "flex", style: { width: `${items.length * 100}%` } },
          items.map((item, i) => React.createElement("div", {
            key: i,
            className: "w-full shrink-0 px-4",
            role: "group",
            "aria-roledescription": "slide",
            "aria-label": `Testimonial ${i + 1} of ${items.length}`,
            "aria-hidden": i !== current
          }, item))))),
    items.length > 1 && React.createElement("div", { className: "mt-6 flex items-center justify-center gap-4" },
      React.createElement("button", {
        type: "button",
        className: "flex h-8 w-8 items-center justify-center rounded-full border border-border text-text-muted transition-colors hover:bg-surface-hover hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        "aria-label": "Previous testimonial",
        onClick: prev
      }, "\u2190"),
      React.createElement("div", { className: "flex gap-2", role: "tablist", "aria-label": "Testimonial slides" },
        items.map((_, i) => React.createElement("button", {
          key: i,
          type: "button",
          role: "tab",
          "aria-selected": i === current,
          "aria-label": `Go to testimonial ${i + 1}`,
          className: `h-2 w-2 rounded-full transition-colors ${i === current ? "bg-primary" : "bg-border hover:bg-border-hover"}`,
          onClick: () => goTo(i)
        }))),
      React.createElement("button", {
        type: "button",
        className: "flex h-8 w-8 items-center justify-center rounded-full border border-border text-text-muted transition-colors hover:bg-surface-hover hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        "aria-label": "Next testimonial",
        onClick: next
      }, "\u2192")));
}
```

---

### 2.4 LogoCloud (`logo-cloud.js`)

Partner/client logo display. Server-safe presentational component.

#### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `title` | `string` | `""` | Section heading above logos |
| `logos` | `{ src: string, alt: string, href?: string }[]` | required | Logo items |
| `variant` | `"grid" \| "marquee"` | `"grid"` | Display variant |
| `className` | `string` | `""` | Override classes |

#### Implementation Notes

- `variant="grid"`: responsive CSS grid (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`), centered logos with grayscale + opacity hover effect.
- `variant="marquee"`: CSS `@keyframes` animation for auto-scrolling. Uses `prefers-reduced-motion` media query to disable animation (logos display as static grid instead).
- Each logo renders as an `<img>` with `alt` text. If `href` is provided, wraps in `<a>` with `target="_blank" rel="noopener noreferrer"`.
- Logos use `grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all` for visual treatment.
- Define the marquee keyframe in `globals.css`:

```css
@keyframes quark-marquee {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

@media (prefers-reduced-motion: reduce) {
  .quark-marquee-track {
    animation: none !important;
  }
}
```

#### Skeleton

```js
import React from "react";

export function LogoCloud({
  title = "",
  logos = [],
  variant = "grid",
  className = "",
  ...props
}) {
  if (!logos.length) return null;

  const renderLogo = (logo) => {
    const img = React.createElement("img", {
      src: logo.src,
      alt: logo.alt,
      className: "h-8 w-auto max-w-[120px] object-contain grayscale opacity-60 transition-all duration-[--duration-normal] hover:grayscale-0 hover:opacity-100"
    });
    if (logo.href) {
      return React.createElement("a", {
        key: logo.alt,
        href: logo.href,
        target: "_blank",
        rel: "noopener noreferrer",
        className: "flex items-center justify-center p-4"
      }, img);
    }
    return React.createElement("div", {
      key: logo.alt,
      className: "flex items-center justify-center p-4"
    }, img);
  };

  const gridContent = React.createElement("div", {
    className: "grid grid-cols-2 items-center justify-items-center gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
  }, logos.map(renderLogo));

  const marqueeContent = React.createElement("div", { className: "overflow-hidden" },
    React.createElement("div", {
      className: "quark-marquee-track flex w-max gap-8",
      style: { animation: "quark-marquee 30s linear infinite" }
    },
      ...[...logos, ...logos].map((logo, i) => React.createElement("div", {
        key: `${logo.alt}-${i}`,
        className: "flex shrink-0 items-center justify-center px-4"
      }, renderLogo(logo).props.children))));

  return React.createElement("section", { className, ...props },
    title && React.createElement("p", {
      className: "mb-8 text-center text-sm font-medium uppercase tracking-wider text-text-faint"
    }, title),
    variant === "marquee" ? marqueeContent : gridContent);
}
```

---

### 2.5 Stats (`stats.js`)

Animated number counters. Client component (`"use client"`).

#### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `items` | `{ value: number, label: string, description?: string }[]` | required | Stat items |
| `variant` | `"inline" \| "grid"` | `"grid"` | Layout variant |
| `className` | `string` | `""` | Override classes |

#### Implementation Notes

- Uses `IntersectionObserver` to trigger animation when the stats section scrolls into view.
- Numbers animate from 0 to target value using `requestAnimationFrame` with easing.
- Animation duration: ~1.5s per counter. All counters animate simultaneously on trigger.
- `variant="inline"`: horizontal flex row with dividers.
- `variant="grid"`: responsive grid (`grid-cols-2 lg:grid-cols-4`).
- Respects `prefers-reduced-motion` - if set, numbers render at final value immediately (no animation).
- Each counter uses `useRef` + `useState` for the animated value.
- Format: numbers ≥ 1000 use `toLocaleString()` for comma separators. Supports suffix via a `suffix` prop on each item (e.g., `{ value: 99, suffix: "%", label: "Satisfaction" }`).

#### Skeleton

```js
"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";

const VARIANTS = {
  inline: "flex flex-wrap items-center justify-center gap-x-12 gap-y-6 divide-x divide-border",
  grid: "grid grid-cols-2 gap-8 lg:grid-cols-4",
};

function easeOutExpo(t) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function AnimatedValue({ value, suffix = "", reducedMotion }) {
  const [display, setDisplay] = useState(reducedMotion ? value : 0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    if (reducedMotion) {
      setDisplay(value);
      return;
    }

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const duration = 1500;
          const startTime = performance.now();

          function tick(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = easeOutExpo(progress);
            setDisplay(Math.round(eased * value));
            if (progress < 1) requestAnimationFrame(tick);
          }

          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [value, reducedMotion]);

  return React.createElement("span", { ref, className: "text-3xl font-bold text-text sm:text-4xl" },
    display.toLocaleString(), suffix);
}

export function Stats({
  items = [],
  variant = "grid",
  className = "",
  ...props
}) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  if (!items.length) return null;

  const cls = `${VARIANTS[variant] ?? VARIANTS.grid} ${className}`.trim();

  return React.createElement("section", { className: cls, ...props },
    items.map((item) => React.createElement("div", {
      key: item.label,
      className: variant === "inline" ? "px-6 first:pl-0 last:pr-0" : "text-center"
    },
      React.createElement(AnimatedValue, {
        value: item.value,
        suffix: item.suffix ?? "",
        reducedMotion
      }),
      React.createElement("p", { className: "mt-1 text-sm font-medium text-text-muted" }, item.label),
      item.description && React.createElement("p", { className: "mt-1 text-sm text-text-faint" }, item.description))));
}
```

---

### 2.6 EmailCapture (`email-capture.js`)

Minimal email signup form. Client component (`"use client"`).

#### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `title` | `string` | `""` | Heading above the form |
| `description` | `string` | `""` | Supporting text |
| `placeholder` | `string` | `"Enter your email"` | Input placeholder |
| `buttonLabel` | `string` | `"Subscribe"` | Submit button text |
| `onSubmit` | `(formData: FormData) => Promise<{ success: boolean, message?: string }>` | required | Server action handler |
| `benefit` | `string` | `""` | Benefit copy below the form (e.g., "No spam, unsubscribe anytime.") |
| `className` | `string` | `""` | Override classes |

#### Implementation Notes

- Uses `useActionState` (React 19) for form state management.
- States: idle, pending (during submission), success, error.
- Success state: replaces form with a checkmark + success message.
- Error state: shows error message below the form in red text.
- Input uses `type="email"`, `required`, with a visually hidden `<label>` for accessibility.
- Proper `aria-describedby` linking error/success messages to the input.
- Pending state: button shows "Sending..." text and is disabled.

#### Skeleton

```js
"use client";
import React, { useActionState } from "react";

const initialState = { success: false, message: "" };

export function EmailCapture({
  title = "",
  description = "",
  placeholder = "Enter your email",
  buttonLabel = "Subscribe",
  onSubmit,
  benefit = "",
  className = "",
  ...props
}) {
  const [state, formAction, isPending] = useActionState(async (prev, formData) => {
    try {
      const result = await onSubmit(formData);
      return result;
    } catch {
      return { success: false, message: "Something went wrong. Please try again." };
    }
  }, initialState);

  const messageId = "email-capture-message";

  if (state.success) {
    return React.createElement("div", {
      className: `rounded-[--radius-default] border border-success/40 bg-success-muted p-6 text-center ${className}`.trim(),
      ...props
    },
      React.createElement("p", { className: "text-2xl", "aria-hidden": "true" }, "\u2713"),
      React.createElement("p", { className: "mt-2 font-semibold text-text" }, state.message || "Thank you for subscribing!"));
  }

  return React.createElement("div", { className, ...props },
    title && React.createElement("h3", { className: "text-xl font-semibold text-text" }, title),
    description && React.createElement("p", { className: "mt-2 text-text-muted" }, description),
    React.createElement("form", { action: formAction, className: "mt-4 flex flex-col gap-3 sm:flex-row" },
      React.createElement("div", { className: "flex-1" },
        React.createElement("label", { htmlFor: "email-capture-input", className: "sr-only" }, "Email address"),
        React.createElement("input", {
          id: "email-capture-input",
          name: "email",
          type: "email",
          required: true,
          placeholder,
          "aria-describedby": state.message ? messageId : undefined,
          className: "h-10 w-full rounded-[--radius-default] border border-border bg-surface px-3 text-sm text-text placeholder:text-text-faint transition-colors duration-200 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
        })),
      React.createElement("button", {
        type: "submit",
        disabled: isPending,
        className: "inline-flex h-10 shrink-0 items-center justify-center rounded-[--radius-default] bg-primary-hover px-6 text-sm font-medium text-white transition-all duration-200 hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed"
      }, isPending ? "Sending..." : buttonLabel)),
    state.message && !state.success && React.createElement("p", {
      id: messageId,
      className: "mt-2 text-sm text-danger",
      role: "alert"
    }, state.message),
    benefit && React.createElement("p", { className: "mt-3 text-xs text-text-faint" }, benefit));
}
```

---

## 3. Landing Page Starter Templates

Three composable reference pages. Each is a server component demonstrating component composition. Agents use these as starting points, not copy-paste targets.

All templates go in `apps/web/src/app/` as new route directories:
- `apps/web/src/app/templates/saas/page.js`
- `apps/web/src/app/templates/local-service/page.js`
- `apps/web/src/app/templates/ecommerce/page.js`

### 3.1 SaaS/Product Landing (`templates/saas/page.js`)

**Sections (top to bottom):**

1. **Navbar** - standard shell with logo + links + CTA
2. **Hero** (product screenshot variant) - headline, subtitle, CTA, secondary CTA, stats (users, revenue, uptime), trust badges (SOC2, GDPR, etc.)
3. **LogoCloud** (grid variant) - partner/integration logos
4. **Features** - 3-column card grid. Each card: icon (lucide-react), title, description. Use `Card`/`CardHeader`/`CardTitle`/`CardContent`.
5. **Stats** (grid variant) - 4 stat items (customers, transactions, countries, uptime)
6. **TestimonialCarousel** - 3-4 TestimonialCards with ratings
7. **Pricing** - 3-column card grid (Starter/Pro/Enterprise). Each card: plan name, price, feature list, CTA button. Highlight "Pro" with a subtle border/badge.
8. **FAQ** - collapsible Card components (use `variant="collapsible"`). 6-8 common questions.
9. **EmailCapture** - inline with benefit copy
10. **Footer** - standard shell

### 3.2 Local Service Landing (`templates/local-service/page.js`)

**Sections (top to bottom):**

1. **Navbar** - standard shell
2. **Hero** (image variant) - headline, subtitle, CTA ("Get a free quote"), secondary CTA ("View our work"), stats (years in business, projects completed, 5-star reviews)
3. **Services** - 3-column card grid. Each card: icon, service name, short description.
4. **Projects/Gallery** - responsive image grid (2-col mobile, 3-col desktop). Each image in a Card with subtle hover effect.
5. **Stats** (inline variant) - 3-4 stat items with dividers
6. **TestimonialCarousel** - 3-4 TestimonialCards with ratings
7. **About** - two-column layout: text block (heading + paragraph + CTA) + image
8. **Contact** - two-column: contact form (Input + Textarea + Button) + contact details (phone, email, address, hours)
9. **Footer** - standard shell

### 3.3 E-commerce Landing (`templates/ecommerce/page.js`)

**Sections (top to bottom):**

1. **Navbar** - standard shell with cart icon
2. **Hero** (image/video variant) - headline, subtitle, CTA ("Shop now"), secondary CTA ("Learn more")
3. **Featured Products** - responsive product grid (2-col mobile, 4-col desktop). Each product card: image, name, price, "Add to cart" button. Use Card components.
4. **Categories** - 3-column card grid. Each card: category image, name, item count.
5. **TestimonialCarousel** - 3-4 TestimonialCards
6. **EmailCapture** - "Get 10% off your first order" with benefit copy
7. **Footer** - standard shell with extra link columns (Shop, About, Help, Legal)

---

## 4. Implementation Checklist

### Phase 1 - Tokens + Core Components

- [ ] Add typography tokens to `globals.css` (`:root` block)
- [ ] Add shadow tokens to `globals.css` (`:root` block)
- [ ] Add animation tokens to `globals.css` (`:root` block)
- [ ] Add `@theme inline` bridge entries for all new tokens
- [ ] Add `@keyframes quark-marquee` to `globals.css`
- [ ] Add `.quark-marquee-track` reduced-motion override to `globals.css`
- [ ] Create `packages/ui/src/hero.js`
- [ ] Create `packages/ui/src/hero.test.js`
- [ ] Create `packages/ui/src/testimonial-card.js`
- [ ] Create `packages/ui/src/testimonial-card.test.js`
- [ ] Create `packages/ui/src/testimonial-carousel.js`
- [ ] Create `packages/ui/src/testimonial-carousel.test.js`
- [ ] Create `packages/ui/src/logo-cloud.js`
- [ ] Create `packages/ui/src/logo-cloud.test.js`
- [ ] Create `packages/ui/src/stats.js`
- [ ] Create `packages/ui/src/stats.test.js`
- [ ] Add all new exports to `packages/ui/src/index.js`
- [ ] Run `pnpm lint` and fix any issues
- [ ] Run `pnpm test` and ensure all tests pass
- [ ] Run `pnpm --filter @usequark/quark-create-app sync-templates`

### Phase 2 - EmailCapture + Templates

- [ ] Create `packages/ui/src/email-capture.js`
- [ ] Create `packages/ui/src/email-capture.test.js`
- [ ] Add export to `packages/ui/src/index.js`
- [ ] Create `apps/web/src/app/templates/saas/page.js`
- [ ] Create `apps/web/src/app/templates/local-service/page.js`
- [ ] Create `apps/web/src/app/templates/ecommerce/page.js`
- [ ] Update `apps/web/src/app/page.js` to demonstrate new components
- [ ] Run `pnpm lint` and fix any issues
- [ ] Run `pnpm test` and ensure all tests pass
- [ ] Run `pnpm --filter @usequark/quark-create-app sync-templates`

### Phase 3 - Polish

- [ ] Add spacing tokens to `globals.css`
- [ ] Add spacing token bridge to `@theme inline`
- [ ] Create additional page templates (product, case study, blog, about, contact)
- [ ] Run `pnpm --filter @usequark/quark-create-app sync-templates`

---

## 5. Rules & Conventions

- **All components are `.js` files** - no TypeScript.
- **All components use `React.createElement`** - no JSX. Follow existing patterns in `packages/ui/src/`.
- **All components accept `className`** for overrides, merged at the end of the class string.
- **All interactive components include ARIA attributes** - `aria-label`, `aria-expanded`, `aria-current`, `role`, etc.
- **No new dependencies** - no animation libraries, no carousel libraries, no third-party form libraries.
- **Components go in `packages/ui/src/`** - each with a co-located `*.test.js` file.
- **Exports go in `packages/ui/src/index.js`** - barrel export for each new component.
- **After source changes, run:** `pnpm --filter @usequark/quark-create-app sync-templates`
- **Use `"use client"` only when needed** - components using hooks (`useState`, `useEffect`, `useRef`, `useActionState`, `IntersectionObserver`) need it. Presentational components do not.
- **Follow existing Tailwind class patterns** - use the design token CSS vars (`text-text`, `bg-surface`, `border-border`, `rounded-[--radius-default]`, etc.).
- **Respect `prefers-reduced-motion`** - disable animations when the user prefers reduced motion.
- **Use `lucide-react` for icons** - it's already a dependency of `packages/ui`.
