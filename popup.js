const setupView = document.getElementById("setup-view");
const mainView = document.getElementById("main-view");
const prList = document.getElementById("pr-list");
const commentList = document.getElementById("comment-list");
const emptyState = document.getElementById("empty-state");
const commentEmptyState = document.getElementById("comment-empty-state");
const statusUser = document.getElementById("status-user");
const statusTime = document.getElementById("status-time");
const btnRefresh = document.getElementById("btn-refresh");
const btnSave = document.getElementById("btn-save");
const btnDisconnect = document.getElementById("btn-disconnect");
const inputToken = document.getElementById("input-token");
const inputUsername = document.getElementById("input-username");

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

function renderPRs(prs, seenComments) {
  prList.innerHTML = "";

  if (!prs || prs.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");

  for (const pr of prs) {
    const repoFullName = pr.repository_url.replace("https://api.github.com/repos/", "");
    const commentCount = pr.comments + (pr.pull_request?.review_comments || 0);

    const item = document.createElement("div");
    item.className = "pr-item";
    item.innerHTML = `
      <div class="pr-header">
        <span class="pr-number">#${pr.number}</span>
        <span class="pr-title">${escapeHtml(pr.title)}</span>
      </div>
      <div class="pr-meta">
        <span class="pr-repo">${escapeHtml(repoFullName)}</span>
        <span class="comment-count ${commentCount > 0 ? "has-new" : ""}">
          💬 ${commentCount}
        </span>
      </div>
    `;

    item.addEventListener("click", () => {
      chrome.tabs.create({ url: pr.html_url });
    });

    prList.appendChild(item);
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
    const item = document.createElement("div");
    item.className = "run-item";
    item.innerHTML = `
      <div class="run-status-dot ${escapeHtml(dotClass)}"></div>
      <div class="run-body">
        <div class="run-header">
          <span class="run-name">${escapeHtml(run.name)}</span>
          <span class="run-time">${timeAgo(run.createdAt)}</span>
        </div>
        <div class="run-meta">
          <span class="run-repo">${escapeHtml(run.repo)}</span>
          · ${escapeHtml(run.branch)} · ${escapeHtml(run.event)}
        </div>
        <div class="run-title">${escapeHtml(run.displayTitle)}</div>
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
}

function loadMain(data) {
  setupView.classList.add("hidden");
  mainView.classList.remove("hidden");
  statusUser.textContent = `@${data.username}`;
  statusTime.textContent = `updated ${timeAgo(data.lastPolled)}`;
  renderPRs(data.prs, data.seenComments);
  renderComments(data.allComments);
  renderActions(data.actionRuns);
}

function loadSetup() {
  mainView.classList.add("hidden");
  setupView.classList.remove("hidden");
}

setupTabs();

chrome.storage.local.get(
  ["token", "username", "prs", "lastPolled", "seenComments", "allComments", "actionRuns"],
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
        ["token", "username", "prs", "lastPolled", "seenComments", "allComments", "actionRuns"],
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
      ["token", "username", "prs", "lastPolled", "seenComments", "allComments", "actionRuns"],
      (data) => {
        btnRefresh.classList.remove("spinning");
        loadMain(data);
      }
    );
  });
});
