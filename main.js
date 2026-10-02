import { Game } from "./game.js";

const canvas = document.querySelector("#gl-canvas");
const mainMenu = document.querySelector("#main-menu");
const controlsPanel = document.querySelector("#controls-panel");
const pausePanel = document.querySelector("#pause-panel");
const gameOver = document.querySelector("#game-over");
const hud = document.querySelector("#hud");
const bottomHelp = document.querySelector("#bottom-help");
const roomBanner = document.querySelector("#room-banner");
const bootError = document.querySelector("#boot-error");
const bootErrorMessage = document.querySelector("#boot-error-message");
const startButton = document.querySelector("#start-button");
const controlsButton = document.querySelector("#controls-button");
const backButton = document.querySelector("#back-button");
const resumeButton = document.querySelector("#resume-button");
const restartButton = document.querySelector("#restart-button");
const gameOverRestart = document.querySelector("#game-over-restart");
const retryButton = document.querySelector("#retry-button");
const startupStatus = document.querySelector("#startup-status");

const objectiveText = document.querySelector("#objective-text");
const zoneText = document.querySelector("#zone-text");
const statusText = document.querySelector("#status-text");
const healthText = document.querySelector("#health-text");
const healthFill = document.querySelector("#health-fill");
const ammoText = document.querySelector("#ammo-text");
const weaponState = document.querySelector("#weapon-state");
const weaponName = document.querySelector("#weapon-name");
const magRow = document.querySelector("#mag-row");
const combatMessage = document.querySelector("#combat-message");
const hitMarker = document.querySelector("#hit-marker");
const damageVignette = document.querySelector("#damage-vignette");
const shotFlash = document.querySelector("#shot-flash");
const viewmodelLayer = document.querySelector("#viewmodel-layer");
const viewmodelImage = document.querySelector("#viewmodel-image");
const muzzleFlashView = document.querySelector("#muzzle-flash-view");

let game = null;
let gameLoading = null;
let playing = false;
let combatMessageTimer = 0;
let hitMarkerTimer = 0;
let damageTimer = 0;
let roomTimer = 0;

function show(element) { element.classList.remove("hidden"); }
function hide(element) { element.classList.add("hidden"); }

function showCombatMessage(message) {
  combatMessage.textContent = message;
  combatMessageTimer = 1.0;
}

async function createGame() {
  if (gameLoading) return gameLoading;

  startButton.disabled = true;
  startButton.textContent = "CARREGANDO CENA...";
  if (startupStatus) startupStatus.textContent = "Inicializando WebGL e a instalação...";

  gameLoading = (async () => {
    try {
      game?.stop();
      const nextGame = new Game(canvas, {
        onState: updateHUD,
        onZone: updateZone,
        onStatus: showCombatMessage,
        onHit: (killed) => {
          hitMarkerTimer = 0.14;
          showCombatMessage(killed ? "ALVO NEUTRALIZADO" : "IMPACTO");
        },
        onWeaponChange: (type) => {
          setViewmodel(type);
        },
        onKnifeAttack: () => {
          pulseKnife();
        },
        onHeadshot: (killed) => {
          hitMarkerTimer = 0.22;
          showCombatMessage(killed ? "HEADSHOT // ALVO NEUTRALIZADO" : "HEADSHOT");
        },
        onAlert: () => showCombatMessage("ALERTA // ZUMBI EM PERSEGUIÇÃO"),
        onShot: () => {
          pulseViewmodel();
          flashMuzzle();
          shotFlash.classList.remove("flash");
          void shotFlash.offsetWidth;
          shotFlash.classList.add("flash");
        },
        onMuzzleFlash: flashMuzzle,
        onReloadStart: () => {
          viewmodelLayer.classList.add("reload");
        },
        onReloadComplete: () => {
          viewmodelLayer.classList.remove("reload");
        },
        onDamage: () => {
          damageTimer = 0.22;
        },
        onGameOver: () => {
          playing = false;
          hide(hud);
          hide(bottomHelp);
          hide(viewmodelLayer);
          hide(pausePanel);
          show(gameOver);
        },
        onPointerLock: (locked) => {
          if (!playing) return;
          if (locked) hide(pausePanel);
          else showCombatMessage("MOUSE LIVRE — clique no jogo para capturar a câmera");
        },
      });

      await nextGame.init();
      nextGame.start();
      game = nextGame;
      hide(bootError);
      startButton.disabled = false;
      startButton.textContent = "INICIAR OPERAÇÃO";
      if (startupStatus) startupStatus.textContent = "CENA PRONTA · clique em INICIAR OPERAÇÃO";
      return true;
    } catch (error) {
      console.error(error);
      bootErrorMessage.textContent = error instanceof Error ? error.message : "Falha desconhecida.";
      show(bootError);
      startButton.disabled = false;
      startButton.textContent = "TENTAR NOVAMENTE";
      if (startupStatus) startupStatus.textContent = "Não foi possível iniciar a cena. Veja a mensagem de erro.";
      return false;
    } finally {
      gameLoading = null;
    }
  })();

  return gameLoading;
}

async function startSession() {
  if (gameLoading) {
    await gameLoading;
  }

  if (!game) {
    const ready = await createGame();
    if (!ready || !game) return;
  }

  playing = true;
  hide(mainMenu);
  hide(controlsPanel);
  hide(gameOver);
  hide(pausePanel);
  show(hud);
  show(bottomHelp);
  show(viewmodelLayer);
  viewmodelLayer.classList.remove("reload", "knife-mode", "knife-swing");
  setViewmodel("ak");
  game.startSession();
}

function setViewmodel(type) {
  if (type === "knife") {
    viewmodelImage.src = "./assets/images/knife-viewmodel.png";
    viewmodelLayer.classList.add("knife-mode");
    hide(muzzleFlashView);
  } else {
    viewmodelImage.src = "./assets/images/ak-cs16-viewmodel.png";
    viewmodelLayer.classList.remove("knife-mode");
    show(muzzleFlashView);
  }
}

function pulseKnife() {
  viewmodelLayer.classList.remove("knife-swing");
  void viewmodelLayer.offsetWidth;
  viewmodelLayer.classList.add("knife-swing");
}

function pulseViewmodel() {
  viewmodelLayer.classList.remove("recoil");
  void viewmodelLayer.offsetWidth;
  viewmodelLayer.classList.add("recoil");
}

function flashMuzzle() {
  muzzleFlashView.classList.remove("active");
  void muzzleFlashView.offsetWidth;
  muzzleFlashView.classList.add("active");
}

function updateHUD(state) {
  if (!state) return;
  healthText.textContent = String(Math.ceil(state.health));
  healthFill.style.width = `${Math.max(0, state.health / state.maxHealth) * 100}%`;
  ammoText.textContent = String(state.ammo);
  const reserve = state.spareMagazines * state.magazineSize;
  document.querySelector(".ammo-row span").textContent = `/ ${reserve}`;
  weaponName.textContent = state.weaponName || "AK-47";
  if (state.weaponType === "knife") {
    weaponState.textContent = state.knifeAttacking ? "ATTACK" : "READY";
    ammoText.textContent = "—";
    document.querySelector(".ammo-row span").textContent = "";
    magRow.innerHTML = "";
  } else {
    weaponState.textContent = state.reloading ? "RELOADING" : (state.ammo === 0 ? "EMPTY" : "READY");
    ammoText.textContent = String(state.ammo);
    const reserve = state.spareMagazines * state.magazineSize;
    document.querySelector(".ammo-row span").textContent = `/ ${reserve}`;
    magRow.innerHTML = "";
    for (let i = 0; i < 4; i += 1) {
      const mag = document.createElement("b");
      mag.className = i < state.spareMagazines ? "active" : "";
      magRow.appendChild(mag);
    }
  }
  zoneText.textContent = state.zone;
  statusText.textContent = state.flashlight ? "LANTERNA: ATIVA" : "LANTERNA: DESATIVADA";

  magRow.innerHTML = "";
  for (let i = 0; i < 4; i += 1) {
    const mag = document.createElement("b");
    mag.className = i < state.spareMagazines ? "active" : "";
    magRow.appendChild(mag);
  }
}

function updateZone(zone) {
  roomBanner.textContent = zone;
  roomTimer = 2.0;
  show(roomBanner);
}

startButton.addEventListener("click", startSession);
controlsButton.addEventListener("click", () => {
  hide(mainMenu);
  show(controlsPanel);
});
backButton.addEventListener("click", () => {
  hide(controlsPanel);
  show(mainMenu);
});
resumeButton.addEventListener("click", () => game?.requestPointerLock());
restartButton.addEventListener("click", startSession);
gameOverRestart.addEventListener("click", startSession);
retryButton.addEventListener("click", () => {
  hide(bootError);
  void createGame();
});

let previousTime = performance.now();
function uiLoop(time) {
  const delta = Math.min((time - previousTime) / 1000, 0.05);
  previousTime = time;

  combatMessageTimer = Math.max(0, combatMessageTimer - delta);
  if (combatMessageTimer <= 0) combatMessage.textContent = "";

  hitMarkerTimer = Math.max(0, hitMarkerTimer - delta);
  if (hitMarkerTimer <= 0) hide(hitMarker); else show(hitMarker);

  damageTimer = Math.max(0, damageTimer - delta);
  damageVignette.classList.toggle("active", damageTimer > 0);

  roomTimer = Math.max(0, roomTimer - delta);
  if (roomTimer <= 0) hide(roomBanner);

  requestAnimationFrame(uiLoop);
}
requestAnimationFrame(uiLoop);
