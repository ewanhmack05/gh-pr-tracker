const setupView = document.getElementById("setup-view");
const mainView = document.getElementById("main-view");
const prList = document.getElementById("pr-list");
const commentList = document.getElementById("comment-list");
const emptyState = document.getElementById("empty-state");
const commentEmptyState = document.getElementById("comment-empty-state");
const statusUser = document.getElementById("status-user");
const statusTime = document.getElementById("status-time");
const btnRefresh = document.getElementById("btn-refresh");
const btnNotifToggle = document.getElementById("btn-notif-toggle");
const notifIconOn = document.getElementById("notif-icon-on");
const notifIconOff = document.getElementById("notif-icon-off");
const btnSave = document.getElementById("btn-save");
const btnDisconnect = document.getElementById("btn-disconnect");
const inputToken = document.getElementById("input-token");
const inputUsername = document.getElementById("input-username");

function setNotifToggleUI(enabled) {
  btnNotifToggle.title = enabled ? "Notifications on — click to disable" : "Notifications off — click to enable";
  notifIconOn.classList.toggle("hidden", !enabled);
  notifIconOff.classList.toggle("hidden", enabled);
}

btnNotifToggle.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "TOGGLE_NOTIFICATIONS" }, (res) => {
    setNotifToggleUI(res.notificationsEnabled);
  });
});


function timeAgo(isoString) {
  if (!isoString) { return "never"; }
  const diff = Math.floor((Date.now() - new Date(isoString)) / 1000);
  if (diff < 60) { return `${diff}s ago`; }
  if (diff < 3600) { return `${Math.floor(diff / 60)}m ago`; }
  if (diff < 86400) { return `${Math.floor(diff / 3600)}h ago`; }
  return `${Math.floor(diff / 86400)}d ago`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderPRs(prs, seenComments, mutedPRs = {}, dismissedPRs = {}) {
  prList.innerHTML = "";

  const visiblePRs = (prs || []).filter((pr) => {
    const repoFullName = pr.repository_url.replace("https://api.github.com/repos/", "");
    const prKey = `${repoFullName}#${pr.number}`;
    return !dismissedPRs[prKey];
  });

  if (visiblePRs.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");

  for (const pr of visiblePRs) {
    const repoFullName = pr.repository_url.replace("https://api.github.com/repos/", "");
    const commentCount = pr.comments + (pr.pull_request?.review_comments || 0);
    const prKey = `${repoFullName}#${pr.number}`;
    const isMuted = !!mutedPRs[prKey];

    const item = document.createElement("div");
    item.className = "pr-item";
    item.innerHTML = `
      <div class="pr-header">
        <span class="pr-number">#${pr.number}</span>
        <span class="pr-title">${escapeHtml(pr.title)}</span>
        <div class="pr-actions">
          <button class="mute-btn icon-btn${isMuted ? " muted" : ""}" data-prkey="${escapeHtml(prKey)}" title="${isMuted ? "Unmute PR" : "Mute PR"}">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1a3 3 0 0 1 3 3v2.5l.75 1H2.25L3 6.5V4a3 3 0 0 1 3-3z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
              <path d="M4.5 9.5a1.5 1.5 0 0 0 3 0" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              ${isMuted ? `<line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>` : ""}
            </svg>
          </button>
          <button class="dismiss-btn icon-btn" data-prkey="${escapeHtml(prKey)}" title="Dismiss PR">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="pr-meta">
        <span class="pr-repo">${escapeHtml(repoFullName)}</span>
        <span class="comment-count ${commentCount > 0 ? "has-new" : ""}">
          💬 ${commentCount}
        </span>
        ${isMuted ? `<span class="muted-label">muted</span>` : ""}
      </div>
    `;

    item.querySelector(".mute-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      const key = e.currentTarget.dataset.prkey;
      chrome.runtime.sendMessage({ type: "TOGGLE_MUTE", prKey: key }, () => {
        chrome.storage.local.get(
          ["prs", "seenComments", "mutedPRs", "dismissedPRs"],
          (data) => renderPRs(data.prs, data.seenComments, data.mutedPRs, data.dismissedPRs)
        );
      });
    });

    item.querySelector(".dismiss-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      const key = e.currentTarget.dataset.prkey;
      chrome.runtime.sendMessage({ type: "DISMISS_PR", prKey: key }, () => {
        chrome.storage.local.get(
          ["prs", "seenComments", "mutedPRs", "dismissedPRs"],
          (data) => {
            renderPRs(data.prs, data.seenComments, data.mutedPRs, data.dismissedPRs);
            renderDismissed(data.prs, data.dismissedPRs);
          }
        );
      });
    });

    item.addEventListener("click", () => {
      chrome.tabs.create({ url: pr.html_url });
    });

    prList.appendChild(item);
  }
}

function renderDismissed(prs, dismissedPRs = {}) {
  const list = document.getElementById("dismissed-list");
  const empty = document.getElementById("dismissed-empty-state");
  list.innerHTML = "";

  const dismissed = (prs || []).filter((pr) => {
    const repoFullName = pr.repository_url.replace("https://api.github.com/repos/", "");
    const prKey = `${repoFullName}#${pr.number}`;
    return !!dismissedPRs[prKey];
  });

  if (dismissed.length === 0) {
    empty.classList.remove("hidden");
    return;
  }

  empty.classList.add("hidden");

  for (const pr of dismissed) {
    const repoFullName = pr.repository_url.replace("https://api.github.com/repos/", "");
    const prKey = `${repoFullName}#${pr.number}`;

    const item = document.createElement("div");
    item.className = "pr-item";
    item.innerHTML = `
      <div class="pr-header">
        <span class="pr-number">#${pr.number}</span>
        <span class="pr-title">${escapeHtml(pr.title)}</span>
        <div class="pr-actions">
          <button class="restore-btn icon-btn" data-prkey="${escapeHtml(prKey)}" title="Restore PR">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M10 6A4 4 0 1 1 6 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              <polyline points="6,1 8.5,1 8.5,3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="pr-meta">
        <span class="pr-repo">${escapeHtml(repoFullName)}</span>
        <span class="muted-label">dismissed</span>
      </div>
    `;

    item.querySelector(".restore-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      const key = e.currentTarget.dataset.prkey;
      chrome.runtime.sendMessage({ type: "DISMISS_PR", prKey: key }, () => {
        chrome.storage.local.get(
          ["prs", "seenComments", "mutedPRs", "dismissedPRs"],
          (data) => {
            renderPRs(data.prs, data.seenComments, data.mutedPRs, data.dismissedPRs);
            renderDismissed(data.prs, data.dismissedPRs);
          }
        );
      });
    });

    item.addEventListener("click", () => {
      chrome.tabs.create({ url: pr.html_url });
    });

    list.appendChild(item);
  }
}

function renderComments(allComments) {
  commentList.innerHTML = "";

  if (!allComments || allComments.length === 0) {
    commentEmptyState.classList.remove("hidden");
    return;
  }

  commentEmptyState.classList.add("hidden");

  for (const comment of allComments) {
    const item = document.createElement("div");
    item.className = `comment-item${comment.isNew ? " is-new" : ""}`;
    item.innerHTML = `
      <div class="comment-header">
        <img class="comment-avatar" src="${escapeHtml(comment.avatarUrl)}" alt="" />
        <span class="comment-author">${escapeHtml(comment.author)}</span>
        <span class="comment-time">${timeAgo(comment.createdAt)}</span>
      </div>
      <div class="comment-pr-ref">${escapeHtml(comment.repo)} <span>#${comment.prNumber}</span> · ${escapeHtml(comment.prTitle)}</div>
      <div class="comment-body">${escapeHtml(comment.body)}</div>
    `;

    item.addEventListener("click", () => {
      chrome.tabs.create({ url: comment.htmlUrl });
    });

    commentList.appendChild(item);
  }
}

function statusDotClass(run) {
  if (run.status === "completed") {
    return run.conclusion || "cancelled";
  }
  return run.status;
}

function renderActions(actionRuns) {
  const list = document.getElementById("action-list");
  const empty = document.getElementById("action-empty-state");
  list.innerHTML = "";

  if (!actionRuns || actionRuns.length === 0) {
    empty.classList.remove("hidden");
    return;
  }

  empty.classList.add("hidden");

  for (const run of actionRuns) {
    const dotClass = statusDotClass(run);
    const conclusionLabel = run.status === "completed"
      ? (run.conclusion || "completed")
      : run.status.replace(/_/g, " ");
    const actorSuffix = run.actor ? ` · @${escapeHtml(run.actor)}` : "";

    const item = document.createElement("div");
    item.className = "run-item";
    item.innerHTML = `
      <div class="run-status-dot ${escapeHtml(dotClass)}"></div>
      <div class="run-body">
        <div class="run-header">
          <span class="run-name">${escapeHtml(run.name)}</span>
          <span class="run-time run-conclusion ${escapeHtml(dotClass)}">${escapeHtml(conclusionLabel)}</span>
        </div>
        <div class="run-meta">
          <span class="run-repo">${escapeHtml(run.repo)}</span>
          · ${escapeHtml(run.branch)}${actorSuffix}
        </div>
        <div class="run-title">${escapeHtml(run.displayTitle)} <span class="run-updated">${timeAgo(run.updatedAt)}</span></div>
      </div>
    `;

    item.addEventListener("click", () => {
      chrome.tabs.create({ url: run.htmlUrl });
    });

    list.appendChild(item);
  }
}

function setupTabs() {
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      const target = tab.dataset.tab;
      document.getElementById("tab-prs").classList.toggle("hidden", target !== "prs");
      document.getElementById("tab-comments").classList.toggle("hidden", target !== "comments");
      document.getElementById("tab-actions").classList.toggle("hidden", target !== "actions");
    });
  });

  const prSubTabs = document.querySelectorAll(".pr-sub-tab");
  prSubTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      prSubTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const target = tab.dataset.subtab;
      document.getElementById("subtab-active").classList.toggle("hidden", target !== "active");
      document.getElementById("subtab-dismissed").classList.toggle("hidden", target !== "dismissed");
    });
  });
}

function loadMain(data) {
  setupView.classList.add("hidden");
  mainView.classList.remove("hidden");
  statusUser.textContent = `@${data.username}`;
  statusTime.textContent = `updated ${timeAgo(data.lastPolled)}`;
  setNotifToggleUI(data.notificationsEnabled !== false);
  renderPRs(data.prs, data.seenComments, data.mutedPRs, data.dismissedPRs);
  renderDismissed(data.prs, data.dismissedPRs);
  renderComments(data.allComments);
  renderActions(data.actionRuns);
}

function loadSetup() {
  mainView.classList.add("hidden");
  setupView.classList.remove("hidden");
}

setupTabs();

chrome.storage.local.get(
  ["token", "username", "prs", "lastPolled", "seenComments", "allComments", "actionRuns", "notificationsEnabled", "mutedPRs", "dismissedPRs"],
  (data) => {
    if (data.token && data.username) {
      loadMain(data);
    } else {
      loadSetup();
    }
  }
);

btnSave.addEventListener("click", () => {
  const token = inputToken.value.trim();
  const username = inputUsername.value.trim();
  if (!token || !username) { return; }

  chrome.storage.local.set({ token, username, seenComments: {} }, () => {
    chrome.runtime.sendMessage({ type: "POLL_NOW" }, () => {
      chrome.storage.local.get(
        ["token", "username", "prs", "lastPolled", "seenComments", "allComments", "actionRuns", "notificationsEnabled", "mutedPRs", "dismissedPRs"],
        loadMain
      );
    });
  });
});

btnDisconnect.addEventListener("click", () => {
  chrome.storage.local.clear(() => {
    loadSetup();
  });
});

btnRefresh.addEventListener("click", () => {
  btnRefresh.classList.add("spinning");
  chrome.runtime.sendMessage({ type: "POLL_NOW" }, () => {
    chrome.storage.local.get(
      ["token", "username", "prs", "lastPolled", "seenComments", "allComments", "actionRuns", "notificationsEnabled", "mutedPRs", "dismissedPRs"],
      (data) => {
        btnRefresh.classList.remove("spinning");
        loadMain(data);
      }
    );
  });
});
