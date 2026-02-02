import requests
import json
import time


def search_opoint(search_term, description):
    url = "https://api.opoint.com/search/"
    # Using the token found in the existing script
    token = "3019bf82475212e483d0016d90230cac09451612"

    headers = {
        "Authorization": f"Token {token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    data = {
        "searchterm": search_term,
        "params": {
            "requestedarticles": 50,
            "main": {"header": 1, "summary": 1, "text": 1},
        },
    }
    try:
        response = requests.post(url, headers=headers, json=data)
        if response.status_code == 200:
            results = response.json()
            # Extract and print basic info for each article found
            articles = results.get("searchresult", {}).get("document", [])
            # print(f"Found {len(articles)} articles.")
            for i, article in enumerate(articles, 1):
                header = article.get("header", {}).get("text", "No Title")
                url_link = article.get("url", "No URL")
                print(f"\n[{i}] {header}")
                print(f"    URL: {url_link}")
        else:
            print(f"Error: {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"An error occurred: {e}")


if __name__ == "__main__":
    queries = [
        {
            "term": '"PGPICC" AND ("Markan White" OR "Amita Petrochemical") AND "2026"',
            "desc": "Tracks the primary broker network for Iran's largest petrochemical exporter and its newest front companies.",
        },
        {
            "term": '"HMS Trading FZE" AND "Shahr Bank" AND "petrochemicals"',
            "desc": 'Investigates the "shadow banking" nodes managed by Shahr Bank to move funds via the UAE.',
        },
        {
            "term": '"vessel identity theft" AND "Kallista" AND "Limas"',
            "desc": 'Focuses on the 2026 "zombie vessel" trend where sanctioned tankers hijack the digital and physical identities of legitimate ships.',
        },
        {
            "term": '"shadow fleet" AND "AIS spoofing" AND "Persian Gulf" AND "2026"',
            "desc": "Captures reports on the latest technological manipulation of tracking systems near Iranian ports.",
        },
        {
            "term": '"Empire International Trading FZE" AND "Bank Melli" AND "rahbar"',
            "desc": 'Monitors the "Rahbar" (entrusted company) network used to disguise payments for the National Iranian Oil Company.',
        },
        {
            "term": '"Fiva Plastik" AND "Triolin Trade FZCO" AND "polyethylene"',
            "desc": "Tracks the Turkey-UAE-Iran trade corridor for high-demand polymers.",
        },
        {
            "term": '"Zarringhalam brothers" AND ("Magical Eagle" OR "Ravenala Trading")',
            "desc": "Investigates the Hong Kong-based laundering hub that processes billions in petrochemical proceeds.",
        },
        {
            "term": '"Ship-to-Ship transfer" AND ("Sungai Linggi" OR "Strait of Malacca") AND "Iranian"',
            "desc": 'Identifies the key Southeast Asian transshipment hubs where Iranian cargo is rebranded as "Malaysian Blend."',
        },
        {
            "term": '"OFAC" AND "January 23 2026" AND "shadow fleet"',
            "desc": "Pulls specific details on the most recent tranche of U.S. sanctions targeting 9 vessels and 8 entities.",
        },
        {
            "term": '"Sepehr Energy Jahan" AND "Luan Bird Shipping" AND "2026"',
            "desc": "Tracks the military-linked (IRGC) oil and petrochemical sales arm and its UAE chartering partners.",
        },
    ]

    for q in queries:
        search_opoint(q["term"], q["desc"])
        # Small delay to avoid hitting rate limits if any
        time.sleep(1)
