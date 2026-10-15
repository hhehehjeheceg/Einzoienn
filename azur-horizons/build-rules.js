(function (root) {
  'use strict';
  const S = root.AZSim, P = S.World.prototype;
  const quadrants = [27, 36, 192, 256];
  const expand = (mask) => quadrants.reduce((value, group, i) => value | ((mask & (1 << i)) ? group : 0), 0);
  const compress = (mask) => [0, 2, 6, 8].reduce((value, bit, i) => value | ((mask & (1 << bit)) ? 1 << i : 0), 0);
  const valid = (type, mask) => {
    if (!Number.isInteger(mask) || mask < 1 || mask > 511) return false;
    if (type === 'floor' || type === 'roof') return mask === expand(compress(mask));
    if (type === 'ramp') return mask === ((mask & 73 ? 73 : 0) | (mask & 146 ? 146 : 0) | (mask & 292 ? 292 : 0));
    if (type !== 'wall') return false;
    const pending = [Math.floor(Math.log2(mask & -mask))], seen = new Set();
    while (pending.length) {
      const i = pending.pop(); if (seen.has(i)) continue; seen.add(i);
      for (const j of [i - 3, i + 3, i % 3 ? i - 1 : -1, i % 3 < 2 ? i + 1 : -1])
        if (j >= 0 && j < 9 && (mask & (1 << j)) && !seen.has(j)) pending.push(j);
    }
    return seen.size === mask.toString(2).replace(/0/g, '').length;
  };
  function bounds(b) {
    const sideways = Math.abs(Math.sin(b.yaw || 0)) > .7;
    return { minX: b.x - (b.type === 'wall' && sideways ? .16 : 2), maxX: b.x + (b.type === 'wall' && sideways ? .16 : 2),
      minZ: b.z - (b.type === 'wall' && !sideways ? .16 : 2), maxZ: b.z + (b.type === 'wall' && !sideways ? .16 : 2),
      minY: b.y - .12, maxY: b.y + (b.type === 'floor' ? .12 : b.type === 'roof' && b.editMask === 511 ? 2 : 4) };
  }
  function touches(a, b) {
    const gaps = [Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX), Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY), Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ)];
    return gaps.every(gap => gap >= -.18) && gaps.filter(gap => gap > .05).length >= 2;
  }
  function grounded(world, b) {
    for (const [x, z] of [[0, 0], [-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9]]) {
      const ground = S.heightAt(b.x + x, b.z + z);
      if (b.y <= ground + .75 && b.y >= ground - 4.2) return true;
    }
    return world._objectsAt(b.x, b.z).some(o => !o.dead && o.type === 'house' && Math.abs(b.x-o.x) <= o.w+2 && Math.abs(b.z-o.z) <= o.d+2 && Math.abs(b.y-(o.y+o.h)) <= 1.5);
  }
  P.hasBuildSupport = function (b) {
    if (this.mode === 'creative' || grounded(this, b)) return true;
    const box = bounds(b);
    return this.builds.some(q => !q.dead && touches(box, bounds(q)));
  };
  const previousPlacement = P.buildPlacement;
  P.buildPlacement = function (player, type, rotation, level) {
    const b = previousPlacement.call(this, player, type, rotation, level);
    if (b.snap) return b;
    const f = { x: -Math.sin(player.yaw || 0), z: -Math.cos(player.yaw || 0) };
    const cellX = Math.round((player.x+f.x*3)/4)*4, cellZ = Math.round((player.z+f.z*3)/4)*4;
    b.x = cellX; b.z = cellZ;
    const ground = S.heightAt(cellX, cellZ);
    let anchor = null, score = Infinity;
    for (const q of this.builds) {
      if (q.dead || Math.abs(q.y-player.y) > 5.5) continue;
      const distance = Math.hypot(q.x-cellX, q.z-cellZ);
      if (distance < 6.1 && distance < score) { anchor = q; score = distance; }
    }
    b.y = anchor ? anchor.y + Math.max(0, Math.floor((player.y-anchor.y+.7)/4))*4 : ground;
    if (this.mode === 'creative' && player.flying && !anchor) b.y = ground + Math.max(0, Math.floor((player.y-ground)/4))*4;
    b.y = Math.round((b.y+(level || 0)*4)*2)/2;
    if (type === 'wall') { b.x -= Math.sin(b.yaw)*2; b.z -= Math.cos(b.yaw)*2; }
    b.x = Math.round(b.x*2)/2; b.z = Math.round(b.z*2)/2; b.snap = 'grid';
    return b;
  };
  P.canBuild = function (p, type, material, rotation, level) {
    if (!p || !['wall','floor','ramp','roof'].includes(type)) return { ok:false, reason:'type' };
    const placement = this.buildPlacement(p, type, rotation, level), fail = reason => ({ok:false, reason, placement});
    if (!['wood','stone','metal'].includes(material)) return fail('material');
    if (!Number.isInteger(level == null ? 0 : level) || Math.abs(level || 0) > 1 || !Number.isInteger(rotation == null ? 0 : rotation) || rotation < 0 || rotation > 3) return fail('level');
    if (!p.alive || p.downed || p.vehicleId || p.gliding || p.swimming || p.flying && this.mode !== 'creative') return fail('airborne');
    if (!p.deployed && this.phase !== 'waiting') return fail('not-deployed');
    if (this.mode !== 'creative' && (!p.mats || p.mats[material] < 10)) return fail('materials');
    if (this.mode !== 'creative' && S.coastDistance(placement.x,placement.z) > S.MAP.shoreStart+20) return fail('outside-island');
    if (this.builds.filter(q => !q.dead && q.owner === p.id).length >= 600) return fail('limit');
    if (Math.abs(placement.y-p.y) > 6.2) return fail('height');
    if (this._buildOverlap(placement)) return fail('duplicate');
    if (this._blocked(placement.x,placement.z,.1,placement.y,p.id)) return fail('blocked');
    if (!this.hasBuildSupport(placement)) return fail('support');
    return {ok:true, reason:'ok', placement};
  };
  const previousBuild = P._build;
  P._build = function (p) {
    if ((this._clock || 0) < (p._nextBuildAt || 0)) return false;
    const count = this.builds.length;
    previousBuild.apply(this, arguments);
    if (this.builds.length > count) { p._nextBuildAt = (this._clock || 0)+.085; return true; }
    return false;
  };
  const previousEdit = P._setEdit;
  P._setEdit = function (p, id, mask) {
    const b = this.builds.find(q => q.id === id);
    if (!p.alive || p.downed || !b || !valid(b.type, mask)) { this._say(p, 'Forme invalide : conserve une structure continue.'); return false; }
    if (Math.hypot(p.x-b.x,p.z-b.z) > 8.5 || Math.abs(p.y-b.y) > 6) { this._say(p,'Pièce trop éloignée.'); return false; }
    const result = previousEdit.call(this,p,id,mask);
    if (result) this._bumpBuilds();
    return result;
  };
  P.collapseUnsupported = function () {
    if (this.mode === 'creative') return 0;
    const pieces = this.builds.filter(q => !q.dead), boxes = pieces.map(bounds), bins = new Map(), reached = new Set(), pending = [];
    pieces.forEach((b,i) => {
      const key = Math.floor(b.x/4)+','+Math.floor(b.y/4)+','+Math.floor(b.z/4);
      if (!bins.has(key)) bins.set(key,[]); bins.get(key).push(i);
      if (grounded(this,b)) { reached.add(i); pending.push(i); }
    });
    while (pending.length) {
      const i = pending.pop(), b = pieces[i], x = Math.floor(b.x/4), y = Math.floor(b.y/4), z = Math.floor(b.z/4);
      for (let dx=-2;dx<=2;dx++) for (let dy=-2;dy<=2;dy++) for (let dz=-2;dz<=2;dz++) {
        const neighbors = bins.get((x+dx)+','+(y+dy)+','+(z+dz)) || [];
        for (const j of neighbors) if (!reached.has(j) && touches(boxes[i],boxes[j])) { reached.add(j); pending.push(j); }
      }
    }
    let count=0;
    pieces.forEach((b,i) => { if (!reached.has(i)) { b.dead=true; b.hp=0; count++; this._emit('destroy',b.x,b.y,b.z,{buildId:b.id,unsupported:true}); } });
    if (count) this._bumpBuilds();
    return count;
  };
  const previousStep = P.step;
  P.step = function (dt) {
    const result = previousStep.call(this,dt);
    if (this._collapseRev !== this._buildsRev && (this._clock || 0) >= (this._collapseAt || 0)) {
      this.collapseUnsupported(); this._collapseRev=this._buildsRev; this._collapseAt=(this._clock || 0)+.2;
    }
    return result;
  };
  root.AZBuildRules = {expand, compress, valid, quadrants, bounds, touches};
})(typeof globalThis !== 'undefined' ? globalThis : this);
