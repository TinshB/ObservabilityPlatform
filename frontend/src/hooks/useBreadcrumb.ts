import { useContext, useEffect, useRef } from 'react'
import { BreadcrumbContext } from '@/components/common/AppBreadcrumbs'

/**
 * Sets a dynamic breadcrumb label for a route parameter value.
 *
 * Call from any page that has a dynamic segment (e.g., :serviceId)
 * to replace the raw param with a human-readable name.
 *
 * @param key   The route parameter value (e.g., the actual serviceId string)
 * @param label The display label (e.g., "order-service")
 */
export function useBreadcrumb(key: string | undefined, label: string | undefined) {
  const { setLabel, removeLabel } = useContext(BreadcrumbContext)

  useEffect(() => {
    if (key && label) {
      setLabel(key, label)
    }
    return () => {
      if (key) removeLabel(key)
    }
  }, [key, label, setLabel, removeLabel])
}

/**
 * Overrides the auto-generated breadcrumb trail with a custom set of crumbs.
 * Clears the override on unmount so other pages fall back to auto-generation.
 */
export function useCustomBreadcrumbs(crumbs: { label: string; path: string }[]) {
  const { setCustomCrumbs } = useContext(BreadcrumbContext)
  const serialized = JSON.stringify(crumbs)
  const prevRef = useRef(serialized)

  useEffect(() => {
    if (prevRef.current !== serialized) {
      prevRef.current = serialized
    }
    setCustomCrumbs(crumbs)
    return () => setCustomCrumbs(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized, setCustomCrumbs])
}
