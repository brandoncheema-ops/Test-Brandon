# Weekend Coverage — Power Automate Email Setup

## Overview

Every Monday, Power Automate sends an email with:
- Last weekend's **dates** (Saturday + Sunday)
- A **link** to a form where the doctor names get filled in

Doctor names are **never hardcoded** — the form is free-fill. Any doctor can be entered for any day.

---

## How to Set Up the Weekly Email in Power Automate (Step by Step)

### Step 1: Create a New Flow

1. Go to [https://make.powerautomate.com](https://make.powerautomate.com)
2. Click **+ Create** → **Automated cloud flow**
3. Name it: `Weekly Weekend Coverage Email`
4. Skip the trigger selection → click **Create**

### Step 2: Add the Recurrence Trigger

1. Click **+ Add a trigger** → search **Recurrence**
2. Set:
   - **Interval:** `1`
   - **Frequency:** `Week`
   - **On these days:** `Monday`
   - **At these hours:** `8` (or whenever you want the email sent)
   - **Time zone:** your time zone (e.g., Eastern)

### Step 3: Add "Initialize Variable" — Saturday Date

1. Click **+ New step** → search **Initialize variable**
2. Set:
   - **Name:** `SaturdayDate`
   - **Type:** String
   - **Value:** click in the box → **Expression** tab → paste:
     ```
     formatDateTime(addDays(utcNow(), sub(0, add(dayOfWeek(utcNow()), 1))), 'M/d')
     ```
   - Click **OK**

### Step 4: Add "Initialize Variable" — Sunday Date

1. Click **+ New step** → **Initialize variable**
2. Set:
   - **Name:** `SundayDate`
   - **Type:** String
   - **Value:** expression:
     ```
     formatDateTime(addDays(utcNow(), sub(0, dayOfWeek(utcNow()))), 'M/d')
     ```

### Step 5: Add "Send an Email (V2)" — Outlook

1. Click **+ New step** → search **Send an email (V2)** (Office 365 Outlook)
2. Set:
   - **To:** the recipient email (Volsky or a distribution list)
   - **Subject:**
     ```
     Weekend Coverage: @{variables('SaturdayDate')} - @{variables('SundayDate')}
     ```
   - **Body:** (click the `</>` code view icon to paste HTML)

```html
<div style="font-family: Segoe UI, Calibri, Arial, sans-serif; max-width: 600px;">
  <div style="background: linear-gradient(135deg, #0d3a2a, #1a5f4a); padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
    <h2 style="color: white; margin: 0;">Weekend Coverage</h2>
    <p style="color: #b8d4cc; margin: 4px 0 0;">@{variables('SaturdayDate')} - @{variables('SundayDate')}</p>
  </div>
  <div style="background: #f9f9f9; padding: 24px; border: 1px solid #e0e0e0; border-top: none;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr style="background: #1a5f4a; color: white;">
        <th style="padding: 10px 14px; text-align: left;">Date</th>
        <th style="padding: 10px 14px; text-align: left;">Doctor On Call</th>
      </tr>
      <tr style="background: white;">
        <td style="padding: 10px 14px; border-bottom: 1px solid #ddd; font-weight: bold;">@{variables('SaturdayDate')}</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #ddd; color: #999; font-style: italic;">— pending —</td>
      </tr>
      <tr style="background: #f0f7f4;">
        <td style="padding: 10px 14px; border-bottom: 1px solid #ddd; font-weight: bold;">@{variables('SundayDate')}</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #ddd; color: #999; font-style: italic;">— pending —</td>
      </tr>
    </table>
    <p style="text-align: center; margin-top: 20px;">
      <a href="https://YOUR-SITE.com/weekend-coverage.html"
         style="display: inline-block; background: #1a5f4a; color: white; padding: 12px 28px;
                text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px;">
        Submit Weekend Coverage
      </a>
    </p>
    <p style="text-align: center; font-size: 12px; color: #999; margin-top: 8px;">
      Click the button to fill in who worked each day
    </p>
  </div>
</div>
```

3. **Important:** Toggle **Is HTML** to **Yes**
4. Replace `https://YOUR-SITE.com` with your actual site URL (e.g., `https://nf6-property-management.onrender.com`)

### Step 6: Save and Test

1. Click **Save** (top right)
2. Click **Test** → **Manually** → **Run flow**
3. Check the recipient's inbox — you should see the email with dates and the green button

---

## What the Email Looks Like

```
Subject: Weekend Coverage: 2/22 - 2/23

┌──────────────────────────────┐
│     Weekend Coverage         │
│       2/22 - 2/23            │
├──────────────────────────────┤
│ Date   │ Doctor On Call      │
│ 2/22   │ — pending —         │
│ 2/23   │ — pending —         │
├──────────────────────────────┤
│   [ Submit Weekend Coverage ] │
│   Click to fill in who worked │
└──────────────────────────────┘
```

## What Happens When They Click the Link

1. The form opens at `weekend-coverage.html`
2. Shows Saturday and Sunday with blank text fields
3. They type any doctor name (free-fill, no dropdown — any name works)
4. Click **Submit Coverage**
5. Success screen shows: `2/22 - Dr. Smith, 2/23 - Dr. Jones`

---

## Quick Setup Checklist

- [ ] Create flow at make.powerautomate.com
- [ ] Add **Recurrence** trigger: weekly on Monday at 8 AM
- [ ] Add **Initialize variable**: `SaturdayDate` (expression above)
- [ ] Add **Initialize variable**: `SundayDate` (expression above)
- [ ] Add **Send an email (V2)**: paste the HTML body above
- [ ] Replace `YOUR-SITE.com` with your real URL
- [ ] Toggle **Is HTML** to Yes
- [ ] **Save** and **Test**

---

## Power Automate Date Expressions Reference

| Expression | Example Result | What It Gives You |
|-----------|---------------|-------------------|
| `formatDateTime(utcNow(), 'M/d')` | `2/24` | Today |
| `formatDateTime(addDays(utcNow(), -1), 'M/d')` | `2/23` | Yesterday |
| `dayOfWeek(utcNow())` | `0-6` | 0=Sun, 6=Sat |
| `addDays(utcNow(), -7)` | last week | Subtract 7 days |

---

## API Endpoints (Optional — For Advanced Setup)

If you want Power Automate to fetch the email body from the API instead of hardcoding the HTML:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/weekend-schedule/email-body?apiKey=nf6-schedule-key&format=html` | GET | Returns ready-to-use HTML email body |
| `/api/weekend-schedule/submit?apiKey=nf6-schedule-key` | PUT | Saves doctor names from the form |
| `/api/weekend-schedule` | GET | List all schedule entries |
| `/api/weekend-schedule/bulk` | POST | Create date entries in bulk |
