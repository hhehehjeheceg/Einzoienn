/* Cartography shared by the minimap and full-screen island map. */
(function (root) {
  "use strict";
  const S = AZSim, spanMax = S.MAP.halfSize * 2, $ = (id) => document.getElementById(id);
  const coastDistance = (x, z) => (S.coastDistance ? S.coastDistance(x, z) : Math.hypot(x, z));
  const mapPoint = (p, span) => [(p.x / span + .5) * 512, (p.z / span + .5) * 512];
  root.AZMapUI = {
    buildMapTexture() {
      const size = 512, c = (this.mapTexture = document.createElement("canvas"));
      c.width = c.height = size;
      const ctx = c.getContext("2d"), im = ctx.createImageData(size, size), m = S.MAP;
      for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
        const wx = (x / size - .5) * spanMax, wz = (z / size - .5) * spanMax, d = coastDistance(wx, wz), h = S.heightAt(wx, wz), bio = S.biomeAt(wx, wz);
        // The coast metric, rather than a radial height test, keeps the map's island
        // a compact irregular rectangle even if terrain height changes in the sim.
        const zone = S.zoneAt ? S.zoneAt(wx, wz) : bio;
        let color = d >= m.shoreEnd ? (d < m.shoreEnd + 60 ? [38, 140, 168] : [23, 102, 141]) : d >= m.shoreStart ? [236, 218, 166] : ({ snow: [228,238,244], desert: [222,160,92], volcano: [70,58,62], jungle: [44,128,62], meadow: [128,186,92] })[zone] || [88,160,84];
        if (zone === "volcano" && S.VOLCANO && Math.hypot(wx - S.VOLCANO.x, wz - S.VOLCANO.z) < S.VOLCANO.crater) color = [255, 96, 32];
        const shade = .93 + Math.min(.12, h / 550) + Math.sin(wx*.04 + wz*.03)*.025, i = (z * size + x) * 4;
        im.data[i] = color[0] * shade; im.data[i + 1] = color[1] * shade; im.data[i + 2] = color[2] * shade; im.data[i + 3] = 255;
      }
      ctx.putImageData(im, 0, 0);
      const trace = (line, width, color) => {
        if (!Array.isArray(line) || !line.length) return;
        ctx.beginPath();
        line.forEach((p, i) => { const [x,y] = mapPoint(p, spanMax); i ? ctx.lineTo(x,y) : ctx.moveTo(x,y); });
        ctx.lineWidth = width; ctx.strokeStyle = color; ctx.stroke();
      };
      // Connector roads remain dominant; streets reveal the dense, navigable districts.
      (S.roads || []).forEach((line) => trace(line, 1.35, "#d9cc9c"));
      (S.streets || []).forEach((line) => trace(line, .65, "rgba(221,218,190,.88)"));
    },
    drawMap(c, full) {
      if (!c || !this.world) return;
      const ctx = c.getContext("2d"), sz = c.width, w = this.world, p = this.player(), waiting = w.phase === "waiting";
      const span = full ? spanMax / (this.mapZoom || 1) : waiting ? 190 : Math.min(360, spanMax), cx = full ? this.mapCenter.x : p.x, cz = full ? this.mapCenter.z : p.z;
      const pt = (x,z) => [((x-cx)/span)*sz+sz/2, ((z-cz)/span)*sz+sz/2];
      ctx.clearRect(0,0,sz,sz); ctx.fillStyle="#17668d";ctx.fillRect(0,0,sz,sz);
      if (waiting && !full) {
        const q=S.MAP.waiting;ctx.fillStyle="#e3d2a2";ctx.beginPath();ctx.arc(...pt(q.x,q.z),(q.radius/span)*sz,0,Math.PI*2);ctx.fill();ctx.fillStyle="#80ad66";ctx.beginPath();ctx.arc(...pt(q.x,q.z),((q.radius*.86)/span)*sz,0,Math.PI*2);ctx.fill();
      } else {
        const [x,y]=pt(-S.MAP.halfSize,-S.MAP.halfSize);ctx.drawImage(this.mapTexture,x,y,(spanMax/span)*sz,(spanMax/span)*sz);
      }
      if (full) {
        ctx.strokeStyle="rgba(238,252,255,.17)";ctx.lineWidth=1;ctx.font="10px sans-serif";ctx.textAlign="center";
        for(let k=0;k<=10;k++) { const at=(k/10-.5)*spanMax,[x]=pt(at,0),[,y]=pt(0,at);ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,sz);ctx.moveTo(0,y);ctx.lineTo(sz,y);ctx.stroke();if(k<10){ctx.fillStyle="#e4f6e9";ctx.fillText(String.fromCharCode(65+k),x+((spanMax/span)*sz)/20,14);ctx.fillText(String(k+1),10,y+((spanMax/span)*sz)/20);}}
      }
      for(const o of w.objects) if(o.type==="house"&&!o.dead) { const [x,y]=pt(o.x,o.z),ww=((o.w*2)/span)*sz,dd=((o.d*2)/span)*sz;ctx.fillStyle="#f5e4ba";ctx.fillRect(x-ww/2,y-dd/2,Math.max(1,ww),Math.max(1,dd));ctx.strokeStyle="rgba(37,68,62,.7)";ctx.lineWidth=.5;ctx.strokeRect(x-ww/2,y-dd/2,Math.max(1,ww),Math.max(1,dd)); }
      // The storm is deliberately circular battle-royale gameplay, independent from the coastline.
      if(!waiting&&!["creative","training"].includes(w.mode)) { const [x,y]=pt(w.storm.x,w.storm.z),r=(w.storm.radius/span)*sz;ctx.save();ctx.fillStyle="rgba(86,37,150,.38)";ctx.beginPath();ctx.rect(0,0,sz,sz);ctx.arc(x,y,r,0,Math.PI*2,true);ctx.fill("evenodd");ctx.strokeStyle="#d2bcff";ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();const [nx,ny]=pt(w.storm.nextX,w.storm.nextZ);ctx.setLineDash([5,5]);ctx.strokeStyle="#effffc";ctx.beginPath();ctx.arc(nx,ny,(w.storm.nextRadius/span)*sz,0,Math.PI*2);ctx.stroke();ctx.restore(); }
      if(full&&["waiting","transport"].includes(w.phase)) { const tr=S.MAP.transport;ctx.save();ctx.setLineDash([6,6]);ctx.strokeStyle="#8defff";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(...pt(tr.startX,tr.startZ));ctx.lineTo(...pt(tr.startX+tr.velocityX*tr.duration,tr.startZ+tr.velocityZ*tr.duration));ctx.stroke();ctx.restore();if(w.phase==="transport"){const [x,y]=pt(w.aircraft.x,w.aircraft.z);ctx.fillStyle="#66edff";ctx.fillRect(x-5,y-3,10,6);} }
      if(full) {ctx.font="600 12px sans-serif";ctx.textAlign="center";for(const r of S.regions){const [x,y]=pt(r.x,r.z),ww=ctx.measureText(r.name).width+14;ctx.fillStyle="rgba(16,49,65,.88)";ctx.fillRect(x-ww/2,y+9,ww,21);ctx.fillStyle="#fff9df";ctx.fillText(r.name,x,y+24);}}
      for(const q of w.players.filter(q=>q.team===p.team&&q.alive)){if(full&&waiting)continue;const [x,y]=pt(q.x,q.z);ctx.save();ctx.translate(x,y);ctx.rotate(-q.yaw);ctx.fillStyle=q.id===p.id?"#fff8d0":"#62efbf";ctx.strokeStyle="#244259";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(5,6);ctx.lineTo(0,3);ctx.lineTo(-5,6);ctx.closePath();ctx.stroke();ctx.fill();ctx.restore();}
      if(this.marker){const [x,y]=pt(this.marker.x,this.marker.z);ctx.fillStyle="#ffd176";ctx.strokeStyle="#6a4929";ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,full?6:5,0,Math.PI*2);ctx.stroke();ctx.fill();ctx.beginPath();ctx.moveTo(x,y+4);ctx.lineTo(x,y+12);ctx.stroke();}
      if(full)this.currentMap={span,cx,cz};
    },
    openMap() {
      if(this.screen!=="game")return;this.modal="map";this.paused=!this.socket;this.fire=false;this.keys={};this.move={x:0,z:0};this.send({fire:false,moveX:0,moveZ:0,moveY:0});if(document.pointerLockElement)document.exitPointerLock();
      this.overlay.innerHTML='<div class="modal-shade"><section class="dialog map-dialog"><div class="dialog-head"><div><span class="eyebrow">'+S.regions.length+' RÉGIONS • 6 BIOMES</span><h2>L’archipel AZUR</h2></div><button class="btn btn-ghost" data-act="resume" aria-label="Fermer la carte">FERMER ×</button></div><canvas id="full-map" class="full-map" width="660" height="660" aria-label="Carte, cliquez pour placer un repère"></canvas><div class="map-legend"><span>▲ Toi / équipe</span><span>○ Prochaine zone</span><span>● Repère</span></div><div class="dialog-actions"><button class="btn btn-secondary" data-act="zoom-in" aria-label="Zoom avant">+</button><button class="btn btn-secondary" data-act="zoom-out" aria-label="Zoom arrière">−</button><button class="btn btn-ghost" data-act="map-center">CENTRER</button><button class="btn btn-ghost" data-act="marker-clear">EFFACER LE REPÈRE</button></div><p class="muted">Clique ou touche pour marquer. Glisse pour déplacer. Molette pour zoomer.</p></section></div>';
      this.drawFullMap();const cv=$("full-map");let start;
      cv.addEventListener("pointerdown",e=>{cv.setPointerCapture(e.pointerId);start={x:e.clientX,y:e.clientY,px:e.clientX,py:e.clientY,moved:false};});
      cv.addEventListener("pointermove",e=>{if(!start)return;const dx=e.clientX-start.px,dy=e.clientY-start.py;if(Math.hypot(e.clientX-start.x,e.clientY-start.y)>5)start.moved=true;if(start.moved){const limit=S.MAP.halfSize;this.mapCenter.x=Math.max(-limit,Math.min(limit,this.mapCenter.x-((dx/cv.clientWidth)*spanMax)/this.mapZoom));this.mapCenter.z=Math.max(-limit,Math.min(limit,this.mapCenter.z-((dy/cv.clientHeight)*spanMax)/this.mapZoom));this.drawFullMap();}start.px=e.clientX;start.py=e.clientY;});
      cv.addEventListener("pointerup",e=>{if(start&&!start.moved){const r=cv.getBoundingClientRect(),span=spanMax/this.mapZoom;this.marker={x:this.mapCenter.x+((e.clientX-r.left)/r.width-.5)*span,z:this.mapCenter.z+((e.clientY-r.top)/r.height-.5)*span};this.audio.ui();this.drawFullMap();}start=null;});cv.addEventListener("pointercancel",()=>start=null);cv.addEventListener("wheel",e=>{e.preventDefault();this.mapZoom=Math.max(1,Math.min(5,this.mapZoom*(e.deltaY<0?1.15:1/1.15)));this.drawFullMap();},{passive:false});
    },
    drawFullMap(){this.drawMap($("full-map"),true);}
  };
})(window);
