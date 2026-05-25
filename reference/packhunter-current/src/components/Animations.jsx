/**
 * Animations - Reusable Framer Motion animation components
 *
 * Usage:
 *   <FadeIn><Card>...</Card></FadeIn>
 *   <SlideIn direction="left"><List>...</List></SlideIn>
 *   <ScaleIn><Button>Click</Button></ScaleIn>
 *   <StaggerContainer><StaggerItem>...</StaggerItem></StaggerContainer>
 */

import { motion, AnimatePresence, useMotionValue, useTransform, useSpring, useReducedMotion } from 'framer-motion'
import { forwardRef, useEffect, useRef, useState } from 'react'

// Fade In animation (respects prefers-reduced-motion)
export const FadeIn = forwardRef(({ children, duration = 0.3, delay = 0, ...props }, ref) => {
  const prefersReduced = useReducedMotion()
  return (
    <motion.div
      ref={ref}
      initial={prefersReduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={prefersReduced ? { duration: 0 } : { duration, delay, ease: 'easeOut' }}
      {...props}
    >
      {children}
    </motion.div>
  )
})
FadeIn.displayName = 'FadeIn'

// Slide In animation
export const SlideIn = forwardRef(({
  children,
  direction = 'up',
  duration = 0.3,
  delay = 0,
  distance = 20,
  ...props
}, ref) => {
  const directions = {
    up: { y: distance },
    down: { y: -distance },
    left: { x: distance },
    right: { x: -distance },
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, ...directions[direction] }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, ...directions[direction] }}
      transition={{ duration, delay, ease: 'easeOut' }}
      {...props}
    >
      {children}
    </motion.div>
  )
})
SlideIn.displayName = 'SlideIn'

// Scale In animation (pop effect)
export const ScaleIn = forwardRef(({
  children,
  duration = 0.2,
  delay = 0,
  scale = 0.9,
  ...props
}, ref) => (
  <motion.div
    ref={ref}
    initial={{ opacity: 0, scale }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale }}
    transition={{ duration, delay, ease: 'easeOut' }}
    {...props}
  >
    {children}
  </motion.div>
))
ScaleIn.displayName = 'ScaleIn'

// Stagger container for list animations (respects prefers-reduced-motion)
export const StaggerContainer = forwardRef(({
  children,
  staggerDelay = 0.05,
  ...props
}, ref) => {
  const prefersReduced = useReducedMotion()
  return (
    <motion.div
      ref={ref}
      initial={prefersReduced ? false : 'hidden'}
      animate="visible"
      exit="hidden"
      variants={{
        visible: {
          transition: {
            staggerChildren: prefersReduced ? 0 : staggerDelay,
          },
        },
      }}
      {...props}
    >
      {children}
    </motion.div>
  )
})
StaggerContainer.displayName = 'StaggerContainer'

// Stagger item (use inside StaggerContainer, respects prefers-reduced-motion)
export const StaggerItem = forwardRef(({
  children,
  duration = 0.3,
  ...props
}, ref) => {
  const prefersReduced = useReducedMotion()
  return (
    <motion.div
      ref={ref}
      variants={prefersReduced
        ? { hidden: { opacity: 1 }, visible: { opacity: 1 } }
        : { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }
      }
      transition={prefersReduced ? { duration: 0 } : { duration, ease: 'easeOut' }}
      {...props}
    >
      {children}
    </motion.div>
  )
})
StaggerItem.displayName = 'StaggerItem'

// Hover scale effect (for buttons, cards)
export const HoverScale = forwardRef(({
  children,
  scale = 1.02,
  duration = 0.2,
  ...props
}, ref) => (
  <motion.div
    ref={ref}
    whileHover={{ scale }}
    whileTap={{ scale: 0.98 }}
    transition={{ duration }}
    {...props}
  >
    {children}
  </motion.div>
))
HoverScale.displayName = 'HoverScale'

// Pulse animation (for notifications, alerts)
export const Pulse = forwardRef(({
  children,
  duration = 2,
  scale = 1.05,
  ...props
}, ref) => (
  <motion.div
    ref={ref}
    animate={{
      scale: [1, scale, 1],
    }}
    transition={{
      duration,
      repeat: Infinity,
      ease: 'easeInOut',
    }}
    {...props}
  >
    {children}
  </motion.div>
))
Pulse.displayName = 'Pulse'

// Shake animation (for errors)
export const Shake = forwardRef(({
  children,
  intensity = 10,
  trigger = false,
  ...props
}, ref) => (
  <motion.div
    ref={ref}
    animate={trigger ? {
      x: [0, -intensity, intensity, -intensity, intensity, 0],
    } : {}}
    transition={{ duration: 0.4 }}
    {...props}
  >
    {children}
  </motion.div>
))
Shake.displayName = 'Shake'

// Page transition wrapper
export const PageTransition = forwardRef(({ children, ...props }, ref) => (
  <motion.div
    ref={ref}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.2, ease: 'easeOut' }}
    {...props}
  >
    {children}
  </motion.div>
))
PageTransition.displayName = 'PageTransition'

// Collapse animation for expandable sections
export const MotionCollapse = forwardRef(({
  children,
  isOpen,
  duration = 0.3,
  ...props
}, ref) => (
  <AnimatePresence initial={false}>
    {isOpen && (
      <motion.div
        ref={ref}
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration, ease: 'easeInOut' }}
        style={{ overflow: 'hidden' }}
        {...props}
      >
        {children}
      </motion.div>
    )}
  </AnimatePresence>
))
MotionCollapse.displayName = 'MotionCollapse'

// Number counter animation (simple fade swap)
export function AnimatedNumber({ value, duration = 1, ...props }) {
  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      key={value}
      {...props}
    >
      <motion.span
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {value}
      </motion.span>
    </motion.span>
  )
}

// Count-up animation — animates from 0 to target value
export function CountUp({
  value,
  duration = 1.2,
  decimals = 0,
  prefix = '',
  suffix = '',
  style,
  className,
}) {
  const motionValue = useMotionValue(0)
  const springValue = useSpring(motionValue, {
    duration: duration * 1000,
    bounce: 0,
  })
  const display = useTransform(springValue, (v) => {
    const num = decimals > 0 ? v.toFixed(decimals) : Math.round(v)
    return `${prefix}${Number(num).toLocaleString()}${suffix}`
  })
  const [hasAnimated, setHasAnimated] = useState(false)
  const ref = useRef(null)

  // Trigger count-up when element enters viewport
  useEffect(() => {
    if (!ref.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          motionValue.set(typeof value === 'number' ? value : 0)
          setHasAnimated(true)
        }
      },
      { threshold: 0.3 }
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [value, hasAnimated, motionValue])

  // Update target when value actually changes after initial animation
  const prevValue = useRef(0)
  useEffect(() => {
    if (hasAnimated && value !== prevValue.current) {
      prevValue.current = value
      motionValue.set(typeof value === 'number' ? value : 0)
    }
  }, [value, hasAnimated, motionValue])

  return (
    <motion.span ref={ref} style={style} className={className}>
      {display}
    </motion.span>
  )
}

// Holographic shine effect — wrap around cards/images for a shimmer on hover
export const HolographicShine = forwardRef(({
  children,
  intensity = 0.15,
  speed = 0.8,
  disabled = false,
  style,
  ...props
}, ref) => {
  const containerRef = useRef(null)

  useEffect(() => {
    if (disabled) return
    const el = containerRef.current
    if (!el) return

    // Inject keyframes once
    const styleId = 'holo-shine-keyframes'
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement('style')
      styleEl.id = styleId
      styleEl.textContent = `
        @keyframes holoShine {
          0% { transform: translateX(-100%) rotate(25deg); }
          100% { transform: translateX(200%) rotate(25deg); }
        }
      `
      document.head.appendChild(styleEl)
    }
  }, [disabled])

  return (
    <motion.div
      ref={(node) => {
        containerRef.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      }}
      style={{
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
      whileHover={disabled ? undefined : 'hover'}
      {...props}
    >
      {children}
      {!disabled && (
        <motion.div
          variants={{
            hover: { opacity: 1 },
          }}
          initial={{ opacity: 0 }}
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: `linear-gradient(
              105deg,
              transparent 30%,
              rgba(124, 138, 255, ${intensity}) 45%,
              rgba(167, 139, 250, ${intensity * 0.8}) 50%,
              rgba(124, 138, 255, ${intensity}) 55%,
              transparent 70%
            )`,
            animation: `holoShine ${speed}s ease-in-out`,
          }}
          transition={{ duration: 0.2 }}
        />
      )}
    </motion.div>
  )
})
HolographicShine.displayName = 'HolographicShine'

// Empty state component with subtle animation
export function EmptyState({
  icon: IconComponent,
  title = 'No data yet',
  description,
  action,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        textAlign: 'center',
      }}
    >
      {IconComponent && (
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            marginBottom: 16,
            opacity: 0.4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {typeof IconComponent === 'function' ? (
            <IconComponent sx={{ fontSize: 64 }} />
          ) : (
            IconComponent
          )}
        </motion.div>
      )}
      <div style={{ color: 'currentColor', opacity: 0.6, fontSize: '1.1rem', fontWeight: 500, marginBottom: 4 }}>
        {title}
      </div>
      {description && (
        <div style={{ color: 'currentColor', opacity: 0.4, fontSize: '0.875rem', maxWidth: 320 }}>
          {description}
        </div>
      )}
      {action && (
        <div style={{ marginTop: 16 }}>{action}</div>
      )}
    </motion.div>
  )
}

// Export AnimatePresence for conditional rendering
export { AnimatePresence, motion }

export default {
  FadeIn,
  SlideIn,
  ScaleIn,
  StaggerContainer,
  StaggerItem,
  HoverScale,
  Pulse,
  Shake,
  PageTransition,
  MotionCollapse,
  AnimatedNumber,
  CountUp,
  HolographicShine,
  EmptyState,
}
