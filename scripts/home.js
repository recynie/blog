(() => {
  'use strict';
  const canvas = document.querySelector('#snow-terrain');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const hero = canvas.parentElement;
  // Quarto places include-before-body inside main; escape its stacking context.
  document.body.prepend(hero);
  const title = document.querySelector('#title-block-header');
  const nav = document.querySelector('#quarto-header');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };

  // Each visit starts from a random terrain; the pointer steers the viewpoint.
  let seed = crypto.getRandomValues(new Uint32Array(1))[0];
  const permutation = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
  }
  const p = [...permutation, ...permutation];
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const mix = (a, b, t) => a + (b - a) * t;
  function gradient(hash, x, y) {
    switch (hash & 7) {
      case 0: return x; case 1: return -x;
      case 2: return y; case 3: return -y;
      case 4: return (x + y) * Math.SQRT1_2;
      case 5: return (x - y) * Math.SQRT1_2;
      case 6: return (-x + y) * Math.SQRT1_2;
      default: return (-x - y) * Math.SQRT1_2;
    }
  }
  function noise(x, y) {
    const ix = Math.floor(x) & 255, iy = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    return mix(
      mix(gradient(p[p[ix] + iy], x, y), gradient(p[p[ix + 1] + iy], x - 1, y), fade(x)),
      mix(gradient(p[p[ix] + iy + 1], x, y - 1), gradient(p[p[ix + 1] + iy + 1], x - 1, y - 1), fade(x)),
      fade(y));
  }

  const texture = document.createElement('canvas');
  const paint = texture.getContext('2d');
  let width, height, nx, ny, field, image, base;
  let targetX = 0, targetY = 0, mouseX = 0, mouseY = 0;
  let frame = 0, previous = 0, elapsed = 0, visible = true;
  let originX = Math.random() * 128, originY = Math.random() * 128;
  const revealDuration = 2600;
  const driftSpeed = 0.025; // Noise units/second; original animation speed.
  const contourDarkening = 22; // Subtract the same RGB amount from local fill.
  let driftX = 0, driftY = 0;
  const snowAmount = elevation => elevation * elevation * 0.9;
  const fillColor = elevation => base.map(channel => mix(channel, 255, snowAmount(elevation)));

  function resize() {
    document.body.style.setProperty('--home-nav-height', `${nav.getBoundingClientRect().height}px`);
    width = hero.clientWidth; height = hero.clientHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    nx = Math.min(240, Math.ceil(width / 6));
    ny = Math.min(160, Math.ceil(height / 6));
    texture.width = nx + 1; texture.height = ny + 1;
    field = new Float32Array((nx + 1) * (ny + 1));
    image = paint.createImageData(nx + 1, ny + 1);
    const hex = getComputedStyle(document.body).getPropertyValue('--site-banner-background').trim();
    base = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    draw(); updateScroll();
  }

  function draw() {
    const stride = nx + 1;
    const aspect = width / height;
    const reveal = reduced.matches ? 1 : smooth(elapsed / revealDuration);
    let lowest = Infinity, highest = -Infinity;
    for (let y = 0; y <= ny; y++) {
      const v = y / ny;
      for (let x = 0; x <= nx; x++) {
        const u = x / nx;
        const px = u * aspect * 2.2 + originX + driftX;
        const py = v * 2.2 + originY + driftY;
        const n = noise(px + 8.3, py + 2.7) + 0.32 * noise(px * 2 + 4, py * 2 + 9) + 0.09 * noise(px * 4, py * 4);
        field[y * stride + x] = n;
        lowest = Math.min(lowest, n);
        highest = Math.max(highest, n);
      }
    }
    // Use the same elevation distribution everywhere, with valleys at banner color.
    // Keep lowlands close to the banner with a gentle quadratic color ramp;
    // the highest peaks approach snow white.
    for (let i = 0; i < field.length; i++) {
      const h = reveal * clamp((field[i] - lowest) / (highest - lowest));
      field[i] = h;
      const snow = snowAmount(h);
      for (let c = 0; c < 3; c++) image.data[i * 4 + c] = mix(base[c], 255, snow);
      image.data[i * 4 + 3] = 255;
    }
    paint.putImageData(image, 0, 0);
    ctx.drawImage(texture, 0, 0, width, height);
    const sx = width / nx, sy = height / ny;
    // Marching squares, with the center value resolving saddle ambiguity.
    ctx.lineWidth = 0.55;
    for (let level = 0.025; level < 0.95; level += 0.018) {
      ctx.beginPath();
      for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
        const i = y * stride + x;
        const values = [field[i], field[i + 1], field[i + stride + 1], field[i + stride]];
        if (level < Math.min(...values) || level > Math.max(...values)) continue;
        const corners = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]];
        const edges = [];
        for (let e = 0; e < 4; e++) {
          const next = (e + 1) % 4;
          if ((values[e] >= level) === (values[next] >= level)) continue;
          const t = (level - values[e]) / (values[next] - values[e]);
          edges.push([mix(corners[e][0], corners[next][0], t) * sx, mix(corners[e][1], corners[next][1], t) * sy]);
        }
        if (edges.length === 4 && ((values.reduce((a, b) => a + b) / 4 >= level) === (values[0] >= level))) edges.push(edges.shift());
        for (let e = 0; e < edges.length; e += 2) {
          ctx.moveTo(...edges[e]); ctx.lineTo(...edges[e + 1]);
        }
      }
      const color = fillColor(level).map(channel => Math.max(0, channel - contourDarkening));
      // Fade into the local fill during entry; at full reveal the darkening is constant.
      ctx.strokeStyle = `rgba(${color.join(',')}, ${reveal})`;
      ctx.stroke();
    }
  }

  function tick(now) {
    frame = 0;
    if (!visible || document.hidden || reduced.matches) return;
    mouseX += (targetX - mouseX) * 0.12;
    mouseY += (targetY - mouseY) * 0.12;
    if (now - previous >= 65) {
      const delta = Math.min(now - previous, 150);
      const revealing = elapsed < revealDuration;
      elapsed = Math.min(revealDuration, elapsed + delta);
      const distance = Math.hypot(mouseX, mouseY);
      // Keep a small rest zone; smoothly reach full speed within the inner quarter.
      const speed = smooth((distance - 0.04) / 0.21) * driftSpeed;
      if (speed > 0) {
        driftX += mouseX / distance * speed * delta / 1000;
        driftY += mouseY / distance * speed * delta / 1000;
      }
      previous = now;
      if (revealing || speed > 0) draw();
    }
    // Looking right moves the terrain left, matching the sampling direction.
    canvas.style.transform = `translate(${-mouseX * 7}px, ${-mouseY * 5}px) scale(1.025)`;
    frame = requestAnimationFrame(tick);
  }
  function start() {
    if (!frame && visible && !document.hidden && !reduced.matches) {
      previous = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }
  function updateScroll() {
    const top = title.getBoundingClientRect().top;
    const navHeight = nav.getBoundingClientRect().height;
    document.body.style.setProperty('--posts-reveal', smooth((innerHeight - top) / (innerHeight - navHeight)));
    visible = top > navHeight + 1;
    // The covered decorative layer must not remain in the keyboard tab order.
    hero.inert = !visible;
    if (!visible) targetX = targetY = mouseX = mouseY = 0;
    start();
  }
  addEventListener('pointermove', event => {
    if (reduced.matches || !['mouse', 'pen'].includes(event.pointerType)) return;
    const bounds = hero.getBoundingClientRect();
    const visibleTop = Math.max(bounds.top, nav.getBoundingClientRect().bottom);
    if (!visible || event.clientY < visibleTop) {
      resetPointer();
      return;
    }
    targetX = clamp((event.clientX - bounds.left) / bounds.width * 2 - 1, -1, 1);
    targetY = clamp((event.clientY - visibleTop) / (bounds.bottom - visibleTop) * 2 - 1, -1, 1);
    start();
  }, { passive: true });
  function resetPointer() {
    targetX = targetY = 0;
    start();
  }
  document.addEventListener('pointerleave', resetPointer);
  addEventListener('blur', resetPointer);
  addEventListener('scroll', updateScroll, { passive: true });
  addEventListener('resize', resize);
  document.addEventListener('visibilitychange', start);
  reduced.addEventListener('change', () => {
    targetX = targetY = mouseX = mouseY = 0;
    elapsed = revealDuration;
    canvas.style.transform = 'none';
    draw(); start();
  });
  // Back/forward cache restores are visits too; ordinary scrolling never replays.
  addEventListener('pageshow', event => {
    if (!event.persisted) return;
    originX = Math.random() * 128; originY = Math.random() * 128;
    elapsed = 0;
    driftX = driftY = 0;
    targetX = targetY = mouseX = mouseY = 0;
    canvas.style.transform = 'none';
    draw(); updateScroll();
  });
  resize();
  new ResizeObserver(resize).observe(nav);
  // Preserve native deep links, including Quarto's category/filter hashes.
  if (location.hash === '#title-block-header') title.scrollIntoView();
})();
