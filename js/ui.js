/* Các lớp giao diện HTML nằm trên cảnh 3D. */

const splitGraphemes = (() => {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const seg = new Intl.Segmenter('vi', { granularity: 'grapheme' });
    return (s) => Array.from(seg.segment(s), (x) => x.segment);
  }
  return (s) => Array.from(s);
})();

export class UI {
  constructor(cfg) {
    this.cfg = cfg;
    const $ = (id) => document.getElementById(id);
    this.$ = {
      loader: $('loader'), loaderText: $('loader-text'),
      title: $('title'), titleMain: $('title-main'), titleSub: $('title-sub'),
      counter: $('counter'), count: $('count'), total: $('total'),
      cue: $('tap-cue'), bubbles: $('bubbles'),
      bar: $('bottom-bar'), hint: $('hint'), btnMusic: $('btn-music'), btnLetter: $('btn-letter'),
      reason: $('reason'), reasonNum: $('reason-num'), reasonText: $('reason-text'),
      letter: $('letter'), envelope: $('envelope'), envTo: $('env-to'), paper: $('paper'),
      greeting: $('letter-greeting'), body: $('letter-body'), sign: $('letter-sign'), date: $('letter-date'),
      letterClose: $('letter-close'),
      lightbox: $('lightbox'), lightboxImg: $('lightbox-img'), lightboxClose: $('lightbox-close'),
      finale: $('finale'), finaleTitle: $('finale-title'), finaleSub: $('finale-sub'),
      finaleAgain: $('finale-again'), finaleStay: $('finale-stay'),
    };
    this.modal = null;
    this.timers = [];
    this.bubbleEls = new Map();
    this.onMusic = null;
    this.onLetterClosed = null;
    this.onModalChange = null;
    this._fill();
    this._bind();
  }

  _fill() {
    const { cfg, $ } = this;
    $.loaderText.textContent = cfg.loading;
    $.titleMain.textContent = cfg.intro.title;
    $.titleSub.textContent = cfg.intro.sub;
    $.total.textContent = cfg.reasons.length;
    $.envTo.textContent = cfg.letter.greeting;
    $.greeting.textContent = cfg.letter.greeting;
    $.sign.textContent = cfg.letter.sign;
    $.date.textContent = cfg.letter.date;
    $.finaleTitle.textContent = cfg.finale.title;
    $.finaleSub.textContent = cfg.finale.sub;
    $.finaleAgain.textContent = cfg.finale.again;
    $.finaleStay.textContent = cfg.finale.stay;
  }

  _bind() {
    const { $ } = this;
    $.btnMusic.addEventListener('click', () => this.onMusic?.());
    $.btnLetter.addEventListener('click', () => this.openLetter());
    $.envelope.addEventListener('click', () => this._revealPaper());
    $.envelope.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') this._revealPaper();
    });
    $.paper.addEventListener('click', (e) => {
      if (this.typing && !e.target.closest('button')) this._finishTyping();
    });
    $.letterClose.addEventListener('click', () => this.closeLetter());
    $.letter.addEventListener('click', (e) => { if (e.target === $.letter) this.closeLetter(); });
    $.lightbox.addEventListener('click', () => this.closeImage());
    $.reason.addEventListener('click', () => $.reason.classList.remove('show'));
    $.finaleAgain.addEventListener('click', () => { this.closeFinale(); this.openLetter(); });
    $.finaleStay.addEventListener('click', () => this.closeFinale());
    addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (this.modal === 'letter') this.closeLetter();
      else if (this.modal === 'lightbox') this.closeImage();
      else if (this.modal === 'finale') this.closeFinale();
    });
  }

  _setModal(name) {
    this.modal = name;
    this.onModalChange?.(!!name);
  }

  get modalOpen() { return !!this.modal; }

  /* ---------- Loader / title ---------- */

  hideLoader() { this.$.loader.classList.add('done'); }

  showNoWebGL() {
    const { $ } = this;
    $.loaderText.textContent = 'Máy này chưa hiển thị được 3D 😢 nhưng thư vẫn ở đây nè';
    const btn = document.createElement('button');
    btn.className = 'pill-btn';
    btn.type = 'button';
    btn.textContent = 'Đọc thư 💌';
    btn.addEventListener('click', () => this.openLetter());
    $.loader.append(btn);
  }

  setTitle(main, sub) {
    const { title, titleMain, titleSub } = this.$;
    title.classList.add('swap');
    setTimeout(() => {
      titleMain.textContent = main;
      titleSub.textContent = sub;
      title.classList.remove('swap');
    }, 380);
  }

  showExplore() {
    const { cfg, $ } = this;
    this.setTitle(cfg.title.main, cfg.title.sub);
    $.hint.textContent = cfg.hints.explore;
    setTimeout(() => {
      $.counter.classList.add('show');
      $.bar.classList.add('show');
    }, 600);
  }

  setHint(text) {
    const { hint } = this.$;
    hint.classList.add('fade');
    setTimeout(() => {
      hint.textContent = text;
      hint.classList.remove('fade');
    }, 300);
  }

  setMusic(on) {
    this.$.btnMusic.classList.toggle('off', !on);
    this.$.btnMusic.setAttribute('aria-pressed', String(on));
  }

  /* ---------- Overlays gắn theo vị trí 3D ---------- */

  placeCue(x, y, visible) {
    const { cue } = this.$;
    cue.classList.toggle('show', visible);
    if (visible) cue.style.transform = `translate(${x}px, ${y}px)`;
  }

  say(id, text) {
    let el = this.bubbleEls.get(id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'bubble';
      this.$.bubbles.append(el);
      this.bubbleEls.set(id, el);
    }
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2400);
  }

  placeBubble(id, x, y) {
    const el = this.bubbleEls.get(id);
    if (el) el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
  }

  /* ---------- Reasons ---------- */

  showReason(n, text) {
    const { cfg, $ } = this;
    $.reasonNum.textContent = `${cfg.reasonLabel} #${n}`;
    $.reasonText.textContent = text;
    $.reason.classList.remove('show');
    void $.reason.offsetWidth;
    $.reason.classList.add('show');
    clearTimeout(this.reasonTimer);
    this.reasonTimer = setTimeout(() => $.reason.classList.remove('show'), 5200);
    $.count.textContent = n;
    $.counter.classList.remove('bump');
    void $.counter.offsetWidth;
    $.counter.classList.add('bump');
  }

  /* ---------- Letter ---------- */

  openLetter() {
    if (this.modal) return;
    const { letter, envelope, paper, body } = this.$;
    this._setModal('letter');
    this._clearTimers();
    letter.classList.remove('open', 'show-paper');
    envelope.classList.remove('open');
    paper.classList.remove('typed', 'typing');
    body.textContent = '';
    void letter.offsetWidth;
    letter.classList.add('open');
    this.timers.push(setTimeout(() => envelope.classList.add('open'), 750));
    this.timers.push(setTimeout(() => this._revealPaper(), 1950));
  }

  _revealPaper() {
    const { letter, envelope, paper } = this.$;
    if (this.modal !== 'letter' || letter.classList.contains('show-paper')) return;
    this._clearTimers();
    envelope.classList.add('open');
    letter.classList.add('show-paper');
    paper.scrollTop = 0;
    this._type();
  }

  _type() {
    const { body, paper } = this.$;
    body.textContent = '';
    this.paras = this.cfg.letter.paragraphs.map((text) => {
      const p = document.createElement('p');
      const typed = document.createElement('span');
      const rest = document.createElement('span');
      rest.className = 'rest';
      rest.textContent = text;
      p.append(typed, rest);
      body.append(p);
      return { typed, rest, chars: splitGraphemes(text), i: 0 };
    });
    const caret = document.createElement('span');
    caret.className = 'caret';
    this.caret = caret;
    this.typing = true;
    paper.classList.add('typing');

    let pi = 0;
    const step = () => {
      const q = this.paras[pi];
      if (!q) return this._finishTyping();
      q.i++;
      q.typed.textContent = q.chars.slice(0, q.i).join('');
      q.rest.textContent = q.chars.slice(q.i).join('');
      q.typed.after(caret);
      if (q.i >= q.chars.length) {
        pi++;
        this.typeTimer = setTimeout(step, 420);
        return;
      }
      const ch = q.chars[q.i - 1];
      this.typeTimer = setTimeout(step, /[.!?…]/.test(ch) ? 260 : /[,;:]/.test(ch) ? 140 : 32);
    };
    this.typeTimer = setTimeout(step, 450);
  }

  _finishTyping() {
    clearTimeout(this.typeTimer);
    if (!this.typing) return;
    this.typing = false;
    for (const q of this.paras) {
      q.typed.textContent = q.chars.join('');
      q.rest.textContent = '';
    }
    this.caret?.remove();
    this.$.paper.classList.remove('typing');
    this.$.paper.classList.add('typed');
  }

  closeLetter() {
    if (this.modal !== 'letter') return;
    this._clearTimers();
    clearTimeout(this.typeTimer);
    this.typing = false;
    this.$.letter.classList.remove('open', 'show-paper');
    this._setModal(null);
    this.onLetterClosed?.();
  }

  _clearTimers() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  /* ---------- Lightbox ---------- */

  showImage(src, alt) {
    if (this.modal) return;
    const { lightbox, lightboxImg } = this.$;
    lightboxImg.src = src;
    lightboxImg.alt = alt;
    this._setModal('lightbox');
    lightbox.classList.add('open');
  }

  closeImage() {
    if (this.modal !== 'lightbox') return;
    this.$.lightbox.classList.remove('open');
    this._setModal(null);
  }

  /* ---------- Finale ---------- */

  showFinale() {
    if (this.modal) return false;
    this.$.reason.classList.remove('show');
    this._setModal('finale');
    this.$.finale.classList.add('open');
    return true;
  }

  closeFinale() {
    if (this.modal !== 'finale') return;
    this.$.finale.classList.remove('open');
    this._setModal(null);
  }
}
