// "3D photo" of the real Crooki cookie stack: a WebGL shader shifts each pixel
// of the cut-out photo by a depth map (parallax) and relights it from the depth
// normals, so the stack seems to turn in space. Plain WebGL, no library.

const COLOR_SRC = "/images/empresas/galletas-stack.webp";
const DEPTH_SRC = "/images/empresas/galletas-stack-depth.png";

const VERT = `
attribute vec2 p;
varying vec2 uv;
void main(){ uv = p*0.5+0.5; uv.y = 1.0-uv.y; gl_Position = vec4(p,0.0,1.0); }`;

// Parallax: a few steps along the view offset to find where the surface is,
// then a soft warm light from the depth normals and a moving sheen.
const FRAG = `
precision mediump float;
varying vec2 uv;
uniform sampler2D col, dep;
uniform vec2 off, texel;
uniform vec2 scale;
uniform float bob;
void main(){
  vec2 st = (uv - 0.5) / scale + 0.5;
  st.y += bob;
  vec2 q = st;
  for (int i = 0; i < 6; i++) {
    float d = texture2D(dep, q).r;
    q = st + off * (d - 0.45);
  }
  if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) { gl_FragColor = vec4(0.0); return; }
  vec4 c = texture2D(col, q);
  float dx = texture2D(dep, q + vec2(texel.x, 0.0)).r - texture2D(dep, q - vec2(texel.x, 0.0)).r;
  float dy = texture2D(dep, q + vec2(0.0, texel.y)).r - texture2D(dep, q - vec2(0.0, texel.y)).r;
  vec3 n = normalize(vec3(-dx, dy, 0.08));
  vec3 L = normalize(vec3(-0.5 - off.x * 6.0, 0.6 + off.y * 6.0, 0.8));
  float diff = 0.82 + 0.28 * dot(n, L);
  float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 18.0) * 0.18;
  vec3 rgb = c.rgb * diff * vec3(1.03, 1.0, 0.95) + spec * vec3(1.0, 0.92, 0.8);
  gl_FragColor = vec4(rgb * c.a, c.a);
}`;

export interface CookieScene {
  start(): void;
  stop(): void;
  resize(): void;
  dispose(): void;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function createCookieScene(box: HTMLElement, onReady: () => void): CookieScene {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;";
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true });
  if (!gl) throw new Error("webgl unavailable");
  box.appendChild(canvas);

  const shader = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const u = (n: string) => gl.getUniformLocation(prog, n);
  const uOff = u("off"), uTexel = u("texel"), uScale = u("scale"), uBob = u("bob");
  gl.uniform1i(u("col"), 0);
  gl.uniform1i(u("dep"), 1);

  const textures: WebGLTexture[] = [];
  const upload = (img: HTMLImageElement, unit: number) => {
    const t = gl.createTexture()!;
    textures.push(t);
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, unit === 0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };

  let imgAspect = 1;
  let loaded = false;
  let raf = 0;
  let wanted = false; // start() may come before the images load
  let running = false;
  let disposed = false;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const t0 = performance.now();

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(box.clientWidth * dpr));
    canvas.height = Math.max(1, Math.round(box.clientHeight * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
    // Fit the photo inside the box (object-fit: contain), with a margin for the motion.
    const boxAspect = canvas.width / canvas.height;
    const s = 0.9;
    gl.uniform2f(uScale, imgAspect > boxAspect ? s : (s * imgAspect) / boxAspect, imgAspect > boxAspect ? (s * boxAspect) / imgAspect : s);
  };

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const t = (now - t0) / 1000;
    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;
    // A slow turn left and right, plus the pointer on desktop.
    const ox = Math.sin(t * 0.7) * 0.035 + pointer.x * 0.04;
    const oy = Math.sin(t * 0.5) * 0.012 + pointer.y * 0.025;
    gl.uniform2f(uOff, ox, oy);
    gl.uniform1f(uBob, Math.sin(t * 1.3) * 0.012);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  const onPointer = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener("pointermove", onPointer, { passive: true });

  const scene: CookieScene = {
    start() {
      wanted = true;
      if (running || !loaded || disposed) return;
      running = true;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      wanted = false;
      running = false;
      cancelAnimationFrame(raf);
    },
    resize,
    dispose() {
      disposed = true;
      scene.stop();
      window.removeEventListener("pointermove", onPointer);
      textures.forEach((t) => gl.deleteTexture(t));
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      canvas.remove();
    },
  };

  Promise.all([loadImage(COLOR_SRC), loadImage(DEPTH_SRC)])
    .then(([color, depth]) => {
      if (disposed) return;
      upload(color, 0);
      upload(depth, 1);
      imgAspect = color.width / color.height;
      gl.uniform2f(uTexel, 2 / depth.width, 2 / depth.height);
      loaded = true;
      resize();
      frame(performance.now());
      cancelAnimationFrame(raf);
      onReady();
      if (wanted) {
        wanted = false;
        scene.start();
      }
    })
    .catch(() => scene.dispose()); // photo stays as the fallback

  return scene;
}
