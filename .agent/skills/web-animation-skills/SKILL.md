---
name: Web Animation Skills
description: Best practices and guidelines for implementing smooth, performant, and purposeful animations in Next.js web applications using Tailwind CSS and Framer Motion.
---

# Web Animation Skills

## 🌟 Core Principles of Animation
1. **Purposeful**: Animations should serve a clear purpose (e.g., providing feedback, indicating state changes, drawing attention), not just acting as decoration.
2. **Subtle and Fast**: UI animations should be snappy (usually between 150ms to 300ms) to avoid feeling sluggish. Use appropriate easing (e.g., `ease-out` for entering elements, `ease-in` for exiting elements).
3. **Performance First**: Only animate properties that do not trigger expensive browser layout recalculations. Specifically, prefer animating `transform` (translate, scale, rotate) and `opacity`.

## 🛠️ Tailwind CSS Animations

Tailwind CSS is excellent for simple, interaction-based animations like hover states, focus states, and simple spin/pulse loading effects.

### Basic Transitions
Use utility classes to add smooth transitions to properties like color, background, opacity, and transform:
- Standard smooth transition: `transition-all duration-200 ease-in-out`
- Hover scale and shadow: `hover:scale-105 hover:shadow-lg transition-transform`
- Active (click) states: `active:scale-95 transition-transform`

### Built-in Keyframe Animations
- `animate-spin`: Ideal for loading indicators (spinners) and icon refreshing states.
- `animate-pulse`: Perfect for skeleton loading screens before data arrives.
- `animate-bounce`: Useful for drawing attention (e.g., "scroll down" arrow indicators).

## 🚀 Framer Motion (for React / Next.js)

For more complex animations like enter/exit animations (mounting/unmounting), layout changes, drag gestures, and orchestrated timed sequences, use **Framer Motion**.

### 1. Mount and Unmount Animations (`AnimatePresence`)
When elements are added or removed from the DOM conditionally, wrap them in `AnimatePresence` to enable `exit` animations.

```tsx
import { motion, AnimatePresence } from 'framer-motion';

<AnimatePresence>
  {isVisible && (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2 }}
    >
      Dropdown Menu Content
    </motion.div>
  )}
</AnimatePresence>
```

### 2. Variants for Orchestration
Use variants to clean up code and orchestrate parent-child animations, such as staggering the appearance of a list of items.

```tsx
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1 // Staggers the child animations by 100ms
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

// ...
<motion.ul variants={containerVariants} initial="hidden" animate="visible">
  <motion.li variants={itemVariants}>List Item 1</motion.li>
  <motion.li variants={itemVariants}>List Item 2</motion.li>
  <motion.li variants={itemVariants}>List Item 3</motion.li>
</motion.ul>
```

### 3. Next.js App Router Page Transitions
Implement smooth page transitions using the `template.tsx` file to animate page entries across navigation.

```tsx
// app/template.tsx
'use client';

import { motion } from 'framer-motion';

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ease: 'easeOut', duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}
```

### 4. Layout Animations
For smooth transitions when layout changes (like reordering a list or expanding a card), use the `layout` prop.

```tsx
<motion.div layout>
  {/* Content that changes size or position */}
</motion.div>
```

## ♿ Accessibility (A11y) & Reduced Motion
Always respect the user's OS-level `prefers-reduced-motion` preference.

- **In Tailwind CSS**: Tailwind's `motion-safe:` and `motion-reduce:` modifiers allow you to define distinct behaviors.
  - Example: `motion-safe:animate-spin` or `motion-reduce:transition-none`

- **In Framer Motion**: Use the `useReducedMotion` hook to conditionally disable or simplify animations (e.g., falling back to simple opacity fades instead of sliding transforms).

```tsx
import { motion, useReducedMotion } from "framer-motion"

const MyComponent = () => {
    const shouldReduceMotion = useReducedMotion()
    
    return (
        <motion.div
            // Avoid translations if motion is reduced, just fade
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 50 }}
            animate={{ opacity: 1, y: 0 }}
        />
    )
}
```

## 💡 Best Practices and Common Pitfalls
1. **Do not animate layout properties directly:** Avoid animating CSS properties like `width`, `height`, `top`, `left`, or margins. These trigger expensive layout recalculations and cause jank. Instead, animate `transform: scale()` or `transform: translate()`.
2. **Leverage Hardware Acceleration:** Animating `transform` and `opacity` typically automatically utilizes GPU hardware acceleration in modern browsers, ensuring 60fps smoothness.
3. **Avoid Infinite Distractions:** Continuous, non-stop animations (unless for a specific active state like a spinner) can be highly distracting to users. Use them sparingly.
4. **Immediate Feedback:** Interactive elements should respond immediately. While an animation might take 200ms to complete, the start of the interaction visually reassuring the user should happen instantly.
