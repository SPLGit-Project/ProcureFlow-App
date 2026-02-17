# Directory & Invitation System Blueprint

## 1. Overview
The Directory & Invitation module allows ProcureFlow to synchronise users from the corporate directory (Azure AD / Entra ID) and securely invite them to the platform. It bridges the gap between the corporate identity provider and the application's internal user table.

---

## 2. Architecture Components

### 2.1 Backend Services (Supabase Edge Functions)
Two core Edge Functions drive this module:

1.  **`directory-suggest`**:
    *   **Purpose**: Real-time search of the corporate directory to find users to invite.
    *   **Source**: Queries Microsoft Graph API (`/users`) with fuzzy matching.
    *   **Security**: Restricted to authenticated Admins/Site Admins.
    *   **Optimization**: Uses a lightweight "suggest" mode to return minimal data (Name, Email, Job Title) for UI dropdowns.

2.  **`send-invite-email`**:
    *   **Purpose**: Generates and sends a secure invitation link via email.
    *   **Mechanism**: Uses Microsoft Graph API (`/sendMail`) to send emails on behalf of the system or a specific user.
    *   **Token Generation**: Creates a cryptographically unique token, hashes it, and stores it in the `invites` table with an expiration (7 days).
    *   **Version**: 1.0.4 (supports dynamic sender personalization and site name placeholders).

### 2.2 Database Schema
*   **`users` table**: Stores detailed profile info (synced from AD + local overrides).
*   **`invites` table**:
    *   `email`: Target email.
    *   `token_hash`: SHA-256 hash of the invite token (security best practice; raw token never stored).
    *   `expires_at`: Timestamp.
    *   `invited_by`: Reference to the admin who sent it.
    *   `site_id`: (Optional) Pre-assigns the user to a site upon acceptance.

---

## 3. Invitation Flow
1.  **Search**: Admin searches for a user in the "Add User" modal (`directory-suggest`).
2.  **Select**: App checks if the user already exists in `users` table.
    *   *If yes*: Prompts to update/reactivate.
    *   *If no*: Prepares a new invitation.
3.  **Configure**: Admin selects a Role (e.g., SITE_USER) and a Site.
4.  **Send**:
    *   Frontend calls `send-invite-email`.
    *   Edge Function verifies permissions.
    *   Edge Function generates token and inserts into DB.
    *   Edge Function sends email via Microsoft Graph.
5.  **Accept**:
    *   User clicks link (`/invite?token=...`).
    *   Frontend validates token against DB hash.
    *   User is redirected to SSO Login (`/login`).
    *   Post-login, the `AuthContext` links the SSO identity (`auth.uid`) to the invited email profile.

---

## 4. UI/UX Configuration & Customization
This section details the user-facing controls for managing invitations, specifically within the **Admin Settings**.

### 4.1 Email Template Management
Admins have full control over the invitation email appearance and behavior via **Settings > Email Templates**.

*   **Subject Line**: Customizable subject (e.g., "Welcome to ProcureFlow").
*   **HTML Body**: Full HTML editor for the email content.
*   **Dynamic Placeholders**:
    *   `{name}`: The invited user's display name.
    *   `{invited_by_name}`: Name of the admin sending the invite.
    *   `{app_name}`: The application name (configured in Branding).
    *   `{link}`: The clickable invitation URL.

### 4.2 Sender Identity Control (New in v1.0.3)
To ensure high deliverability and professional appearance, the system allows configuring *who* the email appears to come from.

*   **Configuration Field**: "Sender Email (From)" in Settings.
*   **Behavior Logic**:
    1.  **Configured Sender**: If a specific email is set in Settings (e.g., `noreply@procureflow.com` or `admin@company.com`), the system will attempt to send *from* that address.
        *   *Requirement*: The Azure App Registration must have `Mail.Send` permissions for that specific user or `Mail.Send` application-level permissions.
    2.  **Fallback (User)**: If the setting is blank, the system defaults to the **Current User's Email**.
        *   *Scenario*: Admin Jane invites Bob. The email comes from `jane@company.com`.
        *   *Benefit*: High trust; recipients recognize the sender.
    3.  **Fallback (System)**: If the current user's email is unavailable/invalid, it falls back to the `SYSTEM_SENDER_EMAIL` environment variable defined in Supabase Secrets.

### 4.3 Preview & Testing
*   **Live Preview**: The Settings screen renders a real-time HTML preview of the email with dummy data, allowing admins to verify layout and formatting before saving.
*   **Test Send**: A "Send Test Email" button allows the admin to send a fully rendered version to themselves to verify end-to-end delivery and formatting.

---

## 5. Security & Governance

### 5.1 Permissive vs. Strict
*   **Current State**: Checks `roles` table. Only `ADMIN`, `SITE_ADMIN`, or `OWNER` can call the `send-invite-email` function.
*   **Token Security**: Tokens are UUIDv4. Only the *hash* is stored in the DB. This prevents an attacker with DB access from generating valid invite links.

### 5.2 Audit Trail
*   The `invites` table serves as a log of who invited whom.
*   Successful invitations are logged in console/Supabase logs with the sender identity used.
