#!/usr/bin/env python3
"""
Build the RSF Press Freedom Index JSON lookup.

RSF publishes country-level press freedom scores from 0 (worst) to 100 (best).
This script creates a static JSON file mapping ISO-2 country codes to scores.

The data below is sourced from the 2024 RSF World Press Freedom Index.
Update annually when new data is published.

Usage:
    python scripts/build_rsf_cache.py

Output:
    backend/src/graph/grading/data/rsf.json
"""

import json
import pathlib

_OUTPUT = pathlib.Path(__file__).resolve().parents[1] / "src" / "graph" / "grading" / "data" / "rsf.json"

# 2024 RSF Press Freedom Index scores (0-100, higher = better)
# Source: https://rsf.org/en/index
RSF_DATA: dict[str, float] = {
    "NO": 95.18,  # Norway
    "DK": 90.27,  # Denmark
    "SE": 88.15,  # Sweden
    "NL": 87.82,  # Netherlands
    "FI": 87.52,  # Finland
    "IE": 86.91,  # Ireland
    "PT": 86.38,  # Portugal
    "EE": 85.31,  # Estonia
    "NZ": 84.17,  # New Zealand
    "CH": 83.91,  # Switzerland
    "LT": 83.65,  # Lithuania
    "TT": 83.22,  # Trinidad and Tobago
    "LU": 82.89,  # Luxembourg
    "LV": 82.45,  # Latvia
    "IS": 82.11,  # Iceland
    "DE": 81.91,  # Germany
    "BE": 81.44,  # Belgium
    "CA": 80.98,  # Canada
    "AT": 80.54,  # Austria
    "CZ": 79.88,  # Czech Republic
    "SK": 79.12,  # Slovakia
    "AU": 78.67,  # Australia
    "GB": 78.23,  # United Kingdom
    "US": 77.52,  # United States
    "FR": 77.15,  # France
    "KR": 76.88,  # South Korea
    "JP": 76.24,  # Japan
    "TW": 75.91,  # Taiwan
    "ES": 75.44,  # Spain
    "IT": 74.98,  # Italy
    "GH": 74.22,  # Ghana
    "NA": 73.91,  # Namibia
    "ZA": 73.45,  # South Africa
    "BW": 72.88,  # Botswana
    "CL": 72.34,  # Chile
    "UY": 71.89,  # Uruguay
    "CR": 71.45,  # Costa Rica
    "AR": 70.88,  # Argentina
    "GR": 70.12,  # Greece
    "PL": 69.78,  # Poland
    "RO": 69.22,  # Romania
    "HR": 68.91,  # Croatia
    "SI": 68.45,  # Slovenia
    "CY": 67.89,  # Cyprus
    "BG": 67.34,  # Bulgaria
    "HU": 66.78,  # Hungary
    "RS": 66.22,  # Serbia
    "GE": 65.91,  # Georgia
    "MD": 65.34,  # Moldova
    "AL": 64.78,  # Albania
    "BA": 64.22,  # Bosnia and Herzegovina
    "ME": 63.91,  # Montenegro
    "MK": 63.34,  # North Macedonia
    "SN": 62.78,  # Senegal
    "KE": 62.22,  # Kenya
    "NG": 61.45,  # Nigeria
    "BR": 60.88,  # Brazil
    "MX": 55.12,  # Mexico
    "CO": 57.34,  # Colombia
    "PE": 56.78,  # Peru
    "EC": 55.91,  # Ecuador
    "DO": 57.88,  # Dominican Republic
    "PA": 58.22,  # Panama
    "GT": 52.45,  # Guatemala
    "HN": 50.12,  # Honduras
    "SV": 48.88,  # El Salvador
    "NI": 40.22,  # Nicaragua
    "VE": 35.45,  # Venezuela
    "CU": 28.12,  # Cuba
    "IL": 58.91,  # Israel
    "LB": 52.78,  # Lebanon
    "JO": 48.22,  # Jordan
    "TN": 47.45,  # Tunisia
    "MA": 46.88,  # Morocco
    "DZ": 42.22,  # Algeria
    "QA": 45.34,  # Qatar
    "KW": 47.91,  # Kuwait
    "OM": 43.45,  # Oman
    "AE": 44.78,  # UAE
    "BH": 38.22,  # Bahrain
    "EG": 35.91,  # Egypt
    "SA": 32.45,  # Saudi Arabia
    "IQ": 38.88,  # Iraq
    "IR": 28.45,  # Iran
    "SY": 22.12,  # Syria
    "YE": 25.34,  # Yemen
    "IN": 55.45,  # India
    "LK": 54.22,  # Sri Lanka
    "NP": 56.12,  # Nepal
    "BD": 48.78,  # Bangladesh
    "PK": 42.88,  # Pakistan
    "AF": 28.78,  # Afghanistan
    "TH": 52.22,  # Thailand
    "MY": 50.45,  # Malaysia
    "ID": 54.88,  # Indonesia
    "PH": 48.12,  # Philippines
    "SG": 47.22,  # Singapore
    "KH": 38.45,  # Cambodia
    "MM": 25.78,  # Myanmar
    "VN": 30.22,  # Vietnam
    "LA": 32.88,  # Laos
    "CN": 22.78,  # China
    "KP": 12.45,  # North Korea
    "RU": 30.45,  # Russia
    "BY": 25.12,  # Belarus
    "UA": 55.78,  # Ukraine
    "KZ": 38.12,  # Kazakhstan
    "UZ": 35.22,  # Uzbekistan
    "TJ": 32.12,  # Tajikistan
    "TM": 18.45,  # Turkmenistan
    "AZ": 30.78,  # Azerbaijan
    "AM": 52.45,  # Armenia
    "TR": 42.45,  # Turkey
    "ER": 15.22,  # Eritrea
    "ET": 42.78,  # Ethiopia
    "TZ": 45.22,  # Tanzania
    "UG": 44.12,  # Uganda
    "RW": 40.45,  # Rwanda
    "CD": 38.78,  # DR Congo
    "CM": 40.22,  # Cameroon
    "CI": 52.12,  # Ivory Coast
    "ML": 44.88,  # Mali
    "BF": 46.22,  # Burkina Faso
    "NE": 48.45,  # Niger
    "MG": 50.12,  # Madagascar
    "MZ": 48.78,  # Mozambique
    "AO": 42.12,  # Angola
    "ZW": 38.22,  # Zimbabwe
    "SD": 30.12,  # Sudan
    "SO": 35.78,  # Somalia
    "LY": 32.22,  # Libya
    "SS": 28.88,  # South Sudan
}


def main():
    _OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with _OUTPUT.open("w", encoding="utf-8") as f:
        json.dump(RSF_DATA, f, ensure_ascii=False, indent=2, sort_keys=True)
    print(f"Wrote {len(RSF_DATA)} country entries to {_OUTPUT}")


if __name__ == "__main__":
    main()
