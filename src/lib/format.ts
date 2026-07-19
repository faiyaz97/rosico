const percentageFormatter = new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

export function formatPercentage(value: number) {
  return percentageFormatter.format(value);
}
