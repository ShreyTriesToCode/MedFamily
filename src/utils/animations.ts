import type { Variants, Transition } from 'framer-motion';

/* ══════════════════════════════════════════════════════════════
   Shared spring / transition configs
   ══════════════════════════════════════════════════════════════ */
export const springBounce: Transition = {
    type: 'spring',
    stiffness: 260,
    damping: 20,
};

export const springSmooth: Transition = {
    type: 'spring',
    stiffness: 200,
    damping: 28,
};

export const easeFade: Transition = {
    duration: 0.4,
    ease: [0.22, 1, 0.36, 1],
};

/* ══════════════════════════════════════════════════════════════
   Fade variants
   ══════════════════════════════════════════════════════════════ */
export const fadeIn: Variants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: easeFade },
    exit: { opacity: 0, y: -8, transition: { duration: 0.25 } },
};

export const fadeInUp: Variants = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
    exit: { opacity: 0, y: -12, transition: { duration: 0.3 } },
};

export const fadeInScale: Variants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
    exit: { opacity: 0, scale: 0.97, transition: { duration: 0.25 } },
};

/* ══════════════════════════════════════════════════════════════
   Stagger container (for lists / grids)
   ══════════════════════════════════════════════════════════════ */
export const staggerContainer: Variants = {
    hidden: {},
    visible: {
        transition: {
            staggerChildren: 0.08,
            delayChildren: 0.1,
        },
    },
};

export const staggerItem: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.45,
            ease: [0.22, 1, 0.36, 1],
        },
    },
};

/* ══════════════════════════════════════════════════════════════
   Scale tap / hover presets (use with whileHover / whileTap)
   ══════════════════════════════════════════════════════════════ */
export const hoverLift = {
    whileHover: { y: -4, transition: springSmooth },
    whileTap: { scale: 0.98, transition: springBounce },
};

export const hoverScale = {
    whileHover: { scale: 1.03, transition: springSmooth },
    whileTap: { scale: 0.97, transition: springBounce },
};

export const tapShrink = {
    whileTap: { scale: 0.96, transition: springBounce },
};

/* ══════════════════════════════════════════════════════════════
   Modal / overlay variants
   ══════════════════════════════════════════════════════════════ */
export const backdropVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.25 } },
    exit: { opacity: 0, transition: { duration: 0.2, delay: 0.05 } },
};

export const modalVariants: Variants = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: {
        opacity: 1,
        scale: 1,
        y: 0,
        transition: {
            type: 'spring',
            stiffness: 300,
            damping: 30,
        },
    },
    exit: {
        opacity: 0,
        scale: 0.97,
        y: 10,
        transition: { duration: 0.2 },
    },
};

/* ══════════════════════════════════════════════════════════════
   Page transition
   ══════════════════════════════════════════════════════════════ */
export const pageTransition: Variants = {
    initial: { opacity: 0, y: 12 },
    animate: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
    },
    exit: {
        opacity: 0,
        y: -8,
        transition: { duration: 0.25 },
    },
};

/* ══════════════════════════════════════════════════════════════
   Slide from direction
   ══════════════════════════════════════════════════════════════ */
export const slideInLeft: Variants = {
    hidden: { opacity: 0, x: -30 },
    visible: { opacity: 1, x: 0, transition: easeFade },
};

export const slideInRight: Variants = {
    hidden: { opacity: 0, x: 30 },
    visible: { opacity: 1, x: 0, transition: easeFade },
};
