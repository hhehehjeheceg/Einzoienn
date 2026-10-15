/* Original inline illustrations: UI icons, equipment and inventory. */
(function (root) {
  "use strict";
  const svg = (body, view = "0 0 64 64", cls = "") =>
    `<svg class="az-icon ${cls}" viewBox="${view}" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
  const paths = {
    play: "M9 5l13 11-13 11V5Z",
    locker: "M5 6h22v22H5V6ZM16 6v22M11 14v5m10-5v5",
    shop: "M4 12l3-7h18l3 7M6 13v14h20V13M4 12c0 5 8 5 8 0 0 5 8 5 8 0 0 5 8 5 8 0M13 27v-9h6v9",
    quests: "M10 5h17v24H5V5h5m0-2h12v5H10V3m1 11h11m-11 6h11",
    pass: "M16 3l11 5v8c0 7-11 13-11 13S5 23 5 16V8l11-5Z",
    settings:
      "M16 10a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm0-7v4m0 18v4M3 16h4m18 0h4M7 7l3 3m12 12 3 3M7 25l3-3M22 10l3-3",
    map: "m3 7 8-4 10 4 8-4v23l-8 4-10-4-8 4V7Zm8-4v23M21 7v23",
    build: "m3 23 13-18 13 18M7 18v11h18V18M16 5v24M7 22h18",
    creative: "M4 5h10v10H4V5Zm14 0h10v10H18V5ZM4 19h10v10H4V19Zm14 0h10v10H18V19Z",
    users:
      "M12 4a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm-9 24v-4a9 9 0 0 1 18 0v4M22 5a5 5 0 0 1 0 10m2 4c4 1 5 4 5 9",
    solo: "M16 4a5 5 0 1 1 0 10 5 5 0 0 1 0-10ZM6 28v-4a10 10 0 0 1 20 0v4",
    sound: "m4 12 6 0 8-7v22l-8-7H4v-8Zm19-3c5 4 5 10 0 14m4-18c7 7 7 15 0 22",
    help: "M16 28a12 12 0 1 0 0-24 12 12 0 0 0 0 24Zm-3-16c0-5 9-5 8 0 0 3-5 3-5 7m0 4h.01",
    star: "m16 2 4.3 9 9.7 1.4-7 6.8 1.7 9.6-8.7-4.5-8.7 4.5L9 19.2l-7-6.8 9.7-1.4L16 2Z",
  };
  function icon(name) {
    return svg(
      `<path d="${paths[name] || paths.star}" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
      "0 0 32 32",
    );
  }
  function gun(key) {
    let b =
      '<path d="M10 28h36v9H10z" fill="#d5e7ee"/><path d="M23 36h8l-3 15h-6z" fill="#668aa1"/><path d="M8 28H2v8h9z" fill="#314f6a"/><path d="M44 31h15v3H44z" fill="#d5e7ee"/><path d="M33 23h6v6h-6z" fill="#91b9c6"/>';
    if (key === "pistol" || key === "revolver")
      b =
        '<path d="M16 23h36v10H29l-4 20H15l5-21h-4z" fill="#d7e9ee"/><path d="m22 34 7 0-4 18h-8z" fill="#69879a"/>';
    if (key === "sniper" || key === "dmr")
      b +=
        '<path d="M24 17h20v6H24zM3 32H0m49 0h15" stroke="#d5e7ee" stroke-width="3"/><rect x="29" y="13" width="6" height="3" rx="1" fill="#ffd38b"/>';
    if (key === "shotgun" || key === "tactical") b += '<rect x="37" y="35" width="19" height="5" rx="2" fill="#bd9069"/>';
    if (key === "launcher")
      b =
        '<rect x="4" y="23" width="53" height="17" rx="7" fill="#a8c3cd"/><ellipse cx="56" cy="31.5" rx="5" ry="8.5" fill="#31526b"/><path d="m23 39-2 10h9l2-10" fill="#647f90"/><rect x="18" y="20" width="21" height="3" fill="#f7cb76"/>';
    return svg(b, "0 0 64 64", "weapon-icon");
  }
  function inventory(it) {
    if (!it) return '<span class="empty-slot">+</span>';
    if (it.kind === "weapon") return gun(it.weapon);
    if (it.kind === "heal")
      return svg(
        '<rect x="12" y="17" width="40" height="34" rx="7" fill="#f5f1e3"/><path d="M24 17v-5h16v5" stroke="#f5f1e3" stroke-width="4"/><path d="M27 23h10v7h7v10h-7v7H27v-7h-7V30h7z" fill="#f07e6b"/>',
      );
    return svg(
      '<path d="M23 7h18v10l9 10v22c0 13-36 13-36 0V27l9-10V7Z" fill="#83e4ed"/><path d="M18 31h28v16c0 8-28 8-28 0V31Z" fill="#3b9fe0"/><path d="M22 7h20v7H22z" fill="#e6f9f2"/>',
    );
  }
  function cosmetic(x) {
    if (x.type === "character")
      return `<img src="./assets/${x.model || x.id}.webp" alt="Illustration originale de ${x.name.replace(/"/g, "")}" loading="lazy" draggable="false">`;
    if (x.type === "loading" || x.type === "pack")
      return '<img class="landscape-art" src="./assets/horizon.webp" alt="Illustration de l’île AZUR" loading="lazy">';
    let b = "";
    if (x.type === "wrap") return gun("rifle").replaceAll("#d5e7ee", x.color || "#38bdf8");
    if (x.type === "tool")
      b =
        '<path d="M22 54 40 15" stroke="#cadce4" stroke-width="5"/><path d="m17 19 9-9 31 12-10 6-14-8-11 5z" fill="currentColor"/><path d="m25 46 5 3-4 9-5-3z" fill="#324b65"/>';
    else if (x.type === "glider")
      b =
        '<path d="M3 24 31 8l30 16-18 8-12-5-12 5L3 24Z" fill="currentColor"/><path d="m15 28 13 23m21-23L36 51M31 9v18" stroke="#c5e9f0" stroke-width="2"/><path d="M26 51h12" stroke="currentColor" stroke-width="4"/>';
    else if (x.type === "back")
      b =
        '<rect x="14" y="13" width="36" height="43" rx="9" fill="currentColor"/><rect x="18" y="31" width="28" height="17" rx="4" fill="#2b5572"/><path d="M24 14v-4h16v4m-23 10h30m-25 4v9m20-9v9" stroke="#e2ebe0" stroke-width="3"/>';
    else if (x.type === "emote")
      b =
        '<g class="dancing-icon"><circle cx="32" cy="12" r="6" fill="currentColor"/><path d="m31 21-3 19-10 15m11-15 14 13m-13-29L15 32l-5-15m21 9 13 4 12-13" stroke="currentColor" stroke-width="6" stroke-linecap="round"/></g>';
    else if (x.type === "music")
      b =
        '<path d="M25 44V15l29-6v29M25 21l29-6" stroke="currentColor" stroke-width="5"/><ellipse cx="18" cy="47" rx="10" ry="7" fill="currentColor"/><ellipse cx="47" cy="41" rx="10" ry="7" fill="currentColor"/>';
    else if (x.type === "banner")
      b =
        '<path d="M18 59V6m2 3h33l-8 11 8 11H20" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>';
    else
      b =
        '<path d="m32 5 22 13v28L32 59 10 46V18L32 5Z" fill="currentColor"/><path d="m32 16 12 8v16l-12 8-12-8V24l12-8Z" stroke="#e3faff" stroke-width="2"/>';
    return svg(b, "0 0 64 64", "cosmetic-icon");
  }
  root.AZIcons = { icon, inventory, cosmetic, gun };
})(window);
