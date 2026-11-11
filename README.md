# Wealth of Nations

An interactive exploration of income, life expectancy, and population from **1810 to 2020** for **195 countries and territories**.

**[Open the visualization](https://mklilley.github.io/wealth-of-nations/)** · [GitHub repository](https://github.com/mklilley/wealth-of-nations)

## Explore

- Logarithmic GDP per capita on the horizontal axis; life expectancy on the vertical axis.
- Bubble **area** proportional to population, using a consistent scale over time.
- Six continent colors, with filters in the legend.
- Hover, focus, or tap bubbles to inspect the country, year, and all three values.
- Play/pause, an annual timeline, direct year entry, restart, and animation speed.
- Country search, selection, and historical paths.
- Responsive layout, keyboard controls, accessible labels, and a source/methodology dialog.

The app is plain HTML, CSS, SVG, and JavaScript. There are no runtime packages, backend, API keys, or build step. All data is served with the website. Google Fonts is optional; system fonts are used if it is unavailable.

## Run locally

Requires Python 3. From this folder:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open <http://localhost:4173>. Use an HTTP server rather than opening `index.html` directly, because the app loads its dataset with `fetch` and uses JavaScript modules.

## Data

The supplied originals are preserved in [`data/raw/`](data/raw/):

| File | Measure |
| --- | --- |
| `income_per_person_gdppercapita_ppp_inflation_adjusted.csv` | Income per person, PPP and inflation adjusted |
| `life_expectancy_years.csv` | Life expectancy in years |
| `population_total.csv` | Total population |

Important details:

- The source CSVs contain **210 year columns**, spanning 1810–2020, and **all omit 1847**. The preparation script expands them to a 211-year calendar and inserts `null` for 1847. It never shifts later observations into an earlier year.
- Missing observations stay missing. A bubble is shown only when all three measures exist for the selected country and year. Coverage counts and the represented population update with the visible countries.
- Income values such as `12.3k` are converted to 12,300. The source files do not specify a PPP dollar base year; the visualization does not invent one.
- Playback interpolates linearly between adjacent available annual observations. It does not interpolate across missing observations. Pausing snaps to an annual observation.
- Life-expectancy summaries are weighted by the populations of the visible countries. They are not independently sourced global estimates.
- Continent assignments use the `Continent` field in the [DataHub country-codes dataset](https://github.com/datasets/country-codes). Its downloaded metadata is preserved in [`data/country-codes.csv`](data/country-codes.csv); country-name aliases are explicit in the preparation script. Transcontinental countries follow this source's classification.
- Original estimates are presented as supplied, without revising historical figures or claiming that these files contain current data.

Rebuild [`data/world.json`](data/world.json) deterministically with Python's standard library:

```sh
python3 scripts/prepare_data.py
```

## Tests

Requires Node.js 20 or later. The development-only `happy-dom` package exercises the real app in a simulated DOM.

```sh
npm ci
npm test
```

Tests cover year alignment, the missing 1847 column, number parsing, log scales, population areas, missing observations, interpolation, weighted summaries, actual hover values, playback and pause, rapid toggling, timeline scrubbing, search, historical paths, continent filters, and year bounds. DOM tests do not replace visual browser review.

## Publish to GitHub Pages

The repository can be served directly from the root of `main`:

1. Push the repository to GitHub.
2. In **Settings → Pages**, choose **Deploy from a branch**, branch **main**, directory **/ (root)**.
3. Open the GitHub Pages URL once the deployment completes.

`.nojekyll` enables direct static serving. Asset URLs are relative, so the app works under a repository path such as `/wealth-of-nations/`.

GitHub Actions runs the data preparation and test suite for pushes and pull requests.
