"""Rebuild the browser dataset from the supplied CSVs; no third-party dependencies."""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ALIASES = {
    "Cote d'Ivoire": "CIV", "Congo, Dem. Rep.": "COD", "Congo, Rep.": "COG",
    "Czech Republic": "CZE", "Micronesia, Fed. Sts.": "FSM", "United Kingdom": "GBR",
    "Hong Kong, China": "HKG", "Kyrgyz Republic": "KGZ", "St. Kitts and Nevis": "KNA",
    "Slovak Republic": "SVK", "Turkey": "TUR", "United States": "USA",
    "St. Vincent and the Grenadines": "VCT",
}
CONTINENTS = {"AF": "Africa", "AS": "Asia", "EU": "Europe", "NA": "North America", "SA": "South America", "OC": "Oceania"}


def number(value):
    if not value.strip():
        return None
    multipliers = {"k": 1000, "M": 1_000_000, "B": 1_000_000_000}
    return float(value[:-1]) * multipliers[value[-1]] if value[-1] in multipliers else float(value)


def read(name):
    with (ROOT / "data" / "raw" / name).open(newline="") as handle:
        reader = csv.DictReader(handle)
        years = [int(y) for y in reader.fieldnames if y != "country"]
        return years, {r["country"]: [number(r[str(y)]) for y in years] for r in reader}


def prepare():
    with (ROOT / "data" / "country-codes.csv").open(newline="") as handle:
        metadata = list(csv.DictReader(handle))
    index = {r[k].casefold(): r for r in metadata for k in
             ("CLDR display name", "official_name_en", "UNTERM English Short", "ISO3166-1-Alpha-3") if r[k]}
    years, income = read("income_per_person_gdppercapita_ppp_inflation_adjusted.csv")
    life_years, life = read("life_expectancy_years.csv")
    pop_years, population = read("population_total.csv")
    assert years == life_years == pop_years
    assert set(income) == set(life) == set(population)
    source_years = years
    years = list(range(min(source_years), max(source_years) + 1))
    def align(values):
        by_year = dict(zip(source_years, values))
        return [by_year.get(year) for year in years]
    countries = []
    for name in sorted(income):
        info = index[ALIASES.get(name, name).casefold()]
        countries.append({"name": name, "code": info["ISO3166-1-Alpha-3"],
                          "continent": CONTINENTS[info["Continent"]],
                          "income": align(income[name]), "life": align(life[name]), "population": align(population[name])})
    data = {"years": years, "missingYears": sorted(set(years) - set(source_years)), "countries": countries}
    (ROOT / "data" / "world.json").write_text(json.dumps(data, separators=(",", ":"), allow_nan=False) + "\n")
    missing = sum(v is None for c in countries for v in c["life"])
    print(f"Prepared {len(countries)} countries across {len(years)} calendar years ({len(source_years)} supplied); {missing} missing life-expectancy observations.")


if __name__ == "__main__":
    prepare()
