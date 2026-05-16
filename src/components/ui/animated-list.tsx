"use client"

import { AnimatePresence, motion } from "framer-motion"
import React, { memo, useEffect, useMemo, useState } from "react"
import { cn } from "@/lib/utils"

interface AnimatedListProps {
  className?: string
  children: React.ReactNode
  delay?: number
}

const AnimatedListItem = ({ children }: { children: React.ReactNode }) => {
  return (
    <motion.div
      layout
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1, originY: 0 }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ type: "spring" as const, stiffness: 350, damping: 40 }}
    >
      {children}
    </motion.div>
  )
}

export const AnimatedList = memo(({ className, children, delay = 1000 }: AnimatedListProps) => {
  const [index, setIndex] = useState(0)
  const childrenArray = useMemo(() => React.Children.toArray(children), [children])
  useEffect(() => {
    if (index < childrenArray.length - 1) {
      const timeout = setTimeout(() => setIndex((prev) => prev + 1), delay)
      return () => clearTimeout(timeout)
    }
  }, [index, delay, childrenArray.length])
  const itemsToShow = useMemo(() => childrenArray.slice(0, index + 1).reverse(), [index, childrenArray])
  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <AnimatePresence>
        {itemsToShow.map((item) => (
          <AnimatedListItem key={(item as React.ReactElement).key}>
            {item}
          </AnimatedListItem>
        ))}
      </AnimatePresence>
    </div>
  )
})
AnimatedList.displayName = "AnimatedList"
