# Data provenance

The files in `raw/` were supplied by the project owner for this visualization. They are preserved unchanged. The filenames identify income per person (GDP per capita, PPP and inflation adjusted), life expectancy in years, and total population. No additional original-source metadata, currency base year, or license was supplied in those files.

`country-codes.csv` was retrieved on 2026-11-11 from:

https://raw.githubusercontent.com/datasets/country-codes/main/data/country-codes.csv

Project and attribution information:

https://github.com/datasets/country-codes

https://github.com/datasets/country-codes/blob/main/ATTRIBUTION.txt

The application uses the country names, ISO alpha-3 identifiers, and continent codes from this metadata. Explicit aliases reconcile differences in country names. The raw indicator values are never replaced by values from the metadata source.

`world.json` is a generated representation of these inputs, created by `scripts/prepare_data.py`. Empty observations and the absent year 1847 are represented by JSON `null`.
