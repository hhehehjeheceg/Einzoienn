/* Shared terrain, water, sky, roads and ground-cover for the AZUR island. */
(function (root) {
  "use strict";
  const T = THREE, S = AZSim, A = AZArt;
  const coastDistance = (x, z) => (S.coastDistance ? S.coastDistance(x, z) : Math.hypot(x, z));
  const map = () => S.MAP;
  const routeDistance = (x, z, a, b) => {
    const dx = b.x - a.x, dz = b.z - a.z, den = dx * dx + dz * dz;
    const t = den ? T.MathUtils.clamp(((x - a.x) * dx + (z - a.z) * dz) / den, 0, 1) : 0;
    return Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
  };
  const onRoute = (x, z, routes, margin) => routes.some((line) => line.some((p, i) => i && routeDistance(x, z, line[i - 1], p) < margin));
  const roads = () => Array.isArray(S.roads) ? S.roads : [];
  const streets = () => Array.isArray(S.streets) ? S.streets : [];
  const allRoutes = () => roads().concat(streets());

  function groundTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d"), rand = A.rng(179);
    ctx.fillStyle = "#eff3e8";
    ctx.fillRect(0, 0, 256, 256);
    // Broad soft patches of meadow tone break the flat base at a glance.
    for (let i = 0; i < 46; i++) {
      const x = rand() * 256, y = rand() * 256, r = 14 + rand() * 42;
      const warm = rand() > .62, g = ctx.createRadialGradient(x, y, 1, x, y, r);
      g.addColorStop(0, warm ? `rgba(238,224,168,${.05 + rand() * .09})` : `rgba(196,224,168,${.05 + rand() * .09})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
    for (let i = 0; i < 4200; i++) {
      const v = Math.floor(112 + rand() * 84), x = rand() * 256, y = rand() * 256;
      ctx.fillStyle = rand() > 0.45 ? `rgba(${v + 14},${v + 10},${v - 16},${0.03 + rand() * 0.07})` : `rgba(${v - 20},${v + 5},${v - 18},${0.025 + rand() * 0.055})`;
      ctx.fillRect(x, y, 1 + rand() * 3.2, 1 + rand() * 4.2);
      if (i % 17 === 0) { ctx.strokeStyle = `rgba(70,108,78,${0.025 + rand() * .025})`; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rand() - .5) * 14, y + 5 + rand() * 10); ctx.stroke(); }
    }
    // Tiny pebbles and brighter grass blades for close-up grain.
    for (let i = 0; i < 260; i++) {
      const x = rand() * 256, y = rand() * 256, s = 1 + rand() * 1.6;
      ctx.fillStyle = `rgba(${190 + rand() * 40 | 0},${186 + rand() * 34 | 0},${170 + rand() * 26 | 0},${.25 + rand() * .3})`;
      ctx.beginPath(); ctx.arc(x, y, s, 0, 7); ctx.fill();
      if (i % 3 === 0) { ctx.strokeStyle = `rgba(120,168,88,${.10 + rand() * .12})`; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rand() - .5) * 6, y - 3 - rand() * 5); ctx.stroke(); }
    }
    // Dry soil cracks and faint cart-track arcs: short dark strokes that read as
    // ground relief from the play camera without any geometry.
    for (let i = 0; i < 64; i++) {
      const x = rand() * 256, y = rand() * 256, a = rand() * Math.PI * 2, len = 6 + rand() * 16;
      ctx.strokeStyle = `rgba(96,84,60,${.05 + rand() * .07})`; ctx.lineWidth = .8 + rand() * .9;
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.cos(a) * len * .5, y + Math.sin(a) * len * .5 + (rand() - .5) * 6, x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    }
    const tex = new T.CanvasTexture(c);
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.repeat.set(96, 96);
    tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }
  const PALETTE = {
    grass: new T.Color("#68ae57"), grassShade: new T.Color("#32846c"), sand: new T.Color("#efd6a4"),
    desert: new T.Color("#dfac68"), snow: new T.Color("#daeaf0"), water: new T.Color("#43a9aa")
  };
  const smoothstep = (a, b, v) => { const t = T.MathUtils.clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function terrainColor(x, z) {
    const d = coastDistance(x, z), m = map(), b = S.biomeAt(x, z);
    const shore = smoothstep(m.shoreStart, m.shoreEnd, d), water = smoothstep(m.shoreEnd - 4, m.shoreEnd + 2, d);
    // Soft biome seams follow the same ramp widths as the simulation heightfield.
    const c = PALETTE.grass.clone().lerp(PALETTE.grassShade, (0.5 + 0.5 * Math.sin(x * .014 - z * .009)) * .23);
    // Fine meadow mottling: a high-frequency brightness grain plus warm dry
    // patches, kept bright so the map never reads dark.
    c.offsetHSL(Math.sin(x * .061 + z * .043) * .012, Math.sin(x * .031 - z * .052) * .05, Math.sin(x * .083 - z * .027) * .030);
    c.lerp(new T.Color("#cfe39a"), Math.max(0, Math.sin(x * .022 + 1.7) * Math.sin(z * .026 - .6)) * .16);
    c.lerp(PALETTE.snow, smoothstep(225,285,x)*(1-smoothstep(-140,-60,z)));
    c.lerp(PALETTE.desert, smoothstep(-70,-10,x)*smoothstep(225,295,z));
    if (shore > 0 && b !== "snow" && b !== "desert") c.lerp(PALETTE.sand, shore);
    return c.lerp(PALETTE.water, water);
  }

  class Environment {
    constructor(scene) {
      this.scene = scene;
      this.root = new T.Group();
      scene.add(this.root);
      this.time = 0;
      this.makeTerrain();
      this.makeSky();
      this.makeWater();
      this.makeRoads();
      this.makeGrass();
      this.makeLandmarks();
      this.makeRockFormations();
      this.makeScenery();
    }
    makeTerrain() {
      const m = map(), geo = new T.PlaneGeometry(m.halfSize * 2, m.halfSize * 2, 180, 180);
      geo.rotateX(-Math.PI / 2);
      const pos = geo.attributes.position, colors = [], rand = A.rng(781);
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i), h = S.heightAt(x, z), c = terrainColor(x, z);
        pos.setY(i, h);
        c.multiplyScalar((0.94 + 0.085 * (0.5 + 0.5 * Math.sin(x * 0.012 + z * 0.008))) * (0.985 + rand() * 0.03));
        colors.push(c.r, c.g, c.b);
      }
      geo.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
      geo.computeVertexNormals();
      const material = new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, map: groundTexture() });
      const terrain = new T.Mesh(geo, material);
      terrain.receiveShadow = true;
      this.root.add(terrain);
      this.terrain = terrain;
      this.terrainPositions = pos; this.terrainSegments = 180;

      // The waiting island is outside the rectangular battle map and intentionally remains local.
      const wait = m.waiting, wg = new T.PlaneGeometry((wait.radius + 38) * 2, (wait.radius + 38) * 2, 38, 38);
      wg.rotateX(-Math.PI / 2);
      const wp = wg.attributes.position, wc = [];
      for (let i = 0; i < wp.count; i++) {
        const dx = wp.getX(i), dz = wp.getZ(i), dist = Math.hypot(dx, dz), x = dx + wait.x, z = dz + wait.z;
        wp.setXYZ(i, x, dist < wait.radius ? S.heightAt(x, z) : T.MathUtils.lerp(5, -7, T.MathUtils.clamp((dist - wait.radius) / 32, 0, 1)), z);
        const c = new T.Color(dist > wait.radius * 0.94 ? "#e1cd8d" : "#62ad61");
        wc.push(c.r, c.g, c.b);
      }
      wg.setAttribute("color", new T.Float32BufferAttribute(wc, 3));
      wg.computeVertexNormals();
      const waitingGround = new T.Mesh(wg, material);
      waitingGround.receiveShadow = true;
      this.root.add(waitingGround);
    }
    // Sample the actual render triangles, not the analytic hill beneath them.
    // Road edges then follow the visible terrain instead of vanishing into its
    // coarser triangles at steep biome/pad transitions. No extra terrain mesh.
    surfaceHeight(x,z) {
      const m=map(),n=this.terrainSegments,unit=m.halfSize*2/n;
      const gx=T.MathUtils.clamp((x+m.halfSize)/unit,0,n-1e-8),gz=T.MathUtils.clamp((z+m.halfSize)/unit,0,n-1e-8);
      const ix=Math.floor(gx),iz=Math.floor(gz),u=gx-ix,v=gz-iz,p=this.terrainPositions,k=iz*(n+1)+ix;
      const a=p.getY(k),b=p.getY(k+1),c=p.getY(k+n+1),d=p.getY(k+n+2);
      return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
    }
    makeSky() {
      this.skyUniforms = { top: { value: new T.Color("#268cce") }, bottom: { value: new T.Color("#d5eff0") }, sun: { value: new T.Vector3(-0.4, 0.6, -0.5).normalize() }, daylight: {value:1}, dusk: {value:0} };
      this.skyDayTop = new T.Color("#268cce"); this.skyDayBottom = new T.Color("#d5eff0");
      this.sky = new T.Mesh(new T.SphereGeometry(3300, 32, 20), new T.ShaderMaterial({
        side: T.BackSide, depthWrite: false, uniforms: this.skyUniforms,
        vertexShader: "varying vec3 vWorld;void main(){vWorld=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
        fragmentShader: "varying vec3 vWorld;uniform vec3 top;uniform vec3 bottom;uniform vec3 sun;uniform float daylight;uniform float dusk;void main(){vec3 d=normalize(vWorld);float h=pow(max(0.,d.y),.48);float s=max(0.,dot(d,sun));vec3 c=mix(bottom,top,h);float horizon=pow(max(0.,1.-abs(d.y)),5.);c=mix(c,vec3(.96,.56,.34),horizon*dusk*.42);c+=vec3(1.,.73,.40)*pow(s,24.)*.15*daylight;c+=vec3(1.,.93,.72)*smoothstep(.9992,.9996,s)*1.25*daylight;c+=vec3(1.,.84,.58)*pow(s,180.)*.38*daylight;float wisps=smoothstep(.86,1.,sin(d.x*24.+d.z*11.)*.5+sin(d.z*37.-d.x*8.)*.5)*smoothstep(.18,.32,d.y)*(1.-smoothstep(.43,.65,d.y));c=mix(c,vec3(.9,.97,1.),wisps*.09*daylight);float wisps2=smoothstep(.80,1.,sin(d.x*13.-d.z*29.+2.)*.5+sin(d.z*19.+d.x*7.)*.5)*smoothstep(.34,.48,d.y)*(1.-smoothstep(.58,.74,d.y));c=mix(c,vec3(.93,.985,1.),wisps2*.06*daylight);gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}" 
      }));
      this.root.add(this.sky);
      this.clouds = new T.Group();
      this.cloudMaterial = new T.MeshBasicMaterial({ vertexColors:true, transparent:true, opacity:.77, depthWrite:false });
      const rand = A.rng(61);
      for (let i = 0; i < 18; i++) {
        const model = new A.Model();
        // Fuller, more sculpted puffs: 8 lumps with varied squash and a warm
        // sunlit tint mixed with cool shaded whites. Still bright daytime.
        for (let k = 0; k < 8; k++) {
          const warm = k % 3 === 0;
          model.ball(9 + rand() * 15, warm ? "#fdf3e2" : k % 3 === 1 ? "#f4fbff" : "#f8ffff",
            (k - 3.5) * 14, rand() * 6 - 1.5, rand() * 9 - 4.5, 1, 0.44 + rand() * .2, 0.72 + rand() * .2, 1);
        }
        const cloud = model.mesh();
        cloud.material = this.cloudMaterial;
        cloud.position.set((rand() - .5) * 2400, 145 + rand() * 180, (rand() - .5) * 2400);
        cloud.rotation.y = rand() * Math.PI;
        this.clouds.add(cloud);
      }
      this.root.add(this.clouds);
      const starPos = [];
      for (let i = 0; i < 450; i++) { const a = rand() * Math.PI * 2, e = rand() * 1.4; starPos.push(Math.cos(a) * Math.cos(e) * 2400, Math.sin(e) * 2400, Math.sin(a) * Math.cos(e) * 2400); }
      const starGeo = new T.BufferGeometry(); starGeo.setAttribute("position", new T.Float32BufferAttribute(starPos, 3));
      this.stars = new T.Points(starGeo, new T.PointsMaterial({ size: 2.2, color: "#d3eaff", transparent: true, opacity: 0 })); this.root.add(this.stars);
      this.birds = new T.Group();
      const bird = new A.Model().box(.65, .03, .12, "#304b61", -.28, 0, 0, 0, 0, .15).box(.65, .03, .12, "#304b61", .28, 0, 0, 0, 0, -.15).mesh();
      for (let i = 0; i < 8; i++) this.birds.add(bird.clone());
      this.root.add(this.birds);
    }
    makeWater() {
      this.waterUniforms = { time: { value: 0 }, light: { value: 1 }, shore: {value:map().shoreEnd} };
      const material = new T.ShaderMaterial({ transparent: true, side: T.DoubleSide, uniforms: this.waterUniforms,
        vertexShader: "uniform float time;varying vec2 vP;varying vec3 vWorld;void main(){vec3 p=position;float swell=sin(p.x*.035+time*.72)*.13+cos(p.y*.052-time*.48)*.08;p.z+=swell;vP=vec2(p.x,-p.y);vWorld=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}",
        // One existing water plane: coast-aware colour/foam and broad sun glints,
        // without reflection buffers, normal-map assets or shoreline meshes.
        fragmentShader: "uniform float time;uniform float light;uniform float shore;varying vec2 vP;varying vec3 vWorld;void main(){float coast=max(abs(vP.x),abs(vP.y))+8.*sin(vP.x*.021)*cos(vP.y*.017)+4.*sin((vP.x-vP.y)*.031);float shelf=1.-smoothstep(shore-9.,shore+100.,coast);float wave=sin(vP.x*.12+time*.85)*cos(vP.y*.105-time*.55);vec3 c=mix(vec3(.030,.235,.415),vec3(.060,.54,.565),shelf);c+=wave*.018;c+=vec3(.016,.055,.055)*sin(time*1.4+vP.x*.043+vP.y*.037)*shelf;float sparkle=pow(max(0.,sin(vP.x*.31-time*.9)*sin(vP.y*.27+time*.7)),10.)*shelf;c+=vec3(.90,.98,1.)*sparkle*.055;float cap=pow(max(0.,sin(vP.x*.23+time*.62)*sin(vP.y*.19-time*.52)),26.)*(1.-shelf);c+=vec3(.84,.95,.96)*cap*.075;float foam=pow(max(0.,sin(coast*.48-time*1.8+wave*.7)),18.)*(1.-smoothstep(shore-2.,shore+12.,coast))*smoothstep(shore-24.,shore-10.,coast);c=mix(c,vec3(.73,.91,.85),foam*.34);float foam2=pow(max(0.,sin(coast*.24-time*1.1+wave*.4)),12.)*(1.-smoothstep(shore+2.,shore+30.,coast))*smoothstep(shore-14.,shore+2.,coast);c=mix(c,vec3(.80,.95,.88),foam2*.20);vec3 normal=normalize(vec3(-cos(vP.x*.12+time*.85)*.035,1.,sin(vP.y*.105-time*.55)*.045));vec3 eye=normalize(cameraPosition-vWorld);vec3 halfway=normalize(eye+normalize(vec3(-.4,.6,-.5)));float glint=pow(max(0.,dot(normal,halfway)),160.);float wide=pow(max(0.,dot(normal,halfway)),24.)*.5;float fresnel=pow(1.-clamp(dot(eye,normal),0.,1.),3.);c=mix(c,vec3(.44,.69,.76),fresnel*.24);c+=vec3(1.,.86,.58)*(glint*.30+wide*.10);c*=light;gl_FragColor=vec4(c,.96);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}" } );
      this.water = new T.Mesh(new T.PlaneGeometry(7000, 7000, 56, 56), material);
      this.water.rotation.x = -Math.PI / 2; this.water.position.y = -2; this.root.add(this.water);
    }
    makeRoads() {
      const positions = [], colors = [], rj = A.rng(555);
      const ribbon = (points, width, col, offset = .14, stride = 5) => {
        if (!Array.isArray(points)) return;
        const color = new T.Color(col);
        for (let i = 1; i < points.length; i++) {
          const a = points[i - 1], b = points[i], dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
          if (len < .01) continue;
          const steps = Math.max(1, Math.ceil(len / stride)), nx = -dz / len * width * .5, nz = dx / len * width * .5;
          for (let k = 0; k < steps; k++) {
            const t = k / steps, u = (k + 1) / steps, x = a.x + dx * t, z = a.z + dz * t, X = a.x + dx * u, Z = a.z + dz * u;
            // Baked asphalt wear: a subtle per-quad brightness drift keeps long
            // roads from reading as one flat ribbon. No runtime cost.
            const wear = .93 + rj() * .12;
            for (const q of [[x - nx,z - nz],[x + nx,z + nz],[X + nx,Z + nz],[X - nx,Z - nz],[x - nx,z - nz],[X + nx,Z + nz]]) {
              positions.push(q[0], this.surfaceHeight(q[0], q[1]) + offset, q[1]); colors.push(color.r * wear, color.g * wear, color.b * wear);
            }
          }
        }
      };
      const palette = (points, local) => {
        const p = points[Math.floor(points.length / 2)] || { x: 0, z: 0 }, b = S.biomeAt(p.x, p.z);
        if (b === "desert") return { curb: "#c3a270", asphalt: "#7d6a58", mark: "#f0d17f", walk: "#d5bd8d" };
        if (b === "snow") return { curb: "#9db9bd", asphalt: "#607d85", mark: "#e8e7c4", walk: "#bfd2cf" };
        return local ? { curb: "#9ba69a", asphalt: "#455c63", mark: "#ecd9a4", walk: "#c2c8b4" } : { curb: "#9b9b82", asphalt: "#526c68", mark: "#f0d898", walk: "#bec2ad" };
      };
      const drawRoute = (line, local) => {
        const p = palette(line, local), roadway = local ? 4.8 : 8.1, outer = roadway + (local ? 2.2 : 3.2);
        ribbon(line, outer, p.curb, .09, local?10:3);
        // Draw the wide sidewalk before the asphalt so the latter leaves a visible curb/walk band.
        ribbon(line, roadway + .75, p.walk, .15, local?10:3); ribbon(line, roadway, p.asphalt, .18, local?10:3);
        for (let i = 1; i < line.length; i++) {
          const a = line[i - 1], b = line[i], len = Math.hypot(b.x - a.x, b.z - a.z);
          for (let at = local ? 11 : 15; at < len; at += local ? 18 : 22) {
            const t = at / len, u = Math.min(1, (at + (local ? 3 : 5)) / len);
            ribbon([{x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t},{x:a.x+(b.x-a.x)*u,z:a.z+(b.z-a.z)*u}], .16, p.mark, .25);
          }
        }
      };
      roads().forEach((line) => drawRoute(line, false));
      streets().forEach((line) => drawRoute(line, true));
      // Crosswalks are rendered only at true intersections of two internal street polylines.
      const vertical = [], horizontal = [];
      streets().forEach((line) => line.forEach((p, i) => { if (!i) return; const a = line[i - 1], b = p; (Math.abs(b.x-a.x) < Math.abs(b.z-a.z) ? vertical : horizontal).push([a,b]); }));
      for (const [v0,v1] of vertical) for (const [h0,h1] of horizontal) {
        const x = v0.x, z = h0.z;
        if (x < Math.min(h0.x,h1.x) || x > Math.max(h0.x,h1.x) || z < Math.min(v0.z,v1.z) || z > Math.max(v0.z,v1.z)) continue;
        for (let k = -1; k <= 1; k++) {
          ribbon([{x:x-2.0,z:z+k*.72},{x:x+2.0,z:z+k*.72}], .28, "#f3ead0", .28);
          ribbon([{x:x+k*.72,z:z-2.0},{x:x+k*.72,z:z+2.0}], .28, "#f3ead0", .281);
        }
      }
      const geo = new T.BufferGeometry(); geo.setAttribute("position", new T.Float32BufferAttribute(positions, 3)); geo.setAttribute("color", new T.Float32BufferAttribute(colors, 3)); geo.computeVertexNormals();
      this.roads = new T.Mesh(geo, new T.MeshStandardMaterial({ vertexColors: true, roughness: .96, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
      this.roads.receiveShadow = true; this.roads.renderOrder = 2; this.root.add(this.roads);
    }
    makeGrass() {
      const positions = [], normals = [];
      for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3, c = Math.cos(a)*.22, s = Math.sin(a)*.22; positions.push(-c,0,-s,c,0,s,.035,.32,0); normals.push(0,1,0,0,1,0,0,1,0); }
      const geo = new T.BufferGeometry(); geo.setAttribute("position",new T.Float32BufferAttribute(positions,3)); geo.setAttribute("normal",new T.Float32BufferAttribute(normals,3));
      // Dense coverage is instanced, but its displayed count is quality-budgeted in
      // update(). Simulation vegetation/collision data is not involved here.
      const count = 6800, rand = A.rng(844), mesh = new T.InstancedMesh(geo, new T.MeshStandardMaterial({ color:"#91bb5d",roughness:1,side:T.DoubleSide }), count), dummy = new T.Object3D();
      // Bright wildflower accents ride the same placement loop: one extra
      // instanced draw call, unlit so the colours stay vivid on mobile.
      const fgeo = new T.BufferGeometry(), fpos = [];
      for (let k = 0; k < 2; k++) { const a = k * Math.PI / 2, ca = Math.cos(a) * .17, sa = Math.sin(a) * .17; fpos.push(-ca, .02, -sa, ca, .02, sa, ca, .22, sa, -ca, .02, -sa, ca, .22, sa, -ca, .22, -sa); }
      fgeo.setAttribute("position", new T.Float32BufferAttribute(fpos, 3)); fgeo.computeVertexNormals();
      const flowerCount = 900, flowers = new T.InstancedMesh(fgeo, new T.MeshBasicMaterial({ side: T.DoubleSide, vertexColors: false }), flowerCount);
      const petal = ["#ff8fb3", "#ffd94d", "#ffffff", "#c99df5", "#ff7b6b", "#7fd4ff"];
      let nf = 0;
      let n = 0, attempts = 0, m = map();
      while (n < count && attempts++ < count * 8) {
        let x, z;
        if (attempts % 3 === 0 && S.regions.length) { const r = S.regions[Math.floor(attempts / 3) % S.regions.length]; x = r.x + (rand()-.5) * ((r.padW || 70)*2.4); z = r.z + (rand()-.5) * ((r.padD || 60)*2.4); }
        else { x = (rand()-.5) * m.halfSize * 2; z = (rand()-.5) * m.halfSize * 2; }
        const b = S.biomeAt(x,z);
        if (b === "water" || b === "sand" || b === "snow" || coastDistance(x,z) >= m.shoreStart - 8 || onRoute(x,z,allRoutes(),4.6) || S.regions.some(r => Math.abs(x-r.x) < (r.padW||0)-7 && Math.abs(z-r.z) < (r.padD||0)-7)) continue;
        dummy.position.set(x,S.heightAt(x,z)+.01,z); dummy.scale.setScalar(.6+rand()*.85); dummy.rotation.set((rand()-.5)*.24,rand()*Math.PI,(rand()-.5)*.24); dummy.updateMatrix(); mesh.setMatrixAt(n,dummy.matrix); mesh.setColorAt(n,new T.Color(b === "desert" ? "#c7b079" : rand()>.7 ? "#b0ca6d" : "#6e9d43")); n++;
        if (nf < flowerCount && b !== "desert" && rand() > .80) {
          dummy.position.set(x + (rand()-.5)*2.4, S.heightAt(x, z) + .01, z + (rand()-.5)*2.4);
          dummy.scale.setScalar(.7 + rand() * .8); dummy.rotation.y = rand() * Math.PI; dummy.updateMatrix();
          flowers.setMatrixAt(nf, dummy.matrix); flowers.setColorAt(nf, new T.Color(petal[Math.floor(rand() * petal.length)])); nf++;
        }
      }
      mesh.count=n; mesh.frustumCulled=false; this.grassMax=n;
      flowers.count = nf; flowers.frustumCulled = false; this.flowerMax = nf; this.flowers = flowers; this.root.add(flowers);
      this.grassUniforms={time:{value:0},focus:{value:new T.Vector3()},distance:{value:160}};
      const u=this.grassUniforms;
      mesh.material.onBeforeCompile=(sh)=>{Object.assign(sh.uniforms,u);sh.vertexShader="uniform float time;uniform vec3 focus;uniform float distance;\n"+sh.vertexShader;sh.vertexShader=sh.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nvec3 anchor=instanceMatrix[3].xyz;float fade=1.-smoothstep(distance*.7,distance,length(anchor.xz-focus.xz));transformed*=fade;transformed.x+=sin(time*1.9+anchor.x*.4+anchor.z*.2)*position.y*.13;");};
      this.grass=mesh;this.root.add(mesh);
    }
    makeLandmarks() {
      this.flags=[]; this.decorations=[];
      const streetModel = new A.Model(), rand = A.rng(122), m = map();
      // Furniture may sit beside a local street, never in the wider connecting carriageway.
      const usable = (x,z) => coastDistance(x,z) < m.shoreStart-8 && !onRoute(x,z,roads(),6) && !onRoute(x,z,streets(),2.9);
      // All street furniture is one merged model. It follows S.streets, not a second guessed city grid.
      streets().forEach((line, lineIndex) => {
        for (let i=1;i<line.length;i++) {
          const a=line[i-1], b=line[i], dx=b.x-a.x, dz=b.z-a.z, len=Math.hypot(dx,dz); if(len<12) continue;
          const nx=-dz/len, nz=dx/len;
          for(let d=10; d<len-7; d+=30) {
            // Houses face their north-side street in the simulation grid. On an east/west
            // street, use the north sidewalk so lights and benches do not sit in a doorway.
            const side=Math.abs(dx)>Math.abs(dz) ? -1 : (((Math.floor(d/30)+lineIndex)&1)?1:-1), x=a.x+dx*d/len+nx*side*3.9, z=a.z+dz*d/len+nz*side*3.9;
            if(!usable(x,z)) continue;
            const y=S.heightAt(x,z);
            streetModel.cyl(.07,.1,4.6,"#3d5869",x,y+2.3,z,8).box(.58,.14,.42,"#f7e0a6",x,y+4.48,z).box(.9,.1,.56,"#3d5869",x,y+4.63,z);
            if ((Math.floor(d/30)+lineIndex)%3===0) {
              const tx=dx/len,tz=dz/len,yaw=Math.atan2(-tz,tx),bx=x-nx*side*.35+tx*3,bz=z-nz*side*.35+tz*3,by=S.heightAt(bx,bz);
              streetModel.box(1.9,.12,.55,"#b68b56",bx,by+.46,bz,0,yaw).box(1.9,.48,.1,"#c3985f",bx+nx*side*.22,by+.75,bz+nz*side*.22,0,yaw).box(.08,.45,.48,"#344d60",bx-tx*.72,by+.22,bz-tz*.72,0,yaw).box(.08,.45,.48,"#344d60",bx+tx*.72,by+.22,bz+tz*.72,0,yaw);
            }
            if ((Math.floor(d/30)+lineIndex)%4===0) { const px=x-nx*side*.45+dx/len*5,pz=z-nz*side*.45+dz/len*5,py=S.heightAt(px,pz); streetModel.box(.9,.42,.65,"#8e7654",px,py+.22,pz).box(.72,.55,.42,"#5c9a54",px,py+.62,pz); }
          }
        }
      });
      // Each district gets a small signed gateway/plaza edge.  It is placed beside
      // the authoritative street lattice rather than through the house centre.
      for (const r of S.regions) {
        const signX=r.x+(r.padW||30)+7,signZ=r.z,signY=S.heightAt(signX,signZ);
        if (usable(signX,signZ,1.2)) streetModel.cyl(.09,.11,2.4,"#3d5869",signX,signY+1.2,signZ,8).box(1.25,.55,.08,r.color||"#4d91d4",signX,signY+2.05,signZ);
      }
      // One merged district-dressing pass gives every data-driven region a
      // recognisable skyline accent. It deliberately shares streetModel's single
      // material/draw call and never changes simulation collision or architecture.
      for (const r of S.regions) {
        const px = r.x + (r.padW || 30) + 11, pz = r.z + 7;
        if (!usable(px, pz)) continue;
        const py = S.heightAt(px, pz), style = r.style || '';
        if (style === 'forest' || style === 'farm') {
          streetModel.cyl(.10, .16, 2.7, '#5b4637', px, py + 1.35, pz, 8)
            .ball(1.0, style === 'farm' ? '#86a84f' : '#39755e', px, py + 3.0, pz, 1.1, .78, 1.0, 1)
            .ball(.62, '#6fa45a', px + .55, py + 3.45, pz + .18, 1.1, .72, .92, 1);
        } else if (style === 'desert' || style === 'port') {
          streetModel.box(2.5, .10, 1.1, style === 'port' ? '#e79a73' : '#d18f4d', px, py + 2.25, pz)
            .cyl(.08, .11, 2.2, '#4a5661', px - .98, py + 1.1, pz, 8)
            .cyl(.08, .11, 2.2, '#4a5661', px + .98, py + 1.1, pz, 8)
            .box(1.7, .06, .08, '#ffc669', px, py + .18, pz);
        } else if (style === 'citadel' || style === 'cliff') {
          streetModel.cyl(.30, .42, 2.8, style === 'cliff' ? '#a9c4cd' : '#577e9d', px, py + 1.4, pz, 8)
            .cyl(.48, .36, .18, r.color || '#4d91d4', px, py + 2.88, pz, 8)
            .box(.08, .68, .08, '#f8d681', px, py + 3.25, pz);
        } else if (style === 'observatory') {
          streetModel.cyl(.34, .48, 1.75, '#6c587f', px, py + .88, pz, 10)
            .cyl(.57, .45, .16, r.color || '#b36ac8', px, py + 1.84, pz, 12)
            .cyl(.06, .06, 1.7, '#d8eef0', px, py + 2.45, pz, 8, 0, 0, 1, 1);
        } else {
          streetModel.cyl(.10, .14, 2.5, '#3d5869', px, py + 1.25, pz, 8)
            .box(.72, .14, .72, r.color || '#27b9b1', px, py + 2.5, pz);
        }
      }
      const furniture=streetModel.mesh(); this.root.add(furniture); this.streetFurniture=furniture;
      for (const r of S.regions) {
        const canvas=document.createElement("canvas");canvas.width=512;canvas.height=96;const ctx=canvas.getContext("2d");ctx.fillStyle="#213a4c";ctx.fillRect(0,0,512,96);ctx.fillStyle="#ffdb80";ctx.font="600 31px sans-serif";ctx.textAlign="center";ctx.fillText(r.name.toUpperCase(),256,59);
        const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;
        const sign=new T.Mesh(new T.PlaneGeometry(6,1.125),new T.MeshBasicMaterial({map:tex,side:T.DoubleSide}));
        const z=r.z,x=r.x+(r.padW||30)+7;sign.position.set(x,S.heightAt(x,z)+3.4,z);this.root.add(sign);this.decorations.push({mesh:sign,x:r.x,z:r.z});
        const pw=r.padW||30,pd=r.padD||30, flagSpot=[{x:r.x-pw-4,z:r.z-pd-4},{x:r.x+pw+4,z:r.z-pd-4},{x:r.x-pw-4,z:r.z+pd+4},{x:r.x+pw+4,z:r.z+pd+4}].find(q=>coastDistance(q.x,q.z)<m.shoreStart-8&&!onRoute(q.x,q.z,allRoutes(),5));
        if(flagSpot){const flagY=S.heightAt(flagSpot.x,flagSpot.z);const pole=new A.Model().cyl(.075,.12,4.8,"#3d5869",flagSpot.x,flagY+2.4,flagSpot.z,8).mesh();this.root.add(pole);this.decorations.push({mesh:pole,x:r.x,z:r.z});
        const flag=new T.Mesh(new T.PlaneGeometry(2.4,1.5,8,4),new T.MeshStandardMaterial({color:r.color,side:T.DoubleSide,roughness:.8}));flag.position.set(flagSpot.x,flagY+4.15,flagSpot.z);flag.userData.base=new Float32Array(flag.geometry.attributes.position.array);this.flags.push(flag);this.root.add(flag);}
      }
      // A restrained coastline landmark pass follows the rectangular coast metric; it never creates a circular ring.
      const rocks=new A.Model();
      for(let i=0;i<22;i++) { const edge=i%4, along=(-.88+(i/22)*1.76)*m.shoreStart, inset=12+rand()*18; let x,z; if(edge===0){x=along;z=-m.shoreStart+inset;}else if(edge===1){x=m.shoreStart-inset;z=along;}else if(edge===2){x=along;z=m.shoreStart-inset;}else{x=-m.shoreStart+inset;z=along;} if(coastDistance(x,z)<m.shoreStart && !onRoute(x,z,allRoutes(),8)) rocks.ball(3+rand()*5,S.biomeAt(x,z)==="snow"?"#a0b4ba":"#a58266",x,S.heightAt(x,z)-2,z,1,1.25,1,1); }
      this.root.add(rocks.mesh());
    }
    // Inland rock formations: clustered outcrops on slopes and biome seams give
    // the terrain readable relief between towns. Two instanced meshes (base +
    // cap), quality-budgeted in update(). Presentation only: placed outside
    // towns, routes and shore, never enters S.objects or collision.
    makeRockFormations() {
      const random = A.rng(3121), max = 150, dummy = new T.Object3D(), m = map();
      const base = new T.InstancedMesh(new T.DodecahedronGeometry(1, 0), new T.MeshStandardMaterial({ color: "#ffffff", roughness: 1, vertexColors: true, flatShading: true }), max);
      const cap = new T.InstancedMesh(new T.DodecahedronGeometry(1, 0), new T.MeshStandardMaterial({ color: "#ffffff", roughness: 1, vertexColors: true, flatShading: true }), max);
      let n = 0, attempts = 0;
      while (n < max && attempts++ < max * 40) {
        const x = (random() - .5) * m.halfSize * 1.7, z = (random() - .5) * m.halfSize * 1.7;
        const b = S.biomeAt(x, z), cd = coastDistance(x, z);
        if (b === "water" || cd >= m.shoreStart - 26 || onRoute(x, z, allRoutes(), 9) || S.regions.some((r) => Math.abs(x - r.x) < (r.padW || 0) + 6 && Math.abs(z - r.z) < (r.padD || 0) + 6)) continue;
        const y = S.heightAt(x, z);
        // Favour slopes and biome seams: skip perfectly flat meadow centres.
        const slope = Math.abs(S.heightAt(x + 6, z) - y) + Math.abs(S.heightAt(x, z + 6) - y);
        if (slope < 1.6 && random() > .25) continue;
        const s = 2.4 + random() * 7.5;
        const col = new T.Color(b === "snow" ? "#93a8ad" : b === "desert" ? "#c08a56" : "#7d8a80");
        dummy.position.set(x, y - s * .18, z); dummy.rotation.set(random() * .3, random() * Math.PI, random() * .24);
        dummy.scale.set(s, s * (.55 + random() * .5), s * (.8 + random() * .4)); dummy.updateMatrix();
        base.setMatrixAt(n, dummy.matrix); base.setColorAt(n, col);
        const cc = col.clone().lerp(new T.Color(b === "snow" ? "#dcebe9" : "#a9bfa0"), .5);
        if (random() > .7) cc.lerp(new T.Color("#8fae62"), .4); // moss lichen
        dummy.position.set(x + (random() - .5) * s * .7, y + s * .28, z + (random() - .5) * s * .7);
        dummy.scale.set(s * .55, s * .42, s * .5); dummy.updateMatrix();
        cap.setMatrixAt(n, dummy.matrix); cap.setColorAt(n, cc);
        n++;
      }
      base.count = cap.count = n; base.frustumCulled = cap.frustumCulled = false;
      base.receiveShadow = cap.receiveShadow = true;
      base.instanceMatrix.needsUpdate = true; cap.instanceMatrix.needsUpdate = true;
      if (base.instanceColor) base.instanceColor.needsUpdate = true;
      if (cap.instanceColor) cap.instanceColor.needsUpdate = true;
      this.rockFormations = { base, cap, max: n };
      this.root.add(base, cap);
    }
    // Scenery is deliberately presentation-only: it is kept outside every
    // authoritative town pad and route margin, and never enters S.objects. This
    // protects doors/roads/collision while giving the long approaches recognisable
    // silhouettes. Each POI is one cached, merged mesh and is culled by quality.
    makeScenery() {
      const m = map(), routes = allRoutes(), placed = [];
      this.scenery = [];
      this.sceneryStats = { beach: 0, camp: 0, beacon: 0, ruins: 0, market: 0, nature: 0, total: 0 };
      const outsideDistricts = (x, z, margin = 16) => S.regions.every((r) => Math.abs(x - r.x) > (r.padW || 0) + margin || Math.abs(z - r.z) > (r.padD || 0) + margin);
      const clear = (x, z, shore) => {
        const d = coastDistance(x, z);
        if (Math.abs(x) > m.halfSize - 24 || Math.abs(z) > m.halfSize - 24 || d >= m.shoreStart - 18) return false;
        if (shore && d < m.shoreStart - 104) return false;
        if (!outsideDistricts(x, z) || onRoute(x, z, routes, 13)) return false;
        const h = S.heightAt(x, z);
        return Number.isFinite(h) && Math.abs(h - S.heightAt(x + 4, z)) < 5 && Math.abs(h - S.heightAt(x, z + 4)) < 5 && placed.every((q) => Math.hypot(x - q.x, z - q.z) > 18);
      };
      // The search is deterministic and lets POIs survive future town/road data
      // edits without hard-coding an unsafe world coordinate.
      const spot = (x, z, shore = false) => {
        for (let i = 0; i < 100; i++) {
          const radius = i ? 7 + Math.floor((i - 1) / 10) * 9 : 0;
          const a = i * 2.399963229728653;
          const qx = x + Math.cos(a) * radius, qz = z + Math.sin(a) * radius;
          if (clear(qx, qz, shore)) { const q = { x: qx, z: qz }; placed.push(q); return q; }
        }
        return null;
      };
      const add = (type, tier, desiredX, desiredZ, shore = false) => {
        const q = spot(desiredX, desiredZ, shore); if (!q) return;
        const x = q.x, z = q.z, y = (dx = 0, dz = 0) => S.heightAt(x + dx, z + dz) + .06;
        const model = new A.Model();
        const accent = type === "beach" ? "#f2a86d" : type === "camp" ? "#e6a654" : type === "beacon" ? "#74d9d2" : type === "ruins" ? "#b5c7c8" : type === "market" ? "#ed8f68" : "#76a85b";
        if (type === "beach") {
          // Parasol, deck chairs and short stilted lookout read as a beach stop,
          // not a blocking building. Its footprint stays fully off the road.
          model.box(5.4, .10, 2.0, "#cda070", x, y(), z + .7).cyl(.12, .17, 2.9, "#665346", x, y() + 1.45, z, 8)
            .cyl(2.25, 1.42, .18, accent, x, y() + 2.83, z, 12).box(1.35, .13, .48, "#e9d1a0", x - 1.5, y(-1.5, .25) + .48, z + .25, 0, .2)
            .box(1.35, .13, .48, "#d88a67", x + 1.55, y(1.55, -.28) + .48, z - .28, 0, -.2);
          for (const dx of [-2.35, 2.35]) model.cyl(.13, .18, 2.1, "#705a49", x + dx, y(dx, .9) + .62, z + .9, 7);
        } else if (type === "camp") {
          model.add(new T.ConeGeometry(2.35, 2.25, 4), "#d7895c", x - 1.35, y(-1.35, 0) + 1.12, z, 0, Math.PI / 4)
            .box(2.9, .08, .9, "#b98d58", x + 1.35, y(1.35, 0) + .11, z).box(.95, .12, .14, "#f6c364", x + 1.35, y(1.35, 0) + .26, z);
          for (let i = 0; i < 7; i++) { const a = i * Math.PI * 2 / 7; model.ball(.36, i % 2 ? "#7d7770" : "#a28b71", x + Math.cos(a) * 1.05, y(Math.cos(a) * 1.05, Math.sin(a) * 1.05) + .18, z + Math.sin(a) * 1.05, 1, .58, 1, 0); }
          model.ball(.25, "#ffbe63", x, y() + .32, z, 1, .45, 1, 1);
        } else if (type === "beacon") {
          model.cyl(1.28, 1.55, .55, "#607b80", x, y() + .28, z, 10).cyl(.42, .58, 4.6, "#426373", x, y() + 2.55, z, 10)
            .cyl(.72, .56, .22, accent, x, y() + 4.85, z, 10).ball(.38, "#f8d782", x, y() + 5.17, z, 1, 1, 1, 1);
          for (const a of [0, Math.PI * .5, Math.PI, Math.PI * 1.5]) model.box(.18, .18, .76, "#d6d3be", x + Math.cos(a) * 1.12, y(Math.cos(a) * 1.12, Math.sin(a) * 1.12) + .55, z + Math.sin(a) * 1.12, 0, a);
        } else if (type === "ruins") {
          model.box(5.4, .16, 3.5, "#87989a", x, y(), z);
          for (const [dx, dz, h] of [[-2,-1.2,2.8],[2,-1.2,2.1],[-2,1.2,1.7],[2,1.2,3.2]]) model.cyl(.30, .38, h, "#aab8b6", x + dx, y(dx, dz) + h * .5, z + dz, 8);
          model.box(4.8, .34, .38, "#cad2c5", x, y(0, -1.2) + 2.42, z - 1.2).ball(.44, "#d6c58b", x, y() + .42, z, 1, .42, 1, 1);
        } else if (type === "market") {
          // Open stalls and textile awnings leave a transparent, human-scale plaza
          // silhouette rather than inventing a solid gameplay obstacle.
          for (const dx of [-2.15, 0, 2.15]) {
            const py = y(dx, 0), col = dx === 0 ? accent : "#56aaa1";
            model.box(1.55, .10, 1.05, "#b88556", x + dx, py + .68, z).box(1.85, .12, 1.30, col, x + dx, py + 2.24, z, 0, dx * .10)
              .cyl(.07, .09, 2.15, "#64564d", x + dx - .72, py + 1.08, z, 7).cyl(.07, .09, 2.15, "#64564d", x + dx + .72, py + 1.08, z, 7);
          }
          model.cyl(.08, .12, 2.8, "#51656a", x, y(0, 2.05) + 1.4, z + 2.05, 7).box(1.12, .46, .07, "#f4d17e", x, y(0, 2.05) + 2.17, z + 2.05);
        } else {
          // High-only distant groves/rock gardens enrich empty approaches in a
          // single mesh each; they are deliberately smaller than sim harvestables.
          for (const [dx, dz, scale] of [[0,0,1],[-2.5,1.1,.72],[2.35,-.9,.78]]) {
            const py = y(dx, dz), snow = S.biomeAt(x + dx, z + dz) === "snow";
            model.cyl(.13 * scale, .25 * scale, 2.3 * scale, "#725a44", x + dx, py + 1.15 * scale, z + dz, 7)
              .ball(1.18 * scale, snow ? "#9fc4c6" : accent, x + dx, py + 2.65 * scale, z + dz, 1, .85, 1, 1)
              .ball(.78 * scale, snow ? "#e2eff0" : "#9abf68", x + dx + .42 * scale, py + 3.02 * scale, z + dz, 1, .85, 1, 1);
          }
          model.ball(.62, "#87958c", x - 2.75, y(-2.75, -1.6) + .25, z - 1.6, 1, .5, .85, 1);
        }
        const mesh = model.mesh();
        mesh.name = `scenery-${type}-${this.sceneryStats[type]}`;
        mesh.userData = { shared: true, scenery: true, type, tier, nonColliding: true, anchor: { x, z } };
        mesh.castShadow = tier === 0; mesh.receiveShadow = true;
        this.root.add(mesh); this.scenery.push({ mesh, x, z, tier, type });
        this.sceneryStats[type]++; this.sceneryStats.total++;
      };
      [[-465,260],[-455,-250],[385,330],[390,-410]].forEach((q) => add("beach", 0, q[0], q[1], true));
      [[-455,-105],[-35,445],[230,-470]].forEach((q) => add("camp", 1, q[0], q[1]));
      [[-475,70],[470,-120]].forEach((q) => add("beacon", 0, q[0], q[1]));
      [[-455,195],[80,-470]].forEach((q) => add("ruins", 1, q[0], q[1]));
      [[-245,435],[-65,175],[255,315]].forEach((q) => add("market", 0, q[0], q[1]));
      [[-440,-330],[-430,420],[-120,450],[410,390],[445,230],[310,-455]].forEach((q) => add("nature", 2, q[0], q[1]));
    }
    dispose() {
      if (this.disposed) return;
      this.disposed = true;
      const geometries = new Set(), materials = new Set(), textures = new Set();
      this.root.traverse((o) => {
        if (o.geometry) geometries.add(o.geometry);
        const list = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const material of list) if (material !== A.material) materials.add(material);
      });
      for (const material of materials) {
        for (const key of ["map", "alphaMap", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap"]) if (material[key]) textures.add(material[key]);
        material.dispose();
      }
      textures.forEach((texture) => texture.dispose());
      geometries.forEach((geometry) => geometry.dispose());
      this.root.removeFromParent(); this.root.clear();
      this.scenery = []; this.decorations = []; this.flags = [];
    }
    update(dt, focus, day=1, quality="medium") {
      this.time+=dt;const t=this.time;this.waterUniforms.time.value=t;this.waterUniforms.light.value=.26+day*.74;
      this.skyUniforms.daylight.value=day;this.skyUniforms.dusk.value=Math.exp(-Math.pow((day-.63)/.18,2));
      this.skyUniforms.top.value.set("#142342").lerp(this.skyDayTop,day);this.skyUniforms.bottom.value.set("#4b4f70").lerp(this.skyDayBottom,day);this.stars.material.opacity=(1-day)*.9;
      this.cloudMaterial.opacity=.27+day*.5;
      const premium = quality === "high" || quality === "ultra";
      this.clouds.children.forEach((c,i)=>{c.visible=i<(quality==="low"?7:quality==="medium"?10:quality==="high"?14:18);c.position.x+=dt*(1+i%4)*.7;if(c.position.x>1500)c.position.x=-1500;});
      this.birds.children.forEach((b,i)=>{b.visible=quality!=="low"||i<4;const a=t*.14+i*.84;b.position.set(focus.x+Math.cos(a)*43,focus.y+22+i*.8,focus.z+Math.sin(a)*43);b.rotation.set(Math.sin(t*6+i)*.18,-a,Math.sin(t*7+i)*.1);});
      this.flags.forEach((f)=>{f.visible=Math.hypot(f.position.x-focus.x,f.position.z-focus.z)<(quality==="low"?180:quality==="ultra"?720:500);if(!f.visible)return;const p=f.geometry.attributes.position,b=f.userData.base;for(let i=0;i<p.count;i++)p.setZ(i,b[i*3+2]+Math.sin(b[i*3]*3+t*4)*.14);p.needsUpdate=true;});
      // Shader fading alone still transforms every blade. Reduce submitted instances
      // before the draw on low/medium quality, so software and mobile paths benefit.
      this.grass.visible=quality!=="low";this.grass.count=premium?this.grassMax:Math.min(this.grassMax,3000);
      // Wildflowers follow the same quality budget; low hides them entirely.
      if(this.flowers){this.flowers.visible=quality!=="low";this.flowers.count=premium?this.flowerMax:Math.min(this.flowerMax,420);}
      // Inland rock outcrops follow the same budget; the adaptiveDetail factor
      // (set by the engine's auto-perf) shrinks counts further when the device
      // struggles, so low-end iPhones stay fluid.
      if (this.rockFormations) {
        const rf = this.rockFormations, ad = root.AZUR?.view?.adaptiveDetail || 1, ultraLow = root.AZUR?.view?.v2UltraLow;
        const budget = quality === "low" ? 60 : premium ? rf.max : 100;
        const rc = Math.max(0, Math.min(rf.max, Math.floor(budget * Math.min(1, ad) * (ultraLow ? .5 : 1))));
        rf.base.count = rc; rf.cap.count = rc; rf.base.visible = rf.cap.visible = rc > 0;
      }
      this.grassUniforms.time.value=t;this.grassUniforms.focus.value.set(focus.x,focus.y,focus.z);this.grassUniforms.distance.value=quality==="ultra"?245:quality==="high"?190:118;
      for(const d of this.decorations)d.mesh.visible=Math.hypot(focus.x-d.x,focus.z-d.z)<(quality==="low"?230:quality==="ultra"?820:600);
      // POI meshes are static/cached; this is only a distance/tier visibility
      // decision. Low keeps nearby iconic shoreline cues, medium omits groves,
      // and high/ultra reveal the complete outskirts pass.
      const sceneryDistance = quality === "low" ? 220 : quality === "ultra" ? 980 : premium ? 820 : 500;
      const sceneryTier = quality === "low" ? 0 : premium ? 2 : 1;
      for (const d of this.scenery || []) d.mesh.visible = d.tier <= sceneryTier && Math.hypot(focus.x - d.x, focus.z - d.z) < sceneryDistance;
      if(this.streetFurniture)this.streetFurniture.visible=quality!=="low";
    }
  }
  root.AZEnvironment={Environment,terrainColor};
})(window);
