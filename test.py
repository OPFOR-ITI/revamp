import requests

# {"id":"be4e39aa-5b8b-4e52-9006-ed4bced349aa","name":"RAVI SANGEETHA REVANTH"}

# url = "https://app.trackr.gov.sg/api/v1/activities/units"
url = "https://app.trackr.gov.sg/api/v2/attendance/units"

headers = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-SG,en-GB;q=0.9,en;q=0.8",
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) "
        "Version/26.4 Safari/605.1.15"
    ),
    "Referer": "https://app.trackr.gov.sg/",
    "Origin": "https://app.trackr.gov.sg",
    "Cookie": "trackr.sid=s%3A--VhALT-5KOKp1isuAHWViW09E24YzGn.fo8R2KrB8VH8AIKjNaXajTaIa4DU8qD09qil6fF1mQs",
}

# params = {
#     "isPast": "true"
# }

# response = requests.get(url, headers=headers, params=params)

# print(response.status_code)
# print(response.text)

payload = {
    "activityId": "927d1c94-b779-4f16-9a8d-47c512cbfb84",
    "unitIds": ["d370caf4-adda-4785-ae92-166686629e88"]
}

response = requests.post(url, headers=headers, json=payload)

print(response.status_code)
print(response.text[:500])

# echo "# revamp" >> README.md
# git init
# git add README.md
# git commit -m "first commit"
# git branch -M main
# git remote add origin https://github.com/OPFOR-ITI/revamp.git
# git push -u origin main