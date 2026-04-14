# Camp Burnt Gin — User Guide

**Version:** 1.0
**Last Updated:** March 2026
**Audience:** Parents and guardians, camp administrators, medical staff, system administrators

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Accessing the System](#2-accessing-the-system)
   - 2.1 [Registering an Account](#21-registering-an-account)
   - 2.2 [Logging In](#22-logging-in)
   - 2.3 [Setting Up Multi-Factor Authentication](#23-setting-up-multi-factor-authentication)
   - 2.4 [Resetting Your Password](#24-resetting-your-password)
   - 2.5 [Logging Out](#25-logging-out)
   - 2.6 [Session Timeout](#26-session-timeout)
3. [User Roles](#3-user-roles)
   - 3.1 [Applicant (Parent or Guardian)](#31-applicant-parent-or-guardian)
   - 3.2 [Administrator](#32-administrator)
   - 3.3 [Medical Staff](#33-medical-staff)
   - 3.4 [Super Administrator](#34-super-administrator)
4. [Applicant Guide](#4-applicant-guide)
   - 4.1 [Registering Your Account](#41-registering-your-account)
   - 4.2 [Adding a Camper Profile](#42-adding-a-camper-profile)
   - 4.3 [Starting a Camp Application](#43-starting-a-camp-application)
   - 4.4 [Saving a Draft and Returning to It](#44-saving-a-draft-and-returning-to-it)
   - 4.5 [Signing and Submitting an Application](#45-signing-and-submitting-an-application)
   - 4.6 [Uploading Documents](#46-uploading-documents)
   - 4.7 [Viewing Application Status](#47-viewing-application-status)
   - 4.8 [Understanding Application Statuses](#48-understanding-application-statuses)
   - 4.9 [Using the Inbox to Communicate with Staff](#49-using-the-inbox-to-communicate-with-staff)
   - 4.10 [Viewing and Responding to Document Requests](#410-viewing-and-responding-to-document-requests)
   - 4.11 [Managing Medical Information for a Camper](#411-managing-medical-information-for-a-camper)
   - 4.12 [Inviting an External Medical Provider](#412-inviting-an-external-medical-provider)
   - 4.13 [Managing Notification Preferences](#413-managing-notification-preferences)
5. [Administrator Guide](#5-administrator-guide)
   - 5.1 [Reviewing Applications](#51-reviewing-applications)
   - 5.2 [Approving, Rejecting, or Waitlisting an Application](#52-approving-rejecting-or-waitlisting-an-application)
   - 5.3 [Managing Campers](#53-managing-campers)
   - 5.4 [Managing Camp Sessions](#54-managing-camp-sessions)
   - 5.5 [Generating Reports](#55-generating-reports)
   - 5.6 [Using the Inbox](#56-using-the-inbox)
   - 5.7 [Managing Document Requests](#57-managing-document-requests)
   - 5.8 [Viewing Notifications](#58-viewing-notifications)
6. [Medical Staff Guide](#6-medical-staff-guide)
   - 6.1 [Accessing Camper Medical Records](#61-accessing-camper-medical-records)
   - 6.2 [Viewing and Updating Medical Information](#62-viewing-and-updating-medical-information)
   - 6.3 [Recording Medical Incidents](#63-recording-medical-incidents)
   - 6.4 [Recording Health Office Visits](#64-recording-health-office-visits)
   - 6.5 [Managing Medical Follow-Ups](#65-managing-medical-follow-ups)
   - 6.6 [Uploading Medical Documents](#66-uploading-medical-documents)
   - 6.7 [Understanding PHI Audit Logging](#67-understanding-phi-audit-logging)
7. [Super Administrator Guide](#7-super-administrator-guide)
   - 7.1 [Managing User Accounts](#71-managing-user-accounts)
   - 7.2 [Assigning and Modifying User Roles](#72-assigning-and-modifying-user-roles)
   - 7.3 [Accessing the Audit Log](#73-accessing-the-audit-log)
   - 7.4 [Using the Form Builder](#74-using-the-form-builder)
8. [Inbox and Messaging](#8-inbox-and-messaging)
   - 8.1 [How the Inbox Works](#81-how-the-inbox-works)
   - 8.2 [Starting a New Conversation](#82-starting-a-new-conversation)
   - 8.3 [Replying to a Message](#83-replying-to-a-message)
   - 8.4 [Message Rules and Limitations](#84-message-rules-and-limitations)
9. [Notifications](#9-notifications)
   - 9.1 [Types of Notifications](#91-types-of-notifications)
   - 9.2 [Managing Notification Preferences](#92-managing-notification-preferences)
10. [Document Uploads](#10-document-uploads)
    - 10.1 [Accepted File Types](#101-accepted-file-types)
    - 10.2 [File Size Limit](#102-file-size-limit)
    - 10.3 [The Scanning Process](#103-the-scanning-process)
11. [Security and Privacy](#11-security-and-privacy)
    - 11.1 [How the System Protects Your Data](#111-how-the-system-protects-your-data)
    - 11.2 [HIPAA and What It Means for You](#112-hipaa-and-what-it-means-for-you)
    - 11.3 [Session Timeout Behavior](#113-session-timeout-behavior)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Introduction

The Camp Burnt Gin management system is a secure, web-based platform designed for the CYSHCN (Children and Youth with Special Health Care Needs) program. It replaces paper-based and email-based workflows with a structured, auditable, and role-controlled platform.

The system supports four groups of users:

- **Parents and guardians** who register campers and submit applications
- **Camp administrators** who review applications and manage operations
- **Medical staff** who record and manage health information during camp
- **Super administrators** who govern the system, manage accounts, and monitor the audit log

The system is available in English and Spanish. You can switch languages at any time using the language selector in the navigation area.

All medical information handled by the system is treated as Protected Health Information (PHI) and managed in accordance with HIPAA technical safeguards. Every access to sensitive records is automatically logged for compliance purposes.

---

## 2. Accessing the System

### 2.1 Registering an Account

Registration is available to parents and guardians only. Administrator and medical staff accounts are created by the super administrator.

To register:

1. Navigate to the system's login page. The root address redirects you to the login page automatically.
2. Click the registration link on the login page.
3. Enter the following information:
   - Full name
   - Email address (must be unique in the system)
   - Password (at least 8 characters, including at least one uppercase letter, one lowercase letter, and one number)
   - Password confirmation (must match the password you entered)
4. Submit the form.

Upon successful registration, your account is created and you are automatically assigned the Applicant role. You are then logged in and directed to the applicant dashboard.

### 2.2 Logging In

1. Navigate to the system login page.
2. Enter your email address and password.
3. Click the login button.

If you have multi-factor authentication enabled, you will be prompted to enter a six-digit code from your authenticator app before access is granted. See Section 2.3 for details.

**Account lockout:** If you enter incorrect credentials five times in a row, your account is locked for 15 minutes. You cannot log in during this period even if you enter the correct password. The lockout expires automatically.

### 2.3 Setting Up Multi-Factor Authentication

Multi-factor authentication (MFA) adds a second layer of security to your account. When enabled, you must enter a six-digit time-sensitive code from an authenticator app each time you log in.

Compatible authenticator apps include Google Authenticator, Authy, and Microsoft Authenticator.

To enable MFA:

1. Log in to your account.
2. Navigate to your account settings.
3. Locate the Multi-Factor Authentication section.
4. Select the option to enable MFA.
5. The system will display a QR code and a text secret key.
6. Open your authenticator app and scan the QR code, or enter the secret key manually.
7. The app will begin generating six-digit codes that refresh every 30 seconds.
8. Enter the current six-digit code from your app into the verification field in the system.
9. Confirm to complete enrollment.

To disable MFA:

1. Navigate to your account settings.
2. Locate the Multi-Factor Authentication section.
3. Select the option to disable MFA.
4. You will be asked to enter your current password and a valid six-digit code from your authenticator app to confirm the change.

### 2.4 Resetting Your Password

If you cannot remember your password:

1. Click "Forgot Password" on the login page.
2. Enter the email address associated with your account.
3. Click submit. You will receive an email containing a password reset link.
4. Click the link in the email. The link is valid for 30 minutes.
5. Enter your new password and confirm it.
6. Submit the form. Your password is updated and you may now log in with the new password.

If you do not receive the email, check your spam or junk folder. If the problem persists, contact your camp administrator.

### 2.5 Logging Out

To log out:

1. Locate the logout option in the navigation menu or your account menu.
2. Click logout.

Your session ends immediately. You are redirected to the login page. The system cannot retrieve your session after you log out.

### 2.6 Session Timeout

Your session expires automatically after 30 minutes of inactivity. This is a HIPAA-required security measure. When your session expires, you are redirected to the login page and must log in again.

Sessions are tab-isolated. If you open the system in multiple browser tabs, each tab maintains its own session. Logging out in one tab does not affect other tabs.

---

## 3. User Roles

The system assigns every user exactly one role. Your role determines which areas of the system you can access and what actions you can perform.

### 3.1 Applicant (Parent or Guardian)

This role is assigned to all self-registered users. Applicants are parents or legal guardians of children applying to attend camp.

**What applicants can do:**
- Create and manage profiles for their own children (campers)
- Start, edit, save, and submit camp applications for their own campers
- Sign applications digitally
- Upload supporting documents
- View the status of their own applications
- Manage medical information for their own campers
- Invite external medical providers to submit medical information
- Communicate with camp staff through the inbox
- View and respond to document requests from staff
- Manage their notification preferences

**What applicants cannot do:**
- View any other family's data
- Review or approve applications
- Access administrative, medical staff, or super administrator functions

### 3.2 Administrator

Administrators are camp staff members responsible for day-to-day operational management.

**What administrators can do:**
- View all applications submitted by all families
- Review, approve, reject, and waitlist applications
- Manage camper records
- Create and manage camp sessions
- Generate administrative reports
- View all medical records (all access is logged)
- Create and revoke medical provider links
- Manage document requests
- Communicate through the inbox
- View and manage notifications

**What administrators cannot do:**
- Assign or modify user roles
- Access the super administrator governance tools
- Promote users to administrator or super administrator

### 3.3 Medical Staff

Medical staff are on-site nurses and clinicians with system accounts. This role is distinct from external medical providers, who access the system through a one-time secure link rather than a system account.

**What medical staff can do:**
- View medical records for all campers (all access is logged)
- Add and update allergy, medication, and diagnosis information
- View emergency contacts (read-only)
- Record treatment log entries
- Record medical incidents (behavioral, medical, injury, environmental, emergency)
- Manage medical follow-up tasks
- Record health office visits with vitals, treatment notes, and disposition
- View activity restrictions for clinical decision-making
- View and upload medical documents for any camper
- Access the full camper directory for clinical workflow

**What medical staff cannot do:**
- Create, modify, or delete camper profiles
- Create or modify applications
- Delete any medical records, allergies, medications, treatments, or documents
- Create or modify medical restrictions (this is an administrative function)
- Modify another staff member's treatment log entries

### 3.4 Super Administrator

Super administrators have the highest level of authority in the system. They inherit all administrator capabilities and also govern the system itself.

**What super administrators can do:**
- Everything an administrator can do
- Create, view, and manage all user accounts
- Assign and modify user roles
- Promote users to administrator or super administrator
- Demote administrators
- Delete user accounts
- Access and export the full audit log
- Use the form builder to manage the application form structure

**Safeguards:**
- The last remaining super administrator account cannot be deleted or demoted. This prevents a situation where no one can govern the system.

---

## 4. Applicant Guide

This section is written for parents and guardians using the system to register a child for camp.

### 4.1 Registering Your Account

Follow the steps in Section 2.1 to create your account. Once registered, you are taken to your applicant dashboard. From the dashboard you can manage camper profiles, track applications, view your inbox, and access your account settings.

### 4.2 Adding a Camper Profile

Before you can apply for a session, you must create a profile for each child you are registering. A camper profile records the basic information about your child.

To add a camper:

1. From your dashboard, navigate to the section for managing campers.
2. Select the option to add a new camper.
3. Enter your child's information, including their full name and date of birth.
4. Save the profile.

You can return to a camper profile at any time to update the information. You may add multiple camper profiles if you have more than one child applying.

### 4.3 Starting a Camp Application

Once a camper profile exists, you can begin an application for a specific camp session.

To start an application:

1. Navigate to the applications section of your dashboard.
2. Select the option to start a new application.
3. Choose the camper you are applying for.
4. Select the camp session you wish to apply to. Sessions must be open for registration. The system will inform you if registration is not currently open or if the session is full.
5. The system checks whether your child meets the age requirements for the selected session. If they do not, the application cannot proceed.
6. Complete the sections of the application form. The form is divided into multiple sections covering camper information, medical history, emergency contacts, and other areas.

**One application per session:** Each camper may have only one application per session. If an application already exists for that camper and session, you will not be able to create a duplicate.

### 4.4 Saving a Draft and Returning to It

You do not need to complete the application in one sitting. While you are working on an application, it is saved as a draft.

- Drafts are not visible to camp administrators. Administrators only see applications after they have been submitted.
- You can return to a draft at any time by navigating to the applications section of your dashboard and selecting the draft application.
- You may edit any part of a draft application freely.

### 4.5 Signing and Submitting an Application

Before an application can be submitted, you must provide a digital signature.

To sign and submit:

1. Review all sections of your completed application.
2. Navigate to the signature section.
3. Provide your signature. You will be asked to sign using a signature input and to type your full name.
4. The system records the time and date of the signature.
5. Set the application status to submitted (mark the draft as final).
6. Confirm the submission.

Once submitted, the application moves to "Under Review" status and becomes visible to camp administrators. You will receive a confirmation notification.

**Important:** Once an application is submitted, you can no longer edit it freely. If the application has not yet been reviewed, you may still make limited edits. Once a decision has been made by the administrator, the application cannot be modified.

If you need to withdraw a submitted application before a decision is made, you may cancel it. Cancellation cannot be undone.

### 4.6 Uploading Documents

You may attach supporting documents to a camper profile, a medical record, or an application.

To upload a document:

1. Navigate to the relevant section (camper profile, medical record, or application).
2. Locate the documents section.
3. Select the file you wish to upload.
4. Choose the document type if prompted (for example: medical, legal, or identification).
5. Submit the upload.

See Section 10 for information about accepted file types, size limits, and the security scanning process.

### 4.7 Viewing Application Status

To view the status of your applications:

1. Navigate to the applications section of your dashboard.
2. Each application is listed with its current status displayed.

You will also receive a notification when the status of your application changes.

### 4.8 Understanding Application Statuses

The following statuses are used throughout the application lifecycle:

```
+------------------+
|   Draft (saved)  |  <-- You are working on the application.
|   Not submitted  |      Administrators cannot see it.
+--------+---------+
         |
         | You submit the application
         v
+------------------+
|   Under Review   |  <-- The application is visible to administrators
|                  |      and is awaiting a decision.
+--------+---------+
         |
         +-------------------+-------------------+
         |                   |                   |
         v                   v                   v
+------------------+ +------------------+ +------------------+
|    Approved      | |    Rejected      | |    Waitlisted    |
|                  | |                  | |                  |
| Your child has   | | The application  | | The session is   |
| been accepted.   | | was not accepted.| | full. Your child |
|                  | | The administrator| | is on the        |
|                  | | is required to   | | waiting list.    |
|                  | | include a reason.| |                  |
+------------------+ +------------------+ +--------+---------+
                                                   |
                                         If space opens up:
                                                   |
                                         +----------v-------+
                                         |    Approved or   |
                                         |    Rejected      |
                                         +------------------+
```

**Cancelled:** You can cancel a non-final application at any time. Once cancelled, the application cannot be reactivated. If you need assistance after cancellation, contact your camp administrator.

When an application is approved or rejected, you will receive a notification. Rejection notifications include a reason provided by the administrator.

### 4.9 Using the Inbox to Communicate with Staff

The inbox allows you to send and receive messages with camp staff. You may use the inbox to ask questions, follow up on your application, or respond to staff communications.

To start a new conversation:

1. Navigate to the inbox section of your dashboard.
2. Select the option to compose a new message.
3. Add a subject and write your message.
4. Send the message.

Messages you send go to the camp administrative team. You will receive a notification when staff reply to your message.

**Note:** You can only communicate with administrators through the inbox. You cannot send messages directly to other applicant accounts.

See Section 8 for detailed information about how the messaging system works.

### 4.10 Viewing and Responding to Document Requests

Camp administrators may request specific documents from you. When a document request is created, you will receive a notification and a message in your inbox.

To view and respond to document requests:

1. Navigate to the documents section of your applicant portal.
2. Locate the "Requested Documents" section. Each request is listed with details about what is needed.
3. Select the request you wish to respond to.
4. Upload the requested file.

Status updates for your document requests are appended as new messages in the same inbox thread that was created when the request was made.

### 4.11 Managing Medical Information for a Camper

You can provide and update detailed medical information for each of your campers. This information is used by camp medical staff to ensure your child's health and safety during the session.

To manage medical information:

1. Navigate to your camper's profile.
2. Select the medical records section.
3. You can add, view, and edit the following types of information:
   - Allergies (including severity: mild, moderate, or severe)
   - Current medications
   - Diagnoses
   - Emergency contacts (at least one is recommended before submitting an application)
   - Behavioral profiles
   - Feeding plans
   - Assistive devices
   - Activity permissions
   - Special needs and dietary restrictions

**Severity levels for allergies:**
- Mild: A minor reaction requiring monitoring
- Moderate: A significant reaction that may require intervention
- Severe: A life-threatening reaction requiring immediate attention

**Note:** Once an allergy is documented by a medical staff member, you cannot delete it. This rule ensures that no allergy is accidentally removed from the record. You can still edit allergy information. Administrators retain the ability to delete records when necessary.

### 4.12 Inviting an External Medical Provider

If your child's doctor or other healthcare provider needs to submit medical information directly, you can send them a secure access link.

To invite an external provider:

1. Navigate to your camper's medical record.
2. Locate the medical provider link section.
3. Enter the provider's email address and an optional message.
4. The system generates a secure, single-use link and emails it to the provider.
5. The link is valid for up to 72 hours after it is created. It cannot be extended. If the provider does not use the link within this period, you must create a new one.
6. The link can only be used once. After the provider submits information through the link, it is marked as used.
7. You and your camp administrator will receive a notification when the provider submits information.

To revoke a link before it is used:

1. Navigate to the provider link section of the camper's medical record.
2. Select the link you wish to revoke.
3. Confirm the revocation.

Revoked links are immediately invalidated. The provider is not notified of the revocation.

### 4.13 Managing Notification Preferences

You can control which types of notifications you receive and how you receive them.

To manage your preferences:

1. Navigate to your account settings.
2. Locate the notification preferences section.
3. Toggle each notification type on or off according to your preference.

Notification types include alerts for application status changes, inbox messages, document requests, and system announcements. Email notifications are only sent if you have enabled them in your preferences.

---

## 5. Administrator Guide

This section is written for camp staff who review applications and manage camp operations.

### 5.1 Reviewing Applications

Applications submitted by families appear in your administrator dashboard in the applications queue.

To view submitted applications:

1. Navigate to the applications section of your admin portal.
2. Applications with a status of "Under Review" are awaiting a decision.
3. Select an application to view its full details, including:
   - Camper information
   - Medical records and allergy information
   - Emergency contacts
   - Supporting documents
   - Application notes

Drafts saved by applicants are not visible in your queue. Only submitted applications appear.

### 5.2 Approving, Rejecting, or Waitlisting an Application

After reviewing an application, you make a decision by recording a review outcome.

To record a decision:

1. Open the application you wish to review.
2. Select the appropriate action: Approve, Reject, or Waitlist.
3. Enter review notes. Notes are required when rejecting an application. They are optional for approvals and waitlistings.
4. Confirm your decision.

The following rules apply:

- An approved application cannot be subsequently rejected, and vice versa. Final decisions are permanent. If a change is needed after a final decision, contact the super administrator.
- A waitlisted application can be moved to approved or rejected when circumstances change (for example, when a space becomes available or the session deadline passes).
- Approved applications count toward the session's capacity. The system tracks available spaces and will notify you if a session is at capacity. Applications cannot be automatically approved when a session is full; waitlisting is used instead.
- Waitlisted applicants are promoted manually by an administrator. There is no automatic promotion from the waitlist.

The applicant receives a notification when you record a decision. Rejection notifications include any review notes you provided.

### 5.3 Managing Campers

Administrators have full access to camper records across all families.

From the camper management section you can:

- View all campers in the system
- View the details of any camper profile
- Update any camper profile
- Delete a camper record

Use care when deleting camper records, as deletion is permanent and removes all associated data.

### 5.4 Managing Camp Sessions

Camp sessions define the periods during which campers can attend. Each session has registration open and close dates, a start date, age requirements, and a maximum capacity.

To manage sessions:

1. Navigate to the sessions section of your admin portal.
2. You can create new sessions, edit existing sessions, and delete sessions.

**Important:** You cannot delete a session that has active applications. You must cancel or otherwise resolve the applications before deleting the session.

When creating a session, define the following:

- Session name and description
- Registration open and close dates (applicants can only submit applications during this window)
- Session start and end dates (used for age calculation)
- Minimum and maximum camper age (optional)
- Maximum capacity

### 5.5 Generating Reports

The reports section provides access to administrative reports that help you manage camp operations.

Available report types:

- **Applications report:** A summary of all applications across all sessions
- **Accepted applicants:** A list of all approved campers
- **Rejected applicants:** A list of all rejected applicants
- **Mailing labels:** Formatted label data for physical mailings
- **ID labels:** Formatted label data for camper identification

Navigate to the reports section and select the report type you need. Apply any filters (such as session or date range) and generate the report.

### 5.6 Using the Inbox

As an administrator, you can view and respond to messages from all applicants. You can also initiate conversations.

To view messages:

1. Navigate to the inbox section of your admin portal.
2. Messages are displayed in a two-panel view: a list of conversations on the left, and the selected conversation on the right.

To compose a new message:

1. Use the compose button or floating compose option.
2. Select the recipient (an applicant or group of participants).
3. Enter a subject and message body.
4. Send the message.

Administrators can soft-delete messages when necessary. Deleted messages are removed from view but preserved in the system's audit trail for compliance purposes. They cannot be permanently deleted.

See Section 8 for full details on the messaging system.

### 5.7 Managing Document Requests

You can formally request documents from any applicant. This creates a structured request record and notifies the applicant through the inbox.

To create a document request:

1. Navigate to the documents section of your admin portal.
2. Select the option to request a document.
3. Use the selector to choose the applicant and, if applicable, the camper the request relates to.
4. Specify the type of document needed and provide any instructions.
5. Submit the request.

The applicant receives a notification and a message in their inbox. When the applicant uploads a document in response to the request, you will see the update in the document request record.

The document request dashboard provides a summary of all outstanding requests along with their current status. Each request moves through the following lifecycle:

```
Awaiting Upload --> Uploaded --> Scanning --> Under Review --> Approved
                                                         |
                                                         +--> Rejected
```

You can approve or reject an uploaded document directly from the document request record. When rejecting, you may provide a reason.

### 5.8 Viewing Notifications

Notifications appear in the notification area of your admin portal. They keep you informed of events such as new application submissions, provider link usage, and inbox messages.

To mark a notification as read, click on it. You can mark individual notifications or all notifications as read.

---

## 6. Medical Staff Guide

This section is written for on-site medical staff (nurses and clinicians) who have system accounts. It describes how to access and manage medical information during camp.

### 6.1 Accessing Camper Medical Records

Medical staff can view the medical records of all campers in the system.

To access camper records:

1. Log in to your medical staff portal.
2. Navigate to the medical records section or the camper directory.
3. Select the camper whose record you wish to view.

The camper directory shows all registered campers by name. You may search or filter the list to find a specific camper.

**Important:** Every access to a medical record is automatically logged in the audit trail. The log records your identity, the record you accessed, the time of access, and the action you performed. This is required for HIPAA compliance and cannot be disabled. See Section 6.7 for more information.

### 6.2 Viewing and Updating Medical Information

From a camper's medical record, you can view and update:

- General medical notes and special needs descriptions
- Dietary restrictions
- Allergies (you can create and update allergies, but not delete them)
- Medications (you can create and update medications, but not delete them)
- Diagnoses
- Emergency contact information (read-only for medical staff)
- Behavioral profiles
- Feeding plans
- Assistive devices
- Activity permissions

To update information:

1. Open the camper's medical record.
2. Navigate to the relevant section.
3. Select the item to edit or use the add button to create a new entry.
4. Save your changes.

**Deletion is not available to medical staff.** Only administrators can delete medical records. This rule ensures that no clinical information is accidentally removed from the record.

**Emergency contact information** is managed by the camper's parent or guardian and by administrators. Medical staff can view emergency contacts but cannot modify them.

### 6.3 Recording Medical Incidents

When a medical event occurs during camp, you record it as a medical incident.

To record a new incident:

1. Navigate to the Incidents section of your medical portal.
2. Select the option to record a new incident.
3. Enter the following information:
   - The camper involved (selected from the directory)
   - Incident type (options include: behavioral, medical, injury, environmental, emergency)
   - Incident severity
   - A description of what occurred and the response provided
   - Date and time of the incident
4. Save the incident record.

You can update incidents you have recorded. Incidents cannot be deleted by medical staff. Deletion is restricted to administrators to preserve the audit trail.

### 6.4 Recording Health Office Visits

When a camper visits the health office, you record a visit entry.

To record a new visit:

1. Navigate to the Visits section of your medical portal.
2. Select the option to record a new visit.
3. Enter the following:
   - The camper who visited
   - Vitals (as applicable)
   - Reason for the visit
   - Treatment provided
   - Disposition (outcome of the visit, such as returned to activity, sent to rest, or referred to external care)
   - Date and time
4. Save the visit record.

You can update your own visit records. Deletion is restricted to administrators.

### 6.5 Managing Medical Follow-Ups

Follow-up tasks help you track ongoing care needs across the camp session.

To create a follow-up task:

1. Navigate to the Follow-Ups section of your medical portal.
2. Select the option to create a new follow-up.
3. Enter the camper, a description of the follow-up needed, priority, and a due date if applicable.
4. Assign the follow-up to a staff member if needed.
5. Save the record.

To update a follow-up task:

1. Open the follow-up from the list.
2. Update the status (for example: open, in progress, or completed).
3. Save the changes.

Medical staff can update and mark complete the follow-up tasks that are assigned to them. Administrators can update any follow-up task. Deletion is restricted to administrators.

### 6.6 Uploading Medical Documents

You can attach documents to a camper's medical record or to a camper's general profile.

To upload a document:

1. Navigate to the relevant camper record or medical record.
2. Locate the documents section.
3. Select the file to upload.
4. Submit the upload.

See Section 10 for information on accepted file types, size limits, and the scanning process.

Medical staff cannot delete documents. Only the user who uploaded a document or an administrator can delete it.

### 6.7 Understanding PHI Audit Logging

Every action you take in the medical portal is logged automatically. This is not optional and cannot be bypassed. The log is part of the system's compliance with HIPAA's Technical Safeguards requirements.

Each log entry records:

- Your user identity
- The record you accessed or modified
- The type of action you performed (viewed, created, updated)
- The date and time of the action
- Your IP address and browser information

These logs are stored permanently, cannot be modified, and are reviewed by the super administrator. PHI access logs are retained for a minimum of six years as required by HIPAA.

If you believe a record was accessed or changed incorrectly, report it to your administrator immediately. The audit log provides a complete, tamper-proof trail of all medical record activity.

---

## 7. Super Administrator Guide

This section is written for super administrators who govern the system.

### 7.1 Managing User Accounts

From the user management section of your super admin portal, you can:

- View all user accounts in the system
- Create new accounts for staff (administrators, medical staff)
- Edit user account details
- Disable or delete accounts

To create a new staff account:

1. Navigate to the user management section.
2. Select the option to create a new user.
3. Enter the user's name, email address, and initial role.
4. Save the account.

The new user will need to set their password using the password reset process (see Section 2.4).

**Deletion safeguards:** The last remaining super administrator account cannot be deleted. The system enforces this to prevent the system from being left without governance access.

### 7.2 Assigning and Modifying User Roles

Only super administrators can assign or change user roles. Administrators do not have this capability.

To change a user's role:

1. Navigate to the user management section.
2. Select the user account you wish to modify.
3. Update the role field.
4. Save the changes.

Available roles are: Applicant, Administrator, Medical Staff, and Super Administrator.

**Restrictions:**
- You cannot demote yourself if you are the last super administrator in the system.
- Role changes take effect immediately. The affected user's access changes as soon as they next interact with the system.

### 7.3 Accessing the Audit Log

The audit log provides a complete, chronological record of all system activity. Only super administrators can access the audit log.

To access the audit log:

1. Navigate to the audit log section of your super admin portal.
2. The log is displayed in a timeline format. Each entry shows:
   - A plain-language description of the event
   - The category of the event (Authentication, Medical, Applications, Messaging, Administrative, Documents, Security, Notifications, System)
   - The user who performed the action
   - The date and time
   - An expandable detail panel showing additional context, including before-and-after data changes where applicable

To filter the log:

- Use the date range filter to limit results to a specific period
- Use the event type filter to show only a specific category (for example, only PHI access events or only authentication events)
- Use the entity type filter to show events related to a specific type of record (for example, only camper records)
- Use the user filter to show only events by a specific user
- Use the search field for free-text search

To export the audit log:

1. Apply any filters you wish to narrow the export.
2. Select the export option and choose CSV or JSON format.
3. The export includes up to 5,000 rows matching your filters.

Audit log records are immutable. They cannot be edited or deleted through the interface.

**Retention:** PHI access logs and administrative action logs are retained for a minimum of six years. Authentication and security event logs are retained for a minimum of one year.

### 7.4 Using the Form Builder

The form builder allows you to manage the structure of the camp application form. You can add, edit, reorder, and remove sections and fields without any technical assistance.

To access the form builder:

1. Navigate to the form builder section of your super admin portal, located at the Form Builder link in the system navigation.
2. The builder displays a three-column layout:
   - Left column: the list of form sections
   - Center column: the fields within the selected section
   - Right column: field editing and configuration options

To add a new section:

1. Select "Add Section" in the left column.
2. Enter a name and optional description for the section.
3. Save.

To add a field to a section:

1. Select the section you wish to add a field to.
2. Select "Add Field" in the center column.
3. Choose the field type (text, dropdown, checkbox, date, etc.).
4. Configure the field label, placeholder text, and whether it is required.
5. For dropdown or checkbox fields, use the options editor to define the choices.
6. Save.

To reorder sections or fields, use the drag handles to move items up or down.

**Important:** If an application has already referenced a specific field, the field's internal identifier cannot be changed. The system will prevent this to protect the integrity of existing application data. You can still change the visible label of a field.

Form definitions are versioned. Changes to the form do not affect applications that were submitted under a previous version.

---

## 8. Inbox and Messaging

### 8.1 How the Inbox Works

The inbox is a two-panel messaging interface. The left panel lists your conversations. The right panel displays the selected conversation and its full message thread.

Messages are organized into threaded conversations. Each conversation has a subject, and replies are grouped together within the same thread.

The inbox is available to applicants and administrators. Medical staff do not have inbox access. All inbox activity is logged in the audit trail.

### 8.2 Starting a New Conversation

To compose a new message:

1. Navigate to your inbox.
2. Click the compose button. A compose window opens.
3. Enter a subject line.
4. Write your message in the body area. A rich text editor is available.
5. Send the message.

**Applicants** can only send messages to administrators. You cannot send messages to other applicant accounts or to medical staff.

**Administrators** can initiate conversations with any applicant account.

### 8.3 Replying to a Message

To reply to an existing message:

1. Open the conversation you wish to reply to.
2. Type your reply in the reply field at the bottom of the conversation.
3. Send the reply.

Your reply is appended to the same conversation thread. All participants in the conversation receive a notification.

### 8.4 Message Rules and Limitations

The following rules apply to all inbox messages:

- **Messages cannot be edited after they are sent.** Once a message is sent, the text is final. This rule maintains the integrity of the communication record.
- **Only the original sender or an administrator can delete a message.** Deleted messages are soft-deleted, meaning they are removed from view but preserved in the system for audit purposes.
- **Messages cannot be permanently deleted.** This is required by HIPAA data retention rules.
- System-generated messages (for example, document request notifications and application status updates) are delivered automatically and appear in your inbox. You cannot reply to all system-generated messages.

---

## 9. Notifications

### 9.1 Types of Notifications

The system sends notifications to keep you informed of important events. Notifications appear in-app and, if you have enabled email notifications in your preferences, are also sent to your email address.

**Applicants receive notifications when:**
- Their application is received and confirmed
- Their application status changes (approved, rejected, waitlisted)
- An administrator sends them an inbox message
- A document request is created for them
- A document request status is updated
- A medical provider submits information through a link

**Administrators receive notifications when:**
- A new application is submitted
- A medical provider submits information through a link
- An applicant sends an inbox message

**All users receive notifications when:**
- A relevant inbox message is received

### 9.2 Managing Notification Preferences

You control which notifications you receive and whether you receive email delivery.

To update your preferences:

1. Navigate to your account settings.
2. Find the notification preferences section.
3. Toggle each notification type on or off.
4. Save your settings.

Changes take effect immediately. If you disable email notifications, you will still see in-app notifications but will not receive emails.

---

## 10. Document Uploads

### 10.1 Accepted File Types

The system accepts the following file types:

| File Type          | Extension(s)      |
|--------------------|-------------------|
| PDF                | .pdf              |
| JPEG image         | .jpg, .jpeg       |
| PNG image          | .png              |
| GIF image          | .gif              |
| Microsoft Word     | .doc              |
| Microsoft Word     | .docx             |

Files in other formats are not accepted. If your document is in a different format, convert it to PDF before uploading. Most word processors and operating systems include built-in tools to save or export documents as PDF.

Executable files and script files are always blocked regardless of their extension. These include files with extensions such as .exe, .bat, .sh, .php, and .js.

### 10.2 File Size Limit

The maximum file size for a single upload is **10 MB** (approximately 10 megabytes).

If your file exceeds this limit, reduce the file size before uploading. For PDF files, you can use a PDF compression tool. For images, you can reduce the resolution or use an image compression tool.

### 10.3 The Scanning Process

Every file you upload is automatically scanned for security threats. This process happens in the background after your upload is accepted.

The scanning lifecycle is as follows:

```
File uploaded
      |
      v
Pending scan (file is stored but not yet available for download)
      |
      v
Scan complete
      |
      +----------+----------+
      |                     |
      v                     v
Scan passed             Scan failed
(file available         (file quarantined,
 for download)           not available)
```

While a file is pending scan, non-administrator users cannot download it. Administrators can access files that are pending scan or have passed scanning.

If a file fails the security scan, it is quarantined. You will not be able to download it. If you believe a file has been incorrectly quarantined, contact your camp administrator.

Under normal circumstances, the scan completes within a short time after upload. If a file remains in pending status for an extended period, contact your administrator.

---

## 11. Security and Privacy

### 11.1 How the System Protects Your Data

The system employs multiple layers of protection for your data and your child's medical information:

- **Encrypted medical data:** All Protected Health Information (PHI), such as medical records, allergies, and diagnoses, is stored in encrypted form in the database. The data is unreadable to anyone who gains unauthorized access to the database itself.
- **Secure file storage:** Uploaded documents are stored outside the publicly accessible area of the web server. They cannot be accessed through a direct web link. All downloads require an authenticated and authorized request through the system.
- **Random file naming:** Uploaded files are stored with randomly generated names. This prevents anyone from guessing the name or location of another user's files.
- **Role-based access control:** Your role determines exactly which data you can access. The system enforces these restrictions at every level. For example, an applicant cannot access another family's records, and medical staff cannot access administrative functions.
- **Password security:** Passwords are stored using a strong one-way hashing algorithm. The system never stores your password in readable form.
- **Automatic session timeout:** Sessions expire after 30 minutes of inactivity. See Section 11.3 for details.
- **Account lockout:** After five consecutive failed login attempts, your account is locked for 15 minutes. This protects against automated password-guessing attacks.
- **Rate limiting:** The system limits the number of login attempts and certain other actions per minute. If you exceed these limits, you will need to wait before trying again.
- **Immutable audit logs:** All sensitive activity is recorded in an audit log that cannot be modified or deleted. This provides a tamper-proof record of who accessed what data and when.

### 11.2 HIPAA and What It Means for You

HIPAA (the Health Insurance Portability and Accountability Act) is a United States federal law that establishes standards for protecting medical information. The Camp Burnt Gin system is designed to comply with HIPAA's Technical Safeguards requirements.

**What this means in practice:**

- Your child's medical information is treated as Protected Health Information (PHI). It is encrypted, access-controlled, and audited.
- Every access to medical records by medical staff or administrators is permanently logged. The log includes who accessed the record, what they did, and when.
- You, as the parent or guardian, control which medical information is entered into the system through your applicant account. You can also invite your child's doctor to submit medical information directly through a secure, time-limited link.
- Medical staff can view your child's medical information to provide appropriate care during camp. They cannot delete records. Deletions require administrator approval.
- Audit logs of PHI access are retained for a minimum of six years, as required by law.
- If you have questions about how your child's medical information is used or stored, contact the camp administrator.

### 11.3 Session Timeout Behavior

For security and HIPAA compliance, the system automatically ends your session after **30 minutes of inactivity**.

When your session times out:

- You are automatically redirected to the login page.
- Any unsaved work may be lost. Save drafts and forms regularly while working in the system.
- You must log in again to continue.

Sessions are isolated per browser tab. If you have the system open in two tabs and one tab's session expires, the other tab is not affected. However, you must log in again in the expired tab.

Closing your browser tab without logging out does not immediately end your session on the server. The session will expire naturally after 30 minutes. For security reasons, always use the logout function when you have finished using the system, especially on shared computers.

---

## 12. Troubleshooting

This section describes common issues and how to resolve them.

---

**Problem:** I cannot log in. The system says my credentials are incorrect.

**Resolution:** Verify that you are entering the email address and password that you used when registering. Passwords are case-sensitive. If you have forgotten your password, use the "Forgot Password" link on the login page (see Section 2.4).

---

**Problem:** My account is locked.

**Resolution:** Your account is temporarily locked after five failed login attempts. The lockout lasts 15 minutes and expires automatically. Wait 15 minutes and then try again. If you continue to have difficulty, contact your camp administrator.

---

**Problem:** I did not receive a password reset email.

**Resolution:** Check your spam or junk mail folder. If the email is not there, ensure you entered the correct email address. Reset links expire after 30 minutes; if the link has expired, request a new one. If you continue to have problems, contact your camp administrator.

---

**Problem:** I cannot see the MFA code entry field after entering my password.

**Resolution:** MFA is only prompted if you have enabled it on your account. If you have recently enabled MFA and are not seeing the prompt, try logging out and logging in again. If the issue persists, contact your administrator.

---

**Problem:** My application is not visible to the administrator.

**Resolution:** Applications in draft mode are not visible to administrators. You must complete the signature step and submit (finalize) the application. See Section 4.5 for the submission process.

---

**Problem:** I cannot edit my submitted application.

**Resolution:** Applications can only be edited if they have not yet received a final decision (approved, rejected, or cancelled). If your application is "Under Review," you may be able to make limited edits. If a final decision has been made, the application cannot be modified. Contact your camp administrator if you need to make changes after a decision.

---

**Problem:** My uploaded document says it is pending scan and I cannot download it.

**Resolution:** The security scanning process runs automatically after upload. It typically completes quickly. Refresh the page and check again. If the document remains in "pending" status for an extended period, contact your camp administrator.

---

**Problem:** My uploaded file was rejected as an unsupported type.

**Resolution:** The system only accepts PDF, JPEG, PNG, GIF, DOC, and DOCX files. Convert your document to PDF format and try uploading again. See Section 10.1 for the full list of accepted file types.

---

**Problem:** My uploaded file was rejected because it is too large.

**Resolution:** The maximum file size is 10 MB. Compress the file before uploading. For PDFs, use a PDF compression utility. For images, reduce the image resolution or use an image compression tool.

---

**Problem:** I cannot send a message to another parent or guardian.

**Resolution:** The messaging system only allows applicants to communicate with administrators. You cannot send messages to other applicant accounts. If you need to contact another family, please reach out through camp-provided contact information outside of this system.

---

**Problem:** The system logged me out unexpectedly.

**Resolution:** Sessions expire after 30 minutes of inactivity. This is a required security measure. Log in again to continue. To avoid losing work, save drafts regularly while working on long forms.

---

**Problem:** I received a notification about a message but I cannot find the message in my inbox.

**Resolution:** Ensure you are looking in the correct inbox section. System-generated messages (such as document request notifications and application status updates) appear as conversations initiated by the system. Scroll through your full conversation list. If you still cannot locate the message, contact your camp administrator.

---

**Problem:** I invited a medical provider but they say the link has expired.

**Resolution:** Medical provider links are valid for 72 hours after creation. If the link has expired, create a new one. Navigate to the camper's medical record, find the provider link section, and generate a new invitation. The previous expired link cannot be reactivated.

---

**Problem:** I need to make a change to an approved or rejected application.

**Resolution:** Final decisions (approved, rejected, cancelled) cannot be changed through the applicant portal. Contact your camp administrator directly. Administrators have the ability to manage records in situations not covered by the standard workflow.

---

**Document Status:** Authoritative
**Audience:** Non-technical users — parents, camp staff, medical staff, system administrators
**Last Updated:** March 2026
