---
name: creative-design
description: >
  This skill activates when the user discusses visual design, UI/UX, creative
  design, graphics, presentations, slide design, dashboard design, interactive
  GUI, web design, mobile design, user interface, user experience, wireframes,
  mockups, prototypes, design systems, color theory, typography, layout,
  branding, or creating executive-friendly, visually stunning deliverables.
version: 1.0.0
disable-model-invocation: true
---

# Creative Design & Visual Excellence

Expert-level guidance for creating stunning visual designs, interactive GUIs, and executive-friendly interfaces that captivate audiences and drive engagement.

---

## 1. Design Philosophy

### The "Wow" Factor Principles

**1. Visual Hierarchy**
```
┌─────────────────────────────────────────┐
│  ATTENTION (Hero element)               │  ← First impression
│   Largest, most prominent              │
├─────────────────────────────────────────┤
│  INTEREST (Supporting visuals)          │  ← Draw them in
│   Charts, icons, imagery               │
├─────────────────────────────────────────┤
│  DESIRE (Value proposition)             │  ← Make them want it
│   Benefits, outcomes, impact           │
├─────────────────────────────────────────┤
│  ACTION (Call to action)                │  ← Tell them what's next
│   Clear next step                      │
└─────────────────────────────────────────┘
```

**2. The 3-Second Rule**
A viewer should understand the key message in 3 seconds or less.

**3. Cognitive Load Management**
- Maximum 7 elements per slide/screen
- Group related information
- Use white space strategically
- Progressive disclosure for complex data

---

## 2. Color Mastery

### Executive Color Palettes

**Corporate Professional:**
```
Primary:   #1E3A5F (Deep Navy)     - Trust, stability
Secondary: #2E7D32 (Forest Green) - Growth, finance
Accent:    #FF6B35 (Vibrant Orange) - Energy, calls-to-action
Neutral:   #F5F5F5 (Soft Gray)     - Backgrounds
Text:      #212121 (Near Black)    - Readability
```

**Modern Tech:**
```
Primary:   #6366F1 (Indigo)        - Innovation
Secondary: #10B981 (Emerald)       - Success
Accent:    #F59E0B (Amber)         - Warnings/attention
Dark:      #0F172A (Slate 900)     - Sophisticated bg
Light:     #F8FAFC (Slate 50)      - Clean backgrounds
```

**Premium Finance:**
```
Primary:   #0A2540 (Midnight)      - Authority
Secondary: #00D4AA (Teal)          - Modern finance
Accent:    #FFD700 (Gold)          - Premium, value
Surface:   #FFFFFF (Pure White)    - Clean
Muted:     #6B7280 (Gray 500)      - Supporting text
```

### Color Psychology for Finance

| Color | Emotion | Best Used For |
|-------|---------|---------------|
| **Blue** | Trust, stability | Primary brand, headers |
| **Green** | Growth, money | Positive metrics, success |
| **Red** | Urgency, alert | Negative variances, alerts |
| **Gold/Yellow** | Value, premium | Highlights, key numbers |
| **Gray** | Neutral, professional | Backgrounds, secondary text |
| **Orange** | Energy, action | CTAs, important buttons |

### Gradient Combinations

**Sunrise (Energetic):**
```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

**Ocean (Calm, Trust):**
```css
background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
```

**Forest (Growth):**
```css
background: linear-gradient(135deg, #134e5e 0%, #71b280 100%);
```

**Midnight (Premium):**
```css
background: linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%);
```

---

## 3. Typography That Commands Attention

### Executive Font Pairings

**Pairing 1: Modern Authority**
- **Headings:** Inter (Bold, clean, modern)
- **Body:** Inter (Readable, professional)
- **Accents:** Playfair Display (Elegant for quotes)

**Pairing 2: Classic Finance**
- **Headings:** Source Serif Pro (Trusted, editorial)
- **Body:** Source Sans Pro (Clean, versatile)
- **Data:** IBM Plex Mono (Numbers, alignment)

**Pairing 3: Tech Forward**
- **Headings:** Space Grotesk (Geometric, modern)
- **Body:** DM Sans (Friendly, readable)
- **Metrics:** JetBrains Mono (Code-like precision)

### Typography Scale

| Element | Size | Weight | Line Height | Letter Spacing |
|---------|------|--------|-------------|----------------|
| **Hero Title** | 48-64px | 700 | 1.1 | -0.02em |
| **H1** | 36-48px | 700 | 1.2 | -0.01em |
| **H2** | 28-36px | 600 | 1.3 | 0 |
| **H3** | 22-28px | 600 | 1.4 | 0 |
| **Body Large** | 18-20px | 400 | 1.6 | 0 |
| **Body** | 16px | 400 | 1.6 | 0 |
| **Small/Caption** | 12-14px | 400 | 1.5 | 0.01em |
| **Data/Numbers** | 24-48px | 700 | 1 | -0.02em |

### Typography Best Practices

**For Presentations:**
- Maximum 2 font families
- Minimum 24pt for slide text
- High contrast (4.5:1 minimum)
- Left-aligned body text
- Consistent hierarchy

**For Dashboards:**
- Monospace for numbers (alignment)
- Tabular figures for financial data
- Maximum 3 weights per family
- Clear distinction between headers and data

---

## 4. Layout & Composition

### The Golden Grid

**12-Column Grid System:**
```
┌─────────────────────────────────────────────────────────────┐
│  1    2    3    4    5    6    7    8    9    10   11   12  │
├─────────────────────────────────────────────────────────────┤
│  [======== FULL WIDTH (12) ========]                        │
│  [====== 8 ======]  [==== 4 ====]                          │
│  [=== 6 ===]  [=== 6 ===]                                  │
│  [== 4 ==]  [== 4 ==]  [== 4 ==]                          │
│  [= 3 =] [= 3 =] [= 3 =] [= 3 =]                          │
└─────────────────────────────────────────────────────────────┘
```

### Spacing System (8-Point Grid)

| Token | Value | Usage |
|-------|-------|-------|
| **xs** | 4px | Tight spacing, icons |
| **sm** | 8px | Compact elements |
| **md** | 16px | Standard spacing |
| **lg** | 24px | Section separation |
| **xl** | 32px | Major sections |
| **2xl** | 48px | Page breaks |
| **3xl** | 64px | Hero spacing |

### Layout Patterns

**The F-Pattern (Reading):**
```
┌─────────────────────────────────────────┐
│   START HERE (Top-left)               │  ← Most important
│  ─────────────────────────────────────  │
│  Secondary content...                   │  ← Scan right
│  ─────────────────────────────────────  │
│  More content...                        │  ← Scan right
└─────────────────────────────────────────┘
```

**The Z-Pattern (Landing Pages):**
```
┌─────────────────────────────────────────┐
│  1⃣ START ───────────────→  2⃣ CTA     │
│                                         │
│                                      │
│                                         │
│  4⃣ INFO ←───────────────  3⃣ IMAGE   │
└─────────────────────────────────────────┘
```

**The Rule of Thirds:**
- Divide canvas into 3×3 grid
- Place key elements at intersection points
- Creates visual tension and interest

---

## 5. Visual Elements That Pop

### Data Visualization Excellence

**Chart Selection Guide:**

| Data Type | Best Chart | When to Use |
|-----------|------------|-------------|
| **Comparison** | Bar chart | Categories vs. values |
| **Trend** | Line chart | Time series data |
| **Composition** | Stacked bar | Part-to-whole |
| **Distribution** | Histogram | Frequency spread |
| **Correlation** | Scatter plot | Two variables |
| **Progress** | Bullet chart | Target vs. actual |
| **Status** | Gauge | Single metric health |

**Chart Design Best Practices:**

```
BEFORE (Boring):
┌─────────────────────────────────────────┐
│  Chart Title                            │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
│  Default colors, no context             │
└─────────────────────────────────────────┘

AFTER (Stunning):
┌─────────────────────────────────────────┐
│  Revenue Growth   +23% YoY            │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░  │
│  $4.2M → $5.8M  Target: $6M             │
│                                         │
│  [Sparkline trend]  [Key driver icons]  │
└─────────────────────────────────────────┘
```

### Iconography

**Icon Style Guidelines:**
- **Style:** Line icons (2px stroke) for professional look
- **Size:** 16px (inline), 24px (buttons), 48px (features)
- **Grid:** 24×24px base grid
- **Color:** Match text or accent color
- **Libraries:** Feather, Heroicons, Phosphor

**Icon + Text Pairing:**
```
  [Icon] Label              (Left icon, 8px gap)
  Label [Icon]              (Right icon, 8px gap)
  [Icon][Text overlapping]  (Too close)
```

### Imagery & Photography

**Executive Photography Style:**
- Clean, professional shots
- Natural lighting
- Diverse representation
- Contextual (office, collaboration)
- High resolution (min 1920px wide)

**Abstract Visuals:**
- Geometric patterns
- Gradient meshes
- Subtle textures
- Data-inspired art
- Isometric illustrations

---

## 6. Interactive GUI Design

### Executive-Friendly Interface Principles

**1. Progressive Disclosure**
```
Level 1: Summary Card
┌─────────────────────────────────────────┐
│   Cash Position      [View Details →] │
│  $12.4M   8%                          │
└─────────────────────────────────────────┘
          Click
Level 2: Detail View
┌─────────────────────────────────────────┐
│  Cash Position by Account               │
│  ┌──────────┬──────────┬──────────────┐│
│  │ Account  │ Balance  │ Trend        ││
│  ├──────────┼──────────┼──────────────┤│
│  │ Checking │ $5.2M    │  Sparkline ││
│  │ Savings  │ $4.1M    │  Sparkline ││
│  │ Investments│ $3.1M  │  Sparkline ││
│  └──────────┴──────────┴──────────────┘│
└─────────────────────────────────────────┘
```

**2. Smart Defaults**
- Show most relevant view first
- Remember user preferences
- Pre-filter to important data
- Auto-refresh for real-time

**3. Micro-Interactions**

| Interaction | Trigger | Effect | Purpose |
|-------------|---------|--------|---------|
| **Hover** | Mouse over | Subtle lift/glow | Affordance |
| **Click** | Selection | Ripple effect | Feedback |
| **Loading** | Data fetch | Skeleton screen | Perceived performance |
| **Success** | Action complete | Check animation | Confirmation |
| **Alert** | Attention needed | Pulse/bounce | Urgency |

### Dashboard Design Patterns

**The Executive Dashboard:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│  [Logo]  Dashboard    [ Search]  [ 3]  [ Profile ]               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Good morning, Sarah! Here's your financial snapshot.           │   │
│  │   Monday, March 15, 2025  |   FY2025 Q1                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐      │
│  │  CLOSE STATUS    │  │  CASH POSITION   │  │  FORECAST        │      │
│  │  ─────────────── │  │  ─────────────── │  │  ─────────────── │      │
│  │                  │  │                  │  │                  │      │
│  │   Day 3 of 5   │  │  $12.4M          │  │  94% Accuracy    │      │
│  │  On Track        │  │   8% vs last wk │  │   6% vs target  │      │
│  │                  │  │                  │  │                  │      │
│  │  [Progress Bar]  │  │  [Sparkline]     │  │  [Gauge]         │      │
│  │                  │  │                  │  │                  │      │
│  │  [View Details →]│  │  [View Details →]│  │  [View Details →]│      │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘      │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │   ATTENTION REQUIRED (2)                                      │   │
│  │  ─────────────────────────────────────────────────────────────  │   │
│  │  • IC mismatch: $45K (Entity 101 vs 201)  [Resolve →]          │   │
│  │  • 3 entities pending period close  [Review →]                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  REVENUE TREND                                                  │   │
│  │  [Interactive line chart with drill-down]                       │   │
│  │  • Hover for values  • Click to drill  • Toggle series          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Library

**Cards:**
```
┌─────────────────────────────────────────┐
│  ┌──────────┐                           │
│  │   Icon   │  Title                     │
│  │   48px   │  ───────────              │
│  └──────────┘  Value          [Trend]   │
│                Description              │
│                           [Action →]    │
└─────────────────────────────────────────┘

Specs:
- Border radius: 12px
- Shadow: 0 4px 6px rgba(0,0,0,0.05)
- Padding: 24px
- Hover: lift + shadow increase
```

**Buttons:**
```
Primary:   [  Get Started  ]    (Filled, accent color)
Secondary: [  Learn More   ]    (Outlined)
Tertiary:  [  Cancel       ]    (Text only)
Ghost:     [  ×            ]    (Icon only)

Specs:
- Border radius: 8px
- Padding: 12px 24px
- Font weight: 600
- Hover: darken 10% + lift
```

**Form Inputs:**
```
Label
┌─────────────────────────────────────────┐
│  Placeholder text                     │
└─────────────────────────────────────────┘
Helper text

Specs:
- Border radius: 8px
- Border: 1px solid gray-300
- Focus: 2px accent color ring
- Padding: 12px 16px
```

---

## 7. Presentation Design That Wins

### The 10/20/30 Rule (Guy Kawasaki)
- **10 slides** for a pitch
- **20 minutes** maximum
- **30 point font** minimum

### Slide Archetypes

**1. The Title Slide (Impact)**
```
┌─────────────────────────────────────────┐
│                                         │
│                                         │
│     [Bold Statement / Question]         │
│                                         │
│     Subtitle with context               │
│                                         │
│     [Visual element / Gradient]         │
│                                         │
│     Date | Presenter | Company          │
│                                         │
└─────────────────────────────────────────┘
```

**2. The Big Number (Attention)**
```
┌─────────────────────────────────────────┐
│                                         │
│              $47.3M                     │
│           ───────────                   │
│     Cost savings over 5 years           │
│                                         │
│     [Supporting visual/context]         │
│                                         │
└─────────────────────────────────────────┘
```

**3. The Comparison (Decision)**
```
┌─────────────────────────────────────────┐
│         Current vs. Future              │
│  ─────────────────────────────────────  │
│                                         │
│  BEFORE              AFTER              │
│  ──────              ─────              │
│  • Slow     →  • Fast                   │
│  • Manual   →  • Automated              │
│  • 8 days   →  • 4 days                 │
│  • $2M/yr   →  • $800K/yr               │
│                                         │
│         [Visual comparison]             │
└─────────────────────────────────────────┘
```

**4. The Process (Clarity)**
```
┌─────────────────────────────────────────┐
│         Implementation Roadmap          │
│                                         │
│   [1]        [2]        [3]        [4]  │
│   Phase 1 → Phase 2 → Phase 3 → Phase 4 │
│   Design    Build      Test      Deploy │
│   4 wks     12 wks     6 wks     4 wks  │
│                                         │
│   [Timeline visualization]              │
└─────────────────────────────────────────┘
```

### Animation Guidelines

**Do Use:**
- Fade in for content reveal
- Slide for section transitions
- Zoom for emphasis on key data
- Morph for related content

**Don't Use:**
- Spinning transitions
- Bouncing elements
- Sound effects
- Excessive animations (>3 per slide)

---

## 8. Interactive Prototypes

### Low-Fidelity (Wireframes)
**Tools:** Figma, Balsamiq, Miro
**Purpose:** Structure, flow, validation
**Time:** 1-2 hours

### High-Fidelity (Mockups)
**Tools:** Figma, Adobe XD, Sketch
**Purpose:** Visual design, stakeholder buy-in
**Time:** 4-8 hours

### Interactive (Clickable)
**Tools:** Figma, ProtoPie, Framer
**Purpose:** User testing, demonstration
**Time:** 8-16 hours

### Code Prototypes
**Tools:** React + Tailwind, Vue, HTML/CSS
**Purpose:** Technical validation, production-ready
**Time:** 16-40 hours

---

## 9. Design Systems

### Creating a Design System

**Core Components:**
1. **Color Palette** (Primary, Secondary, Semantic)
2. **Typography Scale** (Font families, sizes, weights)
3. **Spacing System** (8-point grid)
4. **Component Library** (Buttons, cards, forms)
5. **Icon Set** (Consistent style)
6. **Layout Patterns** (Grids, responsive)

**Documentation:**
- Usage guidelines
- Do's and don'ts
- Code snippets
- Accessibility notes

### Executive Design System Example

```
EXECUTIVE UI KIT
══════════════════════════════════════════

COLORS
──────
Primary:    #1E3A5F    (Trust)
Success:    #10B981    (Positive)
Warning:    #F59E0B    (Alert)
Danger:     #EF4444    (Critical)
Surface:    #FFFFFF    (Background)
Text:       #1F2937    (Primary text)
Muted:      #6B7280    (Secondary text)

TYPOGRAPHY
──────────
Headings:   Inter, 700
Body:       Inter, 400
Data:       IBM Plex Mono, 500

SPACING
───────
xs:  4px
sm:  8px
md:  16px
lg:  24px
xl:  32px
2xl: 48px

COMPONENTS
──────────
[Button Primary]  [Button Secondary]  [Button Text]
[Card] [Input] [Dropdown] [Modal]
[Table] [Chart] [Sparkline]
```

---

## 10. Accessibility (A11y)

### WCAG 2.1 Guidelines

**Color Contrast:**
- Normal text: 4.5:1 minimum
- Large text: 3:1 minimum
- UI components: 3:1 minimum

**Keyboard Navigation:**
- All interactive elements focusable
- Visible focus indicators
- Logical tab order

**Screen Readers:**
- Alt text for images
- ARIA labels
- Semantic HTML
- Skip links

---

## Quick Reference: Design Checklist

**Before Designing:**
- [ ] Audience defined (executive, technical, etc.)
- [ ] Purpose clear (inform, persuade, decide)
- [ ] Key message identified
- [ ] Brand guidelines reviewed

**During Design:**
- [ ] Visual hierarchy established
- [ ] Color palette harmonious
- [ ] Typography readable
- [ ] White space balanced
- [ ] Data visualized clearly

**After Design:**
- [ ] 3-second test passed
- [ ] Accessibility checked
- [ ] Responsive considered
- [ ] Interactive elements work
- [ ] Consistency verified

---

## Tools & Resources

**Design Tools:**
- Figma (collaboration, prototyping)
- Adobe Creative Suite (advanced graphics)
- Canva (quick designs)

**Inspiration:**
- Dribbble (UI inspiration)
- Behance (portfolio showcases)
- Awwwards (web design)
- Mobbin (mobile patterns)

**Assets:**
- Unsplash (photography)
- Undraw (illustrations)
- Feather Icons (icons)
- Google Fonts (typography)
