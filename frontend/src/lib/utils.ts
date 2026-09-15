/** Une clases condicionales para los componentes del sistema visual. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
