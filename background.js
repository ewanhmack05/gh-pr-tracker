const POLL_INTERVAL_MINUTES = 2;
const GITHUB_API = "https://api.github.com";

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["token", "username", "seenComments", "trackedRepos", "notificationsEnabled", "mutedPRs", "dismissedPRs"], resolve);
  });
}

async function fetchJSON(url, token) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function getUserRepos(token) {
  const [userRepos, orgs] = await Promise.all([
    fetchJSON(`${GITHUB_API}/user/repos?affiliation=owner,collaborator,organization_member&per_page=100&sort=pushed`, token),
    fetchJSON(`${GITHUB_API}/user/orgs`, token),
  ]);

  const repoSet = new Set(userRepos.map((r) => r.full_name));

  await Promise.all(
    orgs.map(async (org) => {
      try {
        const orgRepos = await fetchJSON(
          `${GITHUB_API}/orgs/${org.login}/repos?per_page=100&sort=pushed`,
          token
        );
        for (const r of orgRepos) {
          repoSet.add(r.full_name);
        }
      } catch {
        // no access to this org repos
      }
    })
  );

  return [...repoSet];
}

async function getActionRuns(token, username) {
  let repos;
  try {
    repos = await getUserRepos(token);
  } catch (err) {
    console.error("Failed to fetch repos:", err.message);
    return [];
  }

  const allRuns = [];
  await Promise.all(
    repos.map(async (repo) => {
      try {
        const result = await fetchJSON(
          `${GITHUB_API}/repos/${repo}/actions/runs?actor=${username}&per_page=10`,
          token
        );
        for (const run of result.workflow_runs || []) {
          allRuns.push({
            id: String(run.id),
            name: run.name,
            displayTitle: run.display_title,
            repo,
            status: run.status,
            conclusion: run.conclusion,
            createdAt: run.created_at,
            updatedAt: run.updated_at,
            htmlUrl: run.html_url,
            branch: run.head_branch,
            event: run.event,
            actor: run.triggering_actor?.login || run.actor?.login || "",
          });
        }
      } catch {
        // repo may not have Actions enabled
      }
    })
  );

  allRuns.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  return allRuns.slice(0, 50);
}

async function getOpenPRs(token, username) {
  const query = `is:pr+is:open+involves:${username}`;
  const data = await fetchJSON(
    `${GITHUB_API}/search/issues?q=${query}&per_page=50`,
    token
  );
  return data.items || [];
}

async function getCommentsForPR(token, repoFullName, prNumber) {
  const [issueComments, reviewComments] = await Promise.all([
    fetchJSON(
      `${GITHUB_API}/repos/${repoFullName}/issues/${prNumber}/comments?per_page=100`,
      token
    ),
    fetchJSON(
      `${GITHUB_API}/repos/${repoFullName}/pulls/${prNumber}/comments?per_page=100`,
      token
    ),
  ]);
  return [...issueComments, ...reviewComments];
}

function showNotification(id, title, message, iconUrl) {
  chrome.notifications.create(id, {
    type: "basic",
    iconUrl: iconUrl || "icons/icon48.png",
    title,
    message,
    priority: 2,
  });
}

async function pollPRs() {
  const { token, username, seenComments = {}, seenRuns = {}, notificationsEnabled = true, mutedPRs = {}, dismissedPRs = {} } = await getSettings();

  if (!token || !username) {
    return;
  }

  let prs;
  try {
    prs = await getOpenPRs(token, username);
  } catch (err) {
    console.error("Failed to fetch PRs:", err.message);
    return;
  }

  let actionRuns = [];
  try {
    actionRuns = await getActionRuns(token, username);
  } catch (err) {
    console.error("Failed to fetch action runs:", err.message);
  }

  const updatedSeen = { ...seenComments };
  const newNotifications = [];
  const allComments = [];

  for (const pr of prs) {
    const repoFullName = pr.repository_url.replace(`${GITHUB_API}/repos/`, "");
    const prKey = `${repoFullName}#${pr.number}`;

    let comments;
    try {
      comments = await getCommentsForPR(token, repoFullName, pr.number);
    } catch {
      continue;
    }

    const previouslySeen = new Set(seenComments[prKey] || []);

    for (const comment of comments) {
      const commentId = String(comment.id);
      const isNew = !previouslySeen.has(commentId);

      allComments.push({
        id: commentId,
        author: comment.user?.login || "unknown",
        avatarUrl: comment.user?.avatar_url || "",
        body: comment.body || "",
        createdAt: comment.created_at,
        htmlUrl: comment.html_url,
        prNumber: pr.number,
        prTitle: pr.title,
        repo: repoFullName,
        isNew,
      });

      if (isNew) {
        if (comment.user?.login !== username && notificationsEnabled && !mutedPRs[prKey]) {
          newNotifications.push({
            id: `pr-comment-${commentId}`,
            title: `💬 ${comment.user?.login} on ${repoFullName}#${pr.number}`,
            message: comment.body?.slice(0, 200) || "(no content)",
          });
        }
        previouslySeen.add(commentId);
      }
    }

    updatedSeen[prKey] = [...previouslySeen];
  }

  allComments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const updatedSeenRuns = { ...seenRuns };
  for (const run of actionRuns) {
    const prev = seenRuns[run.id];
    if (!prev) {
      updatedSeenRuns[run.id] = { status: run.status, conclusion: run.conclusion };
    } else if (
      run.status === "completed" &&
      (prev.status !== "completed" || prev.conclusion !== run.conclusion)
    ) {
      const emoji = run.conclusion === "success" ? "✅" : run.conclusion === "failure" ? "❌" : "⚠️";
      showNotification(
        `run-${run.id}`,
        `${emoji} ${run.name} · ${run.repo}`,
        `${run.displayTitle} (${run.branch}) — ${run.conclusion}`
      );
      updatedSeenRuns[run.id] = { status: run.status, conclusion: run.conclusion };
    }
  }

  chrome.storage.local.set({ seenComments: updatedSeen, seenRuns: updatedSeenRuns });

  for (const notif of newNotifications) {
    showNotification(notif.id, notif.title, notif.message);
  }

  const openPRKeys = new Set(
    prs.map((pr) => {
      const repoFullName = pr.repository_url.replace(`${GITHUB_API}/repos/`, "");
      return `${repoFullName}#${pr.number}`;
    })
  );
  const prunedDismissed = Object.fromEntries(
    Object.entries(dismissedPRs).filter(([key]) => openPRKeys.has(key))
  );
  chrome.storage.local.set({ dismissedPRs: prunedDismissed });

  chrome.storage.local.set({ lastPolled: new Date().toISOString(), prs, allComments, actionRuns });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "poll-prs") {
    pollPRs();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("poll-prs", {
    periodInMinutes: POLL_INTERVAL_MINUTES,
  });
  pollPRs();
});

chrome.runtime.onStartup.addListener(() => {
  pollPRs();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "POLL_NOW") {
    pollPRs().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === "CLEAR_SEEN") {
    chrome.storage.local.set({ seenComments: {} }, () => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === "TOGGLE_NOTIFICATIONS") {
    chrome.storage.local.get(["notificationsEnabled"], (data) => {
      const next = !(data.notificationsEnabled !== false);
      chrome.storage.local.set({ notificationsEnabled: next }, () => sendResponse({ notificationsEnabled: next }));
    });
    return true;
  }
  if (msg.type === "TOGGLE_MUTE") {
    chrome.storage.local.get(["mutedPRs"], (data) => {
      const mutedPRs = data.mutedPRs || {};
      if (mutedPRs[msg.prKey]) {
        delete mutedPRs[msg.prKey];
      } else {
        mutedPRs[msg.prKey] = true;
      }
      chrome.storage.local.set({ mutedPRs }, () => sendResponse({ mutedPRs }));
    });
    return true;
  }
  if (msg.type === "DISMISS_PR") {
    chrome.storage.local.get(["dismissedPRs"], (data) => {
      const dismissedPRs = data.dismissedPRs || {};
      if (dismissedPRs[msg.prKey]) {
        delete dismissedPRs[msg.prKey];
      } else {
        dismissedPRs[msg.prKey] = true;
      }
      chrome.storage.local.set({ dismissedPRs }, () => sendResponse({ dismissedPRs }));
    });
    return true;
  }
});
