export class Input {
  left = false;
  right = false;
  plunge = false;
  private startQueued = false;

  attach(root: Window | Document | HTMLElement): () => void {
    const onKey = (event: KeyboardEvent, down: boolean): void => {
      const key = event.code;
      const isFlip =
        key === "KeyZ" ||
        key === "KeyX" ||
        key === "ArrowLeft" ||
        key === "ArrowRight" ||
        key === "ShiftLeft" ||
        key === "ShiftRight";
      const isPlunge = key === "Space" || key === "ArrowDown" || key === "KeyC";
      if (isFlip || isPlunge || key === "Enter") event.preventDefault();

      if (key === "KeyZ" || key === "ArrowLeft" || key === "ShiftLeft") this.left = down;
      if (key === "KeyX" || key === "ArrowRight" || key === "ShiftRight") this.right = down;
      if (key === "ShiftLeft" || key === "ShiftRight") {
        this.left = down;
        this.right = down;
      }
      if (isPlunge) this.plunge = down;
      if (down && (key === "Enter" || key === "Space")) this.startQueued = true;
    };

    const down = (event: KeyboardEvent): void => onKey(event, true);
    const up = (event: KeyboardEvent): void => onKey(event, false);
    const blur = (): void => {
      this.left = false;
      this.right = false;
      this.plunge = false;
    };

    root.addEventListener("keydown", down as EventListener);
    root.addEventListener("keyup", up as EventListener);
    window.addEventListener("blur", blur);

    return () => {
      root.removeEventListener("keydown", down as EventListener);
      root.removeEventListener("keyup", up as EventListener);
      window.removeEventListener("blur", blur);
    };
  }

  bindHold(el: HTMLElement, side: "left" | "right" | "plunge"): void {
    const set = (down: boolean): void => {
      if (side === "left") this.left = down;
      if (side === "right") this.right = down;
      if (side === "plunge") this.plunge = down;
      if (down) this.startQueued = true;
    };
    const start = (event: Event): void => {
      event.preventDefault();
      set(true);
    };
    const end = (event: Event): void => {
      event.preventDefault();
      set(false);
    };
    el.addEventListener("pointerdown", start);
    el.addEventListener("pointerup", end);
    el.addEventListener("pointerleave", end);
    el.addEventListener("pointercancel", end);
  }

  bindCanvas(canvas: HTMLCanvasElement, worldW: number, worldH: number, laneInnerX: number): void {
    const worldFromEvent = (event: PointerEvent): { x: number; y: number } => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / Math.max(rect.width, 1)) * worldW,
        y: ((event.clientY - rect.top) / Math.max(rect.height, 1)) * worldH,
      };
    };

    const apply = (event: PointerEvent, down: boolean): void => {
      const point = worldFromEvent(event);
      if (point.x >= laneInnerX) {
        this.plunge = down;
        if (down) this.startQueued = true;
        if (!down) {
          this.left = false;
          this.right = false;
        }
        return;
      }
      if (down) {
        this.left = point.x < worldW * 0.48;
        this.right = point.x >= worldW * 0.48;
      } else {
        this.left = false;
        this.right = false;
      }
    };

    canvas.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      canvas.focus();
      canvas.setPointerCapture(event.pointerId);
      apply(event, true);
    });
    canvas.addEventListener("pointerup", (event) => {
      event.preventDefault();
      apply(event, false);
    });
    canvas.addEventListener("pointercancel", () => {
      this.left = false;
      this.right = false;
      this.plunge = false;
    });
  }

  consumeStart(): boolean {
    const was = this.startQueued;
    this.startQueued = false;
    return was;
  }
}
