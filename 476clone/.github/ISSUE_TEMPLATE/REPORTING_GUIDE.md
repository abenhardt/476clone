# How to Report an Issue — User Guide

**Project:** Camp Burnt Gin
**Applies to:** All team members involved in testing
**Last updated:** March 2026

---

## Overview

This guide explains how to use the project's issue reporting system on GitHub. When you encounter a bug, a visual problem, or want to suggest an improvement while testing the application, this is how you report it correctly so that engineers can act on it quickly.

Taking five extra minutes to fill out a report properly can save hours of back-and-forth between testers and developers.

---

## Before You Begin

You will need:

- A GitHub account
- Access to the project repository (`WinthropUniversity/project-2025-2026-pizza-tacos`)

If you do not have repository access, contact your project lead before proceeding.

---

## Step 1 — Navigate to the Issues Tab

1. Open a web browser and go to the project repository on GitHub.
2. Click the **Issues** tab near the top of the page, between "Code" and "Pull requests."
3. Click the green **New Issue** button on the right side of the page.

---

## Step 2 — Choose the Right Template

You will be presented with three template options. Select the one that best matches what you want to report.

| Template | Use this when... |
|---|---|
| **Bug Report** | Something broke, crashed, returned an error, or behaved in a way that is clearly wrong |
| **UI / UX Issue** | Something looks wrong, feels confusing, or is difficult to use — but the application did not crash |
| **Feature Request** | You want to propose a new feature or an improvement to an existing one |

Click **Get started** next to the appropriate template.

> **Not sure which to choose?** If the application crashed, showed an error message, or lost data, use Bug Report. If the page simply looks wrong or a flow is confusing, use UI / UX Issue.

---

## Step 3 — Fill Out the Form

Each template loads a structured form directly in GitHub. You do not need to write anything from scratch. Work through each field from top to bottom.

### General Rules That Apply to All Forms

**Be specific.** Vague reports cannot be acted on. "It didn't work" or "the page looks weird" does not tell an engineer anything useful. Describe exactly what happened, where it happened, and under what conditions.

**Copy error messages exactly.** If you saw an error message on screen, paste the exact text. Do not paraphrase it. Engineers use that text to search the codebase.

**Use the placeholders as a guide.** Each field contains example text showing you the level of detail expected. Match that level of detail in your own response.

**Do not include sensitive personal information.** Never paste real names, email addresses, Social Security numbers, or medical information into a GitHub issue. GitHub issues are accessible to everyone with repository access.

---

### If You Are Filling Out a Bug Report

The form is divided into four sections. Here is what each section is asking for and why it matters.

**What Broke**
Provide a one-sentence summary of the problem, select which area of the application was affected, and indicate which user role you were logged in as. Role is especially important — because this application has different access levels, the same steps can produce different results depending on your role.

**Where It Happened**
Select the environment (local, staging, or production), your browser, operating system, and device type. This information helps engineers reproduce the issue on the same setup you were using.

**How to Reproduce**
This is the most important section. List every step you took from the moment you opened the page to the moment the bug occurred. Number each step. Include button labels, page names, and any data you entered. Write as though the engineer has never used this part of the application before.

Then describe what you expected to happen, and what actually happened instead.

If you saw an error message — either on the page or in the browser console — paste it in the Error Message field. To find console errors: press **F12** on your keyboard, click the **Console** tab, and look for red text. Copy and paste any red lines into the field.

**How Bad Is It**
Select how consistently you can reproduce the bug and choose a severity level. The severity definitions are written directly in the form — read them before selecting.

**Supporting Evidence**
Drag and drop screenshots or a screen recording directly into the Screenshots field. For most bugs, a screenshot significantly speeds up diagnosis.

---

### If You Are Filling Out a UI / UX Issue

Start by selecting the issue category. This tells engineers and designers immediately what kind of problem they are dealing with — whether it is a visual alignment issue, a responsiveness problem on mobile, an accessibility concern, or a confusing user flow.

Provide the page URL from your browser's address bar. This removes all ambiguity about which screen you are referring to.

Select your device type and approximate screen size. Many layout issues are screen-size-specific, and this information is essential for reproducing them.

In the **What Looks or Feels Wrong** field, describe what you see in concrete terms. "The button is in the wrong place" is not enough. Write: "The Submit button on the application form overlaps the footer text on a 13-inch laptop screen, making both unreadable."

Then describe what you expected to see instead.

Indicate whether this issue prevents the user from completing their task. A broken layout that still allows the user to submit a form is triaged differently from one that makes the submit button completely inaccessible.

Attach a screenshot. For visual and layout issues, a screenshot is almost always the most valuable piece of information you can provide. Annotate it if you can — draw a circle or arrow around the specific problem area.

---

### If You Are Filling Out a Feature Request

Start by describing the problem you are trying to solve — not the feature you want. Explain the specific situation where you run into a limitation or gap in the current application. This framing leads to better outcomes because engineers can often find a solution that works better than the one originally requested.

Then describe your proposed solution in the next field. Be specific about what it should look like and how it should work.

Explain why this matters. What time is wasted, what errors occur, or what workflow is blocked without this feature? Clear justification makes it easier for the team to evaluate and prioritize your request.

Select which user roles would benefit, and indicate urgency honestly. Do not mark everything as Critical — it devalues the field for everyone.

---

## Step 4 — Complete the Checklist

At the bottom of every form is a short pre-submission checklist. Read each item and check the boxes that apply. Some items are required before you can submit.

The checklist is not a formality. It is a final prompt to make sure your report is complete and does not accidentally contain sensitive information.

---

## Step 5 — Submit the Issue

Once all required fields are filled in and the checklist is complete, click the green **Submit new issue** button at the bottom of the form.

Your issue will appear in the Issues tab and will be assigned the appropriate label (for example: `bug`, `ui-ux`, or `enhancement`) automatically. The engineering team will review it during their next triage session.

---

## After Submitting

- **You may be asked follow-up questions.** Engineers may comment on your issue asking for more detail. Check your GitHub notifications and respond promptly — delayed responses slow down fixes.
- **You can add more information at any time.** If you remember something relevant after submitting, scroll to the bottom of your issue and leave a comment. You can also add additional screenshots there.
- **Do not open duplicate issues.** Before submitting a new report, use the search bar in the Issues tab to check whether the same issue has already been reported. If it has, add a comment to the existing issue with any additional context you have.
- **Do not reopen a closed issue for a different bug.** If you encounter a new but similar problem after an issue is closed, open a fresh issue and reference the old one by its number (e.g., "Related to #42").

---

## Quick Reference

| Action | Where to go |
|---|---|
| Report a bug | Issues tab → New Issue → Bug Report |
| Report a visual or UX problem | Issues tab → New Issue → UI / UX Issue |
| Request a new feature or improvement | Issues tab → New Issue → Feature Request |
| Check if your issue already exists | Issues tab → search bar |
| Add more information to your report | Open the issue → scroll down → leave a comment |
| Report a security vulnerability | Do not use a public issue — contact the project lead directly |

---

## A Note on Security and Medical Data

This project handles protected health information. GitHub issues are not a secure channel for sensitive data. Never include the following in any issue report:

- Patient or camper names
- Email addresses or phone numbers
- Social Security numbers or dates of birth
- Medical history, diagnoses, or any health-related record data
- Passwords or access credentials

If you believe you have found a bug that exposes sensitive information, do not describe the data in the issue. Mark the severity as Critical, submit the report with a general description only, and contact the project lead immediately through a private channel.
