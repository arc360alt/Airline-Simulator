import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles/base.css';
import './styles/hud.css';
import './styles/components.css';
import './styles/panels.css';
import './styles/research.css';
import './styles/onboarding.css';
import './styles/tutorial.css';

import { bus } from './game/bus';
import { beginNewSlot, game, listSaves, loadSlot, settings, takeBootIntent } from './game/state';
import { newGame } from './game/actions';
import { tick } from './game/sim';
import { Globe } from './globe/globe';
import { h } from './ui/dom';
import { applyTheme } from './ui/theme';
import { mountHud } from './ui/hud';
import { mountShell, showPlaneTip } from './ui/shell';
import { ui } from './ui/uiState';
import { mountToasts } from './ui/toast';
import { mountChecklist } from './ui/checklist';
import { onboarding } from './ui/onboarding';
import { saveMenu } from './ui/saveMenu';
import { mountTutorial } from './ui/tutorial';
import { sfx } from './ui/sfx';

async function boot(): Promise<void> {
  applyTheme();
  const app = document.getElementById('app')!;
  const sky = h('div.sky', h('div.sky-vignette'));
  app.appendChild(sky);

  const globe = new Globe(sky);
  let lastLook = `${settings.theme}|${settings.accent}|${settings.quality}|${document.documentElement.dataset.theme}`;
  bus.on('settings', () => {
    applyTheme();
    const look = `${settings.theme}|${settings.accent}|${settings.quality}|${document.documentElement.dataset.theme}`;
    if (look !== lastLook) {
      lastLook = look;
      globe.applyTheme();
    }
  });

  // run the render loop right away so the globe spins behind the title screen
  let last = performance.now();
  const loop = (now: number) => {
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    if (game.s) tick(dt);
    globe.frame(game.s);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  const fresh = await chooseAirline(app);

  const ui$ = h('div.ui');
  app.appendChild(ui$);
  mountHud(ui$);
  mountShell(ui$);
  mountChecklist(ui$);
  mountTutorial(ui$, fresh);
  mountToasts(ui$);
  document.documentElement.style.setProperty('--livery', game.s!.airline.color);

  globe.onAirportClick = (code) => {
    ui.selectedAirport = code;
    globe.focus(code);
    bus.emit('openPanel', 'airports');
    bus.emit('change');
  };
  globe.onPlaneClick = (id) => {
    ui.highlightPlane = id;
    bus.emit('openPanel', 'fleet');
    bus.emit('change');
  };
  globe.onPlaneHover = showPlaneTip;
  bus.on('focusAirport', (code) => {
    ui.selectedAirport = code;
    globe.focus(code);
  });
  bus.on('crash', ({ lat, lon }) => {
    globe.explode(lat, lon);
    sfx.bad();
  });

  globe.focus(game.s!.airline.hub, false);
  bus.emit('change');
}

/**
 * Decide which airline to run: honour a request from the previous page (switch
 * save / new airline), otherwise show the save list. Returns true for a newly
 * founded airline.
 */
async function chooseAirline(app: HTMLElement): Promise<boolean> {
  const intent = takeBootIntent();
  if (intent?.kind === 'load' && loadSlot(intent.id)) return false;
  let wantNew = intent?.kind === 'new';
  for (;;) {
    const saves = listSaves();
    if (!wantNew && saves.length) {
      const choice = await saveMenu(app);
      if (choice.kind === 'load' && loadSlot(choice.id)) return false;
      wantNew = choice.kind === 'new';
      if (!wantNew) continue;
    }
    const airline = await onboarding(app, listSaves().length > 0);
    if (airline) {
      beginNewSlot();
      newGame(airline);
      return true;
    }
    wantNew = false; // went back to the save list
  }
}

void boot();
