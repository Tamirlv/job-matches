const fs = require('node:fs');
const path = require('node:path');
const { formatElapsed } = require('./relative-time');

const TIER_LABELS = {
  strong_match: '🟢 Strong Match',
  worth_a_look: '🟡 Worth a Look',
  long_shot: '🟠 Long Shot',
};

const TIER_ACCENT = {
  strong_match: '#22c55e',
  worth_a_look: '#eab308',
  long_shot: '#f97316',
};

const TIER_ORDER = ['strong_match', 'worth_a_look', 'long_shot'];
const PAGE_SIZE = 10;

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toIsraeliDate(isoDate) {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

// `now` is injectable for deterministic tests; production calls always use the real current time.
function formatPosted(m, now = new Date()) {
  if (m.postedTimestamp) return `Posted: ${formatElapsed(m.postedTimestamp, now)}`;
  if (m.postedAt) return `Posted: ${toIsraeliDate(m.postedAt)}`;
  return '';
}

// Best available timestamp for sorting "most recently posted first" - falls back
// through decreasing precision, and finally to when we found it if nothing else exists.
function postedSortKey(m) {
  if (m.postedTimestamp) return new Date(m.postedTimestamp).getTime();
  if (m.postedAt) return new Date(`${m.postedAt}T12:00:00.000Z`).getTime();
  return new Date(m.foundAt).getTime();
}

function renderCard(m, now) {
  const postedText = formatPosted(m, now);
  const timestampAttr = m.postedTimestamp ? ` data-posted-timestamp="${escapeHtml(m.postedTimestamp)}"` : '';
  const locationHtml = m.location ? `<span class="job-location">${escapeHtml(m.location)}</span>` : '';
  const postedHtml = postedText ? `<span class="job-posted"${timestampAttr}>${escapeHtml(postedText)}</span>` : '';
  const separator = locationHtml && postedHtml ? ' &middot; ' : '';
  const meta = locationHtml || postedHtml ? `<div class="job-meta">${locationHtml}${separator}${postedHtml}</div>` : '';
  return `<div class="job-card" data-job-id="${escapeHtml(m.id)}">
  <div class="job-card-header">
    <h3>${escapeHtml(m.title)}</h3>
    <span class="company">${escapeHtml(m.company)}</span>
  </div>
  ${meta}
  <p class="reason">${escapeHtml(m.reason)}</p>
  <div class="job-actions">
    <a class="apply-link" href="${escapeHtml(m.applyLink)}" target="_blank" rel="noopener">View posting</a>
    <label class="sent-cv-label"><input type="checkbox" class="sent-cv-checkbox"> Sent CV</label>
    <button type="button" class="delete-btn">Remove</button>
  </div>
</div>`;
}

function renderTabBar(countsByTier, activeTier) {
  const buttons = TIER_ORDER.map((tier) => {
    const activeClass = tier === activeTier ? ' active' : '';
    return `<button type="button" class="tab-btn${activeClass}" data-tab="${tier}" style="--tier-accent: ${TIER_ACCENT[tier]}">${TIER_LABELS[tier]} <span class="count">(${countsByTier[tier]})</span></button>`;
  }).join('\n');
  return `<div class="tabs">\n${buttons}\n</div>`;
}

function renderPagination() {
  return `<div class="pagination">
    <button type="button" class="prev-page">&laquo; Prev</button>
    <span class="page-indicator">Page 1</span>
    <button type="button" class="next-page">Next &raquo;</button>
  </div>`;
}

function renderTierSection(tier, tierMatches, activeTier, now) {
  const cards = tierMatches.map((m) => renderCard(m, now)).join('\n');
  const activeClass = tier === activeTier ? ' active' : '';
  return `<section class="tier-section${activeClass}" data-tier="${tier}" style="--tier-accent: ${TIER_ACCENT[tier]}">
  ${renderPagination()}
  <div class="cards-container">
${cards}
  </div>
</section>`;
}

const STYLE = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    background: #f4f5f7;
    color: #1f2430;
    margin: 0;
    padding: 24px;
  }
  h1 { font-size: 22px; margin: 0 0 20px; text-align: center; }
  .tabs {
    display: flex;
    justify-content: center;
    gap: 8px;
    max-width: 760px;
    margin: 0 auto;
    flex-wrap: wrap;
    position: sticky;
    top: 0;
    z-index: 20;
    background: #f4f5f7;
    padding: 12px 0;
  }
  .tab-btn {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-bottom: 3px solid transparent;
    border-radius: 8px 8px 0 0;
    padding: 10px 16px;
    font-size: 14px;
    font-weight: 600;
    color: #6b7280;
    cursor: pointer;
  }
  .tab-btn .count { font-weight: normal; }
  .tab-btn.active { color: #1f2430; border-bottom-color: var(--tier-accent); }
  .tab-btn:hover { color: #1f2430; }
  .tier-section { max-width: 760px; margin: 0 auto 32px; display: none; }
  .tier-section.active { display: block; }
  .cards-container { display: flex; flex-direction: column; gap: 12px; }
  .job-card {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-left: 4px solid var(--tier-accent);
    border-radius: 8px;
    padding: 14px 16px;
  }
  .job-card.sent-cv { opacity: 0.6; }
  .job-card-header { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; }
  .job-card-header h3 { margin: 0; font-size: 16px; }
  .company { color: #4b5563; font-size: 14px; }
  .job-meta { color: #6b7280; font-size: 12px; margin-top: 4px; }
  .reason { font-size: 14px; color: #374151; margin: 8px 0; }
  .job-actions { display: flex; align-items: center; gap: 14px; margin-top: 10px; flex-wrap: wrap; }
  .apply-link { color: #2563eb; text-decoration: none; font-size: 14px; font-weight: 600; }
  .apply-link:hover { text-decoration: underline; }
  .sent-cv-label { font-size: 13px; color: #374151; display: flex; align-items: center; gap: 5px; cursor: pointer; }
  .delete-btn {
    margin-left: auto;
    background: none;
    border: 1px solid #d1d5db;
    color: #6b7280;
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 13px;
    cursor: pointer;
  }
  .delete-btn:hover { background: #fee2e2; border-color: #fca5a5; color: #b91c1c; }
  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 14px;
    margin-bottom: 16px;
    position: sticky;
    top: 60px;
    z-index: 10;
    background: #f4f5f7;
    padding: 8px 0;
  }
  .pagination button {
    background: #ffffff;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    padding: 5px 12px;
    font-size: 13px;
    cursor: pointer;
  }
  .pagination button:disabled { opacity: 0.4; cursor: default; }
  .page-indicator { font-size: 13px; color: #6b7280; }
  .empty-message { color: #6b7280; font-size: 14px; }
`;

const SCRIPT = `
  (function () {
    var PAGE_SIZE = ${PAGE_SIZE};
    var DISMISSED_KEY = 'jobMatcherDismissed';
    var SENT_CV_KEY = 'jobMatcherSentCv';

    function loadSet(key) {
      try {
        var raw = localStorage.getItem(key);
        return raw ? new Set(JSON.parse(raw)) : new Set();
      } catch (e) {
        return new Set();
      }
    }

    function saveSet(key, set) {
      try {
        localStorage.setItem(key, JSON.stringify(Array.from(set)));
      } catch (e) {
        // localStorage unavailable - state just won't persist across reloads
      }
    }

    function repaginateVisible(section) {
      // Re-run the display pass over ALL cards (including hidden-by-dismiss ones,
      // which stay display:none permanently) using the current page.
      var allCards = section.querySelectorAll('.job-card');
      var visibleCards = Array.prototype.filter.call(allCards, function (c) {
        return c.getAttribute('data-dismissed') !== 'true';
      });
      var pageAttr = parseInt(section.getAttribute('data-page') || '1', 10);
      var totalPages = Math.max(1, Math.ceil(visibleCards.length / PAGE_SIZE));
      if (pageAttr > totalPages) pageAttr = totalPages;
      section.setAttribute('data-page', String(pageAttr));

      visibleCards.forEach(function (card, i) {
        var onThisPage = i >= (pageAttr - 1) * PAGE_SIZE && i < pageAttr * PAGE_SIZE;
        card.style.display = onThisPage ? '' : 'none';
      });

      section.querySelectorAll('.page-indicator').forEach(function (indicator) {
        indicator.textContent = 'Page ' + pageAttr + ' of ' + totalPages;
      });
      section.querySelectorAll('.prev-page').forEach(function (btn) {
        btn.disabled = pageAttr <= 1;
      });
      section.querySelectorAll('.next-page').forEach(function (btn) {
        btn.disabled = pageAttr >= totalPages;
      });
    }

    function formatElapsedClientSide(timestampIso, now) {
      var then = new Date(timestampIso).getTime();
      var diffMs = Math.max(0, now.getTime() - then);
      var minute = 60000, hour = 3600000, day = 86400000, week = 7 * day;
      if (diffMs < hour) {
        var mins = Math.max(1, Math.floor(diffMs / minute));
        return mins + (mins === 1 ? ' minute ago' : ' minutes ago');
      }
      if (diffMs < day) {
        var hrs = Math.floor(diffMs / hour);
        return hrs + (hrs === 1 ? ' hour ago' : ' hours ago');
      }
      if (diffMs < week) {
        var days = Math.floor(diffMs / day);
        return days + (days === 1 ? ' day ago' : ' days ago');
      }
      var d = new Date(timestampIso);
      var dd = String(d.getUTCDate()).padStart(2, '0');
      var mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      return dd + '/' + mm + '/' + d.getUTCFullYear();
    }

    function refreshPostedTimes() {
      var now = new Date();
      document.querySelectorAll('.job-posted[data-posted-timestamp]').forEach(function (el) {
        var ts = el.getAttribute('data-posted-timestamp');
        el.textContent = 'Posted: ' + formatElapsedClientSide(ts, now);
      });
    }

    function updateTabCount(tier) {
      var section = document.querySelector('.tier-section[data-tier="' + tier + '"]');
      var tabBtn = document.querySelector('.tab-btn[data-tab="' + tier + '"]');
      if (!section || !tabBtn) return;
      var remaining = Array.prototype.filter.call(section.querySelectorAll('.job-card'), function (c) {
        return c.getAttribute('data-dismissed') !== 'true';
      }).length;
      var countSpan = tabBtn.querySelector('.count');
      if (countSpan) countSpan.textContent = '(' + remaining + ')';
    }

    document.addEventListener('DOMContentLoaded', function () {
      refreshPostedTimes();
      setInterval(refreshPostedTimes, 60000);

      var dismissed = loadSet(DISMISSED_KEY);
      var sentCv = loadSet(SENT_CV_KEY);

      document.querySelectorAll('.job-card').forEach(function (card) {
        var id = card.getAttribute('data-job-id');
        if (dismissed.has(id)) {
          card.setAttribute('data-dismissed', 'true');
          card.style.display = 'none';
        }
        if (sentCv.has(id)) {
          var checkbox = card.querySelector('.sent-cv-checkbox');
          if (checkbox) checkbox.checked = true;
          card.classList.add('sent-cv');
        }
      });

      document.querySelectorAll('.tier-section').forEach(function (section) {
        updateTabCount(section.getAttribute('data-tier'));
      });

      document.querySelectorAll('.tab-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var tab = btn.getAttribute('data-tab');
          document.querySelectorAll('.tab-btn').forEach(function (b) {
            b.classList.toggle('active', b === btn);
          });
          document.querySelectorAll('.tier-section').forEach(function (s) {
            var isTarget = s.getAttribute('data-tier') === tab;
            s.classList.toggle('active', isTarget);
            // Reset every tab back to page 1 on switch, so returning to a tab
            // later always starts fresh rather than wherever it was left.
            s.setAttribute('data-page', '1');
            repaginateVisible(s);
          });
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      });

      document.querySelectorAll('.tier-section').forEach(function (section) {
        section.setAttribute('data-page', '1');
        repaginateVisible(section);

        section.querySelectorAll('.prev-page').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var page = parseInt(section.getAttribute('data-page') || '1', 10);
            section.setAttribute('data-page', String(Math.max(1, page - 1)));
            repaginateVisible(section);
          });
        });
        section.querySelectorAll('.next-page').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var page = parseInt(section.getAttribute('data-page') || '1', 10);
            section.setAttribute('data-page', String(page + 1));
            repaginateVisible(section);
          });
        });
      });

      document.querySelectorAll('.sent-cv-checkbox').forEach(function (checkbox) {
        checkbox.addEventListener('change', function () {
          var card = checkbox.closest('.job-card');
          var id = card.getAttribute('data-job-id');
          if (checkbox.checked) {
            sentCv.add(id);
            card.classList.add('sent-cv');
          } else {
            sentCv.delete(id);
            card.classList.remove('sent-cv');
          }
          saveSet(SENT_CV_KEY, sentCv);
        });
      });

      document.querySelectorAll('.delete-btn').forEach(function (button) {
        button.addEventListener('click', function () {
          var card = button.closest('.job-card');
          var section = button.closest('.tier-section');
          var id = card.getAttribute('data-job-id');
          dismissed.add(id);
          saveSet(DISMISSED_KEY, dismissed);
          card.setAttribute('data-dismissed', 'true');
          card.style.display = 'none';
          repaginateVisible(section);
          updateTabCount(section.getAttribute('data-tier'));
        });
      });
    });
  })();
`;

function renderHtml(matches, now = new Date()) {
  const matchesByTier = {};
  const countsByTier = {};
  TIER_ORDER.forEach((tier) => {
    matchesByTier[tier] = matches
      .filter((m) => m.tier === tier)
      .sort((a, b) => postedSortKey(b) - postedSortKey(a));
    countsByTier[tier] = matchesByTier[tier].length;
  });

  const activeTier = TIER_ORDER.find((tier) => countsByTier[tier] > 0) || TIER_ORDER[0];

  const tabBar = renderTabBar(countsByTier, activeTier);
  const sections = TIER_ORDER.map((tier) => renderTierSection(tier, matchesByTier[tier], activeTier, now));

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Job Matches</title>
<style>${STYLE}</style>
</head>
<body>
<h1>Job Matches</h1>
${tabBar}
${sections.join('\n')}
<script>${SCRIPT}</script>
</body>
</html>`;
}

function writeReport(matches, filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, renderHtml(matches));
}

module.exports = { renderHtml, writeReport, TIER_LABELS, TIER_ORDER, formatPosted, postedSortKey };
