# Adding Dates to the Weekend Coverage Email in Power Automate

## The Problem

The current Power Automate flow sends an email like:
> "Dr. Yurka worked this weekend"

Dr. Volsky wants it to include the **specific dates**, like:
> "2/21 - Dr. Yurka, 2/22 - Dr. Yurka"

## Solution Overview

There are **two approaches** depending on your setup:

---

## Approach 1: Modify the Existing Power Automate Flow Directly (No API Needed)

This is the simplest fix if you're already entering the schedule manually in Power Automate or a SharePoint list.

### Step-by-Step Instructions

#### 1. Open Power Automate
- Go to [https://make.powerautomate.com](https://make.powerautomate.com)
- Find your existing weekend coverage flow
- Click **Edit**

#### 2. Add Date Variables
After the trigger (e.g., Recurrence / Schedule), add two **"Initialize variable"** actions:

**Variable 1 — Saturday's Date:**
- Name: `SaturdayDate`
- Type: String
- Value (expression):
  ```
  formatDateTime(addDays(utcNow(), sub(0, sub(dayOfWeek(utcNow()), 6))), 'M/d')
  ```
  > This calculates last Saturday's date in `M/d` format (e.g., `2/21`)

**Variable 2 — Sunday's Date:**
- Name: `SundayDate`
- Type: String
- Value (expression):
  ```
  formatDateTime(addDays(utcNow(), sub(0, sub(dayOfWeek(utcNow()), 0))), 'M/d')
  ```
  > This calculates last Sunday's date in `M/d` format (e.g., `2/22`)

#### 3. Update the Email Body
In the **"Send an email (V2)"** action, replace the current body with:

```
Weekend Coverage Report

@{variables('SaturdayDate')} - @{variables('SaturdayDoctor')}
@{variables('SundayDate')} - @{variables('SundayDoctor')}
```

If the doctor names come from a SharePoint list or Excel file, reference those columns instead of variables.

#### 4. Example: If Using a SharePoint List

If you have a SharePoint list called "Weekend Schedule" with columns:
- `Date` (Date type)
- `DoctorName` (Text type)

Add a **"Get items"** action filtering for last weekend:
- **Filter Query:**
  ```
  Date ge '@{formatDateTime(addDays(utcNow(), sub(0, add(dayOfWeek(utcNow()), 1))), 'yyyy-MM-dd')}' and Date le '@{formatDateTime(utcNow(), 'yyyy-MM-dd')}'
  ```

Then use **"Apply to each"** to build the email body:
- Inside the loop, use **"Append to string variable"**:
  ```
  @{formatDateTime(items('Apply_to_each')?['Date'], 'M/d')} - @{items('Apply_to_each')?['DoctorName']}
  ```

#### 5. Save and Test
- Click **Save**
- Click **Test** → **Manually** → **Run flow**
- Check your email for the updated format

---

## Approach 2: Use the NF6 API (HTTP Connector)

If you prefer to manage schedules through the NF6 app and have Power Automate fetch the data, use the API endpoint we built.

### Step 1: Add Schedule Entries via API

POST entries for each weekend day:

```http
POST /api/weekend-schedule/bulk
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "entries": [
    { "doctorName": "Dr. Yurka", "date": "2026-02-21", "notes": "Saturday coverage" },
    { "doctorName": "Dr. Yurka", "date": "2026-02-22", "notes": "Sunday coverage" }
  ]
}
```

### Step 2: Add an HTTP Action in Power Automate

1. In your flow, add an **"HTTP"** action (requires Premium connector)
2. Configure it:
   - **Method:** GET
   - **URI:** `https://your-server.com/api/weekend-schedule/email-body?apiKey=nf6-schedule-key&format=html`
   - **Headers:** (none needed, API key is in the query string)

3. The response will be a fully formatted HTML email body with dates.

### Step 3: Use the Response in Your Email

In the **"Send an email (V2)"** action:
- Set the **Body** to: `@{body('HTTP')}`
- Make sure **"Is HTML"** is set to **Yes**

### API Endpoints Reference

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/weekend-schedule` | GET | JWT | List all schedule entries |
| `/api/weekend-schedule/last-weekend` | GET | JWT | Get last weekend's summary |
| `/api/weekend-schedule/email-body` | GET | API Key | Get formatted email body for Power Automate |
| `/api/weekend-schedule` | POST | JWT | Add a single schedule entry |
| `/api/weekend-schedule/bulk` | POST | JWT | Add multiple schedule entries at once |
| `/api/weekend-schedule/:id` | DELETE | JWT | Remove a schedule entry |

---

## Quick Reference: Power Automate Date Expressions

| Expression | Result | Description |
|-----------|--------|-------------|
| `formatDateTime(utcNow(), 'M/d')` | `2/23` | Today's date |
| `formatDateTime(addDays(utcNow(), -1), 'M/d')` | `2/22` | Yesterday |
| `dayOfWeek(utcNow())` | `0-6` | 0=Sunday, 6=Saturday |
| `formatDateTime(utcNow(), 'yyyy-MM-dd')` | `2026-02-23` | ISO date format |

---

## Email Output Example

**Before (current):**
> Dr. Yurka worked this weekend

**After (with dates):**
> Weekend Coverage Report
>
> Weekend of 2026-02-21 to 2026-02-22
>
> | Date | Doctor On Call |
> |------|---------------|
> | 2/21 | Dr. Yurka |
> | 2/22 | Dr. Yurka |
>
> Summary: 2/21 - Dr. Yurka, 2/22 - Dr. Yurka
