/* Central motion presets.
   All Landing components import timing/easing from here — never inline. */

export const easePrecast = [0.2, 0.8, 0.2, 1] as const;

export const heroEntry = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, ease: easePrecast },
} as const;

export const heroSubEntry = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay: 0.15, ease: easePrecast },
} as const;

export const cardHover = {
  whileHover: { y: -2 },
  transition: { duration: 0.32, ease: easePrecast },
} as const;

export const showcaseEnter = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-20%" },
  transition: { duration: 0.5, ease: easePrecast },
} as const;

export const entryArrowShift = {
  whileHover: { x: 6 },
  transition: { duration: 0.3, ease: easePrecast },
} as const;

export const viewSwitch = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.3, ease: easePrecast },
} as const;

export const chatMessageEnter = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.24, ease: easePrecast },
} as const;

export const generatingOverlayFade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2, ease: easePrecast },
} as const;

export const stepSlide = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
  transition: { duration: 0.35, ease: easePrecast },
} as const;

export const pulseDot = (delay: number) => ({
  animate: { opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] },
  transition: {
    duration: 1.4,
    repeat: Infinity,
    delay,
    ease: "easeInOut" as const,
  },
});

export const proposalCardHover = {
  whileHover: { y: -4 },
  transition: { duration: 0.25, ease: easePrecast },
} as const;

export const selectionGlow = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.15, ease: easePrecast },
} as const;

export const invalidShake = {
  animate: { x: [0, -4, 4, -2, 2, 0] },
  transition: { duration: 0.3, ease: easePrecast },
} as const;

export const snapHintFade = {
  initial: { opacity: 0 },
  animate: { opacity: 0.8 },
  exit: { opacity: 0 },
  transition: { duration: 0.12, ease: easePrecast },
} as const;
