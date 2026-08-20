import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge conditional class names and resolve Tailwind conflicts so component
 * consumers can override styles predictably via a `className` prop.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
