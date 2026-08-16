/** Thin wrapper over the DOM overlay: HP, score, timer, stick widget, game over. */
export class Hud {
  private readonly hpFill = requireElement<HTMLDivElement>('hp-fill');
  private readonly scoreValue = requireElement<HTMLSpanElement>('stat-score');
  private readonly timeValue = requireElement<HTMLSpanElement>('stat-time');
  private readonly stickWidget = requireElement<HTMLDivElement>('stick-widget');
  private readonly stickKnob = requireElement<HTMLDivElement>('stick-knob');
  private readonly fireHint = requireElement<HTMLDivElement>('fire-hint');
  private readonly damageFlash = requireElement<HTMLDivElement>('damage-flash');
  private readonly gameOver = requireElement<HTMLDivElement>('game-over');
  private readonly finalScore = requireElement<HTMLSpanElement>('final-score');
  private readonly finalTime = requireElement<HTMLSpanElement>('final-time');
  private readonly restartButton = requireElement<HTMLButtonElement>('restart-button');
  private readonly enemyToggle = requireElement<HTMLButtonElement>('enemy-toggle');
  private readonly fireToggle = requireElement<HTMLButtonElement>('fire-toggle');
  private readonly steerToggle = requireElement<HTMLButtonElement>('steer-toggle');
  private readonly speedSlider = requireElement<HTMLInputElement>('speed-slider');
  private readonly speedValue = requireElement<HTMLSpanElement>('speed-value');

  private knobTravel = 34;
  private hintHidden = false;

  constructor(coarsePointer: boolean) {
    this.fireHint.textContent = coarsePointer
      ? 'DRAG THE LEFT SIDE TO DRIVE - THE FLAMER BURNS ON ITS OWN'
      : 'ARROWS OR WASD TO DRIVE - THE FLAMER BURNS ON ITS OWN';
    this.measureKnobTravel();
    window.addEventListener('resize', () => this.measureKnobTravel());
  }

  onRestart(handler: () => void): void {
    this.restartButton.addEventListener('click', handler);
  }

  /** The handler receives the state the player just switched to. */
  onToggleEnemies(handler: (enabled: boolean) => void): void {
    bindToggle(this.enemyToggle, 'ENEMIES', handler);
  }

  onToggleFire(handler: (enabled: boolean) => void): void {
    bindToggle(this.fireToggle, 'FIRE', handler);
  }

  setEnemiesEnabled(enabled: boolean): void {
    paintToggle(this.enemyToggle, 'ENEMIES', enabled);
  }

  setFireEnabled(enabled: boolean): void {
    paintToggle(this.fireToggle, 'FIRE', enabled);
  }

  /** Pressed means screen-relative steering; released means hull-relative. */
  onToggleSteering(handler: (screenRelative: boolean) => void): void {
    this.steerToggle.addEventListener('click', () => {
      const screenRelative = this.steerToggle.getAttribute('aria-pressed') !== 'true';
      this.setScreenSteering(screenRelative);
      handler(screenRelative);
    });
  }

  setScreenSteering(screenRelative: boolean): void {
    this.steerToggle.setAttribute('aria-pressed', String(screenRelative));
    this.steerToggle.textContent = `STEER: ${screenRelative ? 'SCREEN' : 'TANK'}`;
  }

  /** The handler receives a multiplier of the tank's base top speed. */
  onSpeedChange(handler: (scale: number) => void): void {
    const emit = (): void => {
      const percent = Number(this.speedSlider.value);
      this.speedValue.textContent = `${percent}%`;
      handler(percent / 100);
    };

    this.speedSlider.addEventListener('input', emit);
    emit();
  }

  configureSpeedSlider(min: number, max: number): void {
    this.speedSlider.min = String(Math.round(min * 100));
    this.speedSlider.max = String(Math.round(max * 100));
  }

  setHealth(current: number, max: number): void {
    const ratio = Math.max(0, current / max);
    this.hpFill.style.width = `${ratio * 100}%`;
    this.hpFill.classList.toggle('low', ratio <= 0.34);
  }

  setScore(score: number): void {
    this.scoreValue.textContent = String(score);
  }

  setTime(seconds: number): void {
    this.timeValue.textContent = formatTime(seconds);
  }

  /** Stick axes arrive in game space: x is right, y is forward. */
  setStick(x: number, y: number, active: boolean): void {
    const offsetX = x * this.knobTravel;
    const offsetY = -y * this.knobTravel;
    this.stickKnob.style.transform = `translate(${offsetX.toFixed(1)}px, ${offsetY.toFixed(1)}px)`;
    this.stickWidget.classList.toggle('active', active || x !== 0 || y !== 0);
  }

  flashDamage(): void {
    this.damageFlash.classList.add('on');
    window.setTimeout(() => this.damageFlash.classList.remove('on'), 70);
  }

  dismissFireHint(): void {
    if (this.hintHidden) return;
    this.hintHidden = true;
    this.fireHint.classList.add('hidden');
  }

  showGameOver(score: number, seconds: number): void {
    this.finalScore.textContent = String(score);
    this.finalTime.textContent = formatTime(seconds);
    this.gameOver.classList.remove('hidden');
  }

  hideGameOver(): void {
    this.gameOver.classList.add('hidden');
  }

  private measureKnobTravel(): void {
    const base = this.stickKnob.parentElement;
    if (!base) return;
    this.knobTravel = Math.max(12, (base.clientWidth - this.stickKnob.clientWidth) / 2 - 3);
  }
}

function bindToggle(
  button: HTMLButtonElement,
  label: string,
  handler: (enabled: boolean) => void,
): void {
  button.addEventListener('click', () => {
    const enabled = button.getAttribute('aria-pressed') !== 'true';
    paintToggle(button, label, enabled);
    handler(enabled);
  });
}

function paintToggle(button: HTMLButtonElement, label: string, enabled: boolean): void {
  button.setAttribute('aria-pressed', String(enabled));
  button.textContent = `${label}: ${enabled ? 'ON' : 'OFF'}`;
}

function formatTime(seconds: number): string {
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, '0')}`;
}

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`HUD element #${id} is missing from the document`);
  return element as T;
}
