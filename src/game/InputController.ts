type Vec2 = { x: number; y: number };

type ActionName = "pulse" | "dash" | "jump" | "interact";

const MOVEMENT_CODES = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowLeft",
  "ArrowDown",
  "ArrowRight",
]);

const GAMEPLAY_CODES = new Set([
  ...MOVEMENT_CODES,
  "Space",
  "KeyQ",
  "ShiftLeft",
  "ShiftRight",
  "KeyE",
  "Escape",
]);

const TEXT_ENTRY_SELECTOR =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

const SPACE_ACTIVATION_SELECTOR = "button, a[href], [role='button']";

const CAMERA_BLOCKING_SELECTOR =
  "#joystick-zone, #pulse-button, #dash-button, #jump-button, #interact-button";

/**
 * Normalizes keyboard, mouse and multi-touch controls into a small polling API.
 * `move` is persistent, while `look` and Escape are frame deltas cleared by
 * `resetFrame`. Action presses remain queued until their consume method runs.
 */
export class InputController {
  public readonly move: Vec2 = { x: 0, y: 0 };
  public readonly look: Vec2 = { x: 0, y: 0 };

  private readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly joystickZone: HTMLElement | null;
  private readonly joystickKnob: HTMLElement | null;
  private readonly lookZone: HTMLElement;

  private readonly pressedKeys = new Set<string>();
  private readonly touchMove: Vec2 = { x: 0, y: 0 };
  private readonly cleanups: Array<() => void> = [];
  private readonly actionPointers = new Map<HTMLElement, Set<number>>();
  private readonly lastPointerActivation = new WeakMap<HTMLElement, number>();

  private readonly originalStyles = new Map<HTMLElement, Map<string, string>>();
  private readonly originalClasses = new Map<HTMLElement, Map<string, boolean>>();
  private readonly originalAttributes = new Map<HTMLElement, Map<string, string | null>>();

  private joystickPointer: number | null = null;
  private joystickOriginX = 0;
  private joystickOriginY = 0;
  private joystickRadius = 48;

  private lookPointer: number | null = null;
  private lookCaptureElement: HTMLElement | null = null;
  private lookLastX = 0;
  private lookLastY = 0;
  private lookScaleX = 1;
  private lookScaleY = 1;

  private pulseQueued = false;
  private dashQueued = false;
  private interactQueued = false;
  private jumpQueued = false;
  private pausePressed = false;
  private disposed = false;

  public constructor(root: HTMLElement, canvas: HTMLCanvasElement) {
    this.root = root;
    this.canvas = canvas;
    this.joystickZone = this.findElement<HTMLElement>("#joystick-zone");
    this.joystickKnob = this.findElement<HTMLElement>("#joystick-knob");
    this.lookZone = this.findElement<HTMLElement>("#look-zone") ?? canvas;

    this.prepareGameSurface();
    this.bindKeyboard();
    this.bindPointerControls();
    this.bindLifecycle();
  }

  public consumePulse(): boolean {
    const queued = this.pulseQueued;
    this.pulseQueued = false;
    return queued;
  }

  public consumeDash(): boolean {
    const queued = this.dashQueued;
    this.dashQueued = false;
    return queued;
  }

  public consumeInteract(): boolean {
    const queued = this.interactQueued;
    this.interactQueued = false;
    return queued;
  }

  public consumeJump(): boolean {
    const queued = this.jumpQueued;
    this.jumpQueued = false;
    return queued;
  }

  public isPausePressed(): boolean {
    return this.pausePressed;
  }

  public resetFrame(): void {
    this.look.x = 0;
    this.look.y = 0;
    this.pausePressed = false;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.cancelAllInput();
    for (const cleanup of this.cleanups.splice(0)) cleanup();
    this.restoreManagedDomState();
  }

  private findElement<T extends HTMLElement>(selector: string): T | null {
    if (this.root.matches(selector)) return this.root as T;
    return this.root.querySelector<T>(selector);
  }

  private prepareGameSurface(): void {
    const gestureSurfaces = new Set<HTMLElement>([
      this.root,
      this.canvas,
      this.lookZone,
    ]);

    if (this.joystickZone) gestureSurfaces.add(this.joystickZone);
    if (this.joystickKnob) gestureSurfaces.add(this.joystickKnob);

    for (const selector of ["#pulse-button", "#dash-button", "#jump-button", "#interact-button"]) {
      const element = this.findElement<HTMLElement>(selector);
      if (element) gestureSurfaces.add(element);
    }

    for (const element of gestureSurfaces) {
      this.setManagedStyle(element, "touch-action", "none");
      this.setManagedStyle(element, "user-select", "none");
      this.setManagedStyle(element, "-webkit-user-select", "none");
      this.setManagedStyle(element, "-webkit-touch-callout", "none");
    }
    this.setManagedStyle(this.root, "overscroll-behavior", "none");

    const preventGesture = (event: Event): void => {
      if (event.cancelable) event.preventDefault();
    };
    const preventContextMenu = (event: Event): void => {
      if (event.cancelable) event.preventDefault();
    };

    this.listen(this.root, "gesturestart", preventGesture, { passive: false });
    this.listen(this.root, "gesturechange", preventGesture, { passive: false });
    this.listen(this.root, "gestureend", preventGesture, { passive: false });
    this.listen(this.root, "touchmove", preventGesture, { passive: false });
    this.listen(this.root, "dragstart", preventGesture);
    this.listen(this.root, "selectstart", preventGesture);
    this.listen(this.canvas, "contextmenu", preventContextMenu);
    if (this.lookZone !== this.canvas) {
      this.listen(this.lookZone, "contextmenu", preventContextMenu);
    }
  }

  private bindKeyboard(): void {
    this.listen(window, "keydown", this.onKeyDown as EventListener);
    this.listen(window, "keyup", this.onKeyUp as EventListener);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (this.disposed || !GAMEPLAY_CODES.has(event.code)) return;
    if (!this.keyboardBelongsToGame(event)) return;
    if ((event.altKey || event.ctrlKey || event.metaKey) && event.code !== "Escape") return;

    if (event.cancelable) event.preventDefault();

    if (MOVEMENT_CODES.has(event.code)) {
      this.pressedKeys.add(event.code);
      this.updateMove();
      return;
    }

    if (event.repeat) return;
    switch (event.code) {
      case "Space":
        this.jumpQueued = true;
        break;
      case "KeyQ":
        this.pulseQueued = true;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        this.dashQueued = true;
        break;
      case "KeyE":
        this.interactQueued = true;
        break;
      case "Escape":
        this.pausePressed = true;
        break;
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (!MOVEMENT_CODES.has(event.code)) return;

    const wasPressed = this.pressedKeys.delete(event.code);
    if (wasPressed) this.updateMove();
    if (wasPressed && this.keyboardBelongsToGame(event) && event.cancelable) {
      event.preventDefault();
    }
  };

  private keyboardBelongsToGame(event: KeyboardEvent): boolean {
    if (!this.root.isConnected || this.blocksGameKeyboard(event.target, event.code)) return false;

    const eventTarget = event.target;
    if (eventTarget instanceof Node && this.root.contains(eventTarget)) return true;

    const active = document.activeElement;
    if (this.blocksGameKeyboard(active, event.code)) return false;
    if (active instanceof Node && this.root.contains(active)) return true;

    return active === null || active === document.body || active === document.documentElement;
  }

  private blocksGameKeyboard(target: EventTarget | null, code: string): boolean {
    if (!(target instanceof Element)) return false;
    if (target.closest(TEXT_ENTRY_SELECTOR)) return true;
    return code === "Space" && target.closest(SPACE_ACTIVATION_SELECTOR) !== null;
  }

  private bindPointerControls(): void {
    if (this.joystickZone) {
      this.listen(
        this.joystickZone,
        "pointerdown",
        this.onJoystickPointerDown as EventListener,
        { passive: false },
      );
      this.listen(
        this.joystickZone,
        "lostpointercapture",
        this.onJoystickLostCapture as EventListener,
      );
    }

    this.bindLookSurface(this.lookZone, false);
    if (this.lookZone !== this.canvas) this.bindLookSurface(this.canvas, true);

    this.bindActionButton(this.findElement<HTMLElement>("#pulse-button"), "pulse");
    this.bindActionButton(this.findElement<HTMLElement>("#dash-button"), "dash");
    this.bindActionButton(this.findElement<HTMLElement>("#jump-button"), "jump");
    this.bindActionButton(this.findElement<HTMLElement>("#interact-button"), "interact");

    this.listen(window, "pointermove", this.onGlobalPointerMove as EventListener, {
      passive: false,
      capture: true,
    });
    this.listen(window, "pointerup", this.onGlobalPointerEnd as EventListener, true);
    this.listen(window, "pointercancel", this.onGlobalPointerEnd as EventListener, true);
  }

  private readonly onJoystickPointerDown = (event: PointerEvent): void => {
    if (this.disposed || !this.joystickZone || this.joystickPointer !== null) return;
    if (!this.isUsablePointerDown(event)) return;

    event.preventDefault();
    event.stopPropagation();
    this.joystickPointer = event.pointerId;
    this.capturePointer(this.joystickZone, event.pointerId);

    const rect = this.joystickZone.getBoundingClientRect();
    const shortSide = Math.min(rect.width, rect.height);
    this.joystickRadius = Math.max(36, Math.min(64, shortSide * 0.28 || 48));

    const insetX = Math.min(this.joystickRadius, rect.width * 0.5);
    const insetY = Math.min(this.joystickRadius, rect.height * 0.5);
    this.joystickOriginX = this.clamp(
      event.clientX - rect.left,
      insetX,
      Math.max(insetX, rect.width - insetX),
    );
    this.joystickOriginY = this.clamp(
      event.clientY - rect.top,
      insetY,
      Math.max(insetY, rect.height - insetY),
    );

    this.setManagedClass(this.joystickZone, "is-active", true);
    this.setManagedStyle(
      this.joystickZone,
      "--joystick-origin-x",
      `${this.joystickOriginX}px`,
    );
    this.setManagedStyle(
      this.joystickZone,
      "--joystick-origin-y",
      `${this.joystickOriginY}px`,
    );

    if (this.joystickKnob) {
      this.setManagedStyle(this.joystickKnob, "left", `${this.joystickOriginX}px`);
      this.setManagedStyle(this.joystickKnob, "top", `${this.joystickOriginY}px`);
      this.setManagedStyle(this.joystickKnob, "will-change", "transform");
    }

    this.updateJoystick(event.clientX, event.clientY);
  };

  private readonly onJoystickLostCapture = (event: PointerEvent): void => {
    if (event.pointerId === this.joystickPointer) this.finishJoystick(false);
  };

  private updateJoystick(clientX: number, clientY: number): void {
    if (!this.joystickZone) return;

    const rect = this.joystickZone.getBoundingClientRect();
    const rawX = clientX - rect.left - this.joystickOriginX;
    const rawY = clientY - rect.top - this.joystickOriginY;
    const rawDistance = Math.hypot(rawX, rawY);
    const visualScale = rawDistance > this.joystickRadius ? this.joystickRadius / rawDistance : 1;
    const offsetX = rawX * visualScale;
    const offsetY = rawY * visualScale;

    const deadZone = 0.1;
    const magnitude = Math.min(1, rawDistance / this.joystickRadius);
    const outputMagnitude = magnitude <= deadZone ? 0 : (magnitude - deadZone) / (1 - deadZone);
    const directionScale = rawDistance > 0 ? outputMagnitude / rawDistance : 0;
    this.touchMove.x = rawX * directionScale;
    this.touchMove.y = -rawY * directionScale;
    this.updateMove();

    this.setManagedStyle(this.joystickZone, "--joystick-offset-x", `${offsetX}px`);
    this.setManagedStyle(this.joystickZone, "--joystick-offset-y", `${offsetY}px`);
    this.setManagedStyle(this.joystickZone, "--joystick-input-x", `${this.touchMove.x}`);
    this.setManagedStyle(this.joystickZone, "--joystick-input-y", `${this.touchMove.y}`);

    if (this.joystickKnob) {
      this.setManagedStyle(
        this.joystickKnob,
        "transform",
        `translate3d(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px), 0)`,
      );
    }
  }

  private finishJoystick(releaseCapture: boolean): void {
    const pointerId = this.joystickPointer;
    this.joystickPointer = null;
    this.touchMove.x = 0;
    this.touchMove.y = 0;
    this.updateMove();

    if (this.joystickZone) {
      this.setManagedClass(this.joystickZone, "is-active", false);
      this.restoreManagedStyle(this.joystickZone, "--joystick-origin-x");
      this.restoreManagedStyle(this.joystickZone, "--joystick-origin-y");
      this.restoreManagedStyle(this.joystickZone, "--joystick-offset-x");
      this.restoreManagedStyle(this.joystickZone, "--joystick-offset-y");
      this.restoreManagedStyle(this.joystickZone, "--joystick-input-x");
      this.restoreManagedStyle(this.joystickZone, "--joystick-input-y");
      if (releaseCapture && pointerId !== null) {
        this.releasePointer(this.joystickZone, pointerId);
      }
    }

    if (this.joystickKnob) {
      this.restoreManagedStyle(this.joystickKnob, "left");
      this.restoreManagedStyle(this.joystickKnob, "top");
      this.restoreManagedStyle(this.joystickKnob, "transform");
      this.restoreManagedStyle(this.joystickKnob, "will-change");
    }
  }

  private bindLookSurface(surface: HTMLElement, mouseOnly: boolean): void {
    const pointerDown = (rawEvent: Event): void => {
      const event = rawEvent as PointerEvent;
      if (this.disposed || this.lookPointer !== null) return;
      if (mouseOnly && event.pointerType !== "mouse") return;
      if (!this.isUsablePointerDown(event) || this.cameraIsBlockedBy(event.target)) return;

      event.preventDefault();
      this.lookPointer = event.pointerId;
      this.lookCaptureElement = surface;
      this.lookLastX = event.clientX;
      this.lookLastY = event.clientY;

      const rect = surface.getBoundingClientRect();
      this.lookScaleX = Math.max(1, rect.width);
      this.lookScaleY = Math.max(1, rect.height);
      this.setManagedClass(surface, "is-active", true);
      this.capturePointer(surface, event.pointerId);
    };

    const lostCapture = (rawEvent: Event): void => {
      const event = rawEvent as PointerEvent;
      if (event.pointerId === this.lookPointer && surface === this.lookCaptureElement) {
        this.finishLook(false);
      }
    };

    this.listen(surface, "pointerdown", pointerDown, { passive: false });
    this.listen(surface, "lostpointercapture", lostCapture);
  }

  private cameraIsBlockedBy(target: EventTarget | null): boolean {
    return target instanceof Element && target.closest(CAMERA_BLOCKING_SELECTOR) !== null;
  }

  private updateLook(event: PointerEvent): void {
    const samples = event.getCoalescedEvents?.() ?? [];
    const pointerEvents = samples.length > 0 ? samples : [event];

    for (const sample of pointerEvents) {
      const deltaX = sample.clientX - this.lookLastX;
      const deltaY = sample.clientY - this.lookLastY;
      this.lookLastX = sample.clientX;
      this.lookLastY = sample.clientY;
      this.look.x += deltaX / this.lookScaleX;
      this.look.y += deltaY / this.lookScaleY;
    }
  }

  private finishLook(releaseCapture: boolean): void {
    const pointerId = this.lookPointer;
    const captureElement = this.lookCaptureElement;
    this.lookPointer = null;
    this.lookCaptureElement = null;

    if (captureElement) {
      this.setManagedClass(captureElement, "is-active", false);
      if (releaseCapture && pointerId !== null) {
        this.releasePointer(captureElement, pointerId);
      }
    }
  }

  private bindActionButton(button: HTMLElement | null, action: ActionName): void {
    if (!button) return;
    const pointers = new Set<number>();
    this.actionPointers.set(button, pointers);

    const pointerDown = (rawEvent: Event): void => {
      const event = rawEvent as PointerEvent;
      if (this.disposed || !this.isUsablePointerDown(event)) return;

      event.preventDefault();
      event.stopPropagation();
      if (pointers.has(event.pointerId)) return;

      pointers.add(event.pointerId);
      this.capturePointer(button, event.pointerId);
      this.setManagedClass(button, "is-pressed", true);
      this.setManagedAttribute(button, "aria-pressed", "true");
      this.lastPointerActivation.set(button, performance.now());
      this.queueAction(action);
    };

    // Some WebKit automation/embedded contexts synthesize a click from touch
    // without exposing the matching PointerEvent. Keep a click fallback for
    // those contexts and for keyboard activation, while suppressing the click
    // that normally follows a pointerdown so actions never fire twice.
    const clickFallback = (rawEvent: Event): void => {
      if (this.disposed) return;
      const lastPointer = this.lastPointerActivation.get(button) ?? -Infinity;
      if (performance.now() - lastPointer < 750) return;
      if (rawEvent.cancelable) rawEvent.preventDefault();
      this.lastPointerActivation.set(button, performance.now());
      this.queueAction(action);
    };

    const touchFallback = (rawEvent: Event): void => {
      if (this.disposed) return;
      const lastActivation = this.lastPointerActivation.get(button) ?? -Infinity;
      if (performance.now() - lastActivation < 750) return;
      if (rawEvent.cancelable) rawEvent.preventDefault();
      this.lastPointerActivation.set(button, performance.now());
      this.setManagedClass(button, "is-pressed", true);
      this.setManagedAttribute(button, "aria-pressed", "true");
      this.queueAction(action);
      window.setTimeout(() => {
        if (!this.disposed) this.releaseActionVisual(button);
      }, 120);
    };

    const lostCapture = (rawEvent: Event): void => {
      const event = rawEvent as PointerEvent;
      if (!pointers.delete(event.pointerId)) return;
      if (pointers.size === 0) this.releaseActionVisual(button);
    };

    this.listen(button, "pointerdown", pointerDown, { passive: false });
    this.listen(button, "touchstart", touchFallback, { passive: false });
    this.listen(button, "click", clickFallback);
    this.listen(button, "lostpointercapture", lostCapture);
  }

  private queueAction(action: ActionName): void {
    switch (action) {
      case "pulse":
        this.pulseQueued = true;
        break;
      case "dash":
        this.dashQueued = true;
        break;
      case "jump":
        this.jumpQueued = true;
        break;
      case "interact":
        this.interactQueued = true;
        break;
    }
  }

  private readonly onGlobalPointerMove = (event: PointerEvent): void => {
    if (this.disposed) return;

    if (event.pointerId === this.joystickPointer) {
      if (event.cancelable) event.preventDefault();
      this.updateJoystick(event.clientX, event.clientY);
      return;
    }

    if (event.pointerId === this.lookPointer) {
      if (event.cancelable) event.preventDefault();
      this.updateLook(event);
    }
  };

  private readonly onGlobalPointerEnd = (event: PointerEvent): void => {
    if (event.pointerId === this.joystickPointer) this.finishJoystick(true);
    if (event.pointerId === this.lookPointer) this.finishLook(true);

    for (const [button, pointers] of this.actionPointers) {
      if (!pointers.delete(event.pointerId)) continue;
      this.releasePointer(button, event.pointerId);
      if (pointers.size === 0) this.releaseActionVisual(button);
    }
  };

  private releaseActionVisual(button: HTMLElement): void {
    this.setManagedClass(button, "is-pressed", false);
    this.restoreManagedAttribute(button, "aria-pressed");
  }

  private bindLifecycle(): void {
    const cancel = (): void => this.cancelAllInput();
    const visibilityChange = (): void => {
      if (document.visibilityState !== "visible") this.cancelAllInput();
    };

    this.listen(window, "blur", cancel);
    this.listen(window, "pagehide", cancel);
    this.listen(document, "visibilitychange", visibilityChange);
  }

  private cancelAllInput(): void {
    this.pressedKeys.clear();
    this.finishJoystick(true);
    this.finishLook(true);

    for (const [button, pointers] of this.actionPointers) {
      for (const pointerId of pointers) this.releasePointer(button, pointerId);
      pointers.clear();
      this.releaseActionVisual(button);
    }

    this.move.x = 0;
    this.move.y = 0;
    this.look.x = 0;
    this.look.y = 0;
    this.pulseQueued = false;
    this.dashQueued = false;
    this.interactQueued = false;
    this.jumpQueued = false;
    this.pausePressed = false;
  }

  private updateMove(): void {
    const keyboardX =
      Number(this.pressedKeys.has("KeyD") || this.pressedKeys.has("ArrowRight")) -
      Number(this.pressedKeys.has("KeyA") || this.pressedKeys.has("ArrowLeft"));
    const keyboardY =
      Number(this.pressedKeys.has("KeyW") || this.pressedKeys.has("ArrowUp")) -
      Number(this.pressedKeys.has("KeyS") || this.pressedKeys.has("ArrowDown"));

    const combinedX = keyboardX + this.touchMove.x;
    const combinedY = keyboardY + this.touchMove.y;
    const length = Math.hypot(combinedX, combinedY);
    const scale = length > 1 ? 1 / length : 1;
    this.move.x = combinedX * scale;
    this.move.y = combinedY * scale;
  }

  private isUsablePointerDown(event: PointerEvent): boolean {
    // Every touch contact reports button 0, but only the first one isPrimary.
    // Do not reject later contacts: the joystick, camera and actions must work
    // at the same time with independent pointer IDs.
    return event.button === 0;
  }

  private capturePointer(element: HTMLElement, pointerId: number): void {
    try {
      element.setPointerCapture(pointerId);
    } catch {
      // Window-level pointer listeners still provide a safe fallback.
    }
  }

  private releasePointer(element: HTMLElement, pointerId: number): void {
    try {
      if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
    } catch {
      // The pointer or element can disappear during navigation/orientation changes.
    }
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    return Math.max(minimum, Math.min(maximum, value));
  }

  private listen(
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void {
    target.addEventListener(type, listener, options);
    this.cleanups.push(() => target.removeEventListener(type, listener, options));
  }

  private setManagedStyle(element: HTMLElement, property: string, value: string): void {
    let properties = this.originalStyles.get(element);
    if (!properties) {
      properties = new Map();
      this.originalStyles.set(element, properties);
    }
    if (!properties.has(property)) {
      properties.set(property, element.style.getPropertyValue(property));
    }
    element.style.setProperty(property, value);
  }

  private restoreManagedStyle(element: HTMLElement, property: string): void {
    const original = this.originalStyles.get(element)?.get(property);
    if (original === undefined) return;
    if (original) element.style.setProperty(property, original);
    else element.style.removeProperty(property);
  }

  private setManagedClass(element: HTMLElement, className: string, enabled: boolean): void {
    let classes = this.originalClasses.get(element);
    if (!classes) {
      classes = new Map();
      this.originalClasses.set(element, classes);
    }
    if (!classes.has(className)) classes.set(className, element.classList.contains(className));
    const originallyEnabled = classes.get(className) ?? false;
    element.classList.toggle(className, enabled || originallyEnabled);
  }

  private setManagedAttribute(element: HTMLElement, name: string, value: string): void {
    let attributes = this.originalAttributes.get(element);
    if (!attributes) {
      attributes = new Map();
      this.originalAttributes.set(element, attributes);
    }
    if (!attributes.has(name)) attributes.set(name, element.getAttribute(name));
    element.setAttribute(name, value);
  }

  private restoreManagedAttribute(element: HTMLElement, name: string): void {
    const original = this.originalAttributes.get(element)?.get(name);
    if (original === undefined) return;
    if (original === null) element.removeAttribute(name);
    else element.setAttribute(name, original);
  }

  private restoreManagedDomState(): void {
    for (const [element, properties] of this.originalStyles) {
      for (const property of properties.keys()) this.restoreManagedStyle(element, property);
    }
    for (const [element, classes] of this.originalClasses) {
      for (const [className, enabled] of classes) element.classList.toggle(className, enabled);
    }
    for (const [element, attributes] of this.originalAttributes) {
      for (const name of attributes.keys()) this.restoreManagedAttribute(element, name);
    }
  }
}
