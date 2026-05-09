import './AnimatedBackground.css'

const PARTICLES = [
  { id:  1, cx:  90, cy: 920, r: 3,   color: '#833AB4', op: 0.50, dx: -15, dur: 18, t: 0   },
  { id:  2, cx: 230, cy: 870, r: 2,   color: '#FCB045', op: 0.40, dx:  12, dur: 23, t: -4  },
  { id:  3, cx: 420, cy: 910, r: 4,   color: '#0095F6', op: 0.45, dx:  20, dur: 16, t: -9  },
  { id:  4, cx: 580, cy: 850, r: 2.5, color: '#DD2A7B', op: 0.40, dx: -10, dur: 26, t: -13 },
  { id:  5, cx: 750, cy: 920, r: 3.5, color: '#FCB045', op: 0.50, dx:  15, dur: 20, t: -2  },
  { id:  6, cx: 920, cy: 880, r: 2,   color: '#833AB4', op: 0.35, dx: -22, dur: 29, t: -17 },
  { id:  7, cx:1080, cy: 900, r: 3,   color: '#0095F6', op: 0.45, dx:  10, dur: 19, t: -6  },
  { id:  8, cx:1260, cy: 860, r: 2,   color: '#FD1D1D', op: 0.40, dx: -14, dur: 24, t: -11 },
  { id:  9, cx:1380, cy: 920, r: 3.5, color: '#DD2A7B', op: 0.45, dx:   8, dur: 21, t: -3  },
  { id: 10, cx: 150, cy: 620, r: 2.5, color: '#833AB4', op: 0.30, dx:  25, dur: 22, t: -8  },
  { id: 11, cx: 490, cy: 700, r: 2,   color: '#FCB045', op: 0.28, dx: -12, dur: 27, t: -14 },
  { id: 12, cx: 820, cy: 660, r: 3,   color: '#0095F6', op: 0.32, dx:  18, dur: 17, t: -5  },
  { id: 13, cx:1180, cy: 640, r: 2.5, color: '#FD1D1D', op: 0.30, dx:  -8, dur: 25, t: -10 },
]

export default function AnimatedBackground() {
  return (
    <>
      {/* SVG layer — orbs + bokeh particles */}
      <div className="anim-bg" aria-hidden="true">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
          width="100%" height="100%"
        >
          <defs>
            <filter id="ab-blur" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="72"/>
            </filter>
            <filter id="ab-dot-blur" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="4"/>
            </filter>
            {['#833AB4','#DD2A7B','#FCB045','#0095F6','#FD1D1D'].map((c,i) => (
              <radialGradient key={i} id={`ab-g${i+1}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={c} stopOpacity="1"/>
                <stop offset="100%" stopColor={c} stopOpacity="0"/>
              </radialGradient>
            ))}
          </defs>

          <g filter="url(#ab-blur)" className="ab-orbs">
            <circle cx="160"  cy="170" r="300" fill="url(#ab-g1)">
              <animateTransform attributeName="transform" type="translate" values="0,0;45,-35;-30,55;25,-45;0,0" dur="28s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1"/>
            </circle>
            <circle cx="1280" cy="90"  r="260" fill="url(#ab-g2)">
              <animateTransform attributeName="transform" type="translate" values="0,0;-55,45;35,-35;-20,55;0,0" dur="34s" repeatCount="indefinite" begin="-10s" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1"/>
            </circle>
            <circle cx="1310" cy="760" r="320" fill="url(#ab-g3)">
              <animateTransform attributeName="transform" type="translate" values="0,0;-45,-55;55,30;-35,-25;0,0" dur="22s" repeatCount="indefinite" begin="-6s" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1"/>
            </circle>
            <circle cx="130"  cy="800" r="280" fill="url(#ab-g4)">
              <animateTransform attributeName="transform" type="translate" values="0,0;55,45;-35,-55;45,20;0,0" dur="40s" repeatCount="indefinite" begin="-20s" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1"/>
            </circle>
            <circle cx="720"  cy="450" r="210" fill="url(#ab-g5)">
              <animateTransform attributeName="transform" type="translate" values="0,0;35,45;-45,20;20,-45;0,0" dur="32s" repeatCount="indefinite" begin="-15s" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1"/>
            </circle>
          </g>

          <g className="ab-particles">
            {PARTICLES.map(p => (
              <circle key={p.id} cx={p.cx} cy={p.cy} r={p.r} fill={p.color} filter="url(#ab-dot-blur)">
                <animateTransform attributeName="transform" type="translate" values={`0,0;${p.dx},${-(950+p.r)}`} dur={`${p.dur}s`} repeatCount="indefinite" begin={`${p.t}s`} calcMode="linear"/>
                <animate attributeName="opacity" values={`0;${p.op};${p.op};0`} keyTimes="0;0.1;0.8;1" dur={`${p.dur}s`} repeatCount="indefinite" begin={`${p.t}s`}/>
              </circle>
            ))}
          </g>
        </svg>
      </div>

    </>
  )
}
