/* Midas : une arme touchée par Midas devient en or et le reste (au sol, chez un autre joueur).
 * node tests/unit/midas/midas-gold.test.cjs */
const assert = require('assert');
const path = require('path');
global.window = global;
const S = require(path.join(__dirname, '../../../azur-horizons/sim.js'));

function world() {
  const w = new S.World({ mode: 'solo', seed: 3, player: { id: 'p0', name: 'Midas', equipment: { character: 'char-midas' } } });
  w.step(1 / 30);
  return w;
}
const me = (w) => w.players.find((p) => p.id === 'p0');
const other = (w) => w.players.find((p) => p.id !== 'p0' && p.alive);
function place(w, p, x, z) { p.x = x; p.z = z; p.y = w.players[0].y; }
function lootAt(w, p, weapon) {
  const l = { id: 'test-' + weapon + '-' + w.loot.length, kind: 'weapon', weapon, rarity: 1, ammo: 10, reserve: 10, count: 0, gold: false, x: p.x, y: p.y + 0.2, z: p.z, dead: false };
  w.loot.push(l);
  return l;
}
function pickup(w, p) { p.inventory = p.inventory.filter(Boolean); w._pickup ? w._pickup(p) : w._interact(p); }

// 1. Midas ramasse une arme normale : elle devient en or
{
  const w = world(), m = me(w);
  m.inventory = [];
  lootAt(w, m, 'rifle');
  pickup(w, m);
  const it = m.inventory.find((i) => i && i.weapon === 'rifle');
  assert.ok(it, 'Midas a ramassé le fusil');
  assert.strictEqual(it.gold, true, 'le fusil ramassé par Midas est en or');
  // 2. Midas le jette : il reste en or au sol
  m.selected = m.inventory.indexOf(it);
  w._drop(m);
  const dropped = w.loot.filter((l) => !l.dead && l.weapon === 'rifle').pop();
  assert.ok(dropped && dropped.gold === true, "l'arme jetée par Midas est en or au sol");
  // 3. Un autre joueur la ramasse : toujours en or
  const o = other(w);
  o.equipment = { character: 'char-kai' };
  o.inventory = [];
  place(w, o, dropped.x, dropped.z); o.y = dropped.y - 0.2;
  pickup(w, o);
  const it2 = o.inventory.find((i) => i && i.weapon === 'rifle');
  assert.ok(it2, "l'autre joueur a ramassé le fusil");
  assert.strictEqual(it2.gold, true, 'le fusil est toujours en or chez un autre joueur');
  // 4. Il le jette à son tour : encore en or
  o.selected = o.inventory.indexOf(it2);
  w._drop(o);
  const again = w.loot.filter((l) => !l.dead && l.weapon === 'rifle').pop();
  assert.ok(again && again.gold === true, 'toujours en or après un deuxième lâcher');
}
// 5. Un joueur normal qui ramasse une arme neuve : pas en or
{
  const w = world(), o = other(w);
  o.equipment = { character: 'char-kai' };
  o.inventory = [];
  lootAt(w, o, 'shotgun');
  pickup(w, o);
  const it = o.inventory.find((i) => i && i.weapon === 'shotgun');
  assert.ok(it, 'pompe ramassé');
  assert.ok(!it.gold, "une arme neuve ramassée par un joueur normal n'est pas en or");
}
// 6. Arme reçue autrement (coffre, pêche…) : dorée dès la mise à jour suivante
{
  const w = world(), m = me(w);
  m.inventory = [{ kind: 'weapon', weapon: 'smg', rarity: 0, ammo: 20, reserve: 0, id: 'x' }, { kind: 'heal', count: 2, id: 'y' }];
  w._updatePlayer(m, 1 / 30);
  assert.strictEqual(m.inventory[0].gold, true, "l'arme du coffre devient en or");
  assert.ok(!m.inventory[1].gold, 'les soins ne deviennent pas en or');
}
console.log('midas-gold: OK (6 cas)');
