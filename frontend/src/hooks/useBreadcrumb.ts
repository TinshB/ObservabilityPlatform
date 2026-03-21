import { useContext, useEffect } from 'react'
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
