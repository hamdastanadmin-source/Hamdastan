/**
 * `@hamdastan/ui/chart` — shadcn's Recharts wrapper, on an entry of its own.
 *
 * Not in the main barrel on purpose. That barrel is one client module, so
 * whatever it exports ships with every screen that imports a `Button` from
 * it — and Recharts is about 200 KB gzipped, used by one card at the end of
 * the questionnaire. Here it costs only the screens that draw a chart.
 */

export {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from './primitives/chart';
