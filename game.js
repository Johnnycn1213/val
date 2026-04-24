const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const roleStatusEl = document.getElementById("role-status");
const swapRolesBtn = document.getElementById("swap-roles");
const resetSeriesBtn = document.getElementById("reset-series");
const fullscreenBtn = document.getElementById("fullscreen-toggle");
const player1ModeEl = document.getElementById("player1-mode");
const player2ModeEl = document.getElementById("player2-mode");
const gameShellEl = document.getElementById("game-shell");

const WIDTH = 1920;
const HEIGHT = 1080;
const MATCH_TARGET = 3;
const PREP_TIME_FRAMES = 20 * 60;
const ROUND_TIME_FRAMES = 100 * 60;
const PLAYER_W = 44;
const PLAYER_H = 78;
const CROUCH_H = 58;
const DOOR_W = 34;
const DOOR_H = 106;
const STAIR_TRAVEL_FRAMES = 425 / 2;
const ELEVATOR_SPEED = (3.4 / 9) * 4;
const ELEVATOR_CAR_W = 84;
const ELEVATOR_CAR_H = 132;
const BREACH_COUNTDOWN_FRAMES = 3 * 60;
const BREACH_BLAST_RADIUS = 132;
const AI_VISIBLE_MEMORY_FRAMES = 300;
const AI_SOUND_MEMORY_FRAMES = 210;
const AI_ACTION_COMMIT_FRAMES = {
  fight: 18,
  retreat: 44,
  heal: 54,
  seal: 42,
  deploy: 48,
  hold: 26,
};
const AI_THREAT_CONFIDENCE_DECAY = 0.985;
const AI_PASSAGE_DOOR_FRAMES = 90;
const AI_SOUND_EVENT_TTL = 200;
const AI_INTEL_EVENT_TTL = 110;
const AI_DEFAULT_DIFFICULTY = "normal";
const AI_STATE_LOCK_FRAMES = {
  Patrol: 44,
  Search: 42,
  Alert: 36,
  Engage: 22,
  TakeCover: 34,
  Flank: 54,
  Retreat: 50,
  Defend: 40,
  Breach: 42,
};
const AI_DIFFICULTY_PRESETS = {
  easy: {
    visionRange: 470,
    frontalFovDeg: 76,
    peripheralFovDeg: 36,
    hearingScale: 0.86,
    reactionMin: 14,
    reactionMax: 30,
    searchPatience: 130,
    tacticalRate: 0.66,
    teamwork: 0.54,
  },
  normal: {
    visionRange: 560,
    frontalFovDeg: 92,
    peripheralFovDeg: 48,
    hearingScale: 1,
    reactionMin: 8,
    reactionMax: 16,
    searchPatience: 168,
    tacticalRate: 1,
    teamwork: 0.8,
  },
  hard: {
    visionRange: 650,
    frontalFovDeg: 108,
    peripheralFovDeg: 58,
    hearingScale: 1.18,
    reactionMin: 4,
    reactionMax: 10,
    searchPatience: 220,
    tacticalRate: 1.24,
    teamwork: 1,
  },
};

const gameKeys = new Set([
  "w",
  "a",
  "s",
  "d",
  "f",
  "g",
  "q",
  "o",
  "k",
  "l",
  "r",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

const keysDown = new Set();
const keysPressed = new Set();
const aiSoundEvents = [];
const aiIntelEvents = [];

const buildingRect = { x: 52, y: 64, w: 1816, h: 960 };
const floorLevels = [1018, 772, 526, 280];
const floorBounds = [
  { minX: 24, maxX: 1896 },
  { minX: buildingRect.x + 34, maxX: buildingRect.x + buildingRect.w - 34 },
  { minX: buildingRect.x + 34, maxX: buildingRect.x + buildingRect.w - 34 },
  { minX: buildingRect.x + 34, maxX: buildingRect.x + buildingRect.w - 34 },
];
const stairShaft = {
  x1: buildingRect.x + 94,
  x2: buildingRect.x + 300,
};
const elevatorShaft = {
  x1: buildingRect.x + buildingRect.w - 192,
  x2: buildingRect.x + buildingRect.w - 64,
  carW: ELEVATOR_CAR_W,
  carH: ELEVATOR_CAR_H,
};
const stairSegments = [
  {
    lowerFloor: 0,
    side: "left",
    bottomX: buildingRect.x + 134,
    topX: buildingRect.x + 268,
    zoneX1: stairShaft.x1,
    zoneX2: stairShaft.x2,
  },
  {
    lowerFloor: 2,
    side: "left",
    bottomX: buildingRect.x + 134,
    topX: buildingRect.x + 268,
    zoneX1: stairShaft.x1,
    zoneX2: stairShaft.x2,
  },
  {
    lowerFloor: 1,
    side: "right",
    bottomX: elevatorShaft.x1 - 36,
    topX: elevatorShaft.x1 - 154,
    zoneX1: elevatorShaft.x1 - 192,
    zoneX2: elevatorShaft.x1 - 8,
  },
];
const objectiveZone = {
  x: buildingRect.x + 1326,
  y: floorLevels[3] - 90,
  w: 148,
  h: 90,
  floor: 3,
  label: "Vault Core",
};

const floorThemes = [
  { label: "Dock", accent: "#ffb36b", glow: "rgba(255, 179, 107, 0.16)", line: "#6b4934" },
  { label: "Habitat", accent: "#95ffb5", glow: "rgba(149, 255, 181, 0.14)", line: "#426556" },
  { label: "Systems", accent: "#76c9ff", glow: "rgba(118, 201, 255, 0.14)", line: "#35546d" },
  { label: "Command", accent: "#ffd76b", glow: "rgba(255, 215, 107, 0.14)", line: "#5c493b" },
];

/*
const legacyRoomSections = [
  { floor: 0, x: 432, w: 164, kind: "marketHall", title: "前厅集市", wall: "#ead7c4", accent: "#ff9e63", line: "#694932" },
  { floor: 0, x: 624, w: 240, kind: "machineShop", title: "热锻工坊", wall: "#ddd8cf", accent: "#ff8e58", line: "#5d4739" },
  { floor: 0, x: 892, w: 258, kind: "storageDeck", title: "调度仓", wall: "#d4dde2", accent: "#76c9ff", line: "#476276" },
  { floor: 1, x: 432, w: 182, kind: "archiveBay", title: "档案廊", wall: "#ebe2d3", accent: "#ffd76b", line: "#625141" },
  { floor: 1, x: 642, w: 248, kind: "greenhouseBay", title: "空中温室", wall: "#d8e6d7", accent: "#95ffb5", line: "#446656" },
  { floor: 1, x: 918, w: 232, kind: "studioBay", title: "样机展厅", wall: "#dbe5ed", accent: "#76c9ff", line: "#40556a" },
  { floor: 2, x: 432, w: 170, kind: "signalNest", title: "观测台", wall: "#d9e3eb", accent: "#76c9ff", line: "#32475d" },
  { floor: 2, x: 630, w: 284, kind: "commandBay", title: "中枢甲板", wall: "#ece4d6", accent: "#ffd76b", line: "#5b493c" },
  { floor: 2, x: 942, w: 208, kind: "coolantBay", title: "冷却列", wall: "#d6e2e2", accent: "#8ee9e4", line: "#38545f" },
];

*/
const roomSections = [
  { id: "street", floor: 0, x: buildingRect.x + 82, w: 196, kind: "streetGate", title: "Street Gate", wall: "#d9c7b6", accent: "#ffb36b", line: "#6b4934" },
  { id: "lobby", floor: 0, x: buildingRect.x + 306, w: 214, kind: "lobbyBay", title: "Intake", wall: "#ded3c6", accent: "#ffb36b", line: "#6b4934" },
  { id: "forge", floor: 0, x: buildingRect.x + 548, w: 244, kind: "machineShop", title: "Repair Line", wall: "#d7d2cb", accent: "#ff8e58", line: "#5d4739" },
  { id: "triage", floor: 0, x: buildingRect.x + 820, w: 210, kind: "medBay", title: "Triage", wall: "#dbe0da", accent: "#95ffb5", line: "#466453" },
  { id: "freight", floor: 0, x: buildingRect.x + 1058, w: 252, kind: "loadingBay", title: "Freight", wall: "#d1d9df", accent: "#76c9ff", line: "#476276" },
  { id: "security", floor: 0, x: buildingRect.x + 1338, w: 184, kind: "securityBay", title: "Scanner", wall: "#d8e1e7", accent: "#ffd76b", line: "#5c493b" },
  { id: "leftHab", floor: 1, x: buildingRect.x + 320, w: 218, kind: "bunkBay", title: "Bunks", wall: "#e2d8c9", accent: "#ffd76b", line: "#625141" },
  { id: "clinic", floor: 1, x: buildingRect.x + 566, w: 214, kind: "medBay", title: "Clinic", wall: "#dde5dc", accent: "#95ffb5", line: "#426556" },
  { id: "garden", floor: 1, x: buildingRect.x + 808, w: 286, kind: "greenhouseBay", title: "Grow Room", wall: "#d7e3d3", accent: "#95ffb5", line: "#446656" },
  { id: "commons", floor: 1, x: buildingRect.x + 1122, w: 236, kind: "loungeBay", title: "Commons", wall: "#e0d8cc", accent: "#ffb36b", line: "#665645" },
  { id: "eastHab", floor: 1, x: buildingRect.x + 1386, w: 186, kind: "bunkBay", title: "East Hall", wall: "#dfe2d7", accent: "#ffd76b", line: "#625141" },
  { id: "opsWest", floor: 2, x: buildingRect.x + 318, w: 228, kind: "signalNest", title: "Listening", wall: "#d7e1e9", accent: "#76c9ff", line: "#32475d" },
  { id: "server", floor: 2, x: buildingRect.x + 574, w: 254, kind: "serverBay", title: "Server Row", wall: "#d8dee4", accent: "#76c9ff", line: "#35546d" },
  { id: "control", floor: 2, x: buildingRect.x + 856, w: 264, kind: "controlBay", title: "Ops Table", wall: "#e3dacd", accent: "#ffd76b", line: "#5b493c" },
  { id: "coolant", floor: 2, x: buildingRect.x + 1148, w: 220, kind: "coolantBay", title: "Coolant", wall: "#d4e0df", accent: "#8ee9e4", line: "#38545f" },
  { id: "bridge", floor: 2, x: buildingRect.x + 1396, w: 180, kind: "securityBay", title: "East Bridge", wall: "#d9e3eb", accent: "#76c9ff", line: "#38516a" },
  { id: "armory", floor: 3, x: buildingRect.x + 312, w: 222, kind: "armoryBay", title: "Armory", wall: "#ded6ca", accent: "#ffb36b", line: "#6b4934" },
  { id: "briefing", floor: 3, x: buildingRect.x + 562, w: 254, kind: "controlBay", title: "Briefing", wall: "#e7ddcf", accent: "#ffd76b", line: "#5b493c" },
  { id: "vaultCore", floor: 3, x: buildingRect.x + 844, w: 326, kind: "commandBay", title: "Vault Core", wall: "#ebe0d0", accent: "#ffd76b", line: "#5c493b" },
  { id: "relay", floor: 3, x: buildingRect.x + 1198, w: 230, kind: "signalNest", title: "Relay", wall: "#dce6ed", accent: "#76c9ff", line: "#38516a" },
  { id: "panicRoom", floor: 3, x: buildingRect.x + 1456, w: 158, kind: "safeRoom", title: "Panic", wall: "#d8dedf", accent: "#8ee9e4", line: "#38545f" },
];

/*
const legacyCoverTemplates = [
  { floor: 0, x: 188, w: 112, h: 130, kind: "streetBooth", color: "#24384d", accent: "#ffd76b", edge: "#ffe2a4" },
  { floor: 0, x: 536, w: 168, h: 102, kind: "forgeBench", color: "#344d60", accent: "#ff9e63", edge: "#ffd4b0" },
  { floor: 0, x: 906, w: 70, h: 98, kind: "utilityCart", color: "#2c3f55", accent: "#76c9ff", edge: "#b9e3ff" },
  { floor: 0, x: 1220, w: 114, h: 126, kind: "serviceLocker", color: "#25354a", accent: "#ffd76b", edge: "#ffe6b8" },
  { floor: 1, x: 448, w: 72, h: 102, kind: "archiveKiosk", color: "#314458", accent: "#ffd76b", edge: "#ffe2a4" },
  { floor: 1, x: 820, w: 170, h: 106, kind: "hydroponicRack", color: "#34584f", accent: "#95ffb5", edge: "#d5ffe3" },
  { floor: 1, x: 1152, w: 118, h: 132, kind: "displayCabinet", color: "#2d4258", accent: "#76c9ff", edge: "#d7f2ff" },
  { floor: 2, x: 610, w: 196, h: 112, kind: "commandConsole", color: "#2f4157", accent: "#ffd76b", edge: "#ffe2a4" },
  { floor: 2, x: 1018, w: 70, h: 98, kind: "coolantTank", color: "#35545f", accent: "#8ee9e4", edge: "#d8fffb" },
  { floor: 2, x: 1144, w: 122, h: 132, kind: "serverRack", color: "#26384d", accent: "#76c9ff", edge: "#d7f2ff" },
];

*/
const backgroundPropTemplates = [
  { floor: 0, x: buildingRect.x + 224, w: 86, h: 96, kind: "serviceLocker", color: "#4d5b64", accent: "#ffb36b", edge: "rgba(255,255,255,0.1)" },
  { floor: 0, x: buildingRect.x + 646, w: 132, h: 76, kind: "forgeBench", color: "#5a554c", accent: "#ff8e58", edge: "rgba(255,255,255,0.1)" },
  { floor: 0, x: buildingRect.x + 928, w: 82, h: 72, kind: "archiveKiosk", color: "#52615c", accent: "#95ffb5", edge: "rgba(255,255,255,0.1)" },
  { floor: 0, x: buildingRect.x + 1184, w: 96, h: 88, kind: "utilityCart", color: "#4c5c69", accent: "#76c9ff", edge: "rgba(255,255,255,0.1)" },
  { floor: 0, x: buildingRect.x + 1428, w: 82, h: 94, kind: "displayCabinet", color: "#4e5d66", accent: "#ffd76b", edge: "rgba(255,255,255,0.1)" },
  { floor: 1, x: buildingRect.x + 422, w: 74, h: 88, kind: "serviceLocker", color: "#5b554b", accent: "#ffd76b", edge: "rgba(255,255,255,0.1)" },
  { floor: 1, x: buildingRect.x + 706, w: 90, h: 82, kind: "archiveKiosk", color: "#50635a", accent: "#95ffb5", edge: "rgba(255,255,255,0.1)" },
  { floor: 1, x: buildingRect.x + 938, w: 136, h: 84, kind: "hydroponicRack", color: "#536a5a", accent: "#95ffb5", edge: "rgba(255,255,255,0.1)" },
  { floor: 1, x: buildingRect.x + 1248, w: 92, h: 78, kind: "displayCabinet", color: "#5c5a50", accent: "#ffb36b", edge: "rgba(255,255,255,0.1)" },
  { floor: 1, x: buildingRect.x + 1468, w: 70, h: 94, kind: "serviceLocker", color: "#5f5b50", accent: "#ffd76b", edge: "rgba(255,255,255,0.1)" },
  { floor: 2, x: buildingRect.x + 430, w: 92, h: 80, kind: "archiveKiosk", color: "#4d5c68", accent: "#76c9ff", edge: "rgba(255,255,255,0.1)" },
  { floor: 2, x: buildingRect.x + 696, w: 92, h: 100, kind: "serverRack", color: "#465765", accent: "#76c9ff", edge: "rgba(255,255,255,0.1)" },
  { floor: 2, x: buildingRect.x + 982, w: 142, h: 78, kind: "commandConsole", color: "#575b5e", accent: "#ffd76b", edge: "rgba(255,255,255,0.1)" },
  { floor: 2, x: buildingRect.x + 1260, w: 68, h: 96, kind: "coolantTank", color: "#4f6265", accent: "#8ee9e4", edge: "rgba(255,255,255,0.1)" },
  { floor: 2, x: buildingRect.x + 1478, w: 74, h: 82, kind: "utilityCart", color: "#4c5c69", accent: "#76c9ff", edge: "rgba(255,255,255,0.1)" },
  { floor: 3, x: buildingRect.x + 444, w: 92, h: 92, kind: "serviceLocker", color: "#5d514a", accent: "#ffb36b", edge: "rgba(255,255,255,0.1)" },
  { floor: 3, x: buildingRect.x + 718, w: 148, h: 78, kind: "commandConsole", color: "#5c5853", accent: "#ffd76b", edge: "rgba(255,255,255,0.1)" },
  { floor: 3, x: buildingRect.x + 1006, w: 86, h: 108, kind: "serverRack", color: "#4c5962", accent: "#ffd76b", edge: "rgba(255,255,255,0.1)" },
  { floor: 3, x: buildingRect.x + 1306, w: 76, h: 92, kind: "serverRack", color: "#4a5f6c", accent: "#76c9ff", edge: "rgba(255,255,255,0.1)" },
  { floor: 3, x: buildingRect.x + 1516, w: 68, h: 96, kind: "coolantTank", color: "#4f6265", accent: "#8ee9e4", edge: "rgba(255,255,255,0.1)" },
];

const coverTemplates = [];

/*
const legacyDoorTemplates = [
  { id: "entry", floor: 0, x: 318, open: false, fortified: true },
  { id: "ground-west", floor: 0, x: 706, open: true, fortified: false },
  { id: "ground-east", floor: 0, x: 1088, open: false, fortified: true },
  { id: "mid-west", floor: 1, x: 556, open: false, fortified: false },
  { id: "mid-east", floor: 1, x: 1012, open: false, fortified: true },
  { id: "top-west", floor: 2, x: 696, open: false, fortified: false },
  { id: "top-east", floor: 2, x: 946, open: false, fortified: true },
];

*/
const doorTemplates = [
  { id: "entry-west", floor: 0, x: buildingRect.x + 74, open: false, fortified: true },
  { id: "ground-west", floor: 0, x: buildingRect.x + 532, open: true, fortified: false },
  { id: "ground-mid", floor: 0, x: buildingRect.x + 804, open: true, fortified: false },
  { id: "ground-east", floor: 0, x: buildingRect.x + 1322, open: false, fortified: true },
  { id: "entry-east", floor: 0, x: buildingRect.x + buildingRect.w - 54, open: false, fortified: true },
  { id: "mid-west", floor: 1, x: buildingRect.x + 550, open: false, fortified: false },
  { id: "mid-mid", floor: 1, x: buildingRect.x + 1106, open: true, fortified: false },
  { id: "mid-east", floor: 1, x: buildingRect.x + 1370, open: false, fortified: true },
  { id: "upper-west", floor: 2, x: buildingRect.x + 558, open: false, fortified: false },
  { id: "upper-mid", floor: 2, x: buildingRect.x + 1132, open: true, fortified: false },
  { id: "upper-east", floor: 2, x: buildingRect.x + 1380, open: false, fortified: true },
  { id: "crown-west", floor: 3, x: buildingRect.x + 828, open: false, fortified: false },
  { id: "crown-mid", floor: 3, x: buildingRect.x + 1182, open: true, fortified: false },
  { id: "crown-east", floor: 3, x: buildingRect.x + 1446, open: false, fortified: true },
];

const weaponCatalog = {
  rifle: {
    label: "突击步枪",
    cooldown: 6,
    speed: 28,
    damage: 14,
    doorDamage: 5,
    pellets: 1,
    spread: 0.02,
    ttl: 48,
    color: "#ffd76b",
    trail: "#fff0bf",
  },
  breacher: {
    label: "破门霰弹枪",
    cooldown: 18,
    speed: 20,
    damage: 3,
    doorDamage: 6,
    pellets: 6,
    spread: 0.24,
    ttl: 8,
    color: "#ffae5d",
    trail: "#ffd7ae",
  },
  smg: {
    label: "守卫冲锋枪",
    cooldown: 8,
    speed: 24,
    damage: 10,
    doorDamage: 4,
    pellets: 1,
    spread: 0.05,
    ttl: 42,
    color: "#76c9ff",
    trail: "#d7f2ff",
  },
  turret: {
    label: "炮台连发",
    cooldown: 18,
    speed: 22,
    damage: 7,
    doorDamage: 3,
    pellets: 1,
    spread: 0.01,
    ttl: 40,
    color: "#95ffb5",
    trail: "#ddffe7",
  },
};

const gadgetNames = {
  trap: "震撼雷",
  turret: "自动炮台",
  barricade: "路障盾板",
};

const supplyCachePool = [
  { id: "cache-med-a", type: "med", accent: "#95ffb5" },
  { id: "cache-breach-a", type: "breach", accent: "#ffd76b" },
  { id: "cache-tools-a", type: "tools", accent: "#76c9ff" },
  { id: "cache-med-b", type: "med", accent: "#8ee9e4" },
];

const bullets = [];
const effects = [];
let mines = [];
let turrets = [];
let barricades = [];
let doors = [];
let breachCharges = [];
let supplyCaches = [];

let rolePreset = "xiaoxiao-attack";
let roundTimer = ROUND_TIME_FRAMES;
let prepTimer = PREP_TIME_FRAMES;
let roundPhase = "prep";
let captureProgress = 0;
let roundOver = false;
let matchOver = false;
let roundWinner = null;
let roundReason = "";
let message = { text: "切换攻守后会重开整场", timer: 220 };
let lastTime = 0;
let capturePulse = 0;
let elevator = null;

let audioContext = null;
let masterGain = null;
let masterCompressor = null;
let masterStereoMerger = null;
let noiseBuffer = null;
let audioUnlocked = false;
let pendingRoundStartCue = false;

function normalizeKey(key) {
  return key.length === 1 ? key.toLowerCase() : key;
}

function getFloorTheme(floor) {
  return floorThemes[floor] || floorThemes[0];
}

function getFloorInteriorRect(floor) {
  const top = floor === floorLevels.length - 1 ? buildingRect.y + 42 : floorLevels[floor + 1] + 28;
  return {
    x: buildingRect.x + 94,
    y: top,
    w: buildingRect.w - 188,
    h: floorLevels[floor] - top - 18,
  };
}

function fillRoundedPanel(x, y, w, h, radius, fillStyle, strokeStyle = null, lineWidth = 2) {
  roundRect(x, y, w, h, radius);
  ctx.fillStyle = fillStyle;
  ctx.fill();

  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function drawAccentStrip(x, y, w, color, alpha = 0.75) {
  ctx.save();
  ctx.globalAlpha = alpha;
  fillRoundedPanel(x, y, w, 6, 3, color);
  ctx.restore();
}

function drawVentSlots(x, y, w, count, color) {
  const gap = w / count;
  for (let i = 0; i < count; i += 1) {
    fillRoundedPanel(x + 3 + i * gap, y, gap - 6, 5, 2, color);
  }
}

function drawScreenPanel(x, y, w, h, glow) {
  fillRoundedPanel(x, y, w, h, 8, "#122234", "rgba(255,255,255,0.08)", 1.5);
  const glass = ctx.createLinearGradient(x, y, x, y + h);
  glass.addColorStop(0, "rgba(255,255,255,0.18)");
  glass.addColorStop(0.2, glow);
  glass.addColorStop(1, "rgba(7, 17, 29, 0.95)");
  fillRoundedPanel(x + 4, y + 4, w - 8, h - 8, 5, glass);

  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  for (let scanY = y + 10; scanY < y + h - 8; scanY += 8) {
    ctx.beginPath();
    ctx.moveTo(x + 8, scanY);
    ctx.lineTo(x + w - 8, scanY);
    ctx.stroke();
  }
}

function drawGauge(x, y, radius, color) {
  ctx.fillStyle = "#0d1a28";
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, radius - 4, Math.PI * 0.9, Math.PI * 1.7);
  ctx.stroke();

  ctx.strokeStyle = "#eef4ff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + radius * 0.45, y - radius * 0.35);
  ctx.stroke();
}

function drawPlantCluster(x, y, w, h) {
  ctx.fillStyle = "#325644";
  ctx.fillRect(x + 8, y + h - 18, w - 16, 10);
  ctx.fillStyle = "#24352d";
  ctx.fillRect(x + 12, y + h - 8, w - 24, 6);

  for (let i = 0; i < 4; i += 1) {
    const baseX = x + 22 + i * ((w - 44) / 3);
    const stemTop = y + 14 + (i % 2) * 10;
    ctx.strokeStyle = "#5d8d68";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(baseX, y + h - 18);
    ctx.lineTo(baseX, stemTop);
    ctx.stroke();

    ctx.fillStyle = i % 2 === 0 ? "#95ffb5" : "#6ccf82";
    ctx.beginPath();
    ctx.ellipse(baseX - 8, stemTop + 12, 8, 18, -0.5, 0, Math.PI * 2);
    ctx.ellipse(baseX + 8, stemTop + 10, 8, 18, 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawExteriorWindow(x, y, w, h, glow = "rgba(118, 201, 255, 0.7)") {
  fillRoundedPanel(x, y, w, h, 10, "#132538", "#96b6cf", 2);
  const glass = ctx.createLinearGradient(x, y, x + w, y + h);
  glass.addColorStop(0, "rgba(255,255,255,0.28)");
  glass.addColorStop(0.3, glow);
  glass.addColorStop(1, "rgba(13, 30, 46, 0.94)");
  fillRoundedPanel(x + 4, y + 4, w - 8, h - 8, 7, glass);

  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(x + w / 2 - 2, y + 10, 4, h - 20);
  ctx.fillRect(x + 10, y + h / 2 - 2, w - 20, 4);
}

function drawSceneDoor(x, y, w, h, { fortified = false, open = false, destroyed = false, accent = "#76c9ff", exterior = false } = {}) {
  fillRoundedPanel(x - 6, y - 6, w + 12, h + 12, 9, "rgba(0,0,0,0.18)");
  fillRoundedPanel(x, y, w, h, 7, exterior ? "#26384c" : "#1c2d40", destroyed ? "rgba(255,174,93,0.22)" : fortified ? accent : "rgba(255,255,255,0.14)", fortified ? 2.5 : 1.5);

  if (destroyed) {
    fillRoundedPanel(x + 3, y + 3, w - 6, h - 6, 5, "rgba(5, 12, 20, 0.94)");
    ctx.strokeStyle = "rgba(255, 206, 118, 0.42)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 16);
    ctx.lineTo(x + w - 9, y + 38);
    ctx.moveTo(x + 9, y + h - 24);
    ctx.lineTo(x + w - 7, y + h - 48);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 174, 93, 0.52)";
    ctx.fillRect(x + 5, y + h - 12, w - 10, 5);
    return;
  }

  if (open) {
    fillRoundedPanel(x + 4, y + 4, w - 8, h - 8, 5, "rgba(5, 12, 20, 0.92)");
    fillRoundedPanel(x + w - 9, y + 8, 11, h - 16, 4, "rgba(146, 173, 197, 0.28)", "rgba(255,255,255,0.1)", 1);
    drawAccentStrip(x + 8, y + 8, w - 16, accent, 0.35);
    return;
  }

  const leafColor = fortified ? "#56697d" : "#64798f";
  fillRoundedPanel(x + 2, y + 2, w - 4, h - 4, 5, leafColor);

  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(x + 5, y + 10, w - 10, 4);
  ctx.fillStyle = "rgba(0,0,0,0.14)";
  ctx.fillRect(x + 5, y + h - 14, w - 10, 4);
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fillRect(x + w / 2 - 1, y + 12, 2, h - 24);
  fillRoundedPanel(x + w - 10, y + h / 2 - 10, 4, 20, 2, "#dfe5ea");
  drawAccentStrip(x + 6, y + 6, w - 12, accent, 0.85);

  if (fortified) {
    ctx.fillStyle = "rgba(255, 215, 107, 0.48)";
    ctx.fillRect(x + 4, y + 22, w - 8, 7);
    ctx.fillRect(x + 4, y + h / 2 - 4, w - 8, 7);
    ctx.fillRect(x + 4, y + h - 29, w - 8, 7);
  }
}

function drawShadowEllipse(x, y, rx, ry, alpha = 0.15) {
  ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function ensureAudioReady() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return false;
  }

  if (!audioContext) {
    audioContext = new AudioContextClass();
    masterCompressor = audioContext.createDynamicsCompressor();
    masterCompressor.threshold.value = -30;
    masterCompressor.knee.value = 24;
    masterCompressor.ratio.value = 8;
    masterCompressor.attack.value = 0.001;
    masterCompressor.release.value = 0.28;

    masterGain = audioContext.createGain();
    masterGain.gain.value = 10;

    masterStereoMerger = audioContext.createChannelMerger(2);
    masterGain.connect(masterStereoMerger, 0, 0);
    masterGain.connect(masterStereoMerger, 0, 1);
    masterStereoMerger.connect(masterCompressor);
    masterCompressor.connect(audioContext.destination);

    noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 1.5, audioContext.sampleRate);
    const channel = noiseBuffer.getChannelData(0);
    for (let i = 0; i < channel.length; i += 1) {
      channel[i] = Math.random() * 2 - 1;
    }
  }

  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }

  audioUnlocked = true;
  if (pendingRoundStartCue) {
    pendingRoundStartCue = false;
    playRoundStartSound();
  }
  return true;
}

function createAudioBus() {
  if (!audioUnlocked || !audioContext || !masterGain) {
    return null;
  }

  const gain = audioContext.createGain();
  gain.connect(masterGain);
  return gain;
}

function shapeEnvelope(gainNode, startTime, duration, volume, attack = 0.003) {
  gainNode.gain.cancelScheduledValues(startTime);
  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0001), startTime + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
}

function playTone({
  type = "square",
  startFrequency,
  endFrequency,
  duration,
  volume,
  attack = 0.003,
  delay = 0,
  detune = 0,
  linearRamp = false,
}) {
  const gain = createAudioBus();
  if (!gain) {
    return;
  }

  const startTime = audioContext.currentTime + delay;
  const oscillator = audioContext.createOscillator();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(startFrequency, startTime);
  oscillator.detune.value = detune;

  if (endFrequency) {
    if (linearRamp) {
      oscillator.frequency.linearRampToValueAtTime(endFrequency, startTime + duration);
    } else {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), startTime + duration);
    }
  }

  oscillator.connect(gain);
  shapeEnvelope(gain, startTime, duration, volume, attack);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.05);
}

function playNoise({
  duration,
  volume,
  delay = 0,
  attack = 0.002,
  highpass = 500,
  lowpass = 4000,
}) {
  if (!audioUnlocked || !audioContext || !masterGain || !noiseBuffer) {
    return;
  }

  const gain = createAudioBus();
  if (!gain) {
    return;
  }

  const startTime = audioContext.currentTime + delay;
  const source = audioContext.createBufferSource();
  source.buffer = noiseBuffer;

  const highpassFilter = audioContext.createBiquadFilter();
  highpassFilter.type = "highpass";
  highpassFilter.frequency.setValueAtTime(highpass, startTime);

  const lowpassFilter = audioContext.createBiquadFilter();
  lowpassFilter.type = "lowpass";
  lowpassFilter.frequency.setValueAtTime(lowpass, startTime);

  source.connect(highpassFilter);
  highpassFilter.connect(lowpassFilter);
  lowpassFilter.connect(gain);

  shapeEnvelope(gain, startTime, duration, volume, attack);
  source.start(startTime);
  source.stop(startTime + duration + 0.04);
}

function playDoorSound() {
  playNoise({ duration: 0.05, volume: 0.18, highpass: 600, lowpass: 2200 });
  playTone({
    type: "square",
    startFrequency: 180,
    endFrequency: 110,
    duration: 0.08,
    volume: 0.22,
  });
}

function playBreachSound() {
  playNoise({ duration: 0.12, volume: 0.28, highpass: 180, lowpass: 1800 });
  playTone({
    type: "sawtooth",
    startFrequency: 210,
    endFrequency: 60,
    duration: 0.18,
    volume: 0.34,
  });
}

function playDeploySound() {
  playTone({
    type: "triangle",
    startFrequency: 420,
    endFrequency: 780,
    duration: 0.1,
    volume: 0.18,
  });
}

function playTrapSound() {
  playNoise({ duration: 0.14, volume: 0.26, highpass: 240, lowpass: 1800 });
  playTone({
    type: "triangle",
    startFrequency: 260,
    endFrequency: 70,
    duration: 0.18,
    volume: 0.28,
  });
}

function playHitSound() {
  playNoise({ duration: 0.04, volume: 0.1, highpass: 1800, lowpass: 5200 });
  playTone({
    type: "triangle",
    startFrequency: 180,
    endFrequency: 110,
    duration: 0.05,
    volume: 0.12,
  });
}

function playObjectiveSound() {
  playTone({
    type: "sine",
    startFrequency: 820,
    endFrequency: 1040,
    duration: 0.06,
    volume: 0.12,
  });
}

function playShootSound(weaponId) {
  if (weaponId === "rifle") {
    playNoise({ duration: 0.035, volume: 0.14, highpass: 1400, lowpass: 4200 });
    playTone({
      type: "square",
      startFrequency: 880,
      endFrequency: 320,
      duration: 0.07,
      volume: 0.26,
    });
    return;
  }

  if (weaponId === "breacher") {
    playNoise({ duration: 0.08, volume: 0.2, highpass: 700, lowpass: 2600 });
    playTone({
      type: "sawtooth",
      startFrequency: 360,
      endFrequency: 120,
      duration: 0.11,
      volume: 0.3,
    });
    return;
  }

  if (weaponId === "smg") {
    playNoise({ duration: 0.04, volume: 0.12, highpass: 1200, lowpass: 3600 });
    playTone({
      type: "triangle",
      startFrequency: 1260,
      endFrequency: 620,
      duration: 0.08,
      volume: 0.22,
    });
    return;
  }

  playNoise({ duration: 0.05, volume: 0.13, highpass: 1200, lowpass: 3600 });
  playTone({
    type: "triangle",
    startFrequency: 1080,
    endFrequency: 460,
    duration: 0.08,
    volume: 0.18,
  });
}

function playRoundStartSound() {
  if (!audioUnlocked) {
    pendingRoundStartCue = true;
    return;
  }

  playTone({
    type: "triangle",
    startFrequency: 280,
    endFrequency: 560,
    duration: 0.12,
    volume: 0.14,
  });
  playTone({
    type: "triangle",
    startFrequency: 560,
    endFrequency: 760,
    duration: 0.12,
    volume: 0.12,
    delay: 0.08,
  });
}

function playRoundWinSound() {
  playTone({
    type: "triangle",
    startFrequency: 420,
    endFrequency: 520,
    duration: 0.12,
    volume: 0.2,
  });
  playTone({
    type: "triangle",
    startFrequency: 520,
    endFrequency: 700,
    duration: 0.12,
    volume: 0.18,
    delay: 0.12,
  });
  playTone({
    type: "triangle",
    startFrequency: 700,
    endFrequency: 940,
    duration: 0.18,
    volume: 0.22,
    delay: 0.24,
  });
}

window.addEventListener("keydown", (event) => {
  const key = normalizeKey(event.key);
  if (!keysDown.has(key)) {
    keysPressed.add(key);
  }
  keysDown.add(key);

  if (gameKeys.has(key)) {
    ensureAudioReady();
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => {
  const key = normalizeKey(event.key);
  keysDown.delete(key);

  if (gameKeys.has(key)) {
    event.preventDefault();
  }
});

canvas.addEventListener("pointerdown", () => {
  ensureAudioReady();
});

function isDown(key) {
  return keysDown.has(key);
}

function isPressed(key) {
  return keysPressed.has(key);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

function getAiDifficultyLevel() {
  const params = new URLSearchParams(window.location.search);
  const level = params.get("aidifficulty");
  if (level && AI_DIFFICULTY_PRESETS[level]) {
    return level;
  }
  return AI_DEFAULT_DIFFICULTY;
}

function getAiTuning(player) {
  const params = new URLSearchParams(window.location.search);
  const playerKey = player?.id === "p1" ? "p1ai" : "p2ai";
  const playerLevel = params.get(playerKey);
  if (playerLevel && AI_DIFFICULTY_PRESETS[playerLevel]) {
    return AI_DIFFICULTY_PRESETS[playerLevel];
  }
  return AI_DIFFICULTY_PRESETS[getAiDifficultyLevel()] || AI_DIFFICULTY_PRESETS.normal;
}

function isAiDebugEnabled() {
  const params = new URLSearchParams(window.location.search);
  return params.get("aidebug") === "1";
}

function angleDiff(a, b) {
  let diff = a - b;
  while (diff > Math.PI) {
    diff -= Math.PI * 2;
  }
  while (diff < -Math.PI) {
    diff += Math.PI * 2;
  }
  return Math.abs(diff);
}

function getFacingAngle(player) {
  return player.facing >= 0 ? 0 : Math.PI;
}

function scoreCoverCandidate(player, threatX, cover) {
  const rect = getCoverRect(cover);
  const centerX = rect.x + rect.w / 2;
  const coveredLine = lineBlocked(threatX, floorLevels[player.floor] - 50, centerX, floorLevels[player.floor] - 50, player.floor);
  const distanceCost = Math.abs(centerX - player.x);
  const threatDistance = Math.abs(centerX - threatX);
  const sideBonus = Math.sign(centerX - threatX) === Math.sign(player.x - threatX) ? 42 : 0;
  const doorwayPenalty = doors.some((door) => door.floor === player.floor && Math.abs(door.x - centerX) < 76) ? 95 : 0;
  const stairPenalty = stairSegments.some(
    (segment) => (segment.lowerFloor === player.floor || segment.lowerFloor + 1 === player.floor)
      && Math.min(Math.abs(segment.bottomX - centerX), Math.abs(segment.topX - centerX)) < 86,
  )
    ? 88
    : 0;
  const score = (coveredLine ? 230 : 0) + Math.max(0, 240 - threatDistance) + sideBonus - distanceCost * 0.46 - doorwayPenalty - stairPenalty;
  return {
    floor: player.floor,
    x: clamp(centerX, floorBounds[player.floor].minX + PLAYER_W / 2, floorBounds[player.floor].maxX - PLAYER_W / 2),
    score,
    coveredLine,
  };
}

function getBestCoverPoint(player, threatFloor, threatX) {
  if (player.floor !== threatFloor) {
    return null;
  }
  const candidates = coverTemplates
    .filter((cover) => cover.floor === player.floor && cover.blocksBullets !== false)
    .map((cover) => scoreCoverCandidate(player, threatX, cover))
    .filter((candidate) => candidate.score > 10)
    .sort((a, b) => b.score - a.score);
  return candidates[0] || null;
}

function emitAiSoundEvent(type, source, radius = 280, confidence = 0.52) {
  if (!source || source.floor === null || source.floor === undefined) {
    return;
  }
  aiSoundEvents.push({
    type,
    ownerId: source.id || source.ownerId || null,
    sourceRole: source.role || source.ownerRole || "unknown",
    floor: source.floor,
    x: source.x,
    radius,
    confidence,
    ttl: AI_SOUND_EVENT_TTL,
  });
}

function queueAiIntel(source, kind, floor, x, confidence, reason) {
  if (!source || source.controlMode !== "ai") {
    return;
  }
  if ((source.aiState.intelCooldown || 0) > 0) {
    return;
  }
  const tuning = getAiTuning(source);
  aiIntelEvents.push({
    sourceId: source.id,
    role: source.role,
    kind,
    floor,
    x,
    confidence,
    reason,
    delay: Math.round(8 + (1 - tuning.teamwork) * 24),
    ttl: AI_INTEL_EVENT_TTL,
  });
  source.aiState.intelCooldown = Math.round(18 + (1 - tuning.teamwork) * 18);
}

function setAiFsmState(player, nextState, reason = "n/a", lockOverride = null) {
  const prevState = player.aiState.fsmState || "Patrol";
  if (prevState === nextState) {
    return;
  }
  const lockFrames = lockOverride ?? AI_STATE_LOCK_FRAMES[nextState] ?? 28;
  player.aiState.fsmState = nextState;
  player.aiState.fsmLock = lockFrames;
  player.aiState.fsmReason = reason;
  if (isAiDebugEnabled()) {
    console.log(`[AI:${player.name}] ${prevState} -> ${nextState} (${reason})`);
  }
}

function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function segmentHitsRect(x1, y1, x2, y2, rect) {
  const steps = Math.max(2, Math.ceil(distance(x1, y1, x2, y2) / 6));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t;
    if (pointInRect(px, py, rect)) {
      return true;
    }
  }
  return false;
}

function roundRect(x, y, w, h, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function createPlayer(config) {
  return {
    id: config.id,
    name: config.name,
    color: config.color,
    accent: config.accent,
    controls: config.controls,
    score: 0,
    role: "attacker",
    x: 0,
    y: floorLevels[0],
    floor: 0,
    facing: 1,
    health: 100,
    maxHealth: 100,
    armor: 0,
    moveSpeed: 4,
    crouching: false,
    fireCooldown: 0,
    transitionCooldown: 0,
    abilityCooldown: 0,
    slowTimer: 0,
    slowFactor: 1,
    gadgetIndex: 0,
    weaponIndex: 0,
    weaponSet: ["rifle"],
    inventory: {},
    hurtFlash: 0,
    alive: true,
    travelMode: null,
    travel: null,
    controlMode: "human",
    aiState: {
      gadgetPlan: null,
      pathFloor: null,
      holdUntil: 0,
      planIndex: 0,
      anchorX: 0,
      anchorFloor: 0,
      intent: "hold",
      lastSeenFloor: null,
      lastSeenX: null,
      lastSeenTimer: 0,
      breachDoorId: null,
      actionId: null,
      actionUntil: 0,
      tacticalPlan: null,
      suspicionFloor: null,
      suspicionX: null,
      suspicionTimer: 0,
      threatConfidence: 0,
      lastThreatSource: "none",
      lastHeardFloor: null,
      lastHeardX: null,
      lastHeardTimer: 0,
      fsmState: "Patrol",
      fsmLock: 0,
      fsmReason: "spawn",
      visionReactTimer: 0,
      hadVisualLastFrame: false,
      lastVisualSense: null,
      coverFloor: null,
      coverX: null,
      coverScore: 0,
      flankFloor: null,
      flankX: null,
      debugTargetFloor: null,
      debugTargetX: null,
      debugPathFloor: null,
      debugPathX: null,
      footstepTimer: 0,
      intelCooldown: 0,
      teamTask: "solo",
      holdAnchorFloor: null,
      holdAnchorX: null,
      holdAnchorTimer: 0,
    },
    aiAimAngle: null,
  };
}

const players = [
  createPlayer({
    id: "p1",
    name: "player1",
    color: "#ff7b7b",
    accent: "#ffd2d2",
    controls: {
      left: "a",
      right: "d",
      up: "w",
      down: "s",
      shoot: "f",
      ability: "g",
      cycle: "q",
    },
  }),
  createPlayer({
    id: "p2",
    name: "player2",
    color: "#76c9ff",
    accent: "#d4f0ff",
    controls: {
      left: "ArrowLeft",
      right: "ArrowRight",
      up: "ArrowUp",
      down: "ArrowDown",
      shoot: "l",
      ability: "k",
      cycle: "o",
    },
  }),
];

function getAttackerPlayer() {
  return players.find((player) => player.role === "attacker");
}

function getDefenderPlayer() {
  return players.find((player) => player.role === "defender");
}

function showMessage(text, timer = 120) {
  message = { text, timer };
}

function updateRoleStatus() {
  if (!roleStatusEl) {
    return;
  }

  const xiaoxiaoRole = players[0].role === "attacker" ? "攻方" : "守方";
  const huihuiRole = players[1].role === "attacker" ? "攻方" : "守方";
  roleStatusEl.textContent = `当前：player1 ${xiaoxiaoRole} / player2 ${huihuiRole}`;
}

function getRoleTitle(role) {
  return role === "attacker" ? "攻方" : "守方";
}

function getCurrentWeaponId(player) {
  return player.weaponSet[player.weaponIndex];
}

function getCurrentWeapon(player) {
  return weaponCatalog[getCurrentWeaponId(player)];
}

function getPlayerHeight(player) {
  return player.crouching ? CROUCH_H : PLAYER_H;
}

function getEffectiveMoveSpeed(player) {
  return player.moveSpeed * (player.slowTimer > 0 ? player.slowFactor : 1);
}

function applySlow(player, factor = 0.58, duration = 95) {
  player.slowFactor = Math.min(player.slowTimer > 0 ? player.slowFactor : 1, factor);
  player.slowTimer = Math.max(player.slowTimer, duration);
}

function getPlayerRect(player) {
  const height = getPlayerHeight(player);
  return {
    x: player.x - PLAYER_W / 2,
    y: player.y - height,
    w: PLAYER_W,
    h: height,
  };
}

function getDoorRect(door) {
  return {
    x: door.x - DOOR_W / 2,
    y: floorLevels[door.floor] - DOOR_H,
    w: DOOR_W,
    h: DOOR_H,
  };
}

function getCoverRect(cover) {
  return {
    x: cover.x - cover.w / 2,
    y: floorLevels[cover.floor] - cover.h,
    w: cover.w,
    h: cover.h,
  };
}

function getBarricadeRect(barricade) {
  return {
    x: barricade.x - barricade.w / 2,
    y: floorLevels[barricade.floor] - barricade.h,
    w: barricade.w,
    h: barricade.h,
  };
}

function getTurretRect(turret) {
  return {
    x: turret.x - 22,
    // Expand upward so standard chest-height shots can reliably damage turrets.
    y: floorLevels[turret.floor] - 58,
    w: 44,
    h: 58,
  };
}

function getSupplyCacheRect(cache) {
  return {
    x: cache.x - 18,
    y: floorLevels[cache.floor] - 54,
    w: 36,
    h: 48,
  };
}

function getSupplyForbiddenRects(floor, placedCaches = []) {
  const forbidden = [
    ...doors
      .filter((door) => door.floor === floor)
      .map((door) => {
        const rect = getDoorRect(door);
        return { x: rect.x - 36, y: rect.y - 12, w: rect.w + 72, h: rect.h + 24 };
      }),
    ...stairSegments
      .filter((segment) => segment.lowerFloor === floor || segment.lowerFloor === floor - 1)
      .map((segment) => {
        const rect = getStairCutoutRect(segment);
        return { x: rect.x - 28, y: rect.y - 12, w: rect.w + 56, h: rect.h + 24 };
      }),
    { x: elevatorShaft.x1 - 46, y: buildingRect.y, w: elevatorShaft.x2 - elevatorShaft.x1 + 92, h: buildingRect.h },
    ...placedCaches.map((cache) => {
      const rect = getSupplyCacheRect(cache);
      return { x: rect.x - 58, y: rect.y - 28, w: rect.w + 116, h: rect.h + 56 };
    }),
  ];

  if (floor === objectiveZone.floor) {
    forbidden.push({
      x: objectiveZone.x - objectiveZone.w / 2 - 56,
      y: objectiveZone.y - 24,
      w: objectiveZone.w + 112,
      h: objectiveZone.h + 48,
    });
  }

  if (floor === 0) {
    forbidden.push({ x: 0, y: floorLevels[0] - 120, w: buildingRect.x + 190, h: 130 });
  }

  return forbidden;
}

function isSupplySpotClear(candidate, placedCaches) {
  const rect = getSupplyCacheRect(candidate);
  return !getSupplyForbiddenRects(candidate.floor, placedCaches).some((forbidden) => rectsOverlap(rect, forbidden));
}

function getStairCutoutRect(segment) {
  const isRightSide = segment.side === "right";
  const padLeft = isRightSide ? 78 : 0;
  const padRight = isRightSide ? 26 : 0;
  const x = segment.zoneX1 - padLeft;
  const y = floorLevels[segment.lowerFloor + 1] - 18;
  return {
    x,
    y,
    w: segment.zoneX2 - segment.zoneX1 + padLeft + padRight,
    h: floorLevels[segment.lowerFloor] + 8 - y,
  };
}

function propOverlapsPrimaryStair(prop) {
  const rect = getCoverRect(prop);
  return stairSegments
    .filter((segment) => segment.lowerFloor <= 1)
    .some((segment) => {
      const cutout = getStairCutoutRect(segment);
      const expanded = {
        x: cutout.x - 58,
        y: cutout.y - 18,
        w: cutout.w + 116,
        h: cutout.h + 36,
      };
      return rectsOverlap(rect, expanded);
    });
}

function getMovementCoverRectsForFloor(floor) {
  return coverTemplates
    .filter((cover) => cover.floor === floor && cover.blocksMovement !== false)
    .map(getCoverRect);
}

function getBulletCoverRectsForFloor(floor) {
  return coverTemplates
    .filter((cover) => cover.floor === floor && cover.blocksBullets !== false)
    .map(getCoverRect);
}

function getStairSegmentForMove(floor, direction) {
  const lowerFloor = direction > 0 ? floor : floor - 1;
  return stairSegments.find((segment) => segment.lowerFloor === lowerFloor) || null;
}

function getStairLandingX(floor, direction = 1) {
  const segment = getStairSegmentForMove(floor, direction);
  if (!segment) {
    return stairShaft.x1 + 38;
  }

  return direction > 0 ? segment.bottomX : segment.topX;
}

function getElevatorCenterX() {
  return (elevatorShaft.x1 + elevatorShaft.x2) / 2;
}

function getElevatorCarX() {
  return getElevatorCenterX() - elevatorShaft.carW / 2;
}

function inStairZone(player, direction = null) {
  const segments = direction === null
    ? stairSegments.filter((segment) => segment.lowerFloor === player.floor || segment.lowerFloor === player.floor - 1)
    : [getStairSegmentForMove(player.floor, direction)].filter(Boolean);

  return segments.some((segment) => player.x >= segment.zoneX1 && player.x <= segment.zoneX2);
}

function inElevatorZone(player) {
  return player.x >= elevatorShaft.x1 + 8 && player.x <= elevatorShaft.x2 - 8;
}

function inTraversalZone(player) {
  return Boolean(player.travelMode) || inStairZone(player) || inElevatorZone(player);
}

function createElevatorState() {
  return {
    currentFloor: 2,
    targetFloor: 2,
    y: floorLevels[2] - elevatorShaft.carH,
    moving: false,
    occupants: [],
    callOnly: false,
  };
}

function drawRoomMetricPips(x, y, w, accent) {
  ctx.fillStyle = "rgba(8, 18, 30, 0.26)";
  fillRoundedPanel(x + 16, y + 14, Math.min(88, w - 32), 12, 6, "rgba(8, 18, 30, 0.26)");
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.68;
  for (let i = 0; i < 3; i += 1) {
    ctx.fillRect(x + 26 + i * 18, y + 18, 10, 4);
  }
  ctx.globalAlpha = 1;
}

function drawBackWallFrame(x, y, w, h, line) {
  ctx.strokeStyle = line;
  ctx.globalAlpha = 0.36;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 18, y + 42);
  ctx.lineTo(x + w - 18, y + 42);
  ctx.moveTo(x + 18, y + h - 34);
  ctx.lineTo(x + w - 18, y + h - 34);
  ctx.stroke();

  for (let markerX = x + 34; markerX < x + w - 30; markerX += 72) {
    ctx.fillStyle = line;
    ctx.fillRect(markerX, y + 56, 2, h - 106);
  }
  ctx.globalAlpha = 1;
}

function drawBackWallShelf(x, y, w, h, color) {
  fillRoundedPanel(x, y, w, h, 10, color, "rgba(255,255,255,0.14)", 1);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  for (let shelfY = y + 14; shelfY < y + h - 8; shelfY += 24) {
    ctx.fillRect(x + 10, shelfY, w - 20, 3);
  }
}

function drawBackWallBed(x, y, w, color) {
  fillRoundedPanel(x, y, w, 26, 8, color, "rgba(255,255,255,0.14)", 1);
  fillRoundedPanel(x + 8, y + 6, 26, 14, 6, "rgba(255,255,255,0.25)");
}

function drawCompactMonitor(x, y, w, h, glow) {
  fillRoundedPanel(x, y, w, h, 8, "rgba(13, 28, 43, 0.58)", "rgba(255,255,255,0.08)", 1);
  fillRoundedPanel(x + 5, y + 5, w - 10, h - 10, 5, glow);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(x + 10, y + 13, w - 20, 3);
  ctx.fillRect(x + 10, y + 23, w - 30, 3);
}

function drawRoomDetails(section, x, y, w, h) {
  const accent = section.accent;
  ctx.save();
  ctx.globalAlpha = 0.94;

  switch (section.kind) {
    case "streetGate":
      fillRoundedPanel(x + 28, y + 58, w - 56, h - 96, 16, "rgba(70, 83, 91, 0.38)", "rgba(255,255,255,0.08)", 1);
      fillRoundedPanel(x + 46, y + h - 78, w - 92, 42, 12, "rgba(80, 62, 49, 0.5)");
      break;
    case "lobbyBay":
      fillRoundedPanel(x + w * 0.5 - 34, y + 62, 68, h - 92, 28, "rgba(41, 57, 70, 0.42)", "rgba(255,255,255,0.1)", 1);
      fillRoundedPanel(x + 40, y + h - 64, w - 80, 28, 10, "rgba(86, 65, 48, 0.45)");
      break;
    case "machineShop":
      drawBackWallShelf(x + 28, y + 58, w - 56, 54, "rgba(63, 77, 85, 0.42)");
      fillRoundedPanel(x + 44, y + h - 70, w - 88, 34, 10, "rgba(104, 72, 50, 0.46)");
      break;
    case "medBay":
      drawBackWallBed(x + 34, y + h - 82, Math.min(112, w - 68), "rgba(81, 105, 99, 0.48)");
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.68;
      ctx.fillRect(x + w - 60, y + 70, 8, 44);
      ctx.fillRect(x + w - 78, y + 88, 44, 8);
      ctx.globalAlpha = 0.94;
      break;
    case "loadingBay":
      drawBackWallShelf(x + 36, y + 62, 72, h - 112, "rgba(75, 88, 99, 0.45)");
      drawBackWallShelf(x + w - 128, y + 56, 88, h - 104, "rgba(80, 93, 105, 0.43)");
      fillRoundedPanel(x + 130, y + h - 72, 92, 36, 8, "rgba(97, 75, 58, 0.42)");
      break;
    case "securityBay":
      drawCompactMonitor(x + 36, y + 58, 72, 48, "rgba(255, 215, 107, 0.2)");
      fillRoundedPanel(x + w - 74, y + 54, 38, h - 92, 14, "rgba(55, 72, 87, 0.48)");
      break;
    case "bunkBay":
      drawBackWallBed(x + 36, y + 64, w - 72, "rgba(92, 76, 58, 0.42)");
      drawBackWallBed(x + 36, y + 106, w - 72, "rgba(92, 76, 58, 0.34)");
      break;
    case "greenhouseBay":
      fillRoundedPanel(x + 28, y + 50, w - 56, h - 86, 18, "rgba(255,255,255,0.12)", "rgba(255,255,255,0.14)", 1);
      drawPlantCluster(x + 44, y + h - 96, Math.min(84, w - 88), 62);
      drawPlantCluster(x + w - 128, y + h - 100, 82, 66);
      break;
    case "loungeBay":
      fillRoundedPanel(x + 44, y + h - 72, w - 88, 34, 16, "rgba(89, 68, 52, 0.44)");
      fillRoundedPanel(x + 56, y + 70, 54, 44, 12, "rgba(75, 89, 96, 0.36)");
      fillRoundedPanel(x + w - 110, y + 70, 54, 44, 12, "rgba(75, 89, 96, 0.36)");
      break;
    case "serverBay":
      for (let rackX = x + 34; rackX < x + w - 54; rackX += 58) {
        drawBackWallShelf(rackX, y + 54, 42, h - 88, "rgba(43, 61, 76, 0.5)");
      }
      break;
    case "controlBay":
    case "commandBay":
      drawCompactMonitor(x + 34, y + 54, 80, 48, "rgba(118, 201, 255, 0.19)");
      drawCompactMonitor(x + 126, y + 48, 96, 54, "rgba(255, 215, 107, 0.18)");
      fillRoundedPanel(x + 52, y + h - 70, w - 104, 36, 14, "rgba(61, 75, 88, 0.5)");
      break;
    case "coolantBay":
      fillRoundedPanel(x + 38, y + 56, 42, h - 90, 21, "rgba(70, 98, 105, 0.5)", "rgba(142, 233, 228, 0.18)", 1);
      fillRoundedPanel(x + 98, y + 52, 48, h - 86, 24, "rgba(76, 108, 113, 0.44)", "rgba(142, 233, 228, 0.16)", 1);
      ctx.strokeStyle = "rgba(142, 233, 228, 0.22)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x + 150, y + 86);
      ctx.lineTo(x + w - 34, y + 86);
      ctx.lineTo(x + w - 34, y + h - 52);
      ctx.stroke();
      break;
    case "signalNest":
      ctx.strokeStyle = "rgba(118, 201, 255, 0.24)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x + w * 0.52, y + 68, 42, Math.PI, Math.PI * 2);
      ctx.stroke();
      drawCompactMonitor(x + 34, y + 92, 68, 42, "rgba(118, 201, 255, 0.18)");
      break;
    case "armoryBay":
      for (let lockerX = x + 34; lockerX < x + w - 42; lockerX += 48) {
        fillRoundedPanel(lockerX, y + 54, 34, h - 88, 8, "rgba(74, 65, 57, 0.46)", "rgba(255,255,255,0.08)", 1);
      }
      break;
    case "safeRoom":
      fillRoundedPanel(x + 34, y + 58, w - 68, h - 96, 18, "rgba(46, 61, 69, 0.55)", "rgba(142, 233, 228, 0.18)", 1.5);
      drawGauge(x + w * 0.5, y + h * 0.53, 18, accent);
      break;
    default:
      drawBackWallShelf(x + 36, y + 62, w - 72, 54, "rgba(70, 82, 92, 0.36)");
      break;
  }

  ctx.restore();
}

function drawRoomSection(section) {
  const frame = getFloorInteriorRect(section.floor);
  const theme = getFloorTheme(section.floor);
  const x = section.x;
  const y = frame.y;
  const w = section.w;
  const h = frame.h;

  const wallGradient = ctx.createLinearGradient(x, y, x, y + h);
  wallGradient.addColorStop(0, section.wall);
  wallGradient.addColorStop(1, "#96958d");
  fillRoundedPanel(x, y, w, h, 18, wallGradient, "rgba(20, 30, 40, 0.18)", 1.4);

  const shade = ctx.createLinearGradient(x, y, x, y + h);
  shade.addColorStop(0, "rgba(255,255,255,0.06)");
  shade.addColorStop(0.58, "rgba(255,255,255,0)");
  shade.addColorStop(1, "rgba(0,0,0,0.22)");
  fillRoundedPanel(x, y, w, h, 18, shade);

  drawBackWallFrame(x, y, w, h, section.line);
  drawRoomMetricPips(x, y, w, theme.accent);
  drawRoomDetails(section, x, y, w, h);

  if (section.id === "vaultCore") {
    const terminalX = objectiveZone.x - objectiveZone.w / 2;
    const terminalY = objectiveZone.y;
    fillRoundedPanel(
      terminalX - 10,
      terminalY - 10,
      objectiveZone.w + 20,
      objectiveZone.h + 20,
      16,
      "rgba(218, 222, 213, 0.7)",
    );
  }

  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(x, y + h - 10, w, 10);
}

function drawCoverModule(cover, rect) {
  switch (cover.kind) {
    case "streetBooth": {
      fillRoundedPanel(rect.x - 6, rect.y + 14, rect.w + 12, rect.h - 14, 12, cover.color, cover.edge, 2);
      fillRoundedPanel(rect.x - 12, rect.y, rect.w + 24, 24, 10, cover.accent);
      fillRoundedPanel(rect.x + 16, rect.y + 34, rect.w - 32, 44, 10, "#0f2133", "rgba(255,255,255,0.16)", 1.5);
      drawVentSlots(rect.x + 18, rect.y + rect.h - 26, rect.w - 36, 4, "rgba(255,255,255,0.18)");
      break;
    }
    case "forgeBench": {
      fillRoundedPanel(rect.x, rect.y + 18, rect.w, rect.h - 18, 12, cover.color, cover.edge, 2);
      fillRoundedPanel(rect.x + 14, rect.y, rect.w - 28, 28, 10, "#7c5a44");
      fillRoundedPanel(rect.x + 22, rect.y + 42, 46, rect.h - 58, 10, "#25384c");
      fillRoundedPanel(rect.x + rect.w - 68, rect.y + 42, 46, rect.h - 58, 10, "#25384c");
      ctx.fillStyle = cover.accent;
      ctx.fillRect(rect.x + rect.w / 2 - 28, rect.y + 10, 56, 6);
      break;
    }
    case "utilityCart": {
      fillRoundedPanel(rect.x + 6, rect.y + 12, rect.w - 12, rect.h - 18, 10, cover.color, cover.edge, 2);
      fillRoundedPanel(rect.x + 12, rect.y + 20, rect.w - 24, 22, 7, "#4d657f");
      fillRoundedPanel(rect.x + rect.w - 18, rect.y + 8, 8, 34, 4, cover.edge);
      ctx.fillStyle = "#1a2533";
      ctx.beginPath();
      ctx.arc(rect.x + 18, rect.y + rect.h - 4, 8, 0, Math.PI * 2);
      ctx.arc(rect.x + rect.w - 18, rect.y + rect.h - 4, 8, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "serviceLocker": {
      fillRoundedPanel(rect.x, rect.y, rect.w, rect.h, 12, cover.color, cover.edge, 2);
      fillRoundedPanel(rect.x + 12, rect.y + 12, rect.w / 2 - 18, rect.h - 24, 10, "#31485f");
      fillRoundedPanel(rect.x + rect.w / 2 + 6, rect.y + 12, rect.w / 2 - 18, rect.h - 24, 10, "#31485f");
      drawVentSlots(rect.x + 16, rect.y + 24, rect.w / 2 - 26, 3, "rgba(255,255,255,0.14)");
      drawVentSlots(rect.x + rect.w / 2 + 10, rect.y + 24, rect.w / 2 - 26, 3, "rgba(255,255,255,0.14)");
      break;
    }
    case "archiveKiosk": {
      fillRoundedPanel(rect.x + 12, rect.y + 24, rect.w - 24, rect.h - 24, 10, cover.color, cover.edge, 2);
      drawScreenPanel(rect.x + 14, rect.y, rect.w - 28, 40, "rgba(255, 215, 107, 0.48)");
      break;
    }
    case "hydroponicRack": {
      fillRoundedPanel(rect.x, rect.y, rect.w, rect.h, 14, cover.color, cover.edge, 2);
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(rect.x + 20, rect.y + 18, 4, rect.h - 36);
      ctx.fillRect(rect.x + rect.w - 24, rect.y + 18, 4, rect.h - 36);
      ctx.fillRect(rect.x + 12, rect.y + 32, rect.w - 24, 4);
      ctx.fillRect(rect.x + 12, rect.y + 58, rect.w - 24, 4);
      drawPlantCluster(rect.x + 18, rect.y + 34, rect.w - 36, rect.h - 46);
      break;
    }
    case "displayCabinet": {
      fillRoundedPanel(rect.x, rect.y, rect.w, rect.h, 12, cover.color, cover.edge, 2);
      fillRoundedPanel(rect.x + 10, rect.y + 10, rect.w - 20, rect.h - 30, 10, "rgba(255,255,255,0.16)", "rgba(255,255,255,0.22)", 1.5);
      fillRoundedPanel(rect.x + rect.w / 2 - 16, rect.y + rect.h - 44, 32, 20, 8, "#7b614b");
      ctx.fillStyle = cover.accent;
      ctx.beginPath();
      ctx.arc(rect.x + rect.w / 2, rect.y + rect.h / 2 - 6, 10, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "commandConsole": {
      fillRoundedPanel(rect.x, rect.y + 20, rect.w, rect.h - 20, 14, cover.color, cover.edge, 2);
      drawScreenPanel(rect.x + 14, rect.y, rect.w - 28, 34, "rgba(118, 201, 255, 0.48)");
      fillRoundedPanel(rect.x + 24, rect.y + 40, rect.w - 48, 18, 8, "#283a4d");
      ctx.fillStyle = cover.accent;
      ctx.fillRect(rect.x + 36, rect.y + 46, 52, 5);
      ctx.fillRect(rect.x + rect.w - 90, rect.y + 46, 34, 5);
      break;
    }
    case "coolantTank": {
      fillRoundedPanel(rect.x + 10, rect.y, rect.w - 20, rect.h, 20, cover.color, cover.edge, 2);
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      ctx.fillRect(rect.x + 16, rect.y + 18, rect.w - 32, 5);
      ctx.fillRect(rect.x + 16, rect.y + rect.h - 24, rect.w - 32, 5);
      drawGauge(rect.x + rect.w / 2, rect.y + rect.h / 2, 14, cover.accent);
      break;
    }
    case "serverRack": {
      fillRoundedPanel(rect.x, rect.y, rect.w, rect.h, 12, cover.color, cover.edge, 2);
      fillRoundedPanel(rect.x + 12, rect.y + 10, rect.w - 24, rect.h - 20, 10, "#122132", "rgba(255,255,255,0.12)", 1.5);
      drawVentSlots(rect.x + 16, rect.y + 22, rect.w - 32, 5, "rgba(255,255,255,0.14)");
      drawVentSlots(rect.x + 16, rect.y + 50, rect.w - 32, 5, "rgba(255,255,255,0.14)");
      ctx.fillStyle = cover.accent;
      ctx.fillRect(rect.x + 18, rect.y + rect.h - 34, rect.w - 36, 6);
      ctx.fillRect(rect.x + 18, rect.y + rect.h - 20, rect.w - 46, 6);
      break;
    }
    default:
      fillRoundedPanel(rect.x, rect.y, rect.w, rect.h, 12, cover.color, cover.edge, 2);
      break;
  }
}

function buildDoorsFromTemplates() {
  doors = doorTemplates.map((template) => {
    const baseHp = template.fortified ? 780 : 620;
    return {
      ...template,
      hp: template.open ? 0 : baseHp,
      maxHp: 620,
      fortifiedHp: 780,
      destroyed: false,
      initialOpen: template.open,
      initialFortified: template.fortified,
      lastDamageTimer: 0,
      lastDisturbanceRole: null,
      lastCompromisedTimer: 0,
      aiPassageBy: null,
      aiPassageTimer: 0,
      aiPassageWasFortified: false,
    };
  });
}

function buildSupplyCaches() {
  const shuffledFloors = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  const placed = [];

  supplyCaches = supplyCachePool.map((template, index) => {
    const preferredFloor = shuffledFloors[index % shuffledFloors.length];
    let candidate = null;

    for (let attempt = 0; attempt < 80; attempt += 1) {
      const floor = attempt < 48 ? preferredFloor : Math.floor(Math.random() * floorLevels.length);
      const lane = floorBounds[floor];
      const x = rand(lane.minX + 92, lane.maxX - 92);
      const test = { ...template, id: `${template.id}-${index}`, floor, x, consumed: false };
      if (isSupplySpotClear(test, placed)) {
        candidate = test;
        break;
      }
    }

    if (!candidate) {
      const floor = preferredFloor;
      const lane = floorBounds[floor];
      candidate = {
        ...template,
        id: `${template.id}-${index}`,
        floor,
        x: clamp(lane.minX + 280 + index * 240, lane.minX + 92, lane.maxX - 92),
        consumed: false,
      };
    }

    placed.push(candidate);
    return candidate;
  });
}

function configurePlayerRole(player, role) {
  player.role = role;
  player.fireCooldown = 0;
  player.transitionCooldown = 0;
  player.abilityCooldown = 0;
  player.slowTimer = 0;
  player.slowFactor = 1;
  player.hurtFlash = 0;
  player.alive = true;
  player.crouching = false;
  player.travelMode = null;
  player.travel = null;
  player.aiAimAngle = null;
  player.aiState.gadgetPlan = null;
  player.aiState.pathFloor = null;
  player.aiState.holdUntil = 0;
  player.aiState.planIndex = 0;
  player.aiState.intent = "hold";
  player.aiState.lastSeenFloor = null;
  player.aiState.lastSeenX = null;
  player.aiState.lastSeenTimer = 0;
  player.aiState.breachDoorId = null;
  player.aiState.actionId = null;
  player.aiState.actionUntil = 0;
  player.aiState.tacticalPlan = null;
  player.aiState.suspicionFloor = null;
  player.aiState.suspicionX = null;
  player.aiState.suspicionTimer = 0;
  player.aiState.threatConfidence = 0;
  player.aiState.lastThreatSource = "none";
  player.aiState.lastHeardFloor = null;
  player.aiState.lastHeardX = null;
  player.aiState.lastHeardTimer = 0;
  player.aiState.fsmState = "Patrol";
  player.aiState.fsmLock = 0;
  player.aiState.fsmReason = "round-reset";
  player.aiState.visionReactTimer = 0;
  player.aiState.hadVisualLastFrame = false;
  player.aiState.lastVisualSense = null;
  player.aiState.coverFloor = null;
  player.aiState.coverX = null;
  player.aiState.coverScore = 0;
  player.aiState.flankFloor = null;
  player.aiState.flankX = null;
  player.aiState.debugTargetFloor = null;
  player.aiState.debugTargetX = null;
  player.aiState.debugPathFloor = null;
  player.aiState.debugPathX = null;
  player.aiState.footstepTimer = 0;
  player.aiState.intelCooldown = 0;
  player.aiState.teamTask = "solo";
  player.aiState.holdAnchorFloor = null;
  player.aiState.holdAnchorX = null;
  player.aiState.holdAnchorTimer = 0;

  if (role === "attacker") {
    player.weaponSet = ["rifle", "breacher"];
    player.weaponIndex = 0;
    player.inventory = { breach: 4 };
    player.maxHealth = 220;
    player.health = 220;
    player.armor = 0.42;
    player.moveSpeed = 5.3;
    player.floor = 0;
    player.x = 84;
    player.y = floorLevels[0];
    player.facing = 1;
    player.aiState.anchorFloor = objectiveZone.floor;
    player.aiState.anchorX = objectiveZone.x;
  } else {
    player.weaponSet = ["smg"];
    player.weaponIndex = 0;
    player.inventory = { trap: 4, turret: 1, barricade: 3 };
    player.gadgetIndex = 0;
    player.maxHealth = 135;
    player.health = 135;
    player.armor = 0.18;
    player.moveSpeed = 4.3;
    player.floor = 2;
    player.x = buildingRect.x + 1188;
    player.y = floorLevels[2];
    player.facing = -1;
    player.aiState.anchorFloor = objectiveZone.floor;
    player.aiState.anchorX = objectiveZone.x - 140;
  }
}

function setRolePreset(preset, resetScores = true) {
  rolePreset = preset;

  if (preset === "xiaoxiao-attack") {
    configurePlayerRole(players[0], "attacker");
    configurePlayerRole(players[1], "defender");
  } else {
    configurePlayerRole(players[0], "defender");
    configurePlayerRole(players[1], "attacker");
  }

  if (resetScores) {
    players.forEach((player) => {
      player.score = 0;
    });
  }

  updateRoleStatus();
  startRound();
}

function startRound() {
  bullets.length = 0;
  effects.length = 0;
  mines = [];
  turrets = [];
  barricades = [];
  breachCharges = [];
  buildDoorsFromTemplates();
  buildSupplyCaches();
  elevator = createElevatorState();

  roundTimer = ROUND_TIME_FRAMES;
  prepTimer = PREP_TIME_FRAMES;
  roundPhase = "prep";
  captureProgress = 0;
  capturePulse = 0;
  roundOver = false;
  roundWinner = null;
  roundReason = "";
  matchOver = false;

  players.forEach((player) => {
    const role = player.role;
    configurePlayerRole(player, role);
  });

  showMessage("新一轮攻防开始", 120);
  showMessage("守方准备阶段开始", 120);
  playRoundStartSound();
}

function resetSeries() {
  players.forEach((player) => {
    player.score = 0;
  });
  setRolePreset(rolePreset, false);
}

function getNearbyDoor(player, maxDistance = 70) {
  return doors.find((door) => {
    if (door.floor !== player.floor) {
      return false;
    }
    return Math.abs(door.x - player.x) <= maxDistance;
  });
}

function createSpark(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    effects.push({
      type: "spark",
      x,
      y,
      vx: rand(-4.5, 4.5),
      vy: rand(-5.2, 1.6),
      life: rand(18, 32),
      color,
      size: rand(2, 4),
    });
  }
}

function createPulse(x, y, color, radius = 26, maxRadius = 110, life = 24) {
  effects.push({
    type: "ring",
    x,
    y,
    radius,
    maxRadius,
    life,
    maxLife: life,
    color,
  });
}

function createDust(x, y, color = "#fff0bf") {
  effects.push({
    type: "dust",
    x,
    y,
    life: 16,
    maxLife: 16,
    color,
  });
}

function markDoorDisturbance(door, sourceRole = null, timer = AI_SOUND_MEMORY_FRAMES) {
  if (!door) {
    return;
  }
  door.lastDamageTimer = Math.max(door.lastDamageTimer || 0, timer);
  door.lastDisturbanceRole = sourceRole || door.lastDisturbanceRole || "unknown";
  emitAiSoundEvent("door", { floor: door.floor, x: door.x, role: sourceRole || "unknown", id: `door:${door.id}` }, 340, 0.62);
}

function damageDoor(door, amount, sourceRole = null) {
  if (door.open || door.destroyed) {
    return;
  }

  markDoorDisturbance(door, sourceRole);
  door.hp -= amount;
  if (door.hp <= 0) {
    door.open = true;
    door.destroyed = true;
    door.fortified = false;
    door.hp = 0;
    door.lastCompromisedTimer = Math.max(door.lastCompromisedTimer || 0, AI_VISIBLE_MEMORY_FRAMES);
    createSpark(door.x, floorLevels[door.floor] - 40, "#ffd76b", 12);
    createPulse(door.x, floorLevels[door.floor] - 48, "#ffce76", 18, 72, 22);
    playBreachSound();
    showMessage("房门被打穿", 90);
  }
}

function setDoorClosed(door, fortified = false) {
  door.open = false;
  door.destroyed = false;
  door.fortified = fortified;
  door.hp = fortified ? door.fortifiedHp : door.maxHp;
  door.aiPassageBy = null;
  door.aiPassageTimer = 0;
  door.aiPassageWasFortified = false;
}

function getDoorById(doorId) {
  return doors.find((door) => door.id === doorId);
}

function getPendingBreachCharge(doorId) {
  return breachCharges.find((charge) => charge.doorId === doorId);
}

function hasEnemyNearDoor(role, door, radius = 190) {
  return players.some(
    (player) => player.alive && player.role !== role && player.floor === door.floor && Math.abs(player.x - door.x) <= radius,
  );
}

function updateDoorSignals() {
  for (const door of doors) {
    door.lastDamageTimer = Math.max(0, (door.lastDamageTimer || 0) - 1);
    door.lastCompromisedTimer = Math.max(0, (door.lastCompromisedTimer || 0) - 1);
    if (door.lastDamageTimer === 0) {
      door.lastDisturbanceRole = null;
    }

    if (!door.aiPassageBy) {
      continue;
    }

    door.aiPassageTimer = Math.max(0, (door.aiPassageTimer || 0) - 1);
    const opener = players.find((player) => player.id === door.aiPassageBy);
    const openerAway = !opener || opener.floor !== door.floor || Math.abs(opener.x - door.x) > 92;
    if (door.open && door.aiPassageTimer === 0 && openerAway && !hasEnemyNearDoor("defender", door, 210)) {
      setDoorClosed(door, door.aiPassageWasFortified);
      playDoorSound();
      createSpark(door.x, floorLevels[door.floor] - 42, "#95ffb5", 4);
    }
  }
}

function explodeBreachCharge(charge) {
  const owner = players.find((player) => player.id === charge.ownerId) || {
    id: charge.ownerId,
    name: "破门炸药",
    color: "#ffae5d",
  };
  const blastY = floorLevels[charge.floor] - 52;
  const door = getDoorById(charge.doorId);

  if (door && !door.destroyed) {
    damageDoor(door, 9999, owner.role || "attacker");
  } else {
    createSpark(charge.x, blastY, "#ffae5d", 14);
    createPulse(charge.x, blastY, "#ffce76", 18, 84, 24);
    playBreachSound();
  }
  emitAiSoundEvent("explosion", { id: owner.id, role: owner.role || "attacker", floor: charge.floor, x: charge.x }, 620, 0.98);

  for (let barricadeIndex = barricades.length - 1; barricadeIndex >= 0; barricadeIndex -= 1) {
    const barricade = barricades[barricadeIndex];
    if (barricade.floor !== charge.floor) {
      continue;
    }

    const dist = Math.abs(barricade.x - charge.x);
    if (dist > BREACH_BLAST_RADIUS + barricade.w * 0.5) {
      continue;
    }

    barricades.splice(barricadeIndex, 1);
    createSpark(barricade.x, getFloorY(barricade.floor) - 46, "#ffce76", 10);
    createPulse(barricade.x, getFloorY(barricade.floor) - 46, "#ffce76", 18, 88, 22);
  }

  for (const player of players) {
    if (!player.alive || player.floor !== charge.floor) {
      continue;
    }

    const impactY = player.y - getPlayerHeight(player) * 0.55;
    const dist = distance(player.x, impactY, charge.x, blastY);
    if (dist > BREACH_BLAST_RADIUS) {
      continue;
    }

    const falloff = 1 - dist / BREACH_BLAST_RADIUS;
    const damage = 24 + falloff * 88;
    applyDamage(player, owner, damage, charge.x, blastY);
  }

  showMessage(`${owner.name} 引爆了破门炸药`, 90);
}

function updateBreachCharges() {
  for (let i = breachCharges.length - 1; i >= 0; i -= 1) {
    const charge = breachCharges[i];
    charge.timer -= 1;
    if (charge.timer > 0) {
      continue;
    }

    breachCharges.splice(i, 1);
    explodeBreachCharge(charge);
  }
}

function toggleDefenderDoor(player, door) {
  if (door.destroyed) {
    showMessage("这扇门已经被炸穿", 80);
    return;
  }

  if (door.open) {
    setDoorClosed(door, false);
    playDoorSound();
    emitAiSoundEvent("door", { id: player.id, role: player.role, floor: door.floor, x: door.x }, 320, 0.6);
    showMessage(`${player.name} 关上了房门`, 80);
    return;
  }

  if (!door.fortified && door.hp >= door.maxHp) {
    setDoorClosed(door, true);
    playDoorSound();
    emitAiSoundEvent("door", { id: player.id, role: player.role, floor: door.floor, x: door.x }, 320, 0.58);
    showMessage(`${player.name} 加固了房门`, 90);
    return;
  }

  if (door.fortified) {
    door.open = true;
    door.fortified = false;
    door.destroyed = false;
    door.hp = 0;
    playDoorSound();
    emitAiSoundEvent("door", { id: player.id, role: player.role, floor: door.floor, x: door.x }, 320, 0.62);
    showMessage(`${player.name} 打开了加固门`, 80);
    return;
  }

  setDoorClosed(door, false);
  playDoorSound();
  emitAiSoundEvent("door", { id: player.id, role: player.role, floor: door.floor, x: door.x }, 320, 0.56);
  showMessage(`${player.name} 修补了房门`, 80);
}

function legacyAttemptAttackerAbility(player) {
  const door = getNearbyDoor(player);
  if (!door) {
    showMessage("附近没有可爆破的门", 70);
    return;
  }

  if (door.open || door.destroyed) {
    showMessage("这扇门已经通了", 70);
    return;
  }

  if (!door.fortified) {
    door.open = true;
    door.hp = 0;
    door.destroyed = false;
    playDoorSound();
    createSpark(door.x, floorLevels[door.floor] - 40, "#ffd76b", 8);
    showMessage(`${player.name} 踹开了房门`, 80);
    return;
  }

  if (player.inventory.breach <= 0) {
    showMessage("破门炸药已经用完", 90);
    return;
  }

  player.inventory.breach -= 1;
    damageDoor(door, 999, player.role);
  showMessage(`${player.name} 引爆了破门炸药`, 90);
}

function attemptAttackerAbility(player) {
  const door = getNearbyDoor(player);
  if (!door) {
    showMessage("附近没有可安装炸药的门", 70);
    return;
  }

  if (door.open || door.destroyed) {
    showMessage("这扇门已经通了", 70);
    return;
  }

  if (getPendingBreachCharge(door.id)) {
    showMessage("这扇门上已经装了炸药", 70);
    return;
  }

  if (player.inventory.breach <= 0) {
    showMessage("破门炸药已经用完", 90);
    return;
  }

  player.inventory.breach -= 1;
  player.abilityCooldown = 24;
  breachCharges.push({
    doorId: door.id,
    floor: door.floor,
    x: door.x,
    timer: BREACH_COUNTDOWN_FRAMES,
    ownerId: player.id,
  });
  createSpark(door.x, floorLevels[door.floor] - 40, "#ffae5d", 8);
  playDeploySound();
  emitAiSoundEvent("breach-plant", { id: player.id, role: player.role, floor: door.floor, x: door.x }, 380, 0.74);
  showMessage(`${player.name} 安装了破门炸药`, 90);
}

function canPlaceRect(rect, floor) {
  if (rect.x < floorBounds[floor].minX || rect.x + rect.w > floorBounds[floor].maxX) {
    return false;
  }

  const solidRects = [
    ...getMovementCoverRectsForFloor(floor),
    ...doors
      .filter((door) => door.floor === floor && !door.open && !door.destroyed)
      .map(getDoorRect),
    ...barricades.filter((barricade) => barricade.floor === floor).map(getBarricadeRect),
  ];

  return !solidRects.some((solidRect) => rectsOverlap(rect, solidRect));
}

function placeTrap(player) {
  if (player.inventory.trap <= 0) {
    showMessage("震撼雷已经用完", 90);
    return;
  }

  const x = clamp(player.x + player.facing * 28, floorBounds[player.floor].minX + 20, floorBounds[player.floor].maxX - 20);
  if (mines.some((mine) => mine.floor === player.floor && Math.abs(mine.x - x) < 36)) {
    showMessage("这里已经有陷阱了", 80);
    return;
  }

  player.inventory.trap -= 1;
  mines.push({
    x,
    floor: player.floor,
    radius: 16,
    armedIn: 18,
    ownerId: player.id,
  });
  playDeploySound();
  emitAiSoundEvent("deploy", player, 250, 0.48);
  showMessage(`${player.name} 布下了震撼雷`, 80);
}

function placeTurret(player) {
  if (player.inventory.turret <= 0) {
    showMessage("自动炮台已经用完", 90);
    return;
  }

  const x = clamp(player.x + player.facing * 36, floorBounds[player.floor].minX + 24, floorBounds[player.floor].maxX - 24);
  if (turrets.some((turret) => turret.floor === player.floor && Math.abs(turret.x - x) < 70)) {
    showMessage("这里摆不开炮台", 80);
    return;
  }

  player.inventory.turret -= 1;
  turrets.push({
    x,
    floor: player.floor,
    hp: 90,
    cooldown: 24,
    facing: player.facing,
    ownerId: player.id,
  });
  playDeploySound();
  emitAiSoundEvent("deploy", player, 280, 0.5);
  showMessage(`${player.name} 架设了自动炮台`, 80);
}

function placeBarricade(player) {
  if (player.inventory.barricade <= 0) {
    showMessage("路障盾板已经用完", 90);
    return;
  }

  const x = clamp(player.x + player.facing * 46, floorBounds[player.floor].minX + 26, floorBounds[player.floor].maxX - 26);
  const rect = {
    x: x - 22,
    y: floorLevels[player.floor] - 92,
    w: 44,
    h: 92,
  };

  if (!canPlaceRect(rect, player.floor)) {
    showMessage("这里摆不下路障", 80);
    return;
  }

  player.inventory.barricade -= 1;
  barricades.push({
    x,
    floor: player.floor,
    w: 44,
    h: 92,
    hp: 96,
    maxHp: 96,
    ownerId: player.id,
  });
  playDeploySound();
  emitAiSoundEvent("deploy", player, 265, 0.5);
  showMessage(`${player.name} 立起了路障`, 80);
}

function attemptDefenderAbility(player) {
  const nearbyDoor = getNearbyDoor(player);
  if (nearbyDoor) {
    toggleDefenderDoor(player, nearbyDoor);
    return;
  }

  const gadget = ["trap", "turret", "barricade"][player.gadgetIndex];
  if (gadget === "trap") {
    placeTrap(player);
  } else if (gadget === "turret") {
    placeTurret(player);
  } else {
    placeBarricade(player);
  }
}

function applyDamage(target, attacker, damage, impactX, impactY) {
  if (!target.alive || roundOver) {
    return;
  }

  const finalDamage = damage * (1 - target.armor);
  target.health = clamp(target.health - finalDamage, 0, target.maxHealth);
  target.hurtFlash = 10;
  playHitSound();
  createSpark(impactX, impactY, attacker.color || "#ffce76", 6);

  if (target.health <= 0) {
    target.alive = false;
    createPulse(target.x, target.y - 38, attacker.color || "#ffce76", 20, 100, 24);
    endRound(attacker, `${attacker.name} 击倒了 ${target.name}`);
  }
}

function applyDamage(target, attacker, damage, impactX, impactY) {
  if (!target.alive || roundOver) {
    return;
  }

  const finalDamage = damage * (1 - target.armor);
  target.health = clamp(target.health - finalDamage, 0, target.maxHealth);
  target.hurtFlash = 10;
  playHitSound();
  createSpark(impactX, impactY, attacker.color || "#ffce76", 6);

  if (target.health <= 0) {
    target.alive = false;
    createPulse(target.x, target.y - 38, attacker.color || "#ffce76", 20, 100, 24);
    const creditedWinner = attacker && attacker.id && attacker.id === target.id ? getEnemyOf(target) : attacker;
    endRound(creditedWinner || attacker, `${attacker.name} 击倒了 ${target.name}`);
  }
}

function getEnemyOf(player) {
  return players.find((candidate) => candidate !== player);
}

function addBullet(owner, weaponId, originX, originY, angle, extra = {}) {
  const weapon = weaponCatalog[weaponId];
  bullets.push({
    x: originX,
    y: originY,
    prevX: originX,
    prevY: originY,
    vx: Math.cos(angle) * weapon.speed,
    vy: Math.sin(angle) * weapon.speed,
    ttl: weapon.ttl,
    ownerId: owner.id || owner.ownerId || owner.id,
    ownerRole: owner.role || owner.ownerRole || "defender",
    ownerColor: owner.color || "#95ffb5",
    damage: weapon.damage,
    doorDamage: weapon.doorDamage,
    color: weapon.color,
    trail: weapon.trail,
    weaponId,
    ignoreId: extra.ignoreId || null,
  });
}

function getAim(player) {
  if (player.controlMode === "ai" && player.aiAimAngle !== null) {
    player.facing = Math.cos(player.aiAimAngle) >= 0 ? 1 : -1;
    return player.aiAimAngle;
  }

  const left = isDown(player.controls.left);
  const right = isDown(player.controls.right);
  const up = isDown(player.controls.up);
  const down = isDown(player.controls.down);

  if (left) {
    player.facing = -1;
  } else if (right) {
    player.facing = 1;
  }

  let angle = player.facing === 1 ? 0 : Math.PI;
  if (up && !inTraversalZone(player)) {
    angle += player.facing === 1 ? -0.28 : 0.28;
  } else if (down && !player.crouching && !inTraversalZone(player)) {
    angle += player.facing === 1 ? 0.28 : -0.28;
  }

  return angle;
}

function shoot(player) {
  if (!player.alive) {
    return;
  }

  const weaponId = getCurrentWeaponId(player);
  const weapon = weaponCatalog[weaponId];
  const angle = getAim(player);
  const barrelX = player.x + Math.cos(angle) * 24;
  const barrelY = player.y - (player.crouching ? 38 : 52) + Math.sin(angle) * 12;

  for (let i = 0; i < weapon.pellets; i += 1) {
    const spread = weapon.pellets === 1 ? 0 : rand(-weapon.spread, weapon.spread);
    addBullet(player, weaponId, barrelX, barrelY, angle + spread);
  }

  player.fireCooldown = weapon.cooldown;
  createDust(player.x - player.facing * 16, player.y - 8, player.color);
  playShootSound(weaponId);
  emitAiSoundEvent("gunshot", player, weaponId === "breacher" ? 520 : 470, weaponId === "breacher" ? 0.9 : 0.78);
}

function legacyInAnyStairZone(player) {
  return stairZones.some((zone) => player.x >= zone.x1 && player.x <= zone.x2);
}

function legacyAttemptFloorChange(player, direction) {
  if (player.transitionCooldown > 0 || !inAnyStairZone(player)) {
    return;
  }

  const targetFloor = player.floor + direction;
  if (targetFloor < 0 || targetFloor >= floorLevels.length) {
    return;
  }

  player.floor = targetFloor;
  player.y = floorLevels[targetFloor];
  player.transitionCooldown = 14;
  createDust(player.x, player.y - 16, "#eef4ff");
}

function getSolidRectsForFloor(floor) {
  return [
    ...getMovementCoverRectsForFloor(floor),
    ...doors
      .filter((door) => door.floor === floor && !door.open && !door.destroyed)
      .map(getDoorRect),
    ...barricades.filter((barricade) => barricade.floor === floor).map(getBarricadeRect),
  ];
}

function movePlayerHorizontally(player, dx) {
  if (dx === 0) {
    return;
  }

  const previousX = player.x;
  const nextX = player.x + dx;
  const height = getPlayerHeight(player);
  let rect = {
    x: nextX - PLAYER_W / 2,
    y: player.y - height,
    w: PLAYER_W,
    h: height,
  };

  for (const obstacle of getSolidRectsForFloor(player.floor)) {
    if (!rectsOverlap(rect, obstacle)) {
      continue;
    }

    if (dx > 0) {
      rect.x = obstacle.x - rect.w;
    } else {
      rect.x = obstacle.x + obstacle.w;
    }
  }

  player.x = rect.x + rect.w / 2;
  player.x = clamp(player.x, floorBounds[player.floor].minX + PLAYER_W / 2, floorBounds[player.floor].maxX - PLAYER_W / 2);
  if (Math.abs(player.x - previousX) > 0.3) {
    const stepCadence = player.crouching ? 30 : 18;
    if ((player.aiState.footstepTimer || 0) <= 0 && Math.abs(dx) >= 0.85) {
      emitAiSoundEvent("footstep", player, player.crouching ? 180 : 260, player.crouching ? 0.26 : 0.4);
      player.aiState.footstepTimer = stepCadence;
    }
  }
}

function lineBlocked(x1, y1, x2, y2, floor, ignoreTurretId = null) {
  const blockers = [
    ...getBulletCoverRectsForFloor(floor),
    ...doors
      .filter((door) => door.floor === floor && !door.open && !door.destroyed)
      .map(getDoorRect),
    ...barricades.filter((barricade) => barricade.floor === floor).map(getBarricadeRect),
  ];

  return blockers.some((rect) => segmentHitsRect(x1, y1, x2, y2, rect));
}

function cyclePlayerTool(player) {
  if (player.role === "attacker") {
    player.weaponIndex = (player.weaponIndex + 1) % player.weaponSet.length;
    showMessage(`${player.name} 切换到 ${getCurrentWeapon(player).label}`, 80);
    return;
  }

  player.gadgetIndex = (player.gadgetIndex + 1) % 3;
  const gadget = ["trap", "turret", "barricade"][player.gadgetIndex];
  showMessage(`${player.name} 切换到 ${gadgetNames[gadget]}`, 80);
}

function getFloorY(floor) {
  return floorLevels[floor];
}

function insideObjective(player) {
  const rect = getPlayerRect(player);
  return player.floor === objectiveZone.floor && rect.x + rect.w > objectiveZone.x - objectiveZone.w / 2 && rect.x < objectiveZone.x + objectiveZone.w / 2;
}

function legacyUpdatePlayer(player) {
  if (!player.alive || roundOver) {
    return;
  }

  player.fireCooldown = Math.max(0, player.fireCooldown - 1);
  player.transitionCooldown = Math.max(0, player.transitionCooldown - 1);
  player.abilityCooldown = Math.max(0, player.abilityCooldown - 1);
  player.hurtFlash = Math.max(0, player.hurtFlash - 1);

  const left = isDown(player.controls.left);
  const right = isDown(player.controls.right);
  const upPressed = isPressed(player.controls.up);
  const downPressed = isPressed(player.controls.down);
  const horizontal = (right ? 1 : 0) - (left ? 1 : 0);

  if (upPressed) {
    attemptFloorChange(player, 1);
  } else if (downPressed) {
    attemptFloorChange(player, -1);
  }

  player.crouching = isDown(player.controls.down) && !inAnyStairZone(player);

  if (horizontal !== 0) {
    player.facing = Math.sign(horizontal);
    movePlayerHorizontally(player, horizontal * (player.crouching ? player.moveSpeed * 0.55 : player.moveSpeed));
  }

  if (isPressed(player.controls.cycle)) {
    cyclePlayerTool(player);
  }

  if (isDown(player.controls.shoot) && player.fireCooldown === 0) {
    shoot(player);
  }

  if (player.role === "attacker") {
    const controllingObjective = isDown(player.controls.ability) && insideObjective(player);

    if (controllingObjective) {
      captureProgress = clamp(captureProgress + 0.0065, 0, 1);
      capturePulse -= 1;
      if (capturePulse <= 0) {
        capturePulse = 14;
        playObjectiveSound();
      }
      if (captureProgress >= 1) {
        endRound(player, `${player.name} 控制了 ${objectiveZone.label || "终端"}`);
      }
    }

    if (isPressed(player.controls.ability) && !controllingObjective) {
      attemptAttackerAbility(player);
    }
  } else if (isPressed(player.controls.ability)) {
    attemptDefenderAbility(player);
  }
}

function startStairTravel(player, targetFloor) {
  const startFloor = player.floor;
  const direction = Math.sign(targetFloor - startFloor);
  const segment = getStairSegmentForMove(startFloor, direction);
  if (!segment) {
    return;
  }

  const startX = direction > 0 ? segment.bottomX : segment.topX;
  const endX = direction > 0 ? segment.topX : segment.bottomX;

  player.travelMode = "stairs";
  player.travel = {
    startFloor,
    targetFloor,
    startX,
    startY: floorLevels[startFloor],
    endX,
    endY: floorLevels[targetFloor],
    frame: 0,
    total: STAIR_TRAVEL_FRAMES,
  };
  player.x = startX;
  player.y = floorLevels[startFloor];
  player.crouching = false;
  player.transitionCooldown = STAIR_TRAVEL_FRAMES + 6;
  createDust(startX, player.y - 12, "#eef4ff");
}

function requestElevatorToFloor(floor) {
  if (!elevator || elevator.moving || elevator.currentFloor === floor) {
    return;
  }

  elevator.targetFloor = floor;
  elevator.moving = true;
  elevator.callOnly = true;
  elevator.occupants = [];
}

function startElevatorRide(player, direction) {
  if (!elevator) {
    return;
  }

  const targetFloor = player.floor + direction;
  if (targetFloor < 0 || targetFloor >= floorLevels.length) {
    return;
  }

  if (elevator.moving) {
    return;
  }

  if (elevator.currentFloor !== player.floor) {
    requestElevatorToFloor(player.floor);
    showMessage("电梯正在过来", 70);
    return;
  }

  const riders = players.filter((candidate) => candidate.alive && candidate.floor === player.floor && inElevatorZone(candidate));
  if (riders.length === 0) {
    return;
  }

  elevator.targetFloor = targetFloor;
  elevator.moving = true;
  elevator.callOnly = false;
  elevator.occupants = riders.map((candidate) => candidate.id);

  riders.forEach((candidate) => {
    candidate.travelMode = "elevator";
    candidate.travel = { targetFloor };
    candidate.transitionCooldown = 12;
    candidate.crouching = false;
  });

  showMessage("电梯启动", 70);
}

function updateTravelingPlayer(player) {
  if (player.travelMode !== "stairs" || !player.travel) {
    return false;
  }

  const travel = player.travel;
  travel.frame += 1;
  const t = clamp(travel.frame / travel.total, 0, 1);
  const eased = t < 0.5 ? 2 * t * t : 1 - (Math.pow(-2 * t + 2, 2) / 2);
  player.x = travel.startX + (travel.endX - travel.startX) * eased;
  player.y = travel.startY + (travel.endY - travel.startY) * eased;
  player.facing = travel.endX >= travel.startX ? 1 : -1;

  if (t >= 1) {
    player.floor = travel.targetFloor;
    player.x = travel.endX;
    player.y = travel.endY;
    player.travelMode = null;
    player.travel = null;
    player.transitionCooldown = 10;
  }

  return true;
}

function updateElevator() {
  if (!elevator) {
    return;
  }

  if (!elevator.moving) {
    elevator.y = floorLevels[elevator.currentFloor] - elevatorShaft.carH;
    return;
  }

  const targetY = floorLevels[elevator.targetFloor] - elevatorShaft.carH;
  const delta = targetY - elevator.y;
  const step = Math.min(Math.abs(delta), ELEVATOR_SPEED);
  elevator.y += Math.sign(delta) * step;

  const centerX = getElevatorCenterX();
  elevator.occupants.forEach((occupantId) => {
    const rider = players.find((player) => player.id === occupantId);
    if (!rider) {
      return;
    }
    rider.x = centerX;
    rider.y = elevator.y + elevatorShaft.carH;
  });

  if (Math.abs(targetY - elevator.y) > 0.001) {
    return;
  }

  elevator.currentFloor = elevator.targetFloor;
  elevator.y = targetY;
  elevator.moving = false;

  if (elevator.callOnly) {
    elevator.callOnly = false;
    showMessage("电梯已到达", 60);
    return;
  }

  elevator.occupants.forEach((occupantId) => {
    const rider = players.find((player) => player.id === occupantId);
    if (!rider) {
      return;
    }
    rider.floor = elevator.targetFloor;
    rider.y = floorLevels[elevator.targetFloor];
    rider.travelMode = null;
    rider.travel = null;
    rider.transitionCooldown = 10;
    createDust(rider.x, rider.y - 12, "#d7f2ff");
  });
  elevator.occupants = [];
  showMessage("电梯到站", 60);
}

function inAnyStairZone(player) {
  return inStairZone(player);
}

function attemptFloorChange(player, direction) {
  if (player.transitionCooldown > 0 || player.travelMode) {
    return;
  }

  const targetFloor = player.floor + direction;
  if (targetFloor < 0 || targetFloor >= floorLevels.length) {
    return;
  }

  if (inStairZone(player, direction)) {
    startStairTravel(player, targetFloor);
    return;
  }

  if (inElevatorZone(player)) {
    startElevatorRide(player, direction);
  }
}

function getPlayerEyeY(player) {
  return player.y - (player.crouching ? 38 : 52);
}

function getPlayerTargetY(player) {
  return player.y - getPlayerHeight(player) * 0.58;
}

function moveTowardsX(player, targetX, tolerance = 10, speedScale = 1) {
  const delta = targetX - player.x;
  if (Math.abs(delta) <= tolerance) {
    return true;
  }

  const direction = Math.sign(delta);
  player.facing = direction;
  player.crouching = false;
  movePlayerHorizontally(player, direction * getEffectiveMoveSpeed(player) * speedScale);
  return Math.abs(targetX - player.x) <= tolerance;
}

function moveAwayFromX(player, sourceX, minDistance = BREACH_BLAST_RADIUS + 40) {
  const delta = player.x - sourceX;
  if (Math.abs(delta) >= minDistance) {
    return true;
  }

  const direction = delta === 0 ? (player.x <= WIDTH / 2 ? -1 : 1) : Math.sign(delta);
  const targetX = clamp(
    sourceX + direction * minDistance,
    floorBounds[player.floor].minX + PLAYER_W / 2,
    floorBounds[player.floor].maxX - PLAYER_W / 2,
  );
  return moveTowardsX(player, targetX, 14, 1.08);
}

function getVisibleEnemyShot(player, enemy) {
  const visual = evaluateVisualContact(player, enemy);
  player.aiState.lastVisualSense = visual;
  if (!visual || visual.certainty !== "confirmed") {
    return null;
  }

  return {
    angle: visual.angle,
    distance: visual.distance,
    targetY: visual.targetY,
    confidence: visual.confidence,
  };
}

function getBlockingDoor(floor, fromX, toX) {
  const minX = Math.min(fromX, toX);
  const maxX = Math.max(fromX, toX);
  const candidates = doors
    .filter((door) => door.floor === floor && !door.open && !door.destroyed && door.x >= minX - 18 && door.x <= maxX + 18)
    .sort((a, b) => Math.abs(a.x - fromX) - Math.abs(b.x - fromX));
  return candidates[0] || null;
}

function chooseTraversalMode(player, targetFloor) {
  if (player.controlMode === "ai") {
    if (player.role === "defender" && elevator) {
      const floorDelta = Math.abs(targetFloor - player.floor);
      const stairHub = getStairLandingX(player.floor, Math.sign(targetFloor - player.floor));
      const elevatorHub = getElevatorCenterX();
      const stairCost = Math.abs(player.x - stairHub) + floorDelta * 176;
      let elevatorCost = Math.abs(player.x - elevatorHub) + floorDelta * 106;
      let tacticalStairCost = stairCost;
      let tacticalElevatorCost = elevatorCost;
      const confidence = player.aiState.threatConfidence || 0;
      const knownFloor = confidence > 0.12 ? getKnownEnemyFloor(player) : null;
      const knownX = confidence > 0.12 ? getKnownEnemyX(player) : null;

      if (elevator.moving) {
        elevatorCost += 120;
        tacticalElevatorCost += 120;
      }
      if (elevator.currentFloor !== player.floor) {
        const waitCost = 50 + Math.abs(elevator.currentFloor - player.floor) * 38;
        elevatorCost += waitCost;
        tacticalElevatorCost += waitCost;
      }
      if (knownFloor !== null && knownX !== null) {
        const routePressure = 180 * confidence;
        if (knownFloor === player.floor) {
          tacticalStairCost += Math.max(0, routePressure - Math.abs(knownX - stairHub) * 0.35);
          tacticalElevatorCost += Math.max(0, routePressure + 80 - Math.abs(knownX - elevatorHub) * 0.28);
        }
        if (knownFloor === targetFloor && targetFloor >= objectiveZone.floor - 1) {
          tacticalElevatorCost += 90 * confidence;
        }
        if (player.health < player.maxHealth * 0.45) {
          tacticalElevatorCost += 110;
        }
      }

      if ((player.floor >= 2 || targetFloor >= 2) && tacticalElevatorCost <= tacticalStairCost + 145) {
        return "elevator";
      }
      if (player.x >= buildingRect.x + 980 && tacticalElevatorCost < tacticalStairCost) {
        return "elevator";
      }
    }
    return "stairs";
  }

  if (!elevator) {
    return "stairs";
  }

  const floorDelta = Math.abs(targetFloor - player.floor);
  const stairCost = Math.abs(player.x - getStairLandingX(player.floor, Math.sign(targetFloor - player.floor))) + floorDelta * 150;
  let elevatorCost = Math.abs(player.x - getElevatorCenterX()) + floorDelta * 110;

  if (elevator.moving) {
    elevatorCost += 180;
  }
  if (elevator.currentFloor !== player.floor) {
    elevatorCost += 70 + Math.abs(elevator.currentFloor - player.floor) * 48;
  }

  if (floorDelta === 1 && stairCost <= elevatorCost + 24) {
    return "stairs";
  }

  return elevatorCost < stairCost ? "elevator" : "stairs";
}

function getTraversalDirective(player, targetFloor) {
  if (targetFloor === player.floor) {
    return null;
  }

  const mode = chooseTraversalMode(player, targetFloor);
  const direction = Math.sign(targetFloor - player.floor);
  return {
    mode,
    direction,
    hubX: mode === "elevator" ? getElevatorCenterX() : getStairLandingX(player.floor, direction),
  };
}

function travelTowardFloor(player, targetFloor) {
  const directive = getTraversalDirective(player, targetFloor);
  if (!directive) {
    return { arrived: true, blocker: null, targetX: player.x };
  }

  const blocker = getBlockingDoor(player.floor, player.x, directive.hubX);
  if (blocker) {
    return { arrived: false, blocker, targetX: directive.hubX };
  }

  if (!moveTowardsX(player, directive.hubX, directive.mode === "elevator" ? 14 : 18)) {
    return { arrived: false, blocker: null, targetX: directive.hubX };
  }

  attemptFloorChange(player, directive.direction);
  return { arrived: false, blocker: null, targetX: directive.hubX };
}

function advanceToPoint(player, targetFloor, targetX, tolerance = 14) {
  if (player.floor !== targetFloor) {
    const travel = travelTowardFloor(player, targetFloor);
    if (travel.blocker) {
      return { state: "blocked", blocker: travel.blocker, targetX: travel.targetX };
    }
    return { state: travel.arrived ? "arrived" : "traveling", blocker: null, targetX: travel.targetX };
  }

  const blocker = getBlockingDoor(player.floor, player.x, targetX);
  if (blocker) {
    return { state: "blocked", blocker, targetX };
  }

  if (!moveTowardsX(player, targetX, tolerance)) {
    return { state: "moving", blocker: null, targetX };
  }

  return { state: "arrived", blocker: null, targetX };
}

function getAttackerDoorStackX(door) {
  return clamp(door.x - 28, floorBounds[door.floor].minX + PLAYER_W / 2, floorBounds[door.floor].maxX - PLAYER_W / 2);
}

function getDefenderDoorServiceX(door) {
  return clamp(door.x + 24, floorBounds[door.floor].minX + PLAYER_W / 2, floorBounds[door.floor].maxX - PLAYER_W / 2);
}

function getFloorAssaultAnchor(floor) {
  if (floor === 0) {
    return buildingRect.x + 452;
  }
  if (floor === 1) {
    return buildingRect.x + 826;
  }
  if (floor === 2) {
    return buildingRect.x + 1036;
  }
  return objectiveZone.x - 74;
}

function getDefenderFallbackAnchor(floor = objectiveZone.floor) {
  if (floor === 2) {
    return buildingRect.x + 1168;
  }
  return objectiveZone.x + 118;
}

function getDefenderSupportAnchor(floor) {
  if (floor <= 1) {
    return buildingRect.x + 1034;
  }
  if (floor === 2) {
    return buildingRect.x + 1118;
  }
  return objectiveZone.x - 154;
}

function setAiThreatMemory(player, floor, x, timer, confidence, source, canBroadcast = true) {
  const trackedFloor = clamp(Math.round(floor), 0, floorLevels.length - 1);
  const lane = floorBounds[trackedFloor];
  const trackedX = clamp(x, lane.minX + PLAYER_W / 2, lane.maxX - PLAYER_W / 2);

  player.aiState.lastSeenFloor = trackedFloor;
  player.aiState.lastSeenX = trackedX;
  player.aiState.lastSeenTimer = Math.max(player.aiState.lastSeenTimer || 0, timer);
  player.aiState.threatConfidence = Math.max(player.aiState.threatConfidence || 0, confidence);
  player.aiState.lastThreatSource = source;
  if (canBroadcast) {
    queueAiIntel(player, "confirmed", trackedFloor, trackedX, confidence, source);
  }
}

function setAiSuspicion(player, floor, x, timer, confidence, source, canBroadcast = true) {
  const trackedFloor = clamp(Math.round(floor), 0, floorLevels.length - 1);
  const lane = floorBounds[trackedFloor];
  player.aiState.suspicionFloor = trackedFloor;
  player.aiState.suspicionX = clamp(x, lane.minX + PLAYER_W / 2, lane.maxX - PLAYER_W / 2);
  player.aiState.suspicionTimer = Math.max(player.aiState.suspicionTimer || 0, timer);
  player.aiState.threatConfidence = Math.max(player.aiState.threatConfidence || 0, confidence);
  player.aiState.lastThreatSource = source;
  if (canBroadcast) {
    queueAiIntel(player, "suspicious", trackedFloor, player.aiState.suspicionX, confidence, source);
  }
}

function decayAiThreatMemory(player) {
  if (player.aiState.lastSeenTimer > 0) {
    player.aiState.lastSeenTimer -= 1;
  } else {
    player.aiState.lastSeenFloor = null;
    player.aiState.lastSeenX = null;
  }

  if (player.aiState.suspicionTimer > 0) {
    player.aiState.suspicionTimer -= 1;
  } else {
    player.aiState.suspicionFloor = null;
    player.aiState.suspicionX = null;
  }

  player.aiState.threatConfidence = Math.max(0, (player.aiState.threatConfidence || 0) * AI_THREAT_CONFIDENCE_DECAY);
  if (player.aiState.threatConfidence < 0.04) {
    player.aiState.threatConfidence = 0;
    player.aiState.lastThreatSource = "none";
  }

  if (player.aiState.lastHeardTimer > 0) {
    player.aiState.lastHeardTimer -= 1;
  } else {
    player.aiState.lastHeardFloor = null;
    player.aiState.lastHeardX = null;
  }
}

function evaluateVisualContact(player, enemy) {
  // Vision cone + LOS + reaction delay: prevents instant lock-on.
  if (!enemy || !enemy.alive || player.floor !== enemy.floor) {
    player.aiState.hadVisualLastFrame = false;
    player.aiState.visionReactTimer = 0;
    return null;
  }

  const tuning = getAiTuning(player);
  const originY = getPlayerEyeY(player);
  const targetY = getPlayerTargetY(enemy);
  const dx = enemy.x - player.x;
  const dy = targetY - originY;
  const linearDistance = Math.hypot(dx, dy);
  if (linearDistance > tuning.visionRange) {
    player.aiState.hadVisualLastFrame = false;
    player.aiState.visionReactTimer = 0;
    return null;
  }

  if (lineBlocked(player.x, originY, enemy.x, targetY, player.floor)) {
    player.aiState.hadVisualLastFrame = false;
    player.aiState.visionReactTimer = 0;
    return null;
  }

  const frontalHalf = (tuning.frontalFovDeg * Math.PI) / 360;
  const peripheralHalf = (tuning.peripheralFovDeg * Math.PI) / 360;
  const targetAngle = Math.atan2(dy, dx);
  const facingDelta = angleDiff(targetAngle, getFacingAngle(player));
  const confidence = clamp(1 - linearDistance / Math.max(1, tuning.visionRange), 0.2, 1);

  if (facingDelta <= frontalHalf) {
    if (!player.aiState.hadVisualLastFrame) {
      player.aiState.visionReactTimer = Math.round(rand(tuning.reactionMin, tuning.reactionMax));
      player.aiState.hadVisualLastFrame = true;
    }
    if (player.aiState.visionReactTimer > 0) {
      player.aiState.visionReactTimer -= 1;
      return {
        certainty: "warming",
        angle: targetAngle,
        distance: Math.abs(dx),
        targetY,
        confidence: confidence * 0.7,
      };
    }
    return {
      certainty: "confirmed",
      angle: targetAngle,
      distance: Math.abs(dx),
      targetY,
      confidence: clamp(confidence + 0.18, 0.35, 1),
    };
  }

  player.aiState.hadVisualLastFrame = false;
  if (facingDelta <= frontalHalf + peripheralHalf) {
    return {
      certainty: "peripheral",
      angle: targetAngle,
      distance: Math.abs(dx),
      targetY,
      confidence: confidence * 0.46,
    };
  }
  return null;
}

function processAiHearing(player) {
  // Aggregate nearby sound events into suspicious intel, with floor and occlusion penalties.
  let best = null;
  const tuning = getAiTuning(player);
  for (const event of aiSoundEvents) {
    if (event.ttl <= 0 || event.ownerId === player.id) {
      continue;
    }
    if (event.sourceRole === player.role) {
      continue;
    }
    const floorDistance = Math.abs(event.floor - player.floor);
    if (floorDistance > 1) {
      continue;
    }
    const sameFloor = event.floor === player.floor;
    const verticalPenalty = sameFloor ? 1 : 0.58;
    const heardRadius = event.radius * tuning.hearingScale * verticalPenalty;
    const heardDistance = Math.abs(event.x - player.x) + floorDistance * 130;
    if (heardDistance > heardRadius) {
      continue;
    }
    const blockedPenalty = sameFloor && lineBlocked(player.x, getPlayerEyeY(player), event.x, floorLevels[event.floor] - 46, player.floor)
      ? 0.66
      : 1;
    const confidence = clamp(event.confidence * (1 - heardDistance / Math.max(1, heardRadius)) * blockedPenalty + 0.22, 0.16, 0.92);
    if (!best || confidence > best.confidence) {
      best = {
        floor: event.floor,
        x: event.x,
        confidence,
        source: `sound-${event.type}`,
      };
    }
  }

  if (best) {
    player.aiState.lastHeardFloor = best.floor;
    player.aiState.lastHeardX = best.x;
    player.aiState.lastHeardTimer = AI_SOUND_MEMORY_FRAMES;
    setAiSuspicion(player, best.floor, best.x, AI_SOUND_MEMORY_FRAMES, best.confidence, best.source);
  }
}

function updateAiIntelNetwork(player) {
  // Team shares intel with delay and communication range limits.
  const tuning = getAiTuning(player);
  for (const intel of aiIntelEvents) {
    if (intel.ttl <= 0 || intel.role !== player.role || intel.sourceId === player.id) {
      continue;
    }
    const relayRange = 520 + tuning.teamwork * 420;
    const floorPenalty = Math.abs(intel.floor - player.floor) * 170;
    if (Math.abs(intel.x - player.x) + floorPenalty > relayRange) {
      continue;
    }
    intel.delay -= 1;
    if (intel.delay > 0) {
      continue;
    }
    if (intel.kind === "confirmed") {
      setAiThreatMemory(player, intel.floor, intel.x, AI_VISIBLE_MEMORY_FRAMES * 0.75, intel.confidence * 0.9, `ally-${intel.reason}`, false);
    } else {
      setAiSuspicion(player, intel.floor, intel.x, AI_SOUND_MEMORY_FRAMES, intel.confidence * 0.88, `ally-${intel.reason}`, false);
    }
    intel.ttl = 0;
  }
}

function updateEnemyMemory(player, enemy, visibleShot = null) {
  if (enemy && enemy.alive && visibleShot) {
    setAiThreatMemory(player, enemy.floor, enemy.x, AI_VISIBLE_MEMORY_FRAMES, 1, "visual");
    return;
  }

  if (enemy && enemy.alive) {
    const glimpse = player.aiState.lastVisualSense || null;
    if (glimpse && glimpse.certainty === "peripheral") {
      setAiSuspicion(player, enemy.floor, enemy.x, AI_SOUND_MEMORY_FRAMES, glimpse.confidence, "peripheral-visual");
      return;
    }
  }

  decayAiThreatMemory(player);
}

function getKnownEnemyFloor(player) {
  if (player.aiState.lastSeenTimer > 0 && player.aiState.lastSeenFloor !== null) {
    return player.aiState.lastSeenFloor;
  }
  if (player.aiState.suspicionTimer > 0 && player.aiState.suspicionFloor !== null) {
    return player.aiState.suspicionFloor;
  }
  return objectiveZone.floor;
}

function getKnownEnemyX(player) {
  if (player.aiState.lastSeenTimer > 0 && player.aiState.lastSeenX !== null) {
    return player.aiState.lastSeenX;
  }
  if (player.aiState.suspicionTimer > 0 && player.aiState.suspicionX !== null) {
    return player.aiState.suspicionX;
  }
  return getFloorAssaultAnchor(objectiveZone.floor);
}

function getDefenderChargeSignal() {
  const signals = breachCharges
    .map((charge) => {
      const owner = players.find((player) => player.id === charge.ownerId);
      return { charge, owner };
    })
    .filter(({ owner }) => !owner || owner.role === "attacker")
    .sort((a, b) => a.charge.timer - b.charge.timer);
  return signals[0]?.charge || null;
}

function getDefenderDoorSignal() {
  const candidates = doors
    .filter((door) => {
      if (door.initialOpen) {
        return false;
      }
      if (door.lastDisturbanceRole && door.lastDisturbanceRole !== "attacker") {
        return false;
      }
      return (door.lastDamageTimer || 0) > 0 || (door.lastCompromisedTimer || 0) > 0 || door.destroyed;
    })
    .map((door) => {
      const urgency = (door.lastCompromisedTimer || 0) > 0 || door.destroyed ? 1 : 0;
      return {
        door,
        score: door.floor * 160 + urgency * 260 + (door.lastDamageTimer || 0) * 0.12,
      };
    })
    .sort((a, b) => b.score - a.score);
  return candidates[0]?.door || null;
}

function updateDefenderPerception(player, enemy, visibleShot) {
  updateEnemyMemory(player, enemy, visibleShot);
  if (visibleShot && enemy && enemy.alive) {
    return;
  }

  const chargeSignal = getDefenderChargeSignal();
  if (chargeSignal) {
    setAiSuspicion(player, chargeSignal.floor, chargeSignal.x, AI_SOUND_MEMORY_FRAMES + 90, 0.9, "breach-charge");
    return;
  }

  const doorSignal = getDefenderDoorSignal();
  if (doorSignal) {
    setAiSuspicion(player, doorSignal.floor, doorSignal.x, AI_SOUND_MEMORY_FRAMES, doorSignal.destroyed ? 0.82 : 0.68, "door-noise");
    return;
  }

  if (captureProgress > 0.04) {
    setAiSuspicion(player, objectiveZone.floor, objectiveZone.x, AI_SOUND_MEMORY_FRAMES, 0.88, "objective-alarm");
  }
}

function hasFriendlyInBlastRadius(player, floor, blastX, radius = BREACH_BLAST_RADIUS + 16) {
  return players.some(
    (unit) => unit.alive && unit.id !== player.id && unit.role === player.role && unit.floor === floor && Math.abs(unit.x - blastX) <= radius,
  );
}

function hasSafeRetreatFromDoor(player, door, safetyDistance = BREACH_BLAST_RADIUS + 58) {
  if (!door || player.floor !== door.floor) {
    return false;
  }

  const lane = floorBounds[door.floor];
  const minX = lane.minX + PLAYER_W / 2;
  const maxX = lane.maxX - PLAYER_W / 2;
  const leftSpace = door.x - minX;
  const rightSpace = maxX - door.x;
  const playerOnLeft = player.x <= door.x;
  const retreatSpace = playerOnLeft ? leftSpace : rightSpace;
  return retreatSpace >= safetyDistance;
}

function handleDefenderPathBlocker(player, blocker, tolerance = 16) {
  if (!blocker || blocker.floor !== player.floor) {
    return false;
  }

  if (Math.abs(blocker.x - player.x) <= 64) {
    openDoorForAiPassage(player, blocker);
    if (blocker.open || blocker.destroyed) {
      return true;
    }
  }

  if (!moveTowardsX(player, getDefenderDoorServiceX(blocker), tolerance)) {
    return true;
  }

  openDoorForAiPassage(player, blocker);
  return true;
}

function shouldUseChargeOnDoor(player, door, enemy) {
  if (player.inventory.breach <= 0) {
    return false;
  }

  if (!hasSafeRetreatFromDoor(player, door)) {
    return false;
  }

  if (hasFriendlyInBlastRadius(player, door.floor, door.x)) {
    return false;
  }

  if (door.fortified || door.id.startsWith("entry") || door.id.startsWith("crown")) {
    return true;
  }

  if (enemy && enemy.alive && enemy.floor === door.floor && Math.abs(enemy.x - door.x) < 260) {
    return true;
  }

  return roundPhase === "combat" && roundTimer < 42 * 60;
}

function switchWeaponTo(player, weaponId) {
  const nextIndex = player.weaponSet.indexOf(weaponId);
  if (nextIndex >= 0) {
    player.weaponIndex = nextIndex;
  }
}

function getUsefulSupplyCache(player) {
  let best = null;
  let bestScore = Infinity;

  for (const cache of supplyCaches) {
    if (cache.consumed) {
      continue;
    }

    if (cache.type === "med" && player.health > player.maxHealth * 0.72) {
      continue;
    }

    if (player.role === "attacker") {
      if (cache.type === "breach" && player.inventory.breach >= 2) {
        continue;
      }
      if (cache.type === "tools" && player.inventory.breach >= 3 && player.health > player.maxHealth * 0.8) {
        continue;
      }
    } else {
      if (cache.type === "breach" && player.inventory.trap >= 5) {
        continue;
      }
      if (cache.type === "tools" && player.inventory.trap >= 5 && player.inventory.barricade >= 2) {
        continue;
      }
    }

    const score = Math.abs(cache.floor - player.floor) * 360 + Math.abs(cache.x - player.x);
    if (score < bestScore) {
      bestScore = score;
      best = cache;
    }
  }

  return best;
}

function getNearestChargeThreat(player) {
  const threats = breachCharges
    .filter((charge) => charge.floor === player.floor && charge.timer <= 150 && Math.abs(charge.x - player.x) <= BREACH_BLAST_RADIUS + 48)
    .sort((a, b) => Math.abs(a.x - player.x) - Math.abs(b.x - player.x));
  return threats[0] || null;
}

function secureDoorForAi(player, door) {
  if (!door || door.floor !== player.floor || door.destroyed || player.abilityCooldown > 0) {
    return false;
  }

  if (Math.abs(door.x - player.x) > 64) {
    return false;
  }

  let changed = false;
  if (door.open) {
    setDoorClosed(door, door.aiPassageWasFortified || false);
    changed = true;
  } else if (!door.fortified && door.hp >= door.maxHp) {
    setDoorClosed(door, true);
    changed = true;
  }

  if (!changed) {
    return false;
  }

  player.abilityCooldown = 24;
  playDoorSound();
  emitAiSoundEvent("door", { id: player.id, role: player.role, floor: door.floor, x: door.x }, 320, 0.6);
  createSpark(door.x, floorLevels[door.floor] - 42, "#95ffb5", 5);
  return true;
}

function openDoorForAiPassage(player, door) {
  if (!door || door.floor !== player.floor || player.role !== "defender" || player.abilityCooldown > 0) {
    return false;
  }

  if (Math.abs(door.x - player.x) > 64) {
    return false;
  }

  if (door.open || door.destroyed) {
    return true;
  }

  if (hasEnemyNearDoor(player.role, door, 220) || getPendingBreachCharge(door.id)) {
    return false;
  }

  door.aiPassageBy = player.id;
  door.aiPassageWasFortified = door.fortified;
  door.aiPassageTimer = AI_PASSAGE_DOOR_FRAMES;
  door.open = true;
  door.destroyed = false;
  door.fortified = false;
  door.hp = 0;
  player.abilityCooldown = 20;
  playDoorSound();
  emitAiSoundEvent("door", { id: player.id, role: player.role, floor: door.floor, x: door.x }, 320, 0.58);
  return true;
}

function scoreDefenderDoorForSetup(door) {
  if (!door || door.floor < 2 || door.initialOpen || door.id.startsWith("entry")) {
    return -Infinity;
  }
  const objectiveDistance = Math.abs(door.floor - objectiveZone.floor) * 260 + Math.abs(door.x - objectiveZone.x) * 0.25;
  const stairDistance = Math.min(
    ...stairSegments
      .filter((segment) => segment.lowerFloor === door.floor || segment.lowerFloor === door.floor - 1)
      .map((segment) => Math.min(Math.abs(door.x - segment.bottomX), Math.abs(door.x - segment.topX))),
    420,
  );
  const elevatorDistance = Math.abs(door.x - getElevatorCenterX());
  const chokeScore = Math.max(0, 220 - stairDistance) * 0.8 + Math.max(0, 240 - elevatorDistance) * 0.55;
  const depthScore = door.floor * 150 + (door.floor === objectiveZone.floor ? 220 : 0);
  return depthScore + chokeScore - objectiveDistance;
}

function getDefenderTurretCandidates() {
  return [
    { floor: objectiveZone.floor, x: objectiveZone.x - 188, facing: -1, role: "objective-left" },
    { floor: objectiveZone.floor, x: objectiveZone.x + 126, facing: 1, role: "objective-right" },
    { floor: 2, x: buildingRect.x + 1042, facing: -1, role: "second-line" },
    { floor: 2, x: getElevatorCenterX() - 232, facing: -1, role: "elevator-crossfire" },
  ];
}

function getDefenderAiPlan(player = null) {
  if (player && player.aiState.tacticalPlan) {
    return player.aiState.tacticalPlan;
  }

  const doorTargets = doors
    .filter((door) => scoreDefenderDoorForSetup(door) > -Infinity)
    .sort((a, b) => scoreDefenderDoorForSetup(b) - scoreDefenderDoorForSetup(a));
  const turretTarget = getDefenderTurretCandidates()[0];
  const plan = [];

  doorTargets.slice(0, 3).forEach((door, index) => {
    plan.push({ type: "door", doorId: door.id });
    if (index < 2) {
      const trapX = clamp(
        door.x - 54,
        floorBounds[door.floor].minX + 44,
        floorBounds[door.floor].maxX - 44,
      );
      plan.push({ type: "trap", floor: door.floor, x: trapX, facing: -1 });
    }
  });

  plan.splice(Math.min(3, plan.length), 0, {
    type: "turret",
    floor: turretTarget.floor,
    x: turretTarget.x,
    facing: turretTarget.facing,
  });

  const fallbackDoor = doorTargets.find((door) => door.floor === 2) || doorTargets[0];
  if (fallbackDoor) {
    const barricadeX = clamp(
      fallbackDoor.x + 106,
      floorBounds[fallbackDoor.floor].minX + 68,
      floorBounds[fallbackDoor.floor].maxX - 68,
    );
    plan.push({ type: "barricade", floor: fallbackDoor.floor, x: barricadeX, facing: -1 });
  }

  if (player) {
    player.aiState.tacticalPlan = plan;
  }
  return plan;
}

function advanceAiPlan(player) {
  player.aiState.planIndex += 1;
  player.aiState.holdUntil = Math.max(player.aiState.holdUntil, 18);
}

function aiPlaceTrapAt(player, floor, targetX, facing = -1) {
  if (player.inventory.trap <= 0 || mines.some((mine) => mine.floor === floor && Math.abs(mine.x - targetX) < 40)) {
    return true;
  }

  const travel = travelTowardFloor(player, floor);
  if (!travel.arrived) {
    if (travel.blocker) {
      handleDefenderPathBlocker(player, travel.blocker);
    }
    return false;
  }

  player.facing = facing;
  const stagingX = clamp(
    targetX - facing * 28,
    floorBounds[player.floor].minX + PLAYER_W / 2,
    floorBounds[player.floor].maxX - PLAYER_W / 2,
  );
  const blocker = getBlockingDoor(player.floor, player.x, stagingX);
  if (blocker) {
    handleDefenderPathBlocker(player, blocker);
    return false;
  }
  if (!moveTowardsX(player, stagingX, 14)) {
    return false;
  }

  const before = mines.length;
  placeTrap(player);
  if (mines.length > before) {
    player.abilityCooldown = Math.max(player.abilityCooldown, 26);
    player.aiState.holdUntil = 24;
    return true;
  }

  return mines.some((mine) => mine.floor === floor && Math.abs(mine.x - targetX) < 40);
}

function aiPlaceTurretAt(player, floor, targetX, facing = -1) {
  if (player.inventory.turret <= 0 || turrets.some((turret) => turret.floor === floor && Math.abs(turret.x - targetX) < 78)) {
    return true;
  }

  const travel = travelTowardFloor(player, floor);
  if (!travel.arrived) {
    if (travel.blocker) {
      handleDefenderPathBlocker(player, travel.blocker);
    }
    return false;
  }

  player.facing = facing;
  const stagingX = clamp(
    targetX - facing * 36,
    floorBounds[player.floor].minX + PLAYER_W / 2,
    floorBounds[player.floor].maxX - PLAYER_W / 2,
  );
  const blocker = getBlockingDoor(player.floor, player.x, stagingX);
  if (blocker) {
    handleDefenderPathBlocker(player, blocker);
    return false;
  }
  if (!moveTowardsX(player, stagingX, 14)) {
    return false;
  }

  const before = turrets.length;
  placeTurret(player);
  if (turrets.length > before) {
    player.abilityCooldown = Math.max(player.abilityCooldown, 28);
    player.aiState.holdUntil = 28;
    return true;
  }

  return turrets.some((turret) => turret.floor === floor && Math.abs(turret.x - targetX) < 78);
}

function isDefenderBarricadeSpotSafe(floor, x) {
  const rect = {
    x: x - 22,
    y: floorLevels[floor] - 92,
    w: 44,
    h: 92,
  };
  const tooCloseToDoor = doors.some((door) => door.floor === floor && Math.abs(door.x - x) < 92);
  const tooCloseToStairs = stairSegments.some(
    (segment) => (segment.lowerFloor === floor || segment.lowerFloor === floor - 1)
      && Math.min(Math.abs(x - segment.bottomX), Math.abs(x - segment.topX)) < 110,
  );
  const tooCloseToElevator = Math.abs(x - getElevatorCenterX()) < 120;
  const tooCloseToObjective = floor === objectiveZone.floor && Math.abs(x - objectiveZone.x) < objectiveZone.w / 2 + 86;
  return !tooCloseToDoor && !tooCloseToStairs && !tooCloseToElevator && !tooCloseToObjective && canPlaceRect(rect, floor);
}

function aiPlaceBarricadeAt(player, floor, targetX, facing = -1) {
  if (player.inventory.barricade <= 0 || barricades.some((barricade) => barricade.floor === floor && Math.abs(barricade.x - targetX) < 70)) {
    return true;
  }
  if (!isDefenderBarricadeSpotSafe(floor, targetX)) {
    return true;
  }

  const travel = travelTowardFloor(player, floor);
  if (!travel.arrived) {
    if (travel.blocker) {
      handleDefenderPathBlocker(player, travel.blocker);
    }
    return false;
  }

  player.facing = facing;
  const stagingX = clamp(
    targetX - facing * 46,
    floorBounds[player.floor].minX + PLAYER_W / 2,
    floorBounds[player.floor].maxX - PLAYER_W / 2,
  );
  const blocker = getBlockingDoor(player.floor, player.x, stagingX);
  if (blocker) {
    handleDefenderPathBlocker(player, blocker);
    return false;
  }
  if (!moveTowardsX(player, stagingX, 14)) {
    return false;
  }

  const before = barricades.length;
  placeBarricade(player);
  if (barricades.length > before) {
    player.abilityCooldown = Math.max(player.abilityCooldown, 30);
    player.aiState.holdUntil = 24;
    return true;
  }

  return barricades.some((barricade) => barricade.floor === floor && Math.abs(barricade.x - targetX) < 70);
}

function runDefenderSetupPlan(player) {
  const plan = getDefenderAiPlan(player)[player.aiState.planIndex];
  if (!plan) {
    return false;
  }

  if (player.aiState.holdUntil > 0) {
    player.aiState.holdUntil -= 1;
    return true;
  }

  if (plan.type === "door") {
    const door = getDoorById(plan.doorId);
    if (!door || door.destroyed || (door.fortified && !door.open)) {
      advanceAiPlan(player);
      return true;
    }

    const travel = travelTowardFloor(player, door.floor);
    if (!travel.arrived) {
      if (travel.blocker) {
        handleDefenderPathBlocker(player, travel.blocker);
      }
      return true;
    }

    if (!moveTowardsX(player, getDefenderDoorServiceX(door), 18)) {
      return true;
    }

    secureDoorForAi(player, door);
    if (door.fortified && !door.open) {
      advanceAiPlan(player);
    }
    return true;
  }

  if (plan.type === "trap") {
    if (aiPlaceTrapAt(player, plan.floor, plan.x, plan.facing)) {
      advanceAiPlan(player);
    }
    return true;
  }

  if (plan.type === "turret") {
    if (aiPlaceTurretAt(player, plan.floor, plan.x, plan.facing)) {
      advanceAiPlan(player);
    }
    return true;
  }

  if (plan.type === "barricade") {
    if (aiPlaceBarricadeAt(player, plan.floor, plan.x, plan.facing)) {
      advanceAiPlan(player);
    }
    return true;
  }

  advanceAiPlan(player);
  return true;
}

function isAiCapturingObjective(player) {
  if (roundPhase !== "combat" || !insideObjective(player)) {
    return false;
  }

  const enemy = getEnemyOf(player);
  const shot = getVisibleEnemyShot(player, enemy);
  return !shot || shot.distance > 250;
}

function handleAttackerDoor(player, door, targetX, enemy) {
  const direction = door.x >= player.x ? 1 : -1;
  const charge = getPendingBreachCharge(door.id);
  const distanceToDoor = Math.abs(door.x - player.x);

  player.aiState.intent = "breach";
  player.facing = direction;
  player.aiAimAngle = direction === 1 ? 0 : Math.PI;

  if (charge) {
    player.aiState.breachDoorId = door.id;
    moveAwayFromX(player, door.x, BREACH_BLAST_RADIUS + 58);
    return;
  }

  const shouldBreach = shouldUseChargeOnDoor(player, door, enemy);
  const stackX = getTeamSpacingOffset(player, door.floor, getAttackerDoorStackX(door), 42);
  const breachStackX = clamp(
    getTeamSpacingOffset(player, door.floor, door.x - direction * 56, 34),
    floorBounds[player.floor].minX + PLAYER_W / 2,
    floorBounds[player.floor].maxX - PLAYER_W / 2,
  );

  if (shouldBreach) {
    const stacked = moveTowardsX(player, breachStackX, 10);
    if (!stacked && distanceToDoor > 46) {
      return;
    }

    if (!hasSafeRetreatFromDoor(player, door)) {
      player.aiState.breachDoorId = null;
      switchWeaponTo(player, "breacher");
      if (distanceToDoor > 66) {
        moveTowardsX(player, stackX, 12);
      } else if (player.fireCooldown === 0) {
        shoot(player);
      }
      return;
    }

    if (player.abilityCooldown === 0) {
      attemptAttackerAbility(player);
      if (getPendingBreachCharge(door.id)) {
        player.aiState.breachDoorId = door.id;
        player.aiState.holdUntil = 22;
        return;
      }
    }

    // Fallback: if charge is unavailable this frame, keep breaching with shotgun instead of idling.
    player.aiState.breachDoorId = null;
    switchWeaponTo(player, "breacher");
    if (distanceToDoor > 62) {
      moveTowardsX(player, stackX, 12);
      return;
    }
    if (player.fireCooldown === 0) {
      shoot(player);
    }
    return;
  }

  player.aiState.breachDoorId = null;
  switchWeaponTo(player, "breacher");
  const weaponId = getCurrentWeaponId(player);
  const desiredOffset = weaponId === "breacher" ? 58 : 150;
  if (distanceToDoor > desiredOffset) {
    moveTowardsX(player, clamp(door.x - direction * desiredOffset, floorBounds[player.floor].minX + 30, floorBounds[player.floor].maxX - 30), 14);
    return;
  }

  if (player.fireCooldown === 0) {
    shoot(player);
  }
}

function getAttackerDeployableTarget(player, objectiveXHint = objectiveZone.x) {
  const targets = [];

  for (const turret of turrets) {
    if (turret.floor !== player.floor) {
      continue;
    }

    const owner = players.find((unit) => unit.id === turret.ownerId);
    if (owner && owner.role === player.role) {
      continue;
    }

    const distanceToTurret = Math.abs(turret.x - player.x);
    const betweenPlayerAndObjective = (turret.x - player.x) * (objectiveXHint - player.x) > 0;
    if (!betweenPlayerAndObjective && distanceToTurret > 360) {
      continue;
    }

    targets.push({
      kind: "turret",
      floor: turret.floor,
      x: turret.x,
      y: getFloorY(turret.floor) - 20,
      distance: distanceToTurret,
      score: distanceToTurret * 0.78,
    });
  }

  for (const barricade of barricades) {
    if (barricade.floor !== player.floor) {
      continue;
    }

    const owner = players.find((unit) => unit.id === barricade.ownerId);
    if (owner && owner.role === player.role) {
      continue;
    }

    const distanceToBarricade = Math.abs(barricade.x - player.x);
    const betweenPlayerAndObjective = (barricade.x - player.x) * (objectiveXHint - player.x) > 0;
    if (!betweenPlayerAndObjective && distanceToBarricade > 320) {
      continue;
    }

    targets.push({
      kind: "barricade",
      floor: barricade.floor,
      x: barricade.x,
      y: getFloorY(barricade.floor) - 42,
      distance: distanceToBarricade,
      score: distanceToBarricade * 1.08 + 18,
    });
  }

  targets.sort((a, b) => a.score - b.score);
  return targets[0] || null;
}

function engageAttackerDeployable(player, target, enemy) {
  if (!target || target.floor !== player.floor) {
    return false;
  }

  const blocker = getBlockingDoor(player.floor, player.x, target.x);
  if (blocker) {
    handleAttackerDoor(player, blocker, target.x, enemy);
    return true;
  }

  const direction = target.x >= player.x ? 1 : -1;
  const preferredRange = target.kind === "turret" ? 160 : 76;
  const fallbackRange = target.kind === "turret" ? 96 : 62;
  const distance = Math.abs(target.x - player.x);

  player.aiState.intent = "attack";
  player.facing = direction;
  player.aiAimAngle = Math.atan2(target.y - getPlayerEyeY(player), target.x - player.x);

  if (target.kind === "barricade" || distance < 120) {
    switchWeaponTo(player, "breacher");
  } else {
    switchWeaponTo(player, "rifle");
  }

  if (distance > preferredRange) {
    const moveToX = clamp(
      target.x - direction * preferredRange,
      floorBounds[player.floor].minX + PLAYER_W / 2,
      floorBounds[player.floor].maxX - PLAYER_W / 2,
    );
    moveTowardsX(player, moveToX, 12, 1.03);
    return true;
  }

  if (distance < fallbackRange) {
    const pullbackX = clamp(
      target.x - direction * (fallbackRange + 20),
      floorBounds[player.floor].minX + PLAYER_W / 2,
      floorBounds[player.floor].maxX - PLAYER_W / 2,
    );
    moveTowardsX(player, pullbackX, 10, 1.04);
  }

  if (player.fireCooldown === 0) {
    shoot(player);
  }

  return true;
}

function updateAttackerAi(player, enemy) {
  const chargeThreat = getNearestChargeThreat(player);
  if (chargeThreat) {
    moveAwayFromX(player, chargeThreat.x);
    return;
  }

  const enemyShot = getVisibleEnemyShot(player, enemy);
  if (enemyShot) {
    switchWeaponTo(player, enemyShot.distance < 96 ? "breacher" : "rifle");
    player.aiAimAngle = enemyShot.angle;
    player.facing = enemy.x >= player.x ? 1 : -1;

    if (getCurrentWeaponId(player) === "breacher" && enemyShot.distance > 86) {
      moveTowardsX(player, enemy.x - player.facing * 54, 12, 1.06);
    }

    if (player.fireCooldown === 0) {
      shoot(player);
    }
    return;
  }

  if (roundPhase === "prep") {
    player.facing = 1;
    return;
  }

  const usefulCache = getUsefulSupplyCache(player);
  if (usefulCache && (player.health <= player.maxHealth * 0.62 || player.inventory.breach <= 1)) {
    const cacheTravel = travelTowardFloor(player, usefulCache.floor);
    if (cacheTravel.blocker) {
      handleAttackerDoor(player, cacheTravel.blocker, cacheTravel.targetX, enemy);
      return;
    }
    if (!cacheTravel.arrived) {
      return;
    }

    const cacheDoor = getBlockingDoor(player.floor, player.x, usefulCache.x);
    if (cacheDoor) {
      handleAttackerDoor(player, cacheDoor, usefulCache.x, enemy);
      return;
    }

    moveTowardsX(player, usefulCache.x, 12);
    return;
  }

  const objectiveTravel = travelTowardFloor(player, objectiveZone.floor);
  if (objectiveTravel.blocker) {
    handleAttackerDoor(player, objectiveTravel.blocker, objectiveTravel.targetX, enemy);
    return;
  }
  if (!objectiveTravel.arrived) {
    return;
  }

  if (insideObjective(player) && isAiCapturingObjective(player)) {
    captureProgress = clamp(captureProgress + 0.0065, 0, 1);
    capturePulse -= 1;
    if (capturePulse <= 0) {
      capturePulse = 14;
      playObjectiveSound();
    }
    if (captureProgress >= 1) {
      endRound(player, `${player.name} 鎺у埗浜?${objectiveZone.label || "缁堢"}`);
    }
    return;
  }

  const objectiveDoor = getBlockingDoor(player.floor, player.x, objectiveZone.x);
  if (objectiveDoor) {
    handleAttackerDoor(player, objectiveDoor, objectiveZone.x, enemy);
    return;
  }

  moveTowardsX(player, getTeamSpacingOffset(player, objectiveZone.floor, objectiveZone.x, 54), insideObjective(player) ? 10 : 16);
}

function updateDefenderAi(player, enemy) {
  runAdvancedDefenderAi(player, enemy);
}

function assignTeamTasks(role, enemy) {
  // Simple fireteam split: nearest suppresses, others attempt flank.
  const squad = players.filter((unit) => unit.alive && unit.role === role && unit.controlMode === "ai");
  if (squad.length <= 1 || !enemy || !enemy.alive) {
    squad.forEach((unit) => {
      unit.aiState.teamTask = "solo";
    });
    return;
  }

  const ordered = [...squad].sort((a, b) => Math.abs(a.x - enemy.x) - Math.abs(b.x - enemy.x));
  ordered.forEach((unit, index) => {
    unit.aiState.teamTask = index === 0 ? "suppress" : "flank";
  });
}

function chooseFlankPoint(player, floor, targetX) {
  if (player.floor !== floor) {
    return null;
  }
  const left = clamp(targetX - 220, floorBounds[floor].minX + PLAYER_W / 2, floorBounds[floor].maxX - PLAYER_W / 2);
  const right = clamp(targetX + 220, floorBounds[floor].minX + PLAYER_W / 2, floorBounds[floor].maxX - PLAYER_W / 2);
  const chooseLeft = Math.abs(left - player.x) < Math.abs(right - player.x);
  return chooseLeft ? left : right;
}

function getTeamSpacingOffset(player, floor, anchorX, spacing = 46) {
  const squad = players
    .filter((unit) => unit.alive && unit.role === player.role && unit.floor === floor)
    .sort((a, b) => a.id.localeCompare(b.id));
  const index = Math.max(0, squad.findIndex((unit) => unit.id === player.id));
  const centered = index - (squad.length - 1) / 2;
  return clamp(anchorX + centered * spacing, floorBounds[floor].minX + PLAYER_W / 2, floorBounds[floor].maxX - PLAYER_W / 2);
}

function getStableDefenderHoldPoint(player, threat, healthRatio, mode = "hold") {
  const desired = getDefenderHoldPoint(threat, healthRatio);
  const currentFloor = player.aiState.holdAnchorFloor;
  const currentX = player.aiState.holdAnchorX;
  const timer = player.aiState.holdAnchorTimer || 0;

  if (timer > 0 && currentFloor !== null && currentX !== null) {
    return { floor: currentFloor, x: currentX };
  }

  const stickyRange = mode === "retreat" ? 92 : 132;
  if (currentFloor === desired.floor && currentX !== null && Math.abs(currentX - desired.x) <= stickyRange) {
    player.aiState.holdAnchorFloor = currentFloor;
    player.aiState.holdAnchorX = currentX;
    player.aiState.holdAnchorTimer = mode === "retreat" ? 14 : 24;
    return { floor: currentFloor, x: currentX };
  }

  player.aiState.holdAnchorFloor = desired.floor;
  player.aiState.holdAnchorX = desired.x;
  player.aiState.holdAnchorTimer = mode === "retreat" ? 12 : 22;
  return desired;
}

function runTakeCoverBehavior(player, threatFloor, threatX, enemy = null) {
  // Move to the highest scoring nearby hard cover and hold crouched.
  const cover = getBestCoverPoint(player, threatFloor, threatX);
  if (!cover) {
    return false;
  }
  player.aiState.coverFloor = cover.floor;
  player.aiState.coverX = cover.x;
  player.aiState.coverScore = cover.score;
  player.aiState.debugPathFloor = cover.floor;
  player.aiState.debugPathX = cover.x;

  const path = advanceToPoint(player, cover.floor, cover.x, 12);
  if (path.state === "blocked") {
    if (player.role === "defender") {
      handleDefenderPathBlocker(player, path.blocker, 16);
    } else {
      handleAttackerDoor(player, path.blocker, cover.x, enemy);
    }
    return true;
  }
  if (path.state !== "arrived") {
    return true;
  }
  player.crouching = true;
  return true;
}

function updateFsmFromContext(player, visibleShot) {
  if (player.aiState.fsmLock > 0 && player.aiState.fsmState) {
    return;
  }
  if (roundPhase === "prep") {
    setAiFsmState(player, "Patrol", "prep-phase");
    return;
  }
  const healthRatio = player.health / Math.max(player.maxHealth, 1);
  if (healthRatio < 0.28) {
    setAiFsmState(player, "Retreat", "critical-health");
    return;
  }
  if (player.aiState.intent === "breach") {
    setAiFsmState(player, "Breach", "breaching-door");
    return;
  }
  if (visibleShot) {
    setAiFsmState(player, "Engage", "visual-contact");
    return;
  }
  if (player.aiState.suspicionTimer > 0 || player.aiState.lastHeardTimer > 0) {
    setAiFsmState(player, "Alert", "suspicious-contact");
    return;
  }
  if (player.role === "defender") {
    setAiFsmState(player, "Defend", "holding-lane");
    return;
  }
  setAiFsmState(player, "Search", "sweep-objective");
}

function runAdvancedAttackerAi(player, enemy) {
  assignTeamTasks("attacker", enemy);
  const visibleShot = getVisibleEnemyShot(player, enemy);
  updateEnemyMemory(player, enemy, visibleShot);
  updateFsmFromContext(player, visibleShot);
  const tuning = getAiTuning(player);
  player.aiState.debugTargetFloor = getKnownEnemyFloor(player);
  player.aiState.debugTargetX = getKnownEnemyX(player);
  if (player.aiState.breachDoorId && !getPendingBreachCharge(player.aiState.breachDoorId)) {
    player.aiState.breachDoorId = null;
  }

  const chargeThreat = getNearestChargeThreat(player);
  if (chargeThreat) {
    player.aiState.intent = "retreat";
    setAiFsmState(player, "Retreat", "avoid-breach-blast");
    moveAwayFromX(player, chargeThreat.x, BREACH_BLAST_RADIUS + 58);
    return;
  }

  if (visibleShot) {
    const healthRatio = player.health / Math.max(player.maxHealth, 1);
    const shouldTakeCover = (healthRatio < 0.56 || visibleShot.distance > 150) && Math.random() < 0.72 * tuning.tacticalRate;
    if (shouldTakeCover && runTakeCoverBehavior(player, enemy.floor, enemy.x, enemy)) {
      player.aiState.intent = "retreat";
      setAiFsmState(player, "TakeCover", "under-fire");
      if (player.fireCooldown === 0 && visibleShot.distance < 240) {
        player.aiAimAngle = visibleShot.angle;
        shoot(player);
      }
      return;
    }

    player.aiState.intent = "attack";
    setAiFsmState(player, "Engage", "direct-fire");
    switchWeaponTo(player, visibleShot.distance < 96 ? "breacher" : "rifle");
    player.aiAimAngle = visibleShot.angle;
    player.facing = enemy.x >= player.x ? 1 : -1;

    if (visibleShot.distance < 104) {
      moveTowardsX(player, clamp(enemy.x - player.facing * 118, floorBounds[player.floor].minX + 30, floorBounds[player.floor].maxX - 30), 12);
    } else if (getCurrentWeaponId(player) === "breacher" && visibleShot.distance > 86) {
      moveTowardsX(player, enemy.x - player.facing * 54, 12, 1.06);
    }

    const currentWeapon = getCurrentWeapon(player);
    if (currentWeapon && player.fireCooldown > Math.max(6, currentWeapon.cooldown * 0.58) && visibleShot.distance < 180) {
      if (runTakeCoverBehavior(player, enemy.floor, enemy.x, enemy)) {
        setAiFsmState(player, "TakeCover", "recover-fire-cycle");
        return;
      }
    }

    if (player.fireCooldown === 0) {
      shoot(player);
    }
    return;
  }

  if (roundPhase === "prep") {
    player.aiState.intent = "rally";
    setAiFsmState(player, "Patrol", "prep-rally");
    const entryDoor = getDoorById("entry-west");
    if (entryDoor && !entryDoor.open && !entryDoor.destroyed) {
      moveTowardsX(player, getAttackerDoorStackX(entryDoor), 12);
    } else {
      moveTowardsX(player, getStairLandingX(0) - 18, 16);
    }
    player.facing = 1;
    return;
  }

  const objectiveHintX = player.floor === objectiveZone.floor ? objectiveZone.x : getFloorAssaultAnchor(player.floor);
  const deployableTarget = getAttackerDeployableTarget(player, objectiveHintX);
  if (deployableTarget && engageAttackerDeployable(player, deployableTarget, enemy)) {
    setAiFsmState(player, "Engage", "engage-deployable");
    return;
  }

  const usefulCache = getUsefulSupplyCache(player);
  let targetFloor = objectiveZone.floor;
  let targetX = objectiveZone.x;

  if (usefulCache && (player.health <= player.maxHealth * 0.62 || player.inventory.breach <= 1)) {
    player.aiState.intent = "support";
    setAiFsmState(player, "Search", "resupply");
    targetFloor = usefulCache.floor;
    targetX = usefulCache.x;
  } else {
    const knownEnemyFloor = player.aiState.lastSeenTimer > 0 ? getKnownEnemyFloor(player) : null;
    if (knownEnemyFloor !== null && knownEnemyFloor < objectiveZone.floor && knownEnemyFloor >= player.floor) {
      targetFloor = knownEnemyFloor;
      targetX = clamp(getKnownEnemyX(player), floorBounds[targetFloor].minX + 30, floorBounds[targetFloor].maxX - 30);
      player.aiState.intent = "support";
      setAiFsmState(player, "Alert", "pursue-last-known");
    } else {
      targetX = player.floor === objectiveZone.floor ? objectiveZone.x : getFloorAssaultAnchor(targetFloor);
      player.aiState.intent = "rally";
      setAiFsmState(player, "Search", "advance-objective");
    }
  }

  if (player.aiState.teamTask === "flank" && enemy && enemy.alive && player.floor === enemy.floor && !visibleShot && Math.random() < 0.66 * tuning.teamwork) {
    const flankX = chooseFlankPoint(player, enemy.floor, enemy.x);
    if (flankX !== null) {
      player.aiState.flankFloor = enemy.floor;
      player.aiState.flankX = flankX;
      player.aiState.debugPathFloor = enemy.floor;
      player.aiState.debugPathX = flankX;
      const flankPath = advanceToPoint(player, enemy.floor, flankX, 16);
      if (flankPath.state === "blocked") {
        handleAttackerDoor(player, flankPath.blocker, flankX, enemy);
      }
      setAiFsmState(player, "Flank", "teammate-suppresses");
      return;
    }
  }

  const path = advanceToPoint(player, targetFloor, targetX, targetFloor === player.floor ? 12 : 16);
  player.aiState.debugPathFloor = targetFloor;
  player.aiState.debugPathX = targetX;
  if (path.state === "blocked") {
    handleAttackerDoor(player, path.blocker, targetX, enemy);
    setAiFsmState(player, "Breach", "path-blocked-door");
    return;
  }

  if (path.state !== "arrived") {
    return;
  }

  if (player.floor === objectiveZone.floor) {
    const objectiveDoor = getBlockingDoor(player.floor, player.x, objectiveZone.x);
    if (objectiveDoor) {
      handleAttackerDoor(player, objectiveDoor, objectiveZone.x, enemy);
      setAiFsmState(player, "Breach", "objective-door");
      return;
    }

    if (insideObjective(player) && isAiCapturingObjective(player)) {
      player.aiState.intent = "attack";
      setAiFsmState(player, "Defend", "holding-objective-room");
      player.aiAimAngle = player.facing === 1 ? 0 : Math.PI;
      if (Math.abs(player.x - objectiveZone.x) > 8) {
        moveTowardsX(player, getTeamSpacingOffset(player, objectiveZone.floor, objectiveZone.x, 52), 8);
      }
      captureProgress = clamp(captureProgress + 0.0065, 0, 1);
      capturePulse -= 1;
      if (capturePulse <= 0) {
        capturePulse = 14;
        playObjectiveSound();
      }
      if (captureProgress >= 1) {
        endRound(player, `${player.name} captured ${objectiveZone.label || "Terminal"}`);
      }
      return;
    }

    player.aiState.intent = "support";
    moveTowardsX(player, getTeamSpacingOffset(player, objectiveZone.floor, objectiveZone.x, 52), insideObjective(player) ? 8 : 12);
    return;
  }

  moveTowardsX(player, getFloorAssaultAnchor(player.floor), 14);
}

function getDefenderMedCache(player) {
  const threat = getDefenderThreatSnapshot(player);
  let best = null;
  let bestScore = Infinity;
  for (const cache of supplyCaches) {
    if (cache.consumed || cache.type !== "med") {
      continue;
    }
    const pathScore = Math.abs(cache.floor - player.floor) * 360 + Math.abs(cache.x - player.x);
    const sameFloorThreat = cache.floor === threat.floor ? Math.max(0, 260 - Math.abs(cache.x - threat.x)) * threat.confidence : 0;
    const objectiveLoss = cache.floor < objectiveZone.floor - 1 ? 170 * Math.max(0.2, threat.pressure) : 0;
    const unsafeLowerFloor = cache.floor < 2 && threat.confidence > 0.35 ? 620 * threat.confidence : 0;
    const score = pathScore + sameFloorThreat + objectiveLoss + unsafeLowerFloor;
    if (score < bestScore) {
      bestScore = score;
      best = cache;
    }
  }
  return best;
}

function getDefenderThreatSnapshot(player) {
  const hasVisualMemory = player.aiState.lastSeenTimer > 0 && player.aiState.lastSeenFloor !== null;
  const hasSuspicion = player.aiState.suspicionTimer > 0 && player.aiState.suspicionFloor !== null;
  const fallbackFloor = roundPhase === "prep" ? 2 : objectiveZone.floor - 1;
  const trackedFloorRaw = hasVisualMemory || hasSuspicion ? getKnownEnemyFloor(player) : fallbackFloor;
  const trackedFloor = clamp(trackedFloorRaw, 0, floorLevels.length - 1);
  const trackedXRaw = hasVisualMemory || hasSuspicion
    ? getKnownEnemyX(player)
    : getFloorAssaultAnchor(trackedFloor);
  const trackedX = clamp(
    trackedXRaw,
    floorBounds[trackedFloor].minX + PLAYER_W / 2,
    floorBounds[trackedFloor].maxX - PLAYER_W / 2,
  );
  const confidence = hasVisualMemory
    ? Math.max(0.82, player.aiState.threatConfidence || 0)
    : (hasSuspicion ? Math.max(0.35, player.aiState.threatConfidence || 0) : 0.22);
  const floorPressure = trackedFloor >= objectiveZone.floor ? 1 : trackedFloor === objectiveZone.floor - 1 ? 0.82 : 0.52;
  const pressure = clamp(floorPressure * (0.58 + confidence * 0.58), 0.24, 1.18);
  return {
    floor: trackedFloor,
    x: trackedX,
    pressure,
    confidence,
    source: player.aiState.lastThreatSource || "default",
  };
}

function getDefenderPriorityDoor(threatFloor, threatX) {
  const candidates = doors
    .filter((door) => door.floor >= 2 && !door.initialOpen && !door.destroyed)
    .map((door) => {
      const floorDistance = Math.abs(door.floor - threatFloor);
      const xDistance = Math.abs(door.x - threatX);
      const objectiveValue = door.floor === objectiveZone.floor ? 160 : door.floor === objectiveZone.floor - 1 ? 110 : 40;
      const setupValue = Math.max(0, scoreDefenderDoorForSetup(door)) * 0.18;
      return {
        door,
        score: objectiveValue + setupValue - floorDistance * 170 - xDistance * 0.42,
      };
    })
    .sort((a, b) => b.score - a.score);
  return candidates[0]?.door || null;
}

function getDefenderLeashRange(floor) {
  if (floor >= 3) {
    return {
      minX: buildingRect.x + 300,
      maxX: floorBounds[floor].maxX - 36,
    };
  }
  if (floor === 2) {
    return {
      minX: buildingRect.x + 220,
      maxX: floorBounds[floor].maxX - 36,
    };
  }
  return {
    minX: floorBounds[floor].minX + 36,
    maxX: floorBounds[floor].maxX - 36,
  };
}

function clampDefenderLeashX(floor, x) {
  const leash = getDefenderLeashRange(floor);
  return clamp(x, leash.minX, leash.maxX);
}

function getDefenderHoldCandidates() {
  return [
    { floor: 2, x: buildingRect.x + 410, type: "left-stair-deny" },
    { floor: 2, x: buildingRect.x + 910, type: "systems-crossfire" },
    { floor: 2, x: buildingRect.x + 1248, type: "elevator-delay" },
    { floor: 3, x: objectiveZone.x - 210, type: "objective-left" },
    { floor: 3, x: objectiveZone.x + 132, type: "objective-right" },
    { floor: 3, x: getElevatorCenterX() - 204, type: "elevator-retake" },
    { floor: 3, x: buildingRect.x + 452, type: "deep-fallback" },
  ];
}

function scoreDefenderHoldCandidate(candidate, threat, healthRatio) {
  const x = clampDefenderLeashX(candidate.floor, candidate.x);
  const sameFloor = candidate.floor === threat.floor;
  const distanceToThreat = sameFloor ? Math.abs(x - threat.x) : Math.abs(candidate.floor - threat.floor) * 340;
  const distanceToObjective = Math.abs(candidate.floor - objectiveZone.floor) * 240 + Math.abs(x - objectiveZone.x) * 0.38;
  const routeCoverage = Math.max(0, 280 - Math.abs(x - getFloorAssaultAnchor(candidate.floor))) * 0.35;
  const objectiveBias = candidate.floor === objectiveZone.floor ? 180 + captureProgress * 360 : 0;
  const secondLineBias = threat.floor <= 1 && candidate.floor === 2 ? 260 : 0;
  const interceptBias = threat.floor === 2 && candidate.floor === 2 ? 230 : 0;
  const retakeBias = threat.floor >= objectiveZone.floor && candidate.floor === objectiveZone.floor ? 260 : 0;
  const lowHealthBias = healthRatio < 0.42 && candidate.floor === objectiveZone.floor ? 260 : 0;
  const lowHealthPenalty = healthRatio < 0.42 && sameFloor && distanceToThreat < 210 ? 240 : 0;
  const closeDanger = sameFloor ? Math.max(0, 150 - distanceToThreat) * (1.8 + threat.confidence) : 0;
  const idealRange = sameFloor ? 220 - Math.abs(distanceToThreat - 210) * 0.8 : 80;
  const lineOfFire = sameFloor && !lineBlocked(x, floorLevels[candidate.floor] - 52, threat.x, floorLevels[threat.floor] - 48, candidate.floor)
    ? 85
    : 0;

  return (
    routeCoverage
    + objectiveBias
    + secondLineBias
    + interceptBias
    + retakeBias
    + lowHealthBias
    + idealRange
    + lineOfFire
    - distanceToObjective * 0.25
    - closeDanger
    - lowHealthPenalty
  );
}

function getDefenderHoldPoint(threat, healthRatio) {
  const candidates = getDefenderHoldCandidates()
    .map((candidate) => ({
      floor: candidate.floor,
      x: clampDefenderLeashX(candidate.floor, candidate.x),
      score: scoreDefenderHoldCandidate(candidate, threat, healthRatio),
    }))
    .sort((a, b) => b.score - a.score);
  return candidates[0] || {
    floor: objectiveZone.floor,
    x: clampDefenderLeashX(objectiveZone.floor, getDefenderFallbackAnchor(objectiveZone.floor)),
  };
}

function isDefenderDoorCompromised(door) {
  if (!door || door.destroyed) {
    return false;
  }
  if (door.open) {
    return true;
  }
  return !door.fortified && door.hp >= door.maxHp;
}

function runDefenderFirefight(player, enemy, visibleShot, allowReposition = true) {
  const healthRatio = player.health / Math.max(player.maxHealth, 1);
  const preferredMin = healthRatio < 0.52 ? 154 : 122;
  const preferredMax = healthRatio < 0.52 ? 248 : 214;

  player.aiAimAngle = visibleShot.angle;
  player.facing = enemy.x >= player.x ? 1 : -1;
  if (allowReposition) {
    player.crouching = visibleShot.distance > 150;
  }
  const activeWeapon = getCurrentWeapon(player);
  if (allowReposition && activeWeapon && player.fireCooldown > Math.max(6, activeWeapon.cooldown * 0.55) && visibleShot.distance < 170) {
    const coverMoved = runTakeCoverBehavior(player, enemy.floor, enemy.x, enemy);
    if (coverMoved) {
      setAiFsmState(player, "TakeCover", "weapon-cooling");
      return;
    }
  }

  if (allowReposition) {
    if (visibleShot.distance < preferredMin) {
      moveTowardsX(
        player,
        clampDefenderLeashX(
          player.floor,
          enemy.x - player.facing * (preferredMin + 24),
        ),
        10,
        1.04,
      );
    } else if (visibleShot.distance > preferredMax) {
      moveTowardsX(
        player,
        clampDefenderLeashX(
          player.floor,
          enemy.x - player.facing * (preferredMax - 22),
        ),
        16,
        1.02,
      );
    }
  }

  if (player.fireCooldown === 0) {
    shoot(player);
  }
}

function uniqueDeploySpots(candidates) {
  const unique = [];
  for (const candidate of candidates) {
    const x = clamp(candidate.x, floorBounds[candidate.floor].minX + 44, floorBounds[candidate.floor].maxX - 44);
    if (unique.some((spot) => spot.floor === candidate.floor && Math.abs(spot.x - x) < 42)) {
      continue;
    }
    unique.push({ ...candidate, x });
  }
  return unique;
}

function getDefenderTrapCandidates(threat) {
  const priorityDoor = getDefenderPriorityDoor(threat.floor, threat.x);
  const candidates = [];
  if (priorityDoor) {
    candidates.push({ floor: priorityDoor.floor, x: priorityDoor.x - 54, reason: "priority-door" });
  }
  for (const door of doors) {
    if (!door.initialOpen && door.floor >= 2 && door.floor >= Math.max(2, threat.floor - 1)) {
      candidates.push({ floor: door.floor, x: door.x - 48, reason: "door" });
    }
  }
  stairSegments.forEach((segment) => {
    if (segment.lowerFloor >= 2) {
      candidates.push({ floor: segment.lowerFloor, x: segment.bottomX + 56, reason: "stair-bottom" });
    }
    if (segment.lowerFloor + 1 >= 2) {
      candidates.push({ floor: segment.lowerFloor + 1, x: segment.topX - 56, reason: "stair-top" });
    }
  });
  candidates.push({ floor: Math.min(objectiveZone.floor, Math.max(2, threat.floor)), x: getElevatorCenterX() - 78, reason: "elevator" });
  candidates.push({ floor: objectiveZone.floor, x: objectiveZone.x - 154, reason: "objective-left" });
  candidates.push({ floor: objectiveZone.floor, x: objectiveZone.x + 104, reason: "objective-right" });
  return uniqueDeploySpots(candidates);
}

function scoreDefenderTrapCandidate(candidate, player, threat) {
  if (mines.some((mine) => mine.floor === candidate.floor && Math.abs(mine.x - candidate.x) < 58)) {
    return -Infinity;
  }
  const routeBias = Math.max(0, 260 - Math.abs(candidate.x - getFloorAssaultAnchor(candidate.floor))) * 0.45;
  const threatBias = candidate.floor === threat.floor ? Math.max(0, 300 - Math.abs(candidate.x - threat.x)) * threat.confidence : 0;
  const objectiveBias = candidate.floor === objectiveZone.floor ? 180 : candidate.floor === objectiveZone.floor - 1 ? 120 : 0;
  const setupCost = Math.abs(candidate.floor - player.floor) * 145 + Math.abs(candidate.x - player.x) * 0.25;
  const unsafeClose = player.floor === threat.floor && Math.abs(candidate.x - threat.x) < 90 && threat.confidence > 0.75 ? 180 : 0;
  const reasonBias = candidate.reason.includes("door") ? 80 : candidate.reason.includes("stair") ? 100 : 60;
  return routeBias + threatBias + objectiveBias + reasonBias - setupCost - unsafeClose;
}

function getBestDefenderTrapSpot(player, threat) {
  return getDefenderTrapCandidates(threat)
    .map((candidate) => ({ ...candidate, score: scoreDefenderTrapCandidate(candidate, player, threat) }))
    .sort((a, b) => b.score - a.score)[0] || null;
}

function scoreDefenderTurretCandidate(candidate, player, threat) {
  if (turrets.some((turret) => turret.floor === candidate.floor && Math.abs(turret.x - candidate.x) < 86)) {
    return -Infinity;
  }
  const turretY = floorLevels[candidate.floor] - 24;
  const sampleTargets = [
    getFloorAssaultAnchor(candidate.floor),
    objectiveZone.x,
    threat.floor === candidate.floor ? threat.x : getFloorAssaultAnchor(candidate.floor),
    getElevatorCenterX(),
  ];
  const coverage = sampleTargets.reduce((total, x) => {
    const targetX = clamp(x, floorBounds[candidate.floor].minX + 30, floorBounds[candidate.floor].maxX - 30);
    const blocked = lineBlocked(candidate.x, turretY, targetX, floorLevels[candidate.floor] - 48, candidate.floor);
    return total + (blocked ? 0 : Math.max(0, 420 - Math.abs(targetX - candidate.x)));
  }, 0);
  const objectiveBias = candidate.floor === objectiveZone.floor ? 230 : 80;
  const threatBias = candidate.floor === threat.floor ? 160 * threat.confidence : 0;
  const survivalPenalty = candidate.floor === threat.floor && Math.abs(candidate.x - threat.x) < 140 ? 190 * threat.confidence : 0;
  const travelCost = Math.abs(candidate.floor - player.floor) * 130 + Math.abs(candidate.x - player.x) * 0.18;
  return coverage * 0.42 + objectiveBias + threatBias - survivalPenalty - travelCost;
}

function getBestDefenderTurretSpot(player, threat) {
  return getDefenderTurretCandidates()
    .map((candidate) => ({ ...candidate, score: scoreDefenderTurretCandidate(candidate, player, threat) }))
    .sort((a, b) => b.score - a.score)[0] || null;
}

function getBestDefenderBarricadeSpot(player, threat) {
  const candidates = getDefenderTrapCandidates(threat)
    .map((candidate) => ({
      floor: candidate.floor,
      x: candidate.x + 92,
      facing: -1,
      score: scoreDefenderTrapCandidate(candidate, player, threat) - 90,
    }))
    .filter((candidate) => isDefenderBarricadeSpotSafe(candidate.floor, candidate.x))
    .sort((a, b) => b.score - a.score);
  return candidates[0] || null;
}

function runDefenderCombatDeploy(player, threat) {
  if (player.abilityCooldown > 0) {
    return false;
  }

  if (player.inventory.trap > 0) {
    const trapSpot = getBestDefenderTrapSpot(player, threat);
    if (trapSpot && trapSpot.score > 40) {
      aiPlaceTrapAt(player, trapSpot.floor, clampDefenderLeashX(trapSpot.floor, trapSpot.x), -1);
      return true;
    }
  }

  if (player.inventory.turret > 0) {
    const turretSpot = getBestDefenderTurretSpot(player, threat);
    if (turretSpot && turretSpot.score > 90) {
      aiPlaceTurretAt(player, turretSpot.floor, turretSpot.x, turretSpot.facing);
      return true;
    }
  }

  if (player.inventory.barricade > 0 && threat.confidence > 0.45) {
    const barricadeSpot = getBestDefenderBarricadeSpot(player, threat);
    if (barricadeSpot && barricadeSpot.score > 80) {
      aiPlaceBarricadeAt(player, barricadeSpot.floor, barricadeSpot.x, barricadeSpot.facing);
      return true;
    }
  }

  return false;
}

function chooseDefenderCombatAction(player, visibleShot, threat, medCache, doorToSecure) {
  const healthRatio = player.health / Math.max(player.maxHealth, 1);
  const closeFight = visibleShot ? visibleShot.distance < 122 : false;
  const criticalHealth = healthRatio < 0.34;
  const actions = [];

  actions.push({
    id: "fight",
    score: visibleShot
      ? 1.1 + threat.pressure * 0.72 + clamp((240 - visibleShot.distance) / 240, 0, 0.54) - (criticalHealth ? 0.82 : 0)
      : 0,
  });
  actions.push({
    id: "retreat",
    score: (1 - healthRatio) * 1.54 + (closeFight ? 0.96 : 0) + (threat.pressure > 0.8 ? 0.28 : 0),
  });
  actions.push({
    id: "heal",
    score: medCache ? (1 - healthRatio) * 1.72 + (visibleShot ? -0.68 : 0.34) - threat.pressure * 0.12 : 0,
  });
  actions.push({
    id: "seal",
    score: doorToSecure ? 0.84 + threat.pressure * 0.74 + (visibleShot ? -0.64 : 0.2) : 0,
  });
  actions.push({
    id: "deploy",
    score: !visibleShot && (player.inventory.trap > 0 || player.inventory.turret > 0 || player.inventory.barricade > 0)
      ? 0.52 + threat.pressure * 0.58 + threat.confidence * 0.32 + (healthRatio < 0.62 ? 0.08 : 0)
      : 0,
  });
  actions.push({
    id: "hold",
    score: 0.55 + threat.pressure * 0.66,
  });

  if (player.aiState.actionId && player.aiState.actionUntil > 0) {
    const committed = actions.find((action) => action.id === player.aiState.actionId);
    const emergency = criticalHealth || (visibleShot && visibleShot.distance < 86) || threat.source === "breach-charge";
    if (committed && committed.score > 0.18 && !emergency) {
      committed.score += 0.42;
    }
  }

  actions.sort((a, b) => b.score - a.score);
  const choice = actions[0].id;
  if (choice !== player.aiState.actionId) {
    player.aiState.actionId = choice;
    player.aiState.actionUntil = AI_ACTION_COMMIT_FRAMES[choice] || 24;
  }
  return choice;
}

function runAdvancedDefenderAi(player, enemy) {
  assignTeamTasks("defender", enemy);
  const visibleShot = getVisibleEnemyShot(player, enemy);
  updateDefenderPerception(player, enemy, visibleShot);
  updateFsmFromContext(player, visibleShot);
  player.aiState.debugTargetFloor = getKnownEnemyFloor(player);
  player.aiState.debugTargetX = getKnownEnemyX(player);

  const chargeThreat = getNearestChargeThreat(player);
  if (chargeThreat && chargeThreat.timer <= 110) {
    setAiSuspicion(player, chargeThreat.floor, chargeThreat.x, AI_SOUND_MEMORY_FRAMES, 0.95, "breach-charge");
    player.aiState.intent = "retreat";
    setAiFsmState(player, "Retreat", "incoming-breach");
    if (!moveAwayFromX(player, chargeThreat.x, BREACH_BLAST_RADIUS + 72)) {
      return;
    }
    const threat = getDefenderThreatSnapshot(player);
    const fallback = getStableDefenderHoldPoint(player, threat, Math.min(player.health / Math.max(player.maxHealth, 1), 0.28), "retreat");
    const fallbackFloor = fallback.floor;
    const fallbackX = fallback.x;
    const retreatPath = advanceToPoint(player, fallbackFloor, fallbackX, 14);
    if (retreatPath.state === "blocked") {
      handleDefenderPathBlocker(player, retreatPath.blocker, 16);
      return;
    }
    if (retreatPath.state !== "arrived") {
      return;
    }
  }

  if (roundPhase === "prep") {
    if (runDefenderSetupPlan(player)) {
      setAiFsmState(player, "Defend", "prep-fortify");
      return;
    }
    const prepThreat = getDefenderThreatSnapshot(player);
    const prepHold = getDefenderHoldPoint(prepThreat, 0.9);
    const prepPath = advanceToPoint(player, prepHold.floor, prepHold.x, 14);
    if (prepPath.state === "blocked") {
      handleDefenderPathBlocker(player, prepPath.blocker, 18);
      setAiFsmState(player, "Breach", "blocked-while-setup");
      return;
    }
    if (prepPath.state === "arrived" && player.inventory.trap > 0 && player.abilityCooldown === 0) {
      runDefenderCombatDeploy(player, prepThreat);
    }
    return;
  }

  const threat = getDefenderThreatSnapshot(player);
  const healthRatio = player.health / Math.max(player.maxHealth, 1);
  const medCache = healthRatio < 0.62 ? getDefenderMedCache(player) : null;
  const priorityDoor = getDefenderPriorityDoor(threat.floor, threat.x);
  const doorToSecure = priorityDoor && !getPendingBreachCharge(priorityDoor.id) && isDefenderDoorCompromised(priorityDoor)
    ? priorityDoor
    : null;
  const action = chooseDefenderCombatAction(player, visibleShot, threat, medCache, doorToSecure);

  if (action === "fight" && visibleShot) {
    player.aiState.intent = "attack";
    if ((visibleShot.distance > 150 || healthRatio < 0.5) && runTakeCoverBehavior(player, enemy.floor, enemy.x, enemy)) {
      setAiFsmState(player, "TakeCover", "defensive-firefight");
      if (player.fireCooldown === 0) {
        runDefenderFirefight(player, enemy, visibleShot, false);
      }
      return;
    }
    setAiFsmState(player, "Engage", "fight-selected");
    runDefenderFirefight(player, enemy, visibleShot);
    return;
  }

  if (action === "retreat") {
    player.aiState.intent = "retreat";
    setAiFsmState(player, "Retreat", "action-retreat");
    const retreatPoint = getStableDefenderHoldPoint(player, threat, Math.min(healthRatio, 0.3), "retreat");
    const retreatPath = advanceToPoint(player, retreatPoint.floor, retreatPoint.x, 14);
    if (retreatPath.state === "blocked") {
      handleDefenderPathBlocker(player, retreatPath.blocker, 18);
      return;
    }
    if (visibleShot && player.fireCooldown === 0) {
      runDefenderFirefight(player, enemy, visibleShot, false);
    }
    return;
  }

  if (action === "heal" && medCache) {
    player.aiState.intent = "support";
    setAiFsmState(player, "Search", "seek-med-cache");
    const healPath = advanceToPoint(player, medCache.floor, medCache.x, 12);
    if (healPath.state === "blocked") {
      handleDefenderPathBlocker(player, healPath.blocker, 18);
      return;
    }
    if (visibleShot && visibleShot.distance < 170) {
      runDefenderFirefight(player, enemy, visibleShot, false);
    }
    return;
  }

  if (action === "seal" && doorToSecure) {
    player.aiState.intent = "support";
    setAiFsmState(player, "Defend", "reseal-door");
    const serviceX = getDefenderDoorServiceX(doorToSecure);
    const sealPath = advanceToPoint(player, doorToSecure.floor, serviceX, 16);
    if (sealPath.state === "blocked") {
      handleDefenderPathBlocker(player, sealPath.blocker, 18);
      return;
    }
    if (sealPath.state === "arrived") {
      secureDoorForAi(player, doorToSecure);
    }
    return;
  }

  if (action === "deploy" && runDefenderCombatDeploy(player, threat)) {
    player.aiState.intent = "support";
    setAiFsmState(player, "Defend", "deploy-gadgets");
    return;
  }

  player.aiState.intent = "rally";
  setAiFsmState(player, "Defend", "hold-line");
  const holdPoint = getStableDefenderHoldPoint(player, threat, healthRatio, "hold");
  player.aiState.debugPathFloor = holdPoint.floor;
  player.aiState.debugPathX = holdPoint.x;
  const holdPath = advanceToPoint(player, holdPoint.floor, holdPoint.x, 14);
  if (holdPath.state === "blocked") {
    handleDefenderPathBlocker(player, holdPath.blocker, 18);
    return;
  }

  if (visibleShot && player.fireCooldown === 0) {
    runDefenderFirefight(player, enemy, visibleShot);
    return;
  }

  if (holdPath.state === "arrived") {
    player.crouching = threat.pressure > 0.78;
    const nearbyDoor = getNearbyDoor(player, 68);
    if (nearbyDoor && !getPendingBreachCharge(nearbyDoor.id) && isDefenderDoorCompromised(nearbyDoor)) {
      secureDoorForAi(player, nearbyDoor);
    }
  }
}

function updateAiPlayer(player) {
  player.crouching = false;
  player.aiAimAngle = null;
  player.aiState.actionUntil = Math.max(0, (player.aiState.actionUntil || 0) - 1);
  player.aiState.fsmLock = Math.max(0, (player.aiState.fsmLock || 0) - 1);
  player.aiState.footstepTimer = Math.max(0, (player.aiState.footstepTimer || 0) - 1);
  player.aiState.intelCooldown = Math.max(0, (player.aiState.intelCooldown || 0) - 1);
  player.aiState.holdAnchorTimer = Math.max(0, (player.aiState.holdAnchorTimer || 0) - 1);
  updateAiIntelNetwork(player);
  processAiHearing(player);

  const enemy = getEnemyOf(player);
  if (!enemy) {
    return;
  }

  if (player.role === "attacker") {
    runAdvancedAttackerAi(player, enemy);
  } else {
    runAdvancedDefenderAi(player, enemy);
  }
}

function updatePlayer(player) {
  if (!player.alive || roundOver) {
    return;
  }

  player.fireCooldown = Math.max(0, player.fireCooldown - 1);
  player.transitionCooldown = Math.max(0, player.transitionCooldown - 1);
  player.abilityCooldown = Math.max(0, player.abilityCooldown - 1);
  player.slowTimer = Math.max(0, player.slowTimer - 1);
  if (player.slowTimer === 0) {
    player.slowFactor = 1;
  }
  player.hurtFlash = Math.max(0, player.hurtFlash - 1);
  player.aiAimAngle = null;

  if (updateTravelingPlayer(player)) {
    if (isPressed(player.controls.cycle)) {
      cyclePlayerTool(player);
    }

    if (isDown(player.controls.shoot) && player.fireCooldown === 0) {
      shoot(player);
    }
    return;
  }

  if (player.travelMode === "elevator") {
    player.crouching = false;
    return;
  }

  const prepLocked = roundPhase === "prep" && player.role === "attacker";
  if (player.controlMode === "ai") {
    if (prepLocked) {
      player.crouching = false;
      player.facing = 1;
      return;
    }

    updateAiPlayer(player);
    return;
  }

  const left = isDown(player.controls.left);
  const right = isDown(player.controls.right);
  const upPressed = isPressed(player.controls.up);
  const downPressed = isPressed(player.controls.down);
  const horizontal = (right ? 1 : 0) - (left ? 1 : 0);

  if (prepLocked) {
    player.crouching = false;
    return;
  }

  if (upPressed) {
    attemptFloorChange(player, 1);
  } else if (downPressed) {
    attemptFloorChange(player, -1);
  }

  player.crouching = isDown(player.controls.down) && !inTraversalZone(player);

  if (horizontal !== 0) {
    player.facing = Math.sign(horizontal);
    const moveSpeed = getEffectiveMoveSpeed(player);
    movePlayerHorizontally(player, horizontal * (player.crouching ? moveSpeed * 0.55 : moveSpeed));
  }

  if (isPressed(player.controls.cycle)) {
    cyclePlayerTool(player);
  }

  if (isDown(player.controls.shoot) && player.fireCooldown === 0) {
    shoot(player);
  }

  if (player.role === "attacker") {
    const controllingObjective = roundPhase === "combat" && isDown(player.controls.ability) && insideObjective(player);

    if (controllingObjective) {
      captureProgress = clamp(captureProgress + 0.0065, 0, 1);
      capturePulse -= 1;
      if (capturePulse <= 0) {
        capturePulse = 14;
        playObjectiveSound();
      }
      if (captureProgress >= 1) {
        endRound(player, `${player.name} 控制了 ${objectiveZone.label || "终端"}`);
      }
    }

    if (isPressed(player.controls.ability) && !controllingObjective && player.abilityCooldown === 0) {
      attemptAttackerAbility(player);
    }
  } else if (isPressed(player.controls.ability) && player.abilityCooldown === 0) {
    attemptDefenderAbility(player);
  }
}

function updateBullets() {
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const bullet = bullets[i];
    bullet.prevX = bullet.x;
    bullet.prevY = bullet.y;
    bullet.x += bullet.vx;
    bullet.y += bullet.vy;
    bullet.ttl -= 1;

    let removed = false;

    for (const door of doors) {
      if (door.open || door.destroyed) {
        continue;
      }
      const rect = getDoorRect(door);
      if (!segmentHitsRect(bullet.prevX, bullet.prevY, bullet.x, bullet.y, rect)) {
        continue;
      }
      damageDoor(door, bullet.doorDamage, bullet.ownerRole);
      createSpark(bullet.x, bullet.y, bullet.color, 4);
      bullets.splice(i, 1);
      removed = true;
      break;
    }

    if (removed) {
      continue;
    }

    for (const cover of coverTemplates) {
      if (cover.blocksBullets === false) {
        continue;
      }
      const rect = getCoverRect(cover);
      if (!segmentHitsRect(bullet.prevX, bullet.prevY, bullet.x, bullet.y, rect)) {
        continue;
      }
      createSpark(bullet.x, bullet.y, bullet.color, 4);
      bullets.splice(i, 1);
      removed = true;
      break;
    }

    if (removed) {
      continue;
    }

    for (let barricadeIndex = barricades.length - 1; barricadeIndex >= 0; barricadeIndex -= 1) {
      const barricade = barricades[barricadeIndex];
      const rect = getBarricadeRect(barricade);
      if (!segmentHitsRect(bullet.prevX, bullet.prevY, bullet.x, bullet.y, rect)) {
        continue;
      }
      const barricadeDamage = bullet.weaponId === "breacher" ? bullet.damage + 22 : bullet.damage + 10;
      barricade.hp -= barricadeDamage;
      createSpark(bullet.x, bullet.y, bullet.color, 4);
      if (barricade.hp <= 0) {
        barricades.splice(barricadeIndex, 1);
        createPulse(barricade.x, getFloorY(barricade.floor) - 46, "#ffce76", 16, 70, 20);
      }
      bullets.splice(i, 1);
      removed = true;
      break;
    }

    if (removed) {
      continue;
    }

    for (let turretIndex = turrets.length - 1; turretIndex >= 0; turretIndex -= 1) {
      const turret = turrets[turretIndex];
      if (turret.ownerId === bullet.ownerId) {
        continue;
      }
      const rect = getTurretRect(turret);
      if (!segmentHitsRect(bullet.prevX, bullet.prevY, bullet.x, bullet.y, rect)) {
        continue;
      }
      turret.hp -= bullet.damage + 6;
      createSpark(bullet.x, bullet.y, bullet.color, 4);
      if (turret.hp <= 0) {
        turrets.splice(turretIndex, 1);
        createPulse(turret.x, getFloorY(turret.floor) - 18, "#95ffb5", 16, 70, 18);
      }
      bullets.splice(i, 1);
      removed = true;
      break;
    }

    if (removed) {
      continue;
    }

    for (const player of players) {
      if (!player.alive || player.id === bullet.ownerId) {
        continue;
      }

      const owner = players.find((candidate) => candidate.id === bullet.ownerId);
      if (owner && owner.role === player.role) {
        continue;
      }

      const rect = getPlayerRect(player);
      if (!segmentHitsRect(bullet.prevX, bullet.prevY, bullet.x, bullet.y, rect)) {
        continue;
      }

      applyDamage(player, owner || { name: "炮台", color: "#95ffb5" }, bullet.damage, bullet.x, bullet.y);
      bullets.splice(i, 1);
      removed = true;
      break;
    }

    if (removed) {
      continue;
    }

    if (bullet.x < -50 || bullet.x > WIDTH + 50 || bullet.y < -50 || bullet.y > HEIGHT + 50 || bullet.ttl <= 0) {
      bullets.splice(i, 1);
    }
  }
}

function updateMines() {
  const attacker = getAttackerPlayer();
  if (!attacker || !attacker.alive) {
    return;
  }

  for (let i = mines.length - 1; i >= 0; i -= 1) {
    const mine = mines[i];
    mine.armedIn = Math.max(0, mine.armedIn - 1);

    if (mine.armedIn > 0) {
      continue;
    }

    if (mine.floor !== attacker.floor) {
      continue;
    }

    if (Math.abs(mine.x - attacker.x) > 34) {
      continue;
    }

    applyDamage(attacker, getDefenderPlayer(), 9, mine.x, getFloorY(mine.floor) - 10);
    applySlow(attacker, 0.52, 110);
    createPulse(mine.x, getFloorY(mine.floor) - 12, "#76c9ff", 16, 88, 22);
    createSpark(mine.x, getFloorY(mine.floor) - 16, "#76c9ff", 12);
    playTrapSound();
    mines.splice(i, 1);
  }
}

function updateTurrets() {
  const attacker = getAttackerPlayer();
  if (!attacker || !attacker.alive) {
    return;
  }

  for (const turret of turrets) {
    turret.cooldown = Math.max(0, turret.cooldown - 1);

    if (attacker.floor !== turret.floor) {
      continue;
    }

    if (Math.abs(attacker.x - turret.x) > 420) {
      continue;
    }

    const targetY = attacker.y - getPlayerHeight(attacker) * 0.58;
    const turretY = getFloorY(turret.floor) - 24;
    if (lineBlocked(turret.x, turretY, attacker.x, targetY, turret.floor)) {
      continue;
    }

    turret.facing = attacker.x >= turret.x ? 1 : -1;
    if (turret.cooldown > 0) {
      continue;
    }

    turret.cooldown = weaponCatalog.turret.cooldown;
    const angle = Math.atan2(targetY - turretY, attacker.x - turret.x);
    addBullet(
      {
        id: turret.ownerId,
        role: "defender",
        color: "#95ffb5",
      },
      "turret",
      turret.x + turret.facing * 18,
      turretY,
      angle,
    );
    playShootSound("turret");
  }
}

function updateSupplyCaches() {
  for (const cache of supplyCaches) {
    if (cache.consumed) {
      continue;
    }

    const rect = getSupplyCacheRect(cache);
    for (const player of players) {
      if (!player.alive || player.floor !== cache.floor) {
        continue;
      }

      if (!rectsOverlap(rect, getPlayerRect(player))) {
        continue;
      }

      let picked = true;
      if (cache.type === "med") {
        if (player.health >= player.maxHealth - 5) {
          picked = false;
        } else {
          player.health = clamp(player.health + 60, 0, player.maxHealth);
          showMessage(`${player.name} 使用了医疗补给`, 90);
        }
      } else if (cache.type === "breach") {
        if (player.role === "attacker") {
          player.inventory.breach += 1;
          showMessage(`${player.name} 找到了一份炸药补给`, 90);
        } else {
          player.inventory.trap += 1;
          showMessage(`${player.name} 补充了一枚震撼雷`, 90);
        }
      } else if (player.role === "attacker") {
        player.inventory.breach += 1;
        player.health = clamp(player.health + 24, 0, player.maxHealth);
        showMessage(`${player.name} 拿到了突入工具包`, 90);
      } else {
        player.inventory.trap += 1;
        player.inventory.barricade += 1;
        showMessage(`${player.name} 拿到了防御工具包`, 90);
      }

      if (!picked) {
        continue;
      }

      cache.consumed = true;
      createPulse(cache.x, rect.y + rect.h / 2, cache.accent, 18, 96, 22);
      createSpark(cache.x, rect.y + rect.h / 2, cache.accent, 10);
      playDeploySound();
      break;
    }
  }
}

function updateEffects() {
  for (let i = effects.length - 1; i >= 0; i -= 1) {
    const effect = effects[i];
    effect.life -= 1;

    if (effect.type === "spark") {
      effect.x += effect.vx;
      effect.y += effect.vy;
      effect.vy += 0.2;
    }

    if (effect.life <= 0) {
      effects.splice(i, 1);
    }
  }
}

function endRound(winner, reason) {
  if (roundOver) {
    return;
  }

  roundOver = true;
  roundWinner = winner;
  roundReason = reason;
  winner.score += 1;

  if (winner.score >= MATCH_TARGET) {
    matchOver = true;
  }

  showMessage(reason, 220);
  playRoundWinSound();
}

function updateRoundTimer() {
  if (roundOver) {
    return;
  }

  if (roundPhase === "prep") {
    prepTimer -= 1;
    if (prepTimer <= 0) {
      prepTimer = 0;
      roundPhase = "combat";
      showMessage("行动阶段开始", 120);
      playRoundStartSound();
    }
    return;
  }

  roundTimer -= 1;
  if (roundTimer <= 0) {
    endRound(getDefenderPlayer(), `${getDefenderPlayer().name} 守住了整栋楼`);
  }
}

function updateCaptureFallback() {
  if (roundOver || roundPhase !== "combat") {
    return;
  }

  const defender = getDefenderPlayer();
  const defenderReset = defender && defender.alive && insideObjective(defender) ? 0.009 : 0.003;

  if (!(getAttackerPlayer().alive && insideObjective(getAttackerPlayer()) && (isDown(getAttackerPlayer().controls.ability) || isAiCapturingObjective(getAttackerPlayer())))) {
    captureProgress = clamp(captureProgress - defenderReset, 0, 1);
  }
}

function update() {
  if (isPressed("r")) {
    if (matchOver) {
      resetSeries();
    } else {
      startRound();
    }
  }

  if (!roundOver) {
    aiSoundEvents.forEach((event) => {
      event.ttl -= 1;
    });
    aiIntelEvents.forEach((event) => {
      event.ttl -= 1;
    });
    for (let i = aiSoundEvents.length - 1; i >= 0; i -= 1) {
      if (aiSoundEvents[i].ttl <= 0) {
        aiSoundEvents.splice(i, 1);
      }
    }
    for (let i = aiIntelEvents.length - 1; i >= 0; i -= 1) {
      if (aiIntelEvents[i].ttl <= 0) {
        aiIntelEvents.splice(i, 1);
      }
    }

    players.forEach(updatePlayer);
    updateBullets();
    updateBreachCharges();
    updateDoorSignals();
    updateMines();
    updateTurrets();
    updateSupplyCaches();
    updateElevator();
    updateCaptureFallback();
    updateRoundTimer();
  }

  updateEffects();

  if (message.timer > 0) {
    message.timer -= 1;
  }
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, "#132b47");
  gradient.addColorStop(0.42, "#17385c");
  gradient.addColorStop(1, "#07111d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const moonGlow = ctx.createRadialGradient(1260, 150, 30, 1260, 150, 180);
  moonGlow.addColorStop(0, "rgba(255, 235, 176, 0.22)");
  moonGlow.addColorStop(1, "rgba(255, 235, 176, 0)");
  ctx.fillStyle = moonGlow;
  ctx.fillRect(1040, 0, 420, 360);

  ctx.fillStyle = "rgba(255,255,255,0.06)";
  for (let i = 0; i < 90; i += 1) {
    ctx.fillRect((i * 173) % WIDTH, (i * 97) % 360, 3, 3);
  }

  const skyline = [
    { x: 24, w: 118, h: 208, roof: "spire" },
    { x: 162, w: 136, h: 250, roof: "flat" },
    { x: 326, w: 104, h: 194, roof: "dome" },
    { x: 462, w: 122, h: 274, roof: "antenna" },
    { x: 616, w: 96, h: 218, roof: "step" },
    { x: 742, w: 124, h: 258, roof: "spire" },
    { x: 902, w: 112, h: 188, roof: "dome" },
    { x: 1036, w: 148, h: 302, roof: "flat" },
    { x: 1218, w: 126, h: 226, roof: "step" },
    { x: 1378, w: 120, h: 244, roof: "antenna" },
    { x: 1534, w: 132, h: 286, roof: "spire" },
    { x: 1698, w: 160, h: 228, roof: "flat" },
  ];

  skyline.forEach((building) => {
    const baseY = HEIGHT - 108;
    ctx.fillStyle = "rgba(8, 18, 34, 0.55)";

    if (building.roof === "spire") {
      ctx.beginPath();
      ctx.moveTo(building.x, baseY);
      ctx.lineTo(building.x, baseY - building.h + 26);
      ctx.lineTo(building.x + building.w * 0.52, baseY - building.h);
      ctx.lineTo(building.x + building.w, baseY - building.h + 32);
      ctx.lineTo(building.x + building.w, baseY);
      ctx.closePath();
      ctx.fill();
    } else if (building.roof === "dome") {
      fillRoundedPanel(building.x, baseY - building.h, building.w, building.h, 18, "rgba(8, 18, 34, 0.55)");
      ctx.beginPath();
      ctx.ellipse(building.x + building.w / 2, baseY - building.h + 22, building.w * 0.34, 20, 0, Math.PI, Math.PI * 2);
      ctx.fill();
    } else {
      fillRoundedPanel(building.x, baseY - building.h, building.w, building.h, 12, "rgba(8, 18, 34, 0.55)");
      if (building.roof === "step") {
        fillRoundedPanel(building.x + 18, baseY - building.h - 22, building.w - 36, 22, 8, "rgba(8, 18, 34, 0.55)");
      }
      if (building.roof === "antenna") {
        ctx.strokeStyle = "rgba(118, 201, 255, 0.18)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(building.x + building.w / 2, baseY - building.h);
        ctx.lineTo(building.x + building.w / 2, baseY - building.h - 34);
        ctx.stroke();
      }
    }

    ctx.fillStyle = "rgba(255, 226, 164, 0.1)";
    for (let wx = building.x + 14; wx < building.x + building.w - 14; wx += 18) {
      for (let wy = baseY - building.h + 26; wy < baseY - 24; wy += 24) {
        ctx.fillRect(wx, wy, 8, 8);
      }
    }
  });

  const rearSkyline = [
    { x: -40, w: 180, h: 340 },
    { x: 118, w: 136, h: 390 },
    { x: 292, w: 172, h: 320 },
    { x: 514, w: 148, h: 430 },
    { x: 704, w: 188, h: 350 },
    { x: 956, w: 164, h: 456 },
    { x: 1168, w: 204, h: 372 },
    { x: 1414, w: 152, h: 420 },
    { x: 1610, w: 210, h: 348 },
    { x: 1842, w: 128, h: 402 },
  ];

  rearSkyline.forEach((building, index) => {
    const baseY = HEIGHT - 86;
    fillRoundedPanel(building.x, baseY - building.h, building.w, building.h, 10, "rgba(10, 24, 42, 0.34)");
    if (index % 3 === 0) {
      fillRoundedPanel(building.x + 28, baseY - building.h - 26, building.w - 56, 26, 8, "rgba(10, 24, 42, 0.34)");
    }
    ctx.fillStyle = "rgba(118, 201, 255, 0.12)";
    for (let wx = building.x + 20; wx < building.x + building.w - 20; wx += 28) {
      for (let wy = baseY - building.h + 34; wy < baseY - 34; wy += 34) {
        ctx.fillRect(wx, wy, 10, 12);
      }
    }
  });

  ctx.strokeStyle = "rgba(118, 201, 255, 0.16)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(520, HEIGHT - 386);
  ctx.lineTo(936, HEIGHT - 386);
  ctx.lineTo(1036, HEIGHT - 416);
  ctx.lineTo(1364, HEIGHT - 416);
  ctx.stroke();

  const groundGlow = ctx.createLinearGradient(0, HEIGHT - 180, 0, HEIGHT);
  groundGlow.addColorStop(0, "rgba(255,255,255,0)");
  groundGlow.addColorStop(1, "rgba(255,206,118,0.18)");
  ctx.fillStyle = groundGlow;
  ctx.fillRect(0, HEIGHT - 180, WIDTH, 180);
}

function drawBuilding() {
  const shellGradient = ctx.createLinearGradient(buildingRect.x, buildingRect.y, buildingRect.x, buildingRect.y + buildingRect.h);
  shellGradient.addColorStop(0, "#30495f");
  shellGradient.addColorStop(1, "#223648");
  drawShadowEllipse(buildingRect.x + buildingRect.w / 2, buildingRect.y + buildingRect.h + 14, buildingRect.w * 0.42, 24, 0.18);
  fillRoundedPanel(buildingRect.x, buildingRect.y, buildingRect.w, buildingRect.h, 24, shellGradient, "rgba(255,255,255,0.08)", 2);
  fillRoundedPanel(buildingRect.x + 48, buildingRect.y - 18, buildingRect.w - 96, 28, 14, "#41586d", "rgba(255,255,255,0.12)", 1.5);

  ctx.save();
  roundRect(buildingRect.x + 6, buildingRect.y + 6, buildingRect.w - 12, buildingRect.h - 12, 20);
  ctx.clip();

  const interiorGradient = ctx.createLinearGradient(0, buildingRect.y, 0, buildingRect.y + buildingRect.h);
  interiorGradient.addColorStop(0, "#dde6ee");
  interiorGradient.addColorStop(0.45, "#d7d8d3");
  interiorGradient.addColorStop(1, "#c5bfb6");
  ctx.fillStyle = interiorGradient;
  ctx.fillRect(buildingRect.x + 6, buildingRect.y + 6, buildingRect.w - 12, buildingRect.h - 12);

  const serviceChannels = [
    { x: buildingRect.x + 360, glow: "#76c9ff" },
    { x: buildingRect.x + 640, glow: "#ffd76b" },
    { x: buildingRect.x + 930, glow: "#95ffb5" },
    { x: buildingRect.x + 1228, glow: "#8ee9e4" },
    { x: buildingRect.x + 1510, glow: "#ffd76b" },
  ];

  serviceChannels.forEach((channel) => {
    ctx.save();
    ctx.globalAlpha = 0.18;
    fillRoundedPanel(channel.x, buildingRect.y + 32, 14, buildingRect.h - 82, 7, "rgba(23, 34, 48, 0.35)");
    ctx.fillStyle = channel.glow;
    ctx.globalAlpha = 0.09;
    ctx.fillRect(channel.x + 5, buildingRect.y + 48, 4, buildingRect.h - 112);
    ctx.restore();
  });

  roomSections.forEach(drawRoomSection);

  ctx.restore();

  fillRoundedPanel(buildingRect.x, buildingRect.y + 22, 82, buildingRect.h - 44, 18, "#31485f", "#6b859d", 2);
  fillRoundedPanel(buildingRect.x + buildingRect.w - 82, buildingRect.y + 22, 82, buildingRect.h - 44, 18, "#31485f", "#6b859d", 2);

  floorLevels.forEach((floorY, index) => {
    const slabY = floorY;
    const slabX = index === 0 ? 0 : buildingRect.x;
    const slabW = index === 0 ? WIDTH : buildingRect.w;
    const slabGradient = ctx.createLinearGradient(0, slabY, 0, slabY + 18);
    slabGradient.addColorStop(0, "#74757b");
    slabGradient.addColorStop(1, "#4b5058");
    ctx.fillStyle = slabGradient;
    ctx.fillRect(slabX, slabY, slabW, 18);
    ctx.fillStyle = "#d9d3c8";
    ctx.fillRect(slabX, slabY, slabW, 5);
  ctx.fillStyle = "rgba(0, 0, 0, 0.14)";
  ctx.fillRect(slabX, slabY + 12, slabW, 6);
  });

  const facadeWindowYs = floorLevels.map((_, floor) => getFloorInteriorRect(floor).y + 28);
  facadeWindowYs.forEach((y, index) => {
    ctx.save();
    ctx.globalAlpha = 0.58;
    drawExteriorWindow(
      buildingRect.x + 12,
      y,
      56,
      84,
      index === 0 ? "rgba(255, 215, 107, 0.62)" : "rgba(118, 201, 255, 0.58)",
    );
    drawExteriorWindow(
      buildingRect.x + buildingRect.w - 68,
      y - 8,
      56,
      96,
      index === floorLevels.length - 1 ? "rgba(255, 215, 107, 0.64)" : "rgba(118, 201, 255, 0.6)",
    );
    ctx.restore();
  });

  ctx.save();
  ctx.globalAlpha = 0.28;
  floorLevels.forEach((floorY) => {
    for (let x = buildingRect.x + 360; x < buildingRect.x + buildingRect.w - 260; x += 280) {
      fillRoundedPanel(x, floorY - 184, 56, 38, 8, "rgba(216, 237, 248, 0.34)", "rgba(255,255,255,0.16)", 1);
    }
  });
  ctx.restore();

  ctx.fillStyle = "#ffd76b";
  ctx.font = "700 18px Trebuchet MS";
  ctx.textAlign = "left";
  /*
  ctx.fillText("街面层", 88, floorLevels[0] + 52);
  ctx.fillText("二层住户区", buildingRect.x + 24, floorLevels[1] + 52);
  ctx.fillText("三层机房", buildingRect.x + 24, floorLevels[2] + 52);

  */
  stairSegments.forEach((segment, index) => {
    const shaftTop = floorLevels[segment.lowerFloor + 1] - 18;
    const shaftBottom = floorLevels[segment.lowerFloor] + 8;
    const shaftX = segment.zoneX1;
    const shaftW = segment.zoneX2 - segment.zoneX1;
    const shaftH = shaftBottom - shaftTop;
    const accent = index === 0 ? "#ffb36b" : index === 1 ? "#95ffb5" : "#76c9ff";

    const bottomY = floorLevels[segment.lowerFloor] - 4;
    const topY = floorLevels[segment.lowerFloor + 1] - 4;
    const bottomX = clamp(segment.bottomX, shaftX + 34, shaftX + shaftW - 34);
    const topX = clamp(segment.topX, shaftX + 34, shaftX + shaftW - 34);
    const midY = (topY + bottomY) / 2;
    const midX = (bottomX + topX) / 2;

    fillRoundedPanel(bottomX - 52, bottomY - 10, 104, 16, 7, "rgba(38, 55, 72, 0.9)", "rgba(255,255,255,0.12)", 1);
    fillRoundedPanel(topX - 52, topY - 10, 104, 16, 7, "rgba(38, 55, 72, 0.9)", "rgba(255,255,255,0.12)", 1);
    fillRoundedPanel(midX - 42, midY - 8, 84, 16, 7, "rgba(31, 47, 64, 0.84)", "rgba(255,255,255,0.1)", 1);

    const flights = [
      { x1: bottomX, y1: bottomY, x2: midX, y2: midY },
      { x1: midX, y1: midY, x2: topX, y2: topY },
    ];

    flights.forEach((flight) => {
      const dx = flight.x2 - flight.x1;
      const dy = flight.y2 - flight.y1;
      const length = Math.max(1, Math.hypot(dx, dy));
      const nx = -dy / length;
      const ny = dx / length;

      ctx.beginPath();
      ctx.strokeStyle = "rgba(0,0,0,0.2)";
      ctx.lineWidth = 17;
      ctx.moveTo(flight.x1, flight.y1);
      ctx.lineTo(flight.x2, flight.y2);
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = "rgba(72, 91, 110, 0.9)";
      ctx.lineWidth = 14;
      ctx.moveTo(flight.x1, flight.y1);
      ctx.lineTo(flight.x2, flight.y2);
      ctx.stroke();

      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      ctx.lineWidth = 1.5;
      for (let i = 1; i <= 6; i += 1) {
        const t = i / 7;
        const treadX = flight.x1 + dx * t;
        const treadY = flight.y1 + dy * t;
        ctx.beginPath();
        ctx.moveTo(treadX - nx * 21, treadY - ny * 21);
        ctx.lineTo(treadX + nx * 21, treadY + ny * 21);
        ctx.stroke();
      }

      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(flight.x1 + nx * 12, flight.y1 + ny * 12);
      ctx.lineTo(flight.x2 + nx * 12, flight.y2 + ny * 12);
      ctx.moveTo(flight.x1 - nx * 12, flight.y1 - ny * 12);
      ctx.lineTo(flight.x2 - nx * 12, flight.y2 - ny * 12);
      ctx.stroke();
    });
  });

  const elevatorW = elevatorShaft.x2 - elevatorShaft.x1;
  const railLeft = elevatorShaft.x1 + (elevatorW - elevatorShaft.carW) / 2 + 8;
  const railRight = elevatorShaft.x2 - (elevatorW - elevatorShaft.carW) / 2 - 12;
  fillRoundedPanel(elevatorShaft.x1, buildingRect.y + 22, elevatorW, buildingRect.h - 44, 18, "rgba(12, 24, 37, 0.36)", "rgba(255,255,255,0.06)", 1.5);
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(railLeft, buildingRect.y + 44, 4, buildingRect.h - 88);
  ctx.fillRect(railRight, buildingRect.y + 44, 4, buildingRect.h - 88);

  floorLevels.forEach((floorY, index) => {
    fillRoundedPanel(elevatorShaft.x1 + 12, floorY - 52, elevatorW - 24, 18, 8, index === elevator?.targetFloor ? "rgba(149, 255, 181, 0.22)" : "rgba(118, 201, 255, 0.16)");
  });

  const carX = getElevatorCarX();
  const carY = elevator ? elevator.y : floorLevels[Math.min(2, floorLevels.length - 1)] - elevatorShaft.carH;
  fillRoundedPanel(carX, carY, elevatorShaft.carW, elevatorShaft.carH, 16, "#32485e", "rgba(255,255,255,0.14)", 2);
  drawScreenPanel(carX + 8, carY + 12, elevatorShaft.carW - 16, 42, "rgba(118, 201, 255, 0.42)");
  fillRoundedPanel(carX + 8, carY + 64, elevatorShaft.carW - 16, 54, 12, "#243647");
  drawAccentStrip(carX + 6, carY + 8, elevatorShaft.carW - 12, "#76c9ff", 0.85);

  floorLevels.forEach((floorY, index) => {
    const markerX = index === 0 ? 36 : buildingRect.x + 28;
    fillRoundedPanel(markerX, floorY + 28, 76, 14, 7, "rgba(7, 17, 29, 0.44)");
    ctx.fillStyle = getFloorTheme(index).accent;
    ctx.globalAlpha = 0.42;
    ctx.fillRect(markerX + 12, floorY + 33, 52, 4);
    ctx.globalAlpha = 1;
  });

  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(buildingRect.x + 116, buildingRect.y - 18);
  ctx.lineTo(buildingRect.x + 116, buildingRect.y - 54);
  ctx.lineTo(buildingRect.x + 136, buildingRect.y - 70);
  ctx.moveTo(buildingRect.x + buildingRect.w - 136, buildingRect.y - 18);
  ctx.lineTo(buildingRect.x + buildingRect.w - 136, buildingRect.y - 52);
  ctx.lineTo(buildingRect.x + buildingRect.w - 112, buildingRect.y - 70);
  ctx.stroke();
}

function drawStairCutout(segment) {
  // Intentionally empty: stair zones clear furniture but no longer draw a backing panel.
}

function drawCovers() {
  backgroundPropTemplates.forEach((prop) => {
    if (propOverlapsPrimaryStair(prop)) {
      return;
    }

    const rect = getCoverRect(prop);
    ctx.save();
    ctx.globalAlpha = 0.56;
    drawCoverModule(prop, rect);
    ctx.restore();
  });

  coverTemplates.forEach((cover) => {
    const rect = getCoverRect(cover);
    ctx.save();
    drawCoverModule(cover, rect);
    ctx.restore();
  });
}

function drawDoors() {
  doors.forEach((door) => {
    const rect = getDoorRect(door);
    drawSceneDoor(rect.x, rect.y, rect.w, rect.h, {
      fortified: door.fortified,
      open: door.open,
      destroyed: door.destroyed,
      accent: door.fortified ? "#ffd76b" : getFloorTheme(door.floor).accent,
    });
  });
}

function drawDeployables() {
  barricades.forEach((barricade) => {
    const rect = getBarricadeRect(barricade);
    roundRect(rect.x, rect.y, rect.w, rect.h, 10);
    ctx.fillStyle = "#315272";
    ctx.fill();
    ctx.fillStyle = "#95ffb5";
    ctx.fillRect(rect.x, rect.y, rect.w, 5);
  });

  turrets.forEach((turret) => {
    const rect = getTurretRect(turret);
    ctx.fillStyle = "#22354f";
    roundRect(rect.x, rect.y, rect.w, rect.h, 10);
    ctx.fill();
    ctx.fillStyle = "#95ffb5";
    ctx.fillRect(rect.x + 8, rect.y + 8, rect.w - 16, 8);
    ctx.fillRect(turret.x - 2, rect.y - 18, 4, 18);
    ctx.fillRect(turret.x, rect.y - 14, 24 * turret.facing, 4);
  });

  mines.forEach((mine) => {
    const y = getFloorY(mine.floor) - 8;
    ctx.fillStyle = mine.armedIn > 0 ? "#5d7e9a" : "#76c9ff";
    ctx.beginPath();
    ctx.arc(mine.x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#eef4ff";
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  supplyCaches.forEach((cache) => {
    if (cache.consumed) {
      return;
    }

    const rect = getSupplyCacheRect(cache);
    fillRoundedPanel(rect.x, rect.y, rect.w, rect.h, 10, "#2a3d52", cache.accent, 2);
    fillRoundedPanel(rect.x + 6, rect.y + 6, rect.w - 12, rect.h - 12, 8, "rgba(255,255,255,0.08)");
    ctx.fillStyle = cache.accent;
    if (cache.type === "med") {
      ctx.fillRect(rect.x + rect.w / 2 - 3, rect.y + 12, 6, rect.h - 24);
      ctx.fillRect(rect.x + 12, rect.y + rect.h / 2 - 3, rect.w - 24, 6);
    } else if (cache.type === "breach") {
      fillRoundedPanel(rect.x + 10, rect.y + 12, rect.w - 20, 12, 5, cache.accent);
      fillRoundedPanel(rect.x + rect.w / 2 - 5, rect.y + 8, 10, rect.h - 16, 4, "#ffae5d");
    } else {
      ctx.fillRect(rect.x + 10, rect.y + 12, rect.w - 20, 6);
      ctx.fillRect(rect.x + 10, rect.y + 22, rect.w - 20, 6);
      ctx.fillRect(rect.x + 10, rect.y + 32, rect.w - 20, 6);
    }
  });

  breachCharges.forEach((charge) => {
    const blink = charge.timer % 30 < 15 ? 1 : 0.45;
    const y = getFloorY(charge.floor) - 72;
    ctx.save();
    ctx.globalAlpha = blink;
    fillRoundedPanel(charge.x - 12, y, 24, 20, 6, "#3c4f63", "#ffce76", 2);
    fillRoundedPanel(charge.x - 8, y + 4, 16, 12, 4, "#ffae5d");
    ctx.restore();
  });
}

function drawObjective() {
  const pulse = 0.5 + Math.sin(lastTime * 0.006) * 0.5;
  const x = objectiveZone.x - objectiveZone.w / 2;
  const y = objectiveZone.y;

  roundRect(x, y, objectiveZone.w, objectiveZone.h, 12);
  ctx.fillStyle = "rgba(17, 33, 53, 0.94)";
  ctx.fill();
  ctx.strokeStyle = captureProgress > 0 ? "#ffce76" : "#76c9ff";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = `rgba(118, 201, 255, ${0.18 + pulse * 0.12})`;
  ctx.fillRect(x + 16, y + 16, objectiveZone.w - 32, 12);
  ctx.fillStyle = "#ffce76";
  ctx.fillRect(x + 16, y + 40, (objectiveZone.w - 32) * captureProgress, 12);

  ctx.fillStyle = "rgba(238,244,255,0.72)";
  ctx.beginPath();
  ctx.arc(objectiveZone.x, y - 12, 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayers() {
  players.forEach((player) => {
    const roleBand = player.role === "attacker" ? "#ffce76" : "#95ffb5";
    const height = getPlayerHeight(player);
    const bodyX = player.x - PLAYER_W / 2;
    const bodyY = player.y - height;

    if (!player.alive) {
      ctx.globalAlpha = 0.25;
    }

    ctx.save();
    ctx.shadowColor = player.color;
    ctx.shadowBlur = 18;

    roundRect(bodyX, bodyY + 14, PLAYER_W, height - 14, 14);
    ctx.fillStyle = player.color;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(player.x, bodyY + 14, 16, 0, Math.PI * 2);
    ctx.fillStyle = player.accent;
    ctx.fill();

    ctx.fillStyle = roleBand;
    ctx.fillRect(bodyX + 4, bodyY + 34, PLAYER_W - 8, 6);
    ctx.fillStyle = "#0b1522";
    ctx.fillRect(player.x + player.facing * 10, bodyY + 32, 24 * player.facing, 8);

    if (player.role === "attacker") {
      ctx.strokeStyle = "#ffd76b";
      ctx.lineWidth = 3;
      roundRect(bodyX + 6, bodyY + 24, PLAYER_W - 12, height - 28, 12);
      ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(118, 201, 255, 0.24)";
      ctx.fillRect(bodyX + 6, bodyY + 22, PLAYER_W - 12, 8);
    }

    ctx.restore();

    if (player.hurtFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${player.hurtFlash / 14})`;
      roundRect(bodyX, bodyY + 14, PLAYER_W, height - 14, 14);
      ctx.fill();
    }

    const displayName = player.controlMode === "ai" ? `${player.name} [AI]` : player.name;
    ctx.fillStyle = "#eef4ff";
    ctx.font = "700 20px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText(displayName, player.x, bodyY - 18);

    ctx.font = "600 14px Trebuchet MS";
    ctx.fillStyle = roleBand;
    ctx.fillText(getRoleTitle(player.role), player.x, bodyY - 2);
    if (player.controlMode === "ai") {
      ctx.fillStyle = "rgba(238,244,255,0.72)";
      ctx.font = "600 12px Trebuchet MS";
      ctx.fillText(`${player.aiState.fsmState || "Patrol"}:${player.aiState.actionId || "scan"}`, player.x, bodyY + 12);
    }

    const barX = player.x - 46;
    const barY = bodyY - 40;
    ctx.fillStyle = "rgba(10,18,33,0.9)";
    roundRect(barX, barY, 92, 10, 5);
    ctx.fill();
    ctx.fillStyle = player.color;
    roundRect(barX, barY, 92 * (player.health / player.maxHealth), 10, 5);
    ctx.fill();

    if (!player.alive) {
      ctx.globalAlpha = 1;
    }
  });
}

function drawAiDebug() {
  if (!isAiDebugEnabled()) {
    return;
  }
  for (const player of players) {
    if (!player.alive || player.controlMode !== "ai") {
      continue;
    }
    const tuning = getAiTuning(player);
    const eyeY = getPlayerEyeY(player);
    const facing = getFacingAngle(player);
    const halfFov = (tuning.frontalFovDeg * Math.PI) / 360;
    const leftAngle = facing - halfFov;
    const rightAngle = facing + halfFov;
    const range = tuning.visionRange;

    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = player.role === "attacker" ? "#ffce76" : "#95ffb5";
    ctx.beginPath();
    ctx.moveTo(player.x, eyeY);
    ctx.lineTo(player.x + Math.cos(leftAngle) * range, eyeY + Math.sin(leftAngle) * range);
    ctx.lineTo(player.x + Math.cos(rightAngle) * range, eyeY + Math.sin(rightAngle) * range);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    const stateLabel = `${player.aiState.fsmState || "Patrol"} (${player.aiState.fsmReason || "-"})`;
    ctx.fillStyle = "#eef4ff";
    ctx.font = "600 11px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText(stateLabel, player.x, eyeY - 14);

    if (player.aiState.debugTargetFloor === player.floor && player.aiState.debugTargetX !== null) {
      ctx.strokeStyle = "rgba(255, 173, 107, 0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(player.x, eyeY);
      ctx.lineTo(player.aiState.debugTargetX, floorLevels[player.floor] - 44);
      ctx.stroke();
      ctx.fillStyle = "#ffae5d";
      ctx.fillRect(player.aiState.debugTargetX - 5, floorLevels[player.floor] - 49, 10, 10);
    }

    if (player.aiState.lastHeardTimer > 0 && player.aiState.lastHeardFloor === player.floor && player.aiState.lastHeardX !== null) {
      ctx.strokeStyle = "rgba(118, 201, 255, 0.92)";
      ctx.beginPath();
      ctx.arc(player.aiState.lastHeardX, floorLevels[player.floor] - 26, 15, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (player.aiState.debugPathFloor === player.floor && player.aiState.debugPathX !== null) {
      ctx.strokeStyle = "rgba(238, 244, 255, 0.78)";
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.moveTo(player.x, player.y - 16);
      ctx.lineTo(player.aiState.debugPathX, player.y - 16);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (player.aiState.coverFloor === player.floor && player.aiState.coverX !== null) {
      ctx.fillStyle = "rgba(149, 255, 181, 0.9)";
      ctx.fillRect(player.aiState.coverX - 4, floorLevels[player.floor] - 58, 8, 8);
      ctx.fillStyle = "rgba(238,244,255,0.82)";
      ctx.font = "600 10px Trebuchet MS";
      ctx.fillText(`cover:${Math.round(player.aiState.coverScore || 0)}`, player.aiState.coverX, floorLevels[player.floor] - 66);
    }
  }
}

function drawBullets() {
  bullets.forEach((bullet) => {
    ctx.strokeStyle = bullet.trail;
    ctx.lineWidth = bullet.weaponId === "breacher" ? 4 : 3;
    ctx.beginPath();
    ctx.moveTo(bullet.prevX, bullet.prevY);
    ctx.lineTo(bullet.x, bullet.y);
    ctx.stroke();

    ctx.fillStyle = bullet.color;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawEffects() {
  effects.forEach((effect) => {
    if (effect.type === "spark") {
      ctx.globalAlpha = clamp(effect.life / 30, 0, 1);
      ctx.fillStyle = effect.color;
      ctx.fillRect(effect.x, effect.y, effect.size, effect.size);
      ctx.globalAlpha = 1;
      return;
    }

    if (effect.type === "ring") {
      const progress = 1 - effect.life / effect.maxLife;
      const radius = effect.radius + (effect.maxRadius - effect.radius) * progress;
      ctx.globalAlpha = clamp(effect.life / effect.maxLife, 0, 0.85);
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }

    if (effect.type === "dust") {
      const progress = 1 - effect.life / effect.maxLife;
      ctx.globalAlpha = clamp(effect.life / effect.maxLife, 0, 0.5);
      ctx.fillStyle = effect.color;
      ctx.beginPath();
      ctx.ellipse(effect.x, effect.y, 16 + progress * 18, 8 + progress * 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  });
}

function drawHud() {
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(6,14,25,0.72)";
  roundRect(22, 18, 352, 108, 18);
  ctx.fill();
  roundRect(WIDTH - 374, 18, 352, 108, 18);
  ctx.fill();

  players.forEach((player, index) => {
    const panelX = index === 0 ? 40 : WIDTH - 356;
    const hudName = player.controlMode === "ai" ? `${player.name} [AI]` : player.name;
    ctx.fillStyle = player.color;
    ctx.font = "700 26px Trebuchet MS";
    ctx.fillText(`${hudName}  ${player.score}`, panelX, 54);

    ctx.fillStyle = player.role === "attacker" ? "#ffd76b" : "#95ffb5";
    ctx.font = "700 18px Trebuchet MS";
    ctx.fillText(getRoleTitle(player.role), panelX + 156, 54);

    ctx.fillStyle = "#eef4ff";
    ctx.font = "600 18px Trebuchet MS";
    ctx.fillText(`${getCurrentWeapon(player).label}  HP ${Math.ceil(player.health)}`, panelX, 84);

    if (player.role === "attacker") {
      ctx.fillText(`炸药 ${player.inventory.breach}`, panelX, 108);
    } else {
      const gadget = ["trap", "turret", "barricade"][player.gadgetIndex];
      ctx.fillText(
        `${gadgetNames[gadget]}  雷 ${player.inventory.trap} / 炮台 ${player.inventory.turret} / 路障 ${player.inventory.barricade}`,
        panelX,
        108,
      );
    }
  });

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd76b";
  ctx.font = "800 30px Trebuchet MS";
  ctx.fillText("SB Game", WIDTH / 2, 48);

  ctx.fillStyle = "#aebfd8";
  ctx.font = "600 18px Trebuchet MS";
  const seconds = Math.max(0, Math.ceil((roundPhase === "prep" ? prepTimer : roundTimer) / 60));
  const phaseLabel = roundPhase === "prep" ? "Prep" : "Action";
  ctx.fillText(`Attack / Defend  |  ${phaseLabel} ${seconds}s  |  First to ${MATCH_TARGET}`, WIDTH / 2, 76);
  /*
  const phaseLabel = roundPhase === "prep" ? "守方准备阶段" : "行动倒计时";
  ctx.fillText(`攻方突入 / 守方固守  路  ${phaseLabel} ${seconds}s  路  先到 ${MATCH_TARGET} 局`, WIDTH / 2, 76);
  ctx.fillText(`攻方突入 / 守方固守  ·  倒计时 ${seconds}s  ·  先到 ${MATCH_TARGET} 局`, WIDTH / 2, 76);

  */
  ctx.fillStyle = "rgba(5, 12, 23, 0.82)";
  roundRect(WIDTH / 2 - 160, 94, 320, 18, 9);
  ctx.fill();
  ctx.fillStyle = "#ffce76";
  roundRect(WIDTH / 2 - 160, 94, 320 * captureProgress, 18, 9);
  ctx.fill();
  ctx.fillStyle = "#eef4ff";
  ctx.font = "600 14px Trebuchet MS";
  ctx.fillText("攻方终端压制进度", WIDTH / 2, 108);

  if (message.timer > 0) {
    ctx.fillStyle = "rgba(5,12,23,0.72)";
    roundRect(WIDTH / 2 - 220, 122, 440, 42, 18);
    ctx.fill();
    ctx.fillStyle = "#eef4ff";
    ctx.font = "700 20px Trebuchet MS";
    ctx.fillText(message.text, WIDTH / 2, 150);
  }

  if (roundOver && roundWinner) {
    ctx.fillStyle = "rgba(3, 8, 16, 0.74)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = roundWinner.color;
    ctx.font = "800 64px Trebuchet MS";
    ctx.fillText(`${roundWinner.name} 拿下本局`, WIDTH / 2, HEIGHT / 2 - 42);
    ctx.fillStyle = "#eef4ff";
    ctx.font = "700 28px Trebuchet MS";
    ctx.fillText(roundReason, WIDTH / 2, HEIGHT / 2 + 6);
    ctx.font = "700 24px Trebuchet MS";
    ctx.fillText(matchOver ? "按 R 重开整场" : "按 R 进入下一局", WIDTH / 2, HEIGHT / 2 + 50);
  }
}

function draw() {
  drawBackground();
  drawBuilding();
  drawCovers();
  drawDoors();
  drawObjective();
  drawDeployables();
  drawEffects();
  drawBullets();
  drawPlayers();
  drawAiDebug();
  drawHud();
}

function getControlLabel(mode) {
  return mode === "ai" ? "AI" : "Player";
}

function syncPlayerModesFromUi() {
  if (player1ModeEl) {
    players[0].controlMode = player1ModeEl.value === "ai" ? "ai" : "human";
  }

  if (player2ModeEl) {
    players[1].controlMode = player2ModeEl.value === "ai" ? "ai" : "human";
  }

  if (roleStatusEl) {
    const xiaoxiaoRole = players[0].role === "attacker" ? "鏀绘柟" : "瀹堟柟";
    const huihuiRole = players[1].role === "attacker" ? "鏀绘柟" : "瀹堟柟";
    roleStatusEl.textContent = `褰撳墠锛歱layer1 ${xiaoxiaoRole} [${getControlLabel(players[0].controlMode)}] / player2 ${huihuiRole} [${getControlLabel(players[1].controlMode)}]`;
  }
}

function refreshFullscreenButton() {
  if (!fullscreenBtn) {
    return;
  }

  fullscreenBtn.textContent = document.fullscreenElement ? "閫€鍑哄叏灞?" : "杩涘叆鍏ㄥ睆";
}

function refreshUiLabels() {
  if (fullscreenBtn) {
    fullscreenBtn.textContent = document.fullscreenElement ? "Exit Fullscreen" : "Enter Fullscreen";
  }

  if (swapRolesBtn) {
    swapRolesBtn.textContent = "Swap Roles";
  }

  if (resetSeriesBtn) {
    resetSeriesBtn.textContent = "Reset Match";
  }

  const player1Label = document.querySelector('label[for="player1-mode"] span');
  const player2Label = document.querySelector('label[for="player2-mode"] span');
  if (player1Label) {
    player1Label.textContent = "player1 Control";
  }
  if (player2Label) {
    player2Label.textContent = "player2 Control";
  }

  if (player1ModeEl) {
    if (player1ModeEl.options[0]) {
      player1ModeEl.options[0].textContent = "Player";
    }
    if (player1ModeEl.options[1]) {
      player1ModeEl.options[1].textContent = "AI";
    }
  }

  if (player2ModeEl) {
    if (player2ModeEl.options[0]) {
      player2ModeEl.options[0].textContent = "Player";
    }
    if (player2ModeEl.options[1]) {
      player2ModeEl.options[1].textContent = "AI";
    }
  }

  if (roleStatusEl) {
    const player1Role = players[0].role === "attacker" ? "Attack" : "Defend";
    const player2Role = players[1].role === "attacker" ? "Attack" : "Defend";
    roleStatusEl.textContent = `Current: player1 ${player1Role} [${getControlLabel(players[0].controlMode)}] / player2 ${player2Role} [${getControlLabel(players[1].controlMode)}]`;
  }
}

function applyPlayerModesFromUi() {
  syncPlayerModesFromUi();
  refreshUiLabels();
}

function applyModeSelectionFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const player1Mode = params.get("p1") || params.get("player1");
  const player2Mode = params.get("p2") || params.get("player2");

  if (player1ModeEl && (player1Mode === "ai" || player1Mode === "human")) {
    player1ModeEl.value = player1Mode;
  }

  if (player2ModeEl && (player2Mode === "ai" || player2Mode === "human")) {
    player2ModeEl.value = player2Mode;
  }
}

async function toggleFullscreen() {
  if (!gameShellEl) {
    return;
  }

  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await gameShellEl.requestFullscreen();
    }
  } catch (error) {
    showMessage("鍏ㄥ睆妯″紡鍚敤澶辫触", 120);
  }
}

function resizeCanvas() {
  // Cap render DPR for smoother performance on high-density displays.
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 1.25));
  canvas.width = WIDTH * dpr;
  canvas.height = HEIGHT * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function runSimulationFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const frames = Number(params.get("simulate"));
  if (!Number.isFinite(frames) || frames <= 0) {
    return false;
  }

  for (let i = 0; i < frames; i += 1) {
    update();
    keysPressed.clear();
    if (roundOver) {
      break;
    }
  }

  draw();

  const summaryEl = document.createElement("pre");
  summaryEl.id = "sim-summary";
  summaryEl.style.position = "fixed";
  summaryEl.style.left = "-9999px";
  summaryEl.style.top = "0";
  summaryEl.textContent = JSON.stringify({
    phase: roundPhase,
    prepTimer,
    roundTimer,
    captureProgress,
    players: players.map((player) => ({
      name: player.name,
      role: player.role,
      mode: player.controlMode,
      floor: player.floor,
      x: Math.round(player.x),
      alive: player.alive,
      intent: player.aiState.intent,
      action: player.aiState.actionId,
      fsmState: player.aiState.fsmState,
      fsmReason: player.aiState.fsmReason,
      lastSeenFloor: player.aiState.lastSeenFloor,
      suspicionFloor: player.aiState.suspicionFloor,
      lastHeardFloor: player.aiState.lastHeardFloor,
      threatConfidence: Number((player.aiState.threatConfidence || 0).toFixed(2)),
      threatSource: player.aiState.lastThreatSource,
      planIndex: player.aiState.planIndex,
      holdUntil: player.aiState.holdUntil,
      travelMode: player.travelMode,
      abilityCooldown: player.abilityCooldown,
      inventory: player.inventory,
      breach: player.inventory.breach ?? null,
    })),
    doors: doors.map((door) => ({
      id: door.id,
      floor: door.floor,
      open: door.open,
      fortified: door.fortified,
      destroyed: door.destroyed,
      hp: door.hp,
    })),
  }, null, 2);
  document.body.appendChild(summaryEl);
  return true;
}

function loop(timestamp) {
  if (!lastTime) {
    lastTime = timestamp;
  }

  const elapsed = timestamp - lastTime;
  if (elapsed >= 1000 / 60) {
    update();
    draw();
    keysPressed.clear();
    lastTime = timestamp;
  }

  requestAnimationFrame(loop);
}

if (swapRolesBtn) {
  swapRolesBtn.addEventListener("click", () => {
    ensureAudioReady();
    setRolePreset(rolePreset === "xiaoxiao-attack" ? "huihui-attack" : "xiaoxiao-attack");
    applyPlayerModesFromUi();
    showMessage("攻守方已经切换", 120);
  });
}

if (resetSeriesBtn) {
  resetSeriesBtn.addEventListener("click", () => {
    ensureAudioReady();
    resetSeries();
    applyPlayerModesFromUi();
    showMessage("整场战局已重置", 120);
  });
}

if (fullscreenBtn) {
  fullscreenBtn.addEventListener("click", () => {
    ensureAudioReady();
    toggleFullscreen();
  });
}

if (player1ModeEl) {
  player1ModeEl.addEventListener("change", applyPlayerModesFromUi);
}

if (player2ModeEl) {
  player2ModeEl.addEventListener("change", applyPlayerModesFromUi);
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);
document.addEventListener("fullscreenchange", () => {
  refreshUiLabels();
  resizeCanvas();
});
applyModeSelectionFromUrl();
setRolePreset("xiaoxiao-attack");
applyPlayerModesFromUi();
refreshUiLabels();
if (!runSimulationFromUrl()) {
  requestAnimationFrame(loop);
}
