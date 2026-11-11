export const COLORS = {
  Africa: '#df9e36', Asia: '#e57870', Europe: '#779bd1',
  'North America': '#a48acb', 'South America': '#63b3a2', Oceania: '#8baf65',
};
export const X_DOMAIN = [200, 200000];
export const Y_DOMAIN = [0, 95];

export function logPosition(value, width) {
  return Math.log(value / X_DOMAIN[0]) / Math.log(X_DOMAIN[1] / X_DOMAIN[0]) * width;
}

// The same area-to-population ratio is used in every year, including the legend.
export function bubbleRadius(population, maxRadius = 47) {
  return Math.sqrt(population / 1_500_000_000) * maxRadius;
}

export function observation(country, year, firstYear = 1810) {
  const offset = year - firstYear;
  const i = Math.floor(offset);
  if (i < 0 || i >= country.income.length) return null;
  const fraction = offset - i;
  const at = (values) => {
    if (values[i] == null || (fraction > 0 && values[i + 1] == null)) return null;
    return fraction > 0 ? values[i] + (values[i + 1] - values[i]) * fraction : values[i];
  };
  const income = at(country.income), life = at(country.life), population = at(country.population);
  if (!(income > 0) || life == null || !(population > 0)) return null;
  return { country, income, life, population };
}

export function snapshot(data, year, continents = new Set(Object.keys(COLORS))) {
  return data.countries.filter(c => continents.has(c.continent))
    .map(c => observation(c, year, data.years[0])).filter(Boolean)
    .sort((a, b) => b.population - a.population);
}

export function summarize(points) {
  const population = points.reduce((sum, p) => sum + p.population, 0);
  return {
    count: points.length, population,
    life: population ? points.reduce((sum, p) => sum + p.life * p.population, 0) / population : null,
  };
}
