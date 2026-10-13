export const avatarImage = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" rx="20" fill="#457f71"/><circle cx="20" cy="15" r="6" fill="#f7faf8"/><path d="M9 34c0-13 22-13 22 0" fill="#f7faf8"/></svg>',
)}`;

export function post(handle: string, index = 1): string {
  return `<article data-testid="tweet" data-index="${index}">
    <div class="avatar-column">
      <div data-testid="UserAvatar-Container-${handle}" class="avatar">
        <a href="/${handle}" aria-label="${handle}"><img src="${avatarImage}" alt=""></a>
      </div>
    </div>
    <div class="post-body"><header data-testid="User-Name"><strong>测试作者 ${index}</strong>
      <a href="/${handle}">@${handle}<svg data-testid="icon-verified" style="fill:rgb(29, 155, 240)" width="16" height="16"></svg></a></header>
      <p>这是一条本地测试帖子，用于检查头像按钮的位置和状态。所有账号均为虚构样例。</p>
      <div class="post-meta">12 回复 · 8 喜欢</div>
      ${index === 1 ? '<div class="reply-box"><div contenteditable="true" role="textbox" data-testid="tweetTextarea_0"></div><button data-testid="tweetButtonInline">回复</button></div>' : ""}
    </div>
  </article>`;
}

export function control(handle: string, state = "Follow", followsYou: boolean | null = null, id = 100): string {
  const notFollowing = /^(?:Follow|Follow back|关注|回关)$/.test(state);
  return `<div data-testid="UserCell" class="user-cell">
    <a href="/${handle}">@${handle}</a>
    ${followsYou === true ? '<span data-testid="userFollowIndicator">Follows you</span>'
      : followsYou === false ? '<span data-testid="userFollowIndicator">Not following you</span>' : ""}
    <button data-testid="${id}-${notFollowing ? "follow" : "unfollow"}"
      aria-label="${state} @${handle}">${state}</button>
  </div>`;
}

export function fixture(withUnfollow = false): string {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>X 头像快捷关注 - 隔离测试样例</title>
  <style>
  *{box-sizing:border-box} body{margin:0;font:14px/1.6 system-ui,sans-serif;background:#fff;color:#222}
  nav{height:54px;border-bottom:1px solid #ddd;padding:14px 22px}
  a{color:inherit;text-decoration:none} main{width:min(620px,100%);margin:auto;border-inline:1px solid #ddd}
  h1{font-size:18px;font-weight:600;padding:16px;margin:0;border-bottom:1px solid #ddd}
  article{display:flex;gap:12px;padding:16px;min-height:158px;border-bottom:1px solid #ddd}
  .avatar-column{width:40px;flex-shrink:0}.avatar,.avatar img,.avatar a{display:block;width:40px;height:40px}
  .post-body{min-width:0;flex:1}header{display:flex;flex-wrap:wrap;gap:8px}header a,.post-meta{color:#676e74}
  p{margin:8px 0;overflow-wrap:anywhere}.post-meta{font-size:12px;margin-top:14px}
  aside{width:min(620px,100%);margin:24px auto;padding:16px;border-top:1px solid #ddd}
  .user-cell{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:12px 0}
  .user-cell button{margin-left:auto;padding:6px 12px;border:1px solid #777;border-radius:4px;background:transparent;color:inherit}
  .user-cell span{color:#626970;font-size:12px}
  body.dark{background:#101213;color:#e9edef}body.dark main,body.dark article,body.dark nav,body.dark aside{border-color:#3b4144}
  body.dark header a,body.dark .post-meta,body.dark .user-cell span{color:#aab5ba}
  </style></head><body>
    <nav><a data-testid="AppTabBar_Profile_Link" aria-label="Profile" href="/viewer">个人资料</a></nav>
    <main><h1>本地适配测试</h1>${post("alice")}${post("bob", 2)}
      ${withUnfollow ? post("dave", 7) : ""}${post("carol", 3)}
      ${post("unknown", 4)}${post("viewer", 5)}${post("alice", 6)}</main>
    <aside aria-label="原生控件测试样例">
      ${control("alice")}${control("bob", "Follow", true, 101)}
      ${control("carol", "Following", null, 102)}${control("viewer", "Follow", null, 103)}
      ${withUnfollow ? control("dave", "Following", false, 104) : ""}
    </aside>
    <script>
      window.fixtureClicks = {};
      window.fixtureConfirmClicks = 0;
      document.querySelectorAll('.user-cell button').forEach(button => {
        button.addEventListener('click', () => {
          const handle = button.getAttribute('aria-label').split('@')[1];
          window.fixtureClicks[handle] = (window.fixtureClicks[handle] || 0) + 1;
          if (button.dataset.testid.endsWith('-unfollow')) {
            const dialog = document.createElement('div');
            dialog.setAttribute('role', 'dialog');
            const heading = document.createElement('h2');
            heading.textContent = 'Unfollow @' + handle + '?';
            const confirm = document.createElement('button');
            confirm.dataset.testid = 'confirmationSheetConfirm';
            confirm.textContent = 'Unfollow';
            confirm.addEventListener('click', () => {
              window.fixtureConfirmClicks++;
              button.textContent = 'Follow';
              button.setAttribute('aria-label', 'Follow @' + handle);
              button.dataset.testid = button.dataset.testid.replace('-unfollow', '-follow');
              dialog.remove();
            });
            dialog.append(heading, confirm);
            document.body.append(dialog);
            return;
          }
          button.textContent = 'Following';
          button.setAttribute('aria-label', 'Following @' + handle);
          button.dataset.testid = button.dataset.testid.replace('-follow', '-unfollow');
        });
      });
    </script>
  </body></html>`;
}
