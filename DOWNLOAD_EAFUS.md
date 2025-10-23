# How to Download FDA EAFUS Data

## Step 1: Access the Database

Go to: https://hfpappexternal.fda.gov/scripts/fdcc/index.cfm?set=FoodSubstances

## Step 2: Download the Excel File

1. Click the **"Download data from this searchable database in Excel format"** link
2. Save the file as: `data/fda-food-substances.xlsx`

## Step 3: Convert and Import

Once you have the Excel file, run:

```bash
npm install xlsx  # Install Excel parsing library (if not already installed)
node convert-eafus-to-json.js  # Convert Excel to JSON
node import-eafus-data.js  # Import into Supabase
```

## What You'll Get

- **3,971 substances** total
- Includes all GRAS substances, food additives, and color additives
- CAS numbers for chemical identification
- Technical effects (purpose in food)
- CFR regulatory references
- FEMA and JECFA flavor approvals

## Data Fields

The Excel file contains:
- `CAS Reg. No.` - Chemical identifier
- `Substance` - Ingredient name
- `Used for` - Technical effect/purpose
- `21 CFR` - Regulatory citation
- `FEMA GRAS Publication Number`
- `FEMA Number`
- `JECFA Flavor Number`

## After Import

Your GRAS database will contain:
- Current: 186 ingredients
- After import: **~4,000 ingredients!**
- Coverage: **~100% of all FDA-approved food substances**

This will give you the most comprehensive GRAS database possible!
