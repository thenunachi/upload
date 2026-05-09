let _ctx = null

function ac() {
  try {
    if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)()
    if (_ctx.state === 'suspended') _ctx.resume()
    return _ctx
  } catch { return null }
}

function tone(freq, dur, type = 'sine', vol = 0.15, startAt = 0) {
  const c = ac(); if (!c) return
  const o = c.createOscillator(), g = c.createGain()
  o.connect(g); g.connect(c.destination)
  o.type = type; o.frequency.value = freq
  const t = c.currentTime + startAt
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vol, t + 0.015)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  o.start(t); o.stop(t + dur)
}

export function playShutter() {
  const c = ac(); if (!c) return
  const frames = Math.floor(c.sampleRate * 0.055)
  const buf = c.createBuffer(1, frames, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < frames; i++)
    d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / frames, 4)
  const src = c.createBufferSource(), g = c.createGain()
  const f = c.createBiquadFilter()
  f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 0.8
  src.buffer = buf; g.gain.value = 0.45
  src.connect(f); f.connect(g); g.connect(c.destination)
  src.start()
}

export function playPop() {
  const c = ac(); if (!c) return
  const o = c.createOscillator(), g = c.createGain()
  o.connect(g); g.connect(c.destination)
  o.type = 'sine'
  o.frequency.setValueAtTime(280, c.currentTime)
  o.frequency.exponentialRampToValueAtTime(80, c.currentTime + 0.12)
  g.gain.setValueAtTime(0.25, c.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12)
  o.start(); o.stop(c.currentTime + 0.12)
}

export function playHeart() {
  [523.25, 659.25, 783.99].forEach((f, i) => tone(f, 0.38, 'sine', 0.12, i * 0.07))
}

export function playSuccess() {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.42, 'sine', 0.10, i * 0.09))
}

export function playSelect() {
  tone(880, 0.08, 'square', 0.04)
}
