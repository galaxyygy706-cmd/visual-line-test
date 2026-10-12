// Chuyển ngôn ngữ Việt / Anh dùng chung cho các trang.
// - Chữ tĩnh trong HTML: thêm data-en="..." (thay nút chữ đầu tiên), data-en-html="..." (thay cả nội dung),
//   data-en-placeholder / data-en-title / data-en-aria-label (thay thuộc tính).
// - Chữ sinh bằng JS: I18N.t('tiếng Việt', 'English'), rồi vẽ lại trong I18N.on(...).
// - Nút chọn: phần tử có [data-lang-switch] chứa 2 nút data-lang="vi" / "en".
(function(){
  'use strict';
  const KEY = 'sam3d-lang';
  let lang = 'vi';
  try { if (localStorage.getItem(KEY) === 'en') lang = 'en'; } catch(e){}
  const subs = [];

  function swapText(el){
    const tn = Array.prototype.find.call(el.childNodes, n => n.nodeType === 3 && n.textContent.trim());
    if (!tn) return;
    if (el.dataset.vi == null) el.dataset.vi = tn.textContent;
    const vi = el.dataset.vi, m = vi.match(/^(\s*)[\s\S]*?(\s*)$/);
    tn.textContent = lang === 'en' ? m[1] + el.dataset.en + m[2] : vi;
  }
  function apply(root){
    root = root || document;
    root.querySelectorAll('[data-en]').forEach(swapText);
    root.querySelectorAll('[data-en-html]').forEach(el => {
      if (el.dataset.viHtml == null) el.dataset.viHtml = el.innerHTML;
      el.innerHTML = lang === 'en' ? el.dataset.enHtml : el.dataset.viHtml;
    });
    ['placeholder', 'title', 'aria-label'].forEach(a => root.querySelectorAll('[data-en-' + a + ']').forEach(el => {
      const k = 'vi' + a.replace(/(^|-)([a-z])/g, (m, s, c) => c.toUpperCase());   // viPlaceholder, viAriaLabel…
      if (el.dataset[k] == null) el.dataset[k] = el.getAttribute(a) || '';
      el.setAttribute(a, lang === 'en' ? el.getAttribute('data-en-' + a) : el.dataset[k]);
    }));
    document.querySelectorAll('[data-lang-switch] [data-lang]').forEach(b => {
      const on = b.dataset.lang === lang;
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    document.documentElement.lang = lang;
  }
  const I18N = window.I18N = {
    get lang(){ return lang; },
    t(vi, en){ return lang === 'en' && en != null && en !== '' ? en : vi; },
    locale(){ return lang === 'en' ? 'en-US' : 'vi-VN'; },
    on(f){ subs.push(f); },
    apply,
    set(l){
      if (l !== 'vi' && l !== 'en' || l === lang) return;
      lang = l;
      try { localStorage.setItem(KEY, l); } catch(e){}
      apply();
      subs.forEach(f => { try { f(l); } catch(e){ console.error(e); } });
    },
  };
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-lang-switch] [data-lang]');
    if (b) I18N.set(b.dataset.lang);
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => apply());
  else apply();
})();
