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

<!-- screenshot -->

Lists all open pull requests you are involved in. Each item shows:

- PR number and title
- Repository name and comment count
- Review state badge — **Approved**, **Changes requested**, or **Pending review**

**Sorting** — use the dropdown above the list to sort by:

- Latest (default)
- Most comments
- By repo
- Approved first
- Unapproved first

**Per-PR actions** (appear on hover):

- **Mute** — silences desktop notifications for that PR without hiding it
- **Dismiss** — hides the PR from the active list

#### Dismissed

A sub-tab showing all PRs you have dismissed. Each entry has a restore button to bring it back to the active list. Dismissed entries are automatically cleaned up when a PR is merged or closed.

---

### Comments

<!-- screenshot -->

A unified feed of all comments across your tracked PRs, sorted newest first. Each entry shows the author avatar, username, timestamp, PR reference, and comment body. New (unseen) comments are highlighted with an orange left border. Clicking any entry opens it on GitHub.

---

### Actions

<!-- screenshot -->

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
