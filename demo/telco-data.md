# Orbit Telco Demo Data

## Database: `orbit-telco`

This demo showcases a telecommunications company's core data model with customers, service plans, usage records, and billing.

---

## Collection: `plans` (6 documents)

Service plans offered by the carrier.

```javascript
[
  {
    "_id": "plan_unlimited_pro",
    "name": "Unlimited Pro",
    "type": "postpaid",
    "monthlyRate": 85.00,
    "dataLimit": null,
    "voiceMinutes": null,
    "textLimit": null,
    "features": ["5G", "hotspot_50gb", "international_text", "hd_streaming"],
    "active": true
  },
  {
    "_id": "plan_unlimited_basic",
    "name": "Unlimited Basic",
    "type": "postpaid",
    "monthlyRate": 65.00,
    "dataLimit": null,
    "voiceMinutes": null,
    "textLimit": null,
    "features": ["5G", "hotspot_10gb", "sd_streaming"],
    "active": true
  },
  {
    "_id": "plan_family_share",
    "name": "Family Share 100GB",
    "type": "postpaid",
    "monthlyRate": 120.00,
    "dataLimit": 102400,
    "voiceMinutes": null,
    "textLimit": null,
    "features": ["5G", "hotspot_20gb", "hd_streaming", "multi_line_discount"],
    "active": true
  },
  {
    "_id": "plan_prepaid_30",
    "name": "Prepaid 30",
    "type": "prepaid",
    "monthlyRate": 30.00,
    "dataLimit": 5120,
    "voiceMinutes": 500,
    "textLimit": 1000,
    "features": ["4G"],
    "active": true
  },
  {
    "_id": "plan_prepaid_50",
    "name": "Prepaid 50",
    "type": "prepaid",
    "monthlyRate": 50.00,
    "dataLimit": 15360,
    "voiceMinutes": null,
    "textLimit": null,
    "features": ["5G", "hotspot_5gb"],
    "active": true
  },
  {
    "_id": "plan_business_elite",
    "name": "Business Elite",
    "type": "postpaid",
    "monthlyRate": 95.00,
    "dataLimit": null,
    "voiceMinutes": null,
    "textLimit": null,
    "features": ["5G", "hotspot_100gb", "priority_support", "international_roaming", "hd_streaming"],
    "active": true
  }
]
```

---

## Collection: `customers` (25 documents)

Subscriber profiles with plan assignments.

```javascript
[
  {
    "_id": "cust_1001",
    "firstName": "Maria",
    "lastName": "Santos",
    "email": "maria.santos@email.com",
    "phone": "555-0101",
    "planId": "plan_unlimited_pro",
    "accountStatus": "active",
    "region": "northeast",
    "signupDate": "2022-03-15",
    "autopay": true
  },
  {
    "_id": "cust_1002",
    "firstName": "James",
    "lastName": "Chen",
    "email": "jchen@email.com",
    "phone": "555-0102",
    "planId": "plan_family_share",
    "accountStatus": "active",
    "region": "west",
    "signupDate": "2021-08-22",
    "autopay": true
  },
  {
    "_id": "cust_1003",
    "firstName": "Aisha",
    "lastName": "Patel",
    "email": "aisha.p@email.com",
    "phone": "555-0103",
    "planId": "plan_prepaid_50",
    "accountStatus": "active",
    "region": "south",
    "signupDate": "2023-01-10",
    "autopay": false
  },
  {
    "_id": "cust_1004",
    "firstName": "Robert",
    "lastName": "Kim",
    "email": "rkim@business.com",
    "phone": "555-0104",
    "planId": "plan_business_elite",
    "accountStatus": "active",
    "region": "west",
    "signupDate": "2020-11-05",
    "autopay": true
  },
  {
    "_id": "cust_1005",
    "firstName": "Sofia",
    "lastName": "Rodriguez",
    "email": "sofia.r@email.com",
    "phone": "555-0105",
    "planId": "plan_unlimited_basic",
    "accountStatus": "active",
    "region": "south",
    "signupDate": "2023-06-18",
    "autopay": true
  },
  {
    "_id": "cust_1006",
    "firstName": "David",
    "lastName": "Thompson",
    "email": "dthompson@email.com",
    "phone": "555-0106",
    "planId": "plan_prepaid_30",
    "accountStatus": "active",
    "region": "midwest",
    "signupDate": "2024-02-01",
    "autopay": false
  },
  {
    "_id": "cust_1007",
    "firstName": "Emily",
    "lastName": "Okonkwo",
    "email": "eokonkwo@email.com",
    "phone": "555-0107",
    "planId": "plan_unlimited_pro",
    "accountStatus": "active",
    "region": "northeast",
    "signupDate": "2022-09-30",
    "autopay": true
  },
  {
    "_id": "cust_1008",
    "firstName": "Michael",
    "lastName": "Brown",
    "email": "mbrown@business.com",
    "phone": "555-0108",
    "planId": "plan_business_elite",
    "accountStatus": "active",
    "region": "northeast",
    "signupDate": "2021-04-12",
    "autopay": true
  },
  {
    "_id": "cust_1009",
    "firstName": "Lisa",
    "lastName": "Nguyen",
    "email": "lnguyen@email.com",
    "phone": "555-0109",
    "planId": "plan_family_share",
    "accountStatus": "active",
    "region": "west",
    "signupDate": "2022-07-25",
    "autopay": true
  },
  {
    "_id": "cust_1010",
    "firstName": "Carlos",
    "lastName": "Mendez",
    "email": "cmendez@email.com",
    "phone": "555-0110",
    "planId": "plan_prepaid_50",
    "accountStatus": "suspended",
    "region": "south",
    "signupDate": "2023-03-08",
    "autopay": false
  },
  {
    "_id": "cust_1011",
    "firstName": "Sarah",
    "lastName": "Williams",
    "email": "swilliams@email.com",
    "phone": "555-0111",
    "planId": "plan_unlimited_basic",
    "accountStatus": "active",
    "region": "midwest",
    "signupDate": "2023-11-15",
    "autopay": true
  },
  {
    "_id": "cust_1012",
    "firstName": "Kevin",
    "lastName": "Park",
    "email": "kpark@business.com",
    "phone": "555-0112",
    "planId": "plan_business_elite",
    "accountStatus": "active",
    "region": "west",
    "signupDate": "2021-01-20",
    "autopay": true
  },
  {
    "_id": "cust_1013",
    "firstName": "Jennifer",
    "lastName": "Davis",
    "email": "jdavis@email.com",
    "phone": "555-0113",
    "planId": "plan_unlimited_pro",
    "accountStatus": "active",
    "region": "south",
    "signupDate": "2022-05-11",
    "autopay": false
  },
  {
    "_id": "cust_1014",
    "firstName": "Ahmed",
    "lastName": "Hassan",
    "email": "ahassan@email.com",
    "phone": "555-0114",
    "planId": "plan_prepaid_30",
    "accountStatus": "active",
    "region": "northeast",
    "signupDate": "2024-01-05",
    "autopay": false
  },
  {
    "_id": "cust_1015",
    "firstName": "Rachel",
    "lastName": "Green",
    "email": "rgreen@email.com",
    "phone": "555-0115",
    "planId": "plan_family_share",
    "accountStatus": "active",
    "region": "midwest",
    "signupDate": "2022-10-08",
    "autopay": true
  },
  {
    "_id": "cust_1016",
    "firstName": "Thomas",
    "lastName": "Anderson",
    "email": "tanderson@business.com",
    "phone": "555-0116",
    "planId": "plan_business_elite",
    "accountStatus": "active",
    "region": "northeast",
    "signupDate": "2020-06-15",
    "autopay": true
  },
  {
    "_id": "cust_1017",
    "firstName": "Nina",
    "lastName": "Kowalski",
    "email": "nkowalski@email.com",
    "phone": "555-0117",
    "planId": "plan_unlimited_basic",
    "accountStatus": "active",
    "region": "midwest",
    "signupDate": "2023-08-22",
    "autopay": true
  },
  {
    "_id": "cust_1018",
    "firstName": "Marcus",
    "lastName": "Johnson",
    "email": "mjohnson@email.com",
    "phone": "555-0118",
    "planId": "plan_prepaid_50",
    "accountStatus": "active",
    "region": "south",
    "signupDate": "2023-04-17",
    "autopay": false
  },
  {
    "_id": "cust_1019",
    "firstName": "Angela",
    "lastName": "Martinez",
    "email": "amartinez@email.com",
    "phone": "555-0119",
    "planId": "plan_unlimited_pro",
    "accountStatus": "active",
    "region": "west",
    "signupDate": "2022-12-01",
    "autopay": true
  },
  {
    "_id": "cust_1020",
    "firstName": "Daniel",
    "lastName": "Lee",
    "email": "dlee@email.com",
    "phone": "555-0120",
    "planId": "plan_prepaid_30",
    "accountStatus": "cancelled",
    "region": "west",
    "signupDate": "2023-02-28",
    "autopay": false
  },
  {
    "_id": "cust_1021",
    "firstName": "Olivia",
    "lastName": "Wilson",
    "email": "owilson@email.com",
    "phone": "555-0121",
    "planId": "plan_family_share",
    "accountStatus": "active",
    "region": "northeast",
    "signupDate": "2021-11-10",
    "autopay": true
  },
  {
    "_id": "cust_1022",
    "firstName": "Brian",
    "lastName": "Taylor",
    "email": "btaylor@business.com",
    "phone": "555-0122",
    "planId": "plan_business_elite",
    "accountStatus": "active",
    "region": "south",
    "signupDate": "2021-07-03",
    "autopay": true
  },
  {
    "_id": "cust_1023",
    "firstName": "Grace",
    "lastName": "Liu",
    "email": "gliu@email.com",
    "phone": "555-0123",
    "planId": "plan_unlimited_basic",
    "accountStatus": "active",
    "region": "west",
    "signupDate": "2024-01-12",
    "autopay": true
  },
  {
    "_id": "cust_1024",
    "firstName": "Victor",
    "lastName": "Reyes",
    "email": "vreyes@email.com",
    "phone": "555-0124",
    "planId": "plan_prepaid_50",
    "accountStatus": "active",
    "region": "south",
    "signupDate": "2023-09-05",
    "autopay": false
  },
  {
    "_id": "cust_1025",
    "firstName": "Hannah",
    "lastName": "Scott",
    "email": "hscott@email.com",
    "phone": "555-0125",
    "planId": "plan_unlimited_pro",
    "accountStatus": "active",
    "region": "midwest",
    "signupDate": "2022-08-19",
    "autopay": true
  }
]
```

---

## Collection: `usage` (50 documents)

Monthly usage records for each customer. Data in MB, voice in minutes.

```javascript
[
  { "_id": "usage_1001_2024_01", "customerId": "cust_1001", "period": "2024-01", "dataMB": 45200, "voiceMinutes": 320, "textCount": 1850, "roamingMB": 0 },
  { "_id": "usage_1001_2024_02", "customerId": "cust_1001", "period": "2024-02", "dataMB": 52100, "voiceMinutes": 285, "textCount": 2100, "roamingMB": 1200 },
  { "_id": "usage_1002_2024_01", "customerId": "cust_1002", "period": "2024-01", "dataMB": 78500, "voiceMinutes": 890, "textCount": 3200, "roamingMB": 0 },
  { "_id": "usage_1002_2024_02", "customerId": "cust_1002", "period": "2024-02", "dataMB": 82300, "voiceMinutes": 1020, "textCount": 2950, "roamingMB": 0 },
  { "_id": "usage_1003_2024_01", "customerId": "cust_1003", "period": "2024-01", "dataMB": 12400, "voiceMinutes": 180, "textCount": 890, "roamingMB": 0 },
  { "_id": "usage_1003_2024_02", "customerId": "cust_1003", "period": "2024-02", "dataMB": 14200, "voiceMinutes": 95, "textCount": 1100, "roamingMB": 0 },
  { "_id": "usage_1004_2024_01", "customerId": "cust_1004", "period": "2024-01", "dataMB": 38900, "voiceMinutes": 1450, "textCount": 520, "roamingMB": 8500 },
  { "_id": "usage_1004_2024_02", "customerId": "cust_1004", "period": "2024-02", "dataMB": 41200, "voiceMinutes": 1680, "textCount": 480, "roamingMB": 12000 },
  { "_id": "usage_1005_2024_01", "customerId": "cust_1005", "period": "2024-01", "dataMB": 28700, "voiceMinutes": 120, "textCount": 2400, "roamingMB": 0 },
  { "_id": "usage_1005_2024_02", "customerId": "cust_1005", "period": "2024-02", "dataMB": 31500, "voiceMinutes": 145, "textCount": 2650, "roamingMB": 0 },
  { "_id": "usage_1006_2024_01", "customerId": "cust_1006", "period": "2024-01", "dataMB": 3200, "voiceMinutes": 380, "textCount": 650, "roamingMB": 0 },
  { "_id": "usage_1006_2024_02", "customerId": "cust_1006", "period": "2024-02", "dataMB": 4100, "voiceMinutes": 420, "textCount": 780, "roamingMB": 0 },
  { "_id": "usage_1007_2024_01", "customerId": "cust_1007", "period": "2024-01", "dataMB": 67800, "voiceMinutes": 210, "textCount": 3100, "roamingMB": 500 },
  { "_id": "usage_1007_2024_02", "customerId": "cust_1007", "period": "2024-02", "dataMB": 72400, "voiceMinutes": 195, "textCount": 3400, "roamingMB": 0 },
  { "_id": "usage_1008_2024_01", "customerId": "cust_1008", "period": "2024-01", "dataMB": 42100, "voiceMinutes": 2100, "textCount": 890, "roamingMB": 15000 },
  { "_id": "usage_1008_2024_02", "customerId": "cust_1008", "period": "2024-02", "dataMB": 39800, "voiceMinutes": 1950, "textCount": 920, "roamingMB": 18500 },
  { "_id": "usage_1009_2024_01", "customerId": "cust_1009", "period": "2024-01", "dataMB": 65200, "voiceMinutes": 780, "textCount": 4200, "roamingMB": 0 },
  { "_id": "usage_1009_2024_02", "customerId": "cust_1009", "period": "2024-02", "dataMB": 71800, "voiceMinutes": 850, "textCount": 3900, "roamingMB": 0 },
  { "_id": "usage_1010_2024_01", "customerId": "cust_1010", "period": "2024-01", "dataMB": 8900, "voiceMinutes": 65, "textCount": 420, "roamingMB": 0 },
  { "_id": "usage_1010_2024_02", "customerId": "cust_1010", "period": "2024-02", "dataMB": 2100, "voiceMinutes": 12, "textCount": 85, "roamingMB": 0 },
  { "_id": "usage_1011_2024_01", "customerId": "cust_1011", "period": "2024-01", "dataMB": 22400, "voiceMinutes": 310, "textCount": 1800, "roamingMB": 0 },
  { "_id": "usage_1011_2024_02", "customerId": "cust_1011", "period": "2024-02", "dataMB": 25100, "voiceMinutes": 280, "textCount": 1950, "roamingMB": 0 },
  { "_id": "usage_1012_2024_01", "customerId": "cust_1012", "period": "2024-01", "dataMB": 55600, "voiceMinutes": 1820, "textCount": 620, "roamingMB": 22000 },
  { "_id": "usage_1012_2024_02", "customerId": "cust_1012", "period": "2024-02", "dataMB": 58200, "voiceMinutes": 2050, "textCount": 710, "roamingMB": 19500 },
  { "_id": "usage_1013_2024_01", "customerId": "cust_1013", "period": "2024-01", "dataMB": 48900, "voiceMinutes": 425, "textCount": 2800, "roamingMB": 0 },
  { "_id": "usage_1013_2024_02", "customerId": "cust_1013", "period": "2024-02", "dataMB": 51200, "voiceMinutes": 390, "textCount": 2650, "roamingMB": 2500 },
  { "_id": "usage_1014_2024_01", "customerId": "cust_1014", "period": "2024-01", "dataMB": 2800, "voiceMinutes": 290, "textCount": 520, "roamingMB": 0 },
  { "_id": "usage_1014_2024_02", "customerId": "cust_1014", "period": "2024-02", "dataMB": 3500, "voiceMinutes": 340, "textCount": 610, "roamingMB": 0 },
  { "_id": "usage_1015_2024_01", "customerId": "cust_1015", "period": "2024-01", "dataMB": 72100, "voiceMinutes": 920, "textCount": 3800, "roamingMB": 0 },
  { "_id": "usage_1015_2024_02", "customerId": "cust_1015", "period": "2024-02", "dataMB": 68500, "voiceMinutes": 880, "textCount": 4100, "roamingMB": 0 },
  { "_id": "usage_1016_2024_01", "customerId": "cust_1016", "period": "2024-01", "dataMB": 35200, "voiceMinutes": 2450, "textCount": 380, "roamingMB": 28000 },
  { "_id": "usage_1016_2024_02", "customerId": "cust_1016", "period": "2024-02", "dataMB": 38100, "voiceMinutes": 2680, "textCount": 420, "roamingMB": 32000 },
  { "_id": "usage_1017_2024_01", "customerId": "cust_1017", "period": "2024-01", "dataMB": 19800, "voiceMinutes": 150, "textCount": 2200, "roamingMB": 0 },
  { "_id": "usage_1017_2024_02", "customerId": "cust_1017", "period": "2024-02", "dataMB": 21400, "voiceMinutes": 180, "textCount": 2450, "roamingMB": 0 },
  { "_id": "usage_1018_2024_01", "customerId": "cust_1018", "period": "2024-01", "dataMB": 11200, "voiceMinutes": 85, "textCount": 1100, "roamingMB": 0 },
  { "_id": "usage_1018_2024_02", "customerId": "cust_1018", "period": "2024-02", "dataMB": 13800, "voiceMinutes": 92, "textCount": 1250, "roamingMB": 0 },
  { "_id": "usage_1019_2024_01", "customerId": "cust_1019", "period": "2024-01", "dataMB": 58200, "voiceMinutes": 540, "textCount": 2900, "roamingMB": 3500 },
  { "_id": "usage_1019_2024_02", "customerId": "cust_1019", "period": "2024-02", "dataMB": 62100, "voiceMinutes": 480, "textCount": 3200, "roamingMB": 0 },
  { "_id": "usage_1020_2024_01", "customerId": "cust_1020", "period": "2024-01", "dataMB": 1800, "voiceMinutes": 120, "textCount": 280, "roamingMB": 0 },
  { "_id": "usage_1020_2024_02", "customerId": "cust_1020", "period": "2024-02", "dataMB": 0, "voiceMinutes": 0, "textCount": 0, "roamingMB": 0 },
  { "_id": "usage_1021_2024_01", "customerId": "cust_1021", "period": "2024-01", "dataMB": 85200, "voiceMinutes": 1100, "textCount": 4500, "roamingMB": 0 },
  { "_id": "usage_1021_2024_02", "customerId": "cust_1021", "period": "2024-02", "dataMB": 79800, "voiceMinutes": 980, "textCount": 4200, "roamingMB": 0 },
  { "_id": "usage_1022_2024_01", "customerId": "cust_1022", "period": "2024-01", "dataMB": 44500, "voiceMinutes": 1750, "textCount": 550, "roamingMB": 9800 },
  { "_id": "usage_1022_2024_02", "customerId": "cust_1022", "period": "2024-02", "dataMB": 47200, "voiceMinutes": 1890, "textCount": 620, "roamingMB": 11200 },
  { "_id": "usage_1023_2024_01", "customerId": "cust_1023", "period": "2024-01", "dataMB": 15800, "voiceMinutes": 95, "textCount": 1400, "roamingMB": 0 },
  { "_id": "usage_1023_2024_02", "customerId": "cust_1023", "period": "2024-02", "dataMB": 18200, "voiceMinutes": 110, "textCount": 1650, "roamingMB": 0 },
  { "_id": "usage_1024_2024_01", "customerId": "cust_1024", "period": "2024-01", "dataMB": 10500, "voiceMinutes": 75, "textCount": 980, "roamingMB": 0 },
  { "_id": "usage_1024_2024_02", "customerId": "cust_1024", "period": "2024-02", "dataMB": 12100, "voiceMinutes": 88, "textCount": 1150, "roamingMB": 0 },
  { "_id": "usage_1025_2024_01", "customerId": "cust_1025", "period": "2024-01", "dataMB": 55800, "voiceMinutes": 380, "textCount": 2700, "roamingMB": 1800 },
  { "_id": "usage_1025_2024_02", "customerId": "cust_1025", "period": "2024-02", "dataMB": 59200, "voiceMinutes": 350, "textCount": 2850, "roamingMB": 0 }
]
```

---

## Collection: `billing` (40 documents)

Monthly billing records with charges breakdown.

```javascript
[
  { "_id": "bill_1001_2024_01", "customerId": "cust_1001", "period": "2024-01", "planCharge": 85.00, "overageCharge": 0, "roamingCharge": 0, "taxes": 7.23, "totalDue": 92.23, "status": "paid", "paidDate": "2024-01-28" },
  { "_id": "bill_1001_2024_02", "customerId": "cust_1001", "period": "2024-02", "planCharge": 85.00, "overageCharge": 0, "roamingCharge": 12.00, "taxes": 8.25, "totalDue": 105.25, "status": "paid", "paidDate": "2024-02-26" },
  { "_id": "bill_1002_2024_01", "customerId": "cust_1002", "period": "2024-01", "planCharge": 120.00, "overageCharge": 0, "roamingCharge": 0, "taxes": 10.20, "totalDue": 130.20, "status": "paid", "paidDate": "2024-01-25" },
  { "_id": "bill_1002_2024_02", "customerId": "cust_1002", "period": "2024-02", "planCharge": 120.00, "overageCharge": 0, "roamingCharge": 0, "taxes": 10.20, "totalDue": 130.20, "status": "paid", "paidDate": "2024-02-24" },
  { "_id": "bill_1003_2024_01", "customerId": "cust_1003", "period": "2024-01", "planCharge": 50.00, "overageCharge": 0, "roamingCharge": 0, "taxes": 4.25, "totalDue": 54.25, "status": "paid", "paidDate": "2024-01-30" },
  { "_id": "bill_1003_2024_02", "customerId": "cust_1003", "period": "2024-02", "planCharge": 50.00, "overageCharge": 0, "roamingCharge": 0, "taxes": 4.25, "totalDue": 54.25, "status": "paid", "paidDate": "2024-02-28" },
  { "_id": "bill_1004_2024_01", "customerId": "cust_1004", "period": "2024-01", "planCharge": 95.00, "overageCharge": 0, "roamingCharge": 85.00, "taxes": 15.30, "totalDue": 195.30, "status": "paid", "paidDate": "2024-01-22" },
  { "_id": "bill_1004_2024_02", "customerId": "cust_1004", "period": "2024-02", "planCharge": 95.00, "overageCharge": 0, "roamingCharge": 120.00, "taxes": 18.28, "totalDue": 233.28, "status": "paid", "paidDate": "2024-02-21" },
  { "_id": "bill_1005_2024_01", "customerId": "cust_1005", "period": "2024-01", "planCharge": 65.00, "overageCharge": 0, "roamingCharge": 0, "taxes": 5.53, "totalDue": 70.53, "status": "paid", "paidDate": "2024-01-27" },
  { "_id": "bill_1005_2024_02", "customerId": "cust_1005", "period": "2024-02", "planCharge": 65.00, "overageCharge": 0, "roamingCharge": 0, "taxes": 5.53, "totalDue": 70.53, "status": "paid", "paidDate": "2024-02-25" },
  { "_id": "bill_1006_2024_01", "customerId": "cust_1006", "period": "2024-01", "planCharge": 30.00, "overageCharge": 0, "roamingCharge": 0, "taxes": 2.55, "totalDue": 32.55, "status": "paid", "paidDate": "2024-02-05" },
  { "_id": "bill_1006_2024_02", "customerId": "cust_1006", "period": "2024-02", "planCharge": 30.00, "overageCharge": 0, "roamingCharge": 0, "taxes": 2.55, "totalDue": 32.55, "status": "paid", "paidDate": "2024-03-02" },
  { "_id": "bill_1007_2024_01", "customerId": "cust_1007", "period": "2024-01", "planCharge": 85.00, "overageCharge": 0, "roamingCharge": 5.00, "taxes": 7.65, "totalDue": 97.65, "status": "paid", "paidDate": "2024-01-29" },
  { "_id": "bill_1007_2024_02", "customerId": "cust_1007", "period": "2024-02", "planCharge": 85.00, "overageCharge": 0, "roamingCharge": 0, "taxes": 7.23, "totalDue": 92.23, "status": "paid", "paidDate": "2024-02-27" },
  { "_id": "bill_1008_2024_01", "customerId": "cust_1008", "period": "2024-01", "planCharge": 95.00, "overageCharge": 0, "roamingCharge": 150.00, "taxes": 20.83, "totalDue": 265.83, "status": "paid", "paidDate": "2024-01-23" },
  { "_id": "bill_1008_2024_02", "customerId": "cust_1008", "period": "2024-02", "planCharge": 95.00, "overageCharge": 0, "roamingCharge": 185.00, "taxes": 23.80, "totalDue": 303.80, "status": "paid", "paidDate": "2024-02-22" },
  { "_id": "bill_1009_2024_01", "customerId": "cust_1009", "period": "2024-01", "planCharge": 120.00, "overageCharge": 0, "roamingCharge": 0, "taxes": 10.20, "totalDue": 130.20, "status": "paid", "paidDate": "2024-01-26" },
  { "_id": "bill_1009_2024_02", "customerId": "cust_1009", "period": "2024-02", "planCharge": 120.00, "overageCharge": 0, "roamingCharge": 0, "taxes": 10.20, "totalDue": 130.20, "status": "paid", "paidDate": "2024-02-25" },
  { "_id": "bill_1010_2024_01", "customerId": "cust_1010", "period": "2024-01", "planCharge": 50.00, "overageCharge": 0, "roamingCharge": 0, "taxes": 4.25, "totalDue": 54.25, "status": "paid", "paidDate": "2024-02-10" },
  { "_id": "bill_1010_2024_02", "customerId": "cust_1010", "period": "2024-02", "planCharge": 50.00, "overageCharge": 0, "roamingCharge": 0, "taxes": 4.25, "totalDue": 54.25, "status": "overdue", "paidDate": null },
  { "_id": "bill_1011_2024_01", "customerId": "cust_1011", "period": "2024-01", "planCharge": 65.00, "overageCharge": 0, "roamingCharge": 0, "taxes": 5.53, "totalDue": 70.53, "status": "paid", "paidDate": "2024-01-28" },
  { "_id": "bill_1011_2024_02", "customerId": "cust_1011", "period": "2024-02", "planCharge": 65.00, "overageCharge": 0, "roamingCharge": 0, "taxes": 5.53, "totalDue": 70.53, "status": "paid", "paidDate": "2024-02-26" },
  { "_id": "bill_1012_2024_01", "customerId": "cust_1012", "period": "2024-01", "planCharge": 95.00, "overageCharge": 0, "roamingCharge": 220.00, "taxes": 26.78, "totalDue": 341.78, "status": "paid", "paidDate": "2024-01-20" },
  { "_id": "bill_1012_2024_02", "customerId": "cust_1012", "period": "2024-02", "planCharge": 95.00, "overageCharge": 0, "roamingCharge": 195.00, "taxes": 24.65, "totalDue": 314.65, "status": "paid", "paidDate": "2024-02-19" },
  { "_id": "bill_1013_2024_01", "customerId": "cust_1013", "period": "2024-01", "planCharge": 85.00, "overageCharge": 0, "roamingCharge": 0, "taxes": 7.23, "totalDue": 92.23, "status": "paid", "paidDate": "2024-02-08" },
  { "_id": "bill_1013_2024_02", "customerId": "cust_1013", "period": "2024-02", "planCharge": 85.00, "overageCharge": 0, "roamingCharge": 25.00, "taxes": 9.35, "totalDue": 119.35, "status": "pending", "paidDate": null },
  { "_id": "bill_1014_2024_01", "customerId": "cust_1014", "period": "2024-01", "planCharge": 30.00, "overageCharge": 0, "roamingCharge": 0, "taxes": 2.55, "totalDue": 32.55, "status": "paid", "paidDate": "2024-02-01" },
  { "_id": "bill_1014_2024_02", "customerId": "cust_1014", "period": "2024-02", "planCharge": 30.00, "overageCharge": 0, "roamingCharge": 0, "taxes": 2.55, "totalDue": 32.55, "status": "paid", "paidDate": "2024-03-01" },
  { "_id": "bill_1015_2024_01", "customerId": "cust_1015", "period": "2024-01", "planCharge": 120.00, "overageCharge": 0, "roamingCharge": 0, "taxes": 10.20, "totalDue": 130.20, "status": "paid", "paidDate": "2024-01-24" },
  { "_id": "bill_1015_2024_02", "customerId": "cust_1015", "period": "2024-02", "planCharge": 120.00, "overageCharge": 0, "roamingCharge": 0, "taxes": 10.20, "totalDue": 130.20, "status": "paid", "paidDate": "2024-02-23" },
  { "_id": "bill_1016_2024_01", "customerId": "cust_1016", "period": "2024-01", "planCharge": 95.00, "overageCharge": 0, "roamingCharge": 280.00, "taxes": 31.88, "totalDue": 406.88, "status": "paid", "paidDate": "2024-01-18" },
  { "_id": "bill_1016_2024_02", "customerId": "cust_1016", "period": "2024-02", "planCharge": 95.00, "overageCharge": 0, "roamingCharge": 320.00, "taxes": 35.28, "totalDue": 450.28, "status": "paid", "paidDate": "2024-02-17" },
  { "_id": "bill_1017_2024_01", "customerId": "cust_1017", "period": "2024-01", "planCharge": 65.00, "overageCharge": 0, "roamingCharge": 0, "taxes": 5.53, "totalDue": 70.53, "status": "paid", "paidDate": "2024-01-30" },
  { "_id": "bill_1017_2024_02", "customerId": "cust_1017", "period": "2024-02", "planCharge": 65.00, "overageCharge": 0, "roamingCharge": 0, "taxes": 5.53, "totalDue": 70.53, "status": "paid", "paidDate": "2024-02-28" },
  { "_id": "bill_1018_2024_01", "customerId": "cust_1018", "period": "2024-01", "planCharge": 50.00, "overageCharge": 0, "roamingCharge": 0, "taxes": 4.25, "totalDue": 54.25, "status": "paid", "paidDate": "2024-02-03" },
  { "_id": "bill_1018_2024_02", "customerId": "cust_1018", "period": "2024-02", "planCharge": 50.00, "overageCharge": 0, "roamingCharge": 0, "taxes": 4.25, "totalDue": 54.25, "status": "paid", "paidDate": "2024-03-01" },
  { "_id": "bill_1019_2024_01", "customerId": "cust_1019", "period": "2024-01", "planCharge": 85.00, "overageCharge": 0, "roamingCharge": 35.00, "taxes": 10.20, "totalDue": 130.20, "status": "paid", "paidDate": "2024-01-27" },
  { "_id": "bill_1019_2024_02", "customerId": "cust_1019", "period": "2024-02", "planCharge": 85.00, "overageCharge": 0, "roamingCharge": 0, "taxes": 7.23, "totalDue": 92.23, "status": "paid", "paidDate": "2024-02-26" },
  { "_id": "bill_1020_2024_01", "customerId": "cust_1020", "period": "2024-01", "planCharge": 30.00, "overageCharge": 0, "roamingCharge": 0, "taxes": 2.55, "totalDue": 32.55, "status": "paid", "paidDate": "2024-02-05" },
  { "_id": "bill_1020_2024_02", "customerId": "cust_1020", "period": "2024-02", "planCharge": 0, "overageCharge": 0, "roamingCharge": 0, "taxes": 0, "totalDue": 0, "status": "cancelled", "paidDate": null }
]
```

---

## Demo Queries

### Simple Query: Find all customers on unlimited plans

```javascript
// Natural language: "Show me all customers on unlimited plans"
db.customers.find({
  planId: { $in: ["plan_unlimited_pro", "plan_unlimited_basic"] }
})
```

### Medium Query: Revenue by plan type

```javascript
// Natural language: "Show total revenue by plan type for January 2024"
db.billing.aggregate([
  { $match: { period: "2024-01", status: "paid" } },
  { $lookup: {
      from: "customers",
      localField: "customerId",
      foreignField: "_id",
      as: "customer"
  }},
  { $unwind: "$customer" },
  { $lookup: {
      from: "plans",
      localField: "customer.planId",
      foreignField: "_id",
      as: "plan"
  }},
  { $unwind: "$plan" },
  { $group: {
      _id: "$plan.type",
      totalRevenue: { $sum: "$totalDue" },
      customerCount: { $sum: 1 },
      avgBill: { $avg: "$totalDue" }
  }},
  { $sort: { totalRevenue: -1 } }
])
```

### Analytical Query: High-value roaming customers

```javascript
// Natural language: "Which business customers have the highest roaming charges? Show their usage patterns."
db.billing.aggregate([
  { $match: { roamingCharge: { $gt: 0 } } },
  { $lookup: {
      from: "customers",
      localField: "customerId",
      foreignField: "_id",
      as: "customer"
  }},
  { $unwind: "$customer" },
  { $match: { "customer.planId": "plan_business_elite" } },
  { $lookup: {
      from: "usage",
      let: { custId: "$customerId", period: "$period" },
      pipeline: [
        { $match: { $expr: { $and: [
          { $eq: ["$customerId", "$$custId"] },
          { $eq: ["$period", "$$period"] }
        ]}}}
      ],
      as: "usage"
  }},
  { $unwind: "$usage" },
  { $project: {
      customerName: { $concat: ["$customer.firstName", " ", "$customer.lastName"] },
      period: 1,
      roamingCharge: 1,
      roamingMB: "$usage.roamingMB",
      voiceMinutes: "$usage.voiceMinutes",
      totalBill: "$totalDue"
  }},
  { $sort: { roamingCharge: -1 } }
])
```

### Regional Analysis

```javascript
// Natural language: "Compare data usage across regions for February 2024"
db.usage.aggregate([
  { $match: { period: "2024-02" } },
  { $lookup: {
      from: "customers",
      localField: "customerId",
      foreignField: "_id",
      as: "customer"
  }},
  { $unwind: "$customer" },
  { $group: {
      _id: "$customer.region",
      totalDataGB: { $sum: { $divide: ["$dataMB", 1024] } },
      avgDataGB: { $avg: { $divide: ["$dataMB", 1024] } },
      customerCount: { $sum: 1 }
  }},
  { $sort: { totalDataGB: -1 } }
])
```

---

## Demo Script Prompts

### Act 1: Local Development

1. "Connect to my local MongoDB"
2. "Create a database called orbit-telco"
3. "Create a plans collection and insert these service plans: [paste plans data]"
4. "Create a customers collection with these subscribers: [paste customers data]"
5. "Create usage and billing collections with this data: [paste data]"
6. "Show me all customers on unlimited plans"
7. "What's the total revenue by plan type for January?"
8. "Which business customers have the highest roaming charges and what are their usage patterns?"

### Act 2: Provision Atlas

9. "Create an M10 cluster in AWS us-east-1 called telco-prod for my project"

### Act 3: Migration

10. "Connect to my Atlas cluster telco-prod"
11. "Copy all collections from the local orbit-telco database to Atlas"
12. "Verify the migration - show collection counts on both local and Atlas"

### Act 4: Atlas Management

13. "Run the regional data usage analysis on Atlas"
14. "Show my current Atlas billing summary"
15. "Run a security audit - show database users and IP access list"
16. "What does Performance Advisor recommend for this cluster?"
