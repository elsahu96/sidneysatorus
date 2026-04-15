#!/usr/bin/env python3
"""
Build the RSF Press Freedom Index JSON lookup.

RSF publishes country-level press freedom scores from 0 (worst) to 100 (best).
This script creates a static JSON file mapping ISO-2 country codes to scores.

The data below is sourced from the 2025 RSF World Press Freedom Index.
Update annually when new data is published.

Usage:
    python scripts/build_rsf_cache.py

Output:
    backend/src/graph/grading/data/rsf.json
"""

import json
import pathlib

_OUTPUT = pathlib.Path(__file__).resolve().parents[1] / "src" / "graph" / "grading" / "data" / "rsf.json"

# 2025 RSF Press Freedom Index scores (0-100, higher = better)
# Source: https://rsf.org/en/index
# ISO-3 → ISO-2 converted from official RSF CSV export.
# Excluded: CSS (OECS regional bloc), CTU (Northern Cyprus — non-UN member).
RSF_DATA: dict[str, float] = {
    "AD": 63.3,    # Andorra
    "AE": 26.91,   # United Arab Emirates
    "AF": 17.88,   # Afghanistan
    "AL": 58.18,   # Albania
    "AM": 73.96,   # Armenia
    "AO": 52.67,   # Angola
    "AR": 56.14,   # Argentina
    "AT": 78.12,   # Austria
    "AU": 75.15,   # Australia
    "AZ": 25.47,   # Azerbaijan
    "BA": 56.33,   # Bosnia-Herzegovina
    "BD": 33.71,   # Bangladesh
    "BE": 80.12,   # Belgium
    "BF": 52.25,   # Burkina Faso
    "BG": 60.78,   # Bulgaria
    "BH": 30.24,   # Bahrain
    "BI": 45.44,   # Burundi
    "BJ": 54.6,    # Benin
    "BN": 53.47,   # Brunei
    "BO": 54.09,   # Bolivia
    "BR": 63.8,    # Brazil
    "BT": 32.62,   # Bhutan
    "BW": 57.64,   # Botswana
    "BY": 25.73,   # Belarus
    "BZ": 68.32,   # Belize
    "CA": 78.75,   # Canada
    "CD": 42.31,   # DR Congo
    "CF": 60.15,   # Central African Republic
    "CG": 60.58,   # Congo-Brazzaville
    "CH": 83.98,   # Switzerland
    "CI": 63.69,   # Côte d'Ivoire
    "CL": 62.25,   # Chile
    "CM": 42.75,   # Cameroon
    "CN": 14.8,    # China
    "CO": 49.8,    # Colombia
    "CR": 73.09,   # Costa Rica
    "CU": 26.03,   # Cuba
    "CV": 74.98,   # Cabo Verde
    "CY": 59.04,   # Cyprus
    "CZ": 83.96,   # Czechia
    "DE": 83.85,   # Germany
    "DJ": 25.36,   # Djibouti
    "DK": 86.93,   # Denmark
    "DO": 69.87,   # Dominican Republic
    "DZ": 44.64,   # Algeria
    "EC": 53.76,   # Ecuador
    "EE": 89.46,   # Estonia
    "EG": 24.74,   # Egypt
    "ER": 11.32,   # Eritrea
    "ES": 77.35,   # Spain
    "ET": 36.92,   # Ethiopia
    "FI": 87.18,   # Finland
    "FJ": 71.2,    # Fiji
    "FR": 76.62,   # France
    "GA": 70.65,   # Gabon
    "GB": 78.89,   # United Kingdom
    "GE": 50.53,   # Georgia
    "GH": 67.13,   # Ghana
    "GM": 65.49,   # Gambia
    "GN": 52.53,   # Guinea
    "GQ": 48.68,   # Equatorial Guinea
    "GR": 55.37,   # Greece
    "GT": 40.32,   # Guatemala
    "GW": 51.36,   # Guinea-Bissau
    "GY": 60.12,   # Guyana
    "HK": 39.86,   # Hong Kong
    "HN": 38.51,   # Honduras
    "HR": 64.2,    # Croatia
    "HT": 51.06,   # Haiti
    "HU": 62.82,   # Hungary
    "ID": 44.13,   # Indonesia
    "IE": 86.92,   # Ireland
    "IL": 51.06,   # Israel
    "IN": 32.96,   # India
    "IQ": 30.69,   # Iraq
    "IR": 16.22,   # Iran
    "IS": 81.36,   # Iceland
    "IT": 68.01,   # Italy
    "JM": 75.83,   # Jamaica
    "JO": 35.25,   # Jordan
    "JP": 63.14,   # Japan
    "KE": 49.41,   # Kenya
    "KG": 37.46,   # Kyrgyzstan
    "KH": 28.18,   # Cambodia
    "KM": 59.27,   # Comoros
    "KP": 12.64,   # North Korea
    "KR": 64.06,   # South Korea
    "KW": 44.06,   # Kuwait
    "KZ": 39.34,   # Kazakhstan
    "LA": 33.22,   # Laos
    "LB": 42.62,   # Lebanon
    "LI": 83.42,   # Liechtenstein
    "LK": 39.93,   # Sri Lanka
    "LR": 66.61,   # Liberia
    "LS": 52.07,   # Lesotho
    "LT": 82.27,   # Lithuania
    "LU": 83.04,   # Luxembourg
    "LV": 81.82,   # Latvia
    "LY": 40.42,   # Libya
    "MA": 48.04,   # Morocco / Western Sahara
    "MD": 73.36,   # Moldova
    "ME": 72.83,   # Montenegro
    "MG": 50.8,    # Madagascar
    "MK": 70.44,   # North Macedonia
    "ML": 48.23,   # Mali
    "MM": 25.32,   # Myanmar
    "MN": 52.57,   # Mongolia
    "MR": 67.52,   # Mauritania
    "MT": 62.96,   # Malta
    "MU": 67.31,   # Mauritius
    "MV": 52.46,   # Maldives
    "MW": 59.2,    # Malawi
    "MX": 45.55,   # Mexico
    "MY": 56.09,   # Malaysia
    "MZ": 52.63,   # Mozambique
    "NA": 75.35,   # Namibia
    "NE": 57.05,   # Niger
    "NG": 46.81,   # Nigeria
    "NI": 22.83,   # Nicaragua
    "NL": 88.64,   # Netherlands
    "NO": 92.31,   # Norway
    "NP": 55.2,    # Nepal
    "NZ": 81.37,   # New Zealand
    "OM": 42.29,   # Oman
    "PA": 66.75,   # Panama
    "PE": 42.88,   # Peru
    "PG": 58.35,   # Papua New Guinea
    "PH": 49.57,   # Philippines
    "PK": 29.62,   # Pakistan
    "PL": 74.79,   # Poland
    "PS": 27.41,   # Palestine
    "PT": 84.26,   # Portugal
    "PY": 56.84,   # Paraguay
    "QA": 58.25,   # Qatar
    "RO": 66.42,   # Romania
    "RS": 53.55,   # Serbia
    "RU": 24.57,   # Russia
    "RW": 35.84,   # Rwanda
    "SA": 27.94,   # Saudi Arabia
    "SC": 68.56,   # Seychelles
    "SD": 30.34,   # Sudan
    "SE": 88.13,   # Sweden
    "SG": 45.78,   # Singapore
    "SI": 74.06,   # Slovenia
    "SK": 71.93,   # Slovakia
    "SL": 66.36,   # Sierra Leone
    "SN": 59.43,   # Senegal
    "SO": 40.49,   # Somalia
    "SR": 74.49,   # Suriname
    "SS": 51.63,   # South Sudan
    "SV": 41.19,   # El Salvador
    "SY": 15.82,   # Syria
    "SZ": 52.86,   # Eswatini
    "TD": 51.89,   # Chad
    "TG": 48.03,   # Togo
    "TH": 56.72,   # Thailand
    "TJ": 32.21,   # Tajikistan
    "TL": 71.79,   # East Timor
    "TM": 19.14,   # Turkmenistan
    "TN": 43.48,   # Tunisia
    "TO": 68.39,   # Tonga
    "TR": 29.4,    # Türkiye
    "TT": 79.71,   # Trinidad and Tobago
    "TW": 77.04,   # Taiwan
    "TZ": 53.68,   # Tanzania
    "UA": 63.93,   # Ukraine
    "UG": 37.61,   # Uganda
    "US": 65.49,   # United States
    "UY": 65.18,   # Uruguay
    "UZ": 35.24,   # Uzbekistan
    "VE": 29.21,   # Venezuela
    "VN": 19.74,   # Vietnam
    "WS": 69.28,   # Samoa
    "XK": 52.73,   # Kosovo
    "YE": 31.45,   # Yemen
    "ZA": 75.71,   # South Africa
    "ZM": 57.33,   # Zambia
    "ZW": 52.1,    # Zimbabwe
}


def main():
    _OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with _OUTPUT.open("w", encoding="utf-8") as f:
        json.dump(RSF_DATA, f, ensure_ascii=False, indent=2, sort_keys=True)
    print(f"Wrote {len(RSF_DATA)} country entries to {_OUTPUT}")


if __name__ == "__main__":
    main()
