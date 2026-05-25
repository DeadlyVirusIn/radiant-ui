/**
 * Container/hunt group configuration — shared between AutomationScheduler and HuntMonitor.
 */

export const CONTAINER_COLORS = {
  1: '#4caf50', // green
  2: '#ff9800', // orange
  3: '#2196f3', // blue
  4: '#9c27b0', // purple
}

export const CONTAINER_LABELS = {
  1: 'C1',
  2: 'C2',
  3: 'C3',
  4: 'C4',
}

export function getContainerColor(groupNum, fallback = '#888') {
  return CONTAINER_COLORS[groupNum] || fallback
}

export function getContainerLabel(groupNum) {
  return CONTAINER_LABELS[groupNum] || `C${groupNum}`
}
