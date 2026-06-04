# gh-pr-tracker

A Chrome extension for tracking GitHub pull requests, comments, and Actions runs — with desktop notifications, per-PR muting, dismissal, and sorting.

---

## Setup

### 1. Create a Personal Access Token

Go to [GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)](https://github.com/settings/tokens/new) and create a new token with the following scopes:

| Scope           | Reason                                                         |
| --------------- | -------------------------------------------------------------- |
| `repo`          | Read PRs, comments, reviews, and Actions runs on private repos |
| `read:org`      | Read repos belonging to your organisations                     |
| `notifications` | Required for the notifications permission                      |

> **Fine-grained tokens** are not currently supported — use a classic token.

### 2. Connect the extension

Open the extension popup and enter your token and GitHub username, then click **Connect**. The extension will immediately run its first poll and populate all tabs.

---

## Tabs

### PRs

<img width="452" height="707" alt="image" src="https://github.com/user-attachments/assets/0d32d882-a8ba-40ad-8bdf-3da55f6b88e8" />

Lists all open pull requests you are involved in. Each item shows:

- PR number and title
- Repository name and comment count
- Review state badge — **Approved**, **Changes requested**, or **Pending review**

<img width="445" height="118" alt="image" src="https://github.com/user-attachments/assets/b3e25425-c9cf-4cf8-bc43-637f932f5f43" />


**Sorting** — use the dropdown above the list to sort by:

- Latest (default)
- Most comments
- By repo
- Approved first
- Unapproved first

<img width="445" height="373" alt="image" src="https://github.com/user-attachments/assets/99122644-dba6-40fe-b66b-6227c8391d63" />

**Per-PR actions** (appear on hover):

- **Mute** — silences desktop notifications for that PR without hiding it
- **Dismiss** — hides the PR from the active list

#### Dismissed

A sub-tab showing all PRs you have dismissed. Each entry has a restore button to bring it back to the active list. Dismissed entries are automatically cleaned up when a PR is merged or closed.

<img width="452" height="251" alt="image" src="https://github.com/user-attachments/assets/b2c6f184-5e03-4d9b-b198-4da052fd872a" />

---

### Comments

<img width="452" height="623" alt="image" src="https://github.com/user-attachments/assets/c3434db8-08d4-4907-a789-e6550d2fa459" />

A unified feed of all comments across your tracked PRs, sorted newest first. Each entry shows the author avatar, username, timestamp, PR reference, and comment body. New (unseen) comments are highlighted with an orange left border. Clicking any entry opens it on GitHub.

---

### Actions

<img width="446" height="622" alt="image" src="https://github.com/user-attachments/assets/1f32da89-464f-4fb2-8d47-fe754e25b9cc" />

Lists GitHub Actions runs triggered by you across all repos you own or collaborate on, sorted by most recently updated. Each entry shows:

- Status dot (pulsing orange when in progress, green for success, red for failure)
- Workflow name and result label
- Repository and branch
- Commit/trigger title and time elapsed

Clicking an entry opens the run on GitHub.

---

## Desktop Notifications

The extension polls GitHub every **2 minutes** via a background service worker. Desktop notifications fire when:

- A new comment is left on a PR you are involved in, by someone other than yourself
- A GitHub Actions run you triggered completes (success, failure, or other conclusion)

Notifications will **not** fire for comments that already existed when a PR was first seen (no flood on install or reconnect).

**Global toggle** — the bell icon in the header enables or disables all PR comment notifications. Action run notifications are always on.

**Per-PR muting** — muting a PR suppresses its comment notifications individually without affecting others.

---

## Header controls

| Control        | Function                                         |
| -------------- | ------------------------------------------------ |
| Refresh button | Triggers an immediate poll                       |
| Bell icon      | Toggles desktop notifications on/off globally    |
| Disconnect     | Clears the stored token and resets the extension |

---

## Token storage

Your personal access token is stored in `chrome.storage.local`, scoped to the extension. It is never sent anywhere other than the GitHub API.
