# Automatic Re-FollowUp Mechanism

Husada CRM features an automated client retention system that re-engages patients who have not replied to our last message within a specified time limit (default 24 hours).

## Configuration settings

Configurations are stored in the database (`system_settings` table) and managed via `/dashboard/settings` (Admin/Super Admin only):

* **`auto_followup_enabled`** (`true` / `false`): Enables or disables the background cron runner.
* **`auto_followup_hours`** (Integer, default `24`): The waiting threshold in hours before a conversation is considered idle.
* **`auto_followup_template`** (Text): The custom follow-up message template. Supports the dynamic variable `{{nama}}` which resolves to the patient's name.

## Background Execution Engine

The background job is integrated into `server.js` and runs on a **30-minute interval**.

### Process Workflow
1. **Setting Validation**: The system checks if `auto_followup_enabled` is set to `"true"`.
2. **Idle Discovery**: Queries the database for open conversations where `lastMessageAt` is older than `now - auto_followup_hours`.
3. **Outbound Verification**: For each idle conversation, it checks the last message. If the last message was outbound (sent by us) and was *not* sent by the System User ID (`de5118a9-d0d0-4d14-9670-13e3e56b5116`), it qualifies for a follow-up.
4. **Variable Interpolation**: Replaces `{{nama}}` with the contact's `fullName` (falls back to "Kak" if blank).
5. **WAHA Dispatch**: Sends a `POST` request to WAHA API (`/api/sendText`) using the `default` session name.
6. **Persistence**:
   * Saves the outbound message in `messages` under System User ID (`de5118a9-d0d0-4d14-9670-13e3e56b5116`).
   * Updates `lastMessageAt` and `lastRepliedById` in `conversations`.
   * Increments `totalMessages` and updates `lastInteractionAt` in `contacts`.
7. **Audit Trail Logging**: Inserts an entry into `activity_logs` with action `auto_followup` attributing it to the System User ID.
8. **Real-time Synchronization**: Broadcasts Socket.io events (`new_message` and `inbox_update`) to instantly refresh active frontend agents' UI dashboards.

## Security Guards
* **Anti-Spam Filter**: If the last message in the thread is already an automatic follow-up (i.e. sent by the System User ID), the conversation is skipped to prevent repeatedly spamming the user.
* **Agent Response Safety**: If the last message was inbound (sent by the patient), the system ignores it. This prevents automated follow-ups from interrupting threads where patients are actively waiting for an agent's custom response.
