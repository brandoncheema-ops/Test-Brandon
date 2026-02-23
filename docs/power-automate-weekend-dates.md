# Adding Dates to the Weekend Coverage Email in Power Automate

## The Problem

The current Power Automate flow sends an email saying who worked the weekend **without dates**.
Dr. Volsky wants the email to include the **specific dates**, like:
> "2/21 - Dr. Yurka, 2/22 - Dr. Yurka"

**Key requirement:** Doctor names are NOT known ahead of time. Volsky fills them in **after** the weekend ends.

## How It Works Now

1. Power Automate sends an email on Monday with the **weekend dates** and a **link**
2. Volsky clicks the link, fills in who worked each day
3. The schedule is saved with names + dates

---

## Approach 1: Modify the Existing Power Automate Flow (No API Needed)

### Step-by-Step in Power Automate

#### 1. Open Your Flow
- Go to [https://make.powerautomate.com](https://make.powerautomate.com)
- Find your weekend coverage flow → **Edit**

#### 2. Add Date Variables
After the trigger (Recurrence), add two **"Initialize variable"** actions:

**Saturday's Date:**
- Name: `SaturdayDate`
- Type: String
- Value (expression):
  ```
  formatDateTime(addDays(utcNow(), sub(0, sub(dayOfWeek(utcNow()), 6))), 'M/d')
  ```

**Sunday's Date:**
- Name: `SundayDate`
- Type: String
- Value (expression):
  ```
  formatDateTime(addDays(utcNow(), sub(0, sub(dayOfWeek(utcNow()), 0))), 'M/d')
  ```

#### 3. Update the Email Body
In **"Send an email (V2)"**, set **Is HTML** to **Yes** and use this body:

```html
<h3>Weekend Coverage</h3>
<p><strong>@{variables('SaturdayDate')} - @{variables('SundayDate')}</strong></p>
<table border="1" cellpadding="8">
  <tr><th>Date</th><th>Doctor</th></tr>
  <tr><td>@{variables('SaturdayDate')}</td><td>— pending —</td></tr>
  <tr><td>@{variables('SundayDate')}</td><td>— pending —</td></tr>
</table>
<br>
<a href="https://your-site.com/weekend-coverage.html">Click here to submit who worked</a>
```

#### 4. Save and Test
- Click **Save** → **Test** → **Manually** → **Run flow**

---

## Approach 2: Use the NF6 API + HTML Form (Recommended)

This approach uses the API to auto-generate the email with dates and includes a clickable link for Volsky.

### Flow Overview

```
Monday morning (Recurrence trigger)
  → HTTP GET: /api/weekend-schedule/email-body (gets dates + form link)
  → Send email (V2): paste the HTML body
  → Volsky clicks link in email
  → Fills in doctor names on the form
  → Done
```

### Step 1: Create Weekend Date Entries (Friday)

POST the upcoming weekend dates (no doctor names needed):

```http
POST /api/weekend-schedule/bulk
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "entries": [
    { "date": "2026-02-28" },
    { "date": "2026-03-01" }
  ]
}
```

### Step 2: Power Automate — HTTP Action

Add an **HTTP** action:
- **Method:** GET
- **URI:** `https://your-server.com/api/weekend-schedule/email-body?apiKey=nf6-schedule-key&format=html`

The response is a full HTML email with:
- Weekend dates in a table
- A green **"Submit Weekend Coverage"** button/link

### Step 3: Send the Email

In **"Send an email (V2)"**:
- **To:** Dr. Volsky's email
- **Subject:** `Weekend Coverage`
- **Body:** `@{body('HTTP')}`
- **Is HTML:** Yes

### Step 4: Volsky Clicks the Link

The email contains a button that opens `weekend-coverage.html`:
- Shows Saturday and Sunday dates
- Has text fields next to each date
- Volsky types the doctor names and clicks **Submit**

### API Endpoints Reference

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/weekend-schedule` | GET | JWT | List all schedule entries |
| `/api/weekend-schedule/last-weekend` | GET | JWT | Get last weekend summary + form URL |
| `/api/weekend-schedule/email-body` | GET | API Key | HTML email body for Power Automate |
| `/api/weekend-schedule` | POST | JWT | Add a single date entry |
| `/api/weekend-schedule/bulk` | POST | JWT | Add multiple date entries at once |
| `/api/weekend-schedule/:id` | PUT | JWT | Update entry (fill in doctor name) |
| `/api/weekend-schedule/submit` | PUT | API Key | Submit doctor names from the HTML form |
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

**Before (old):**
> Dr. Yurka worked this weekend

**After (new email Volsky receives on Monday):**

| Date | Doctor On Call |
|------|---------------|
| 2/28 | — pending — |
| 3/1  | — pending — |

**[ Submit Weekend Coverage ]** ← clickable link

**After Volsky fills in names:**

| Date | Doctor On Call |
|------|---------------|
| 2/28 | Dr. Yurka |
| 3/1  | Dr. Yurka |
