// Keyboard and mouse state for the whole game. Keys are tracked by their
// physical code so WASD, arrows and the rest behave the same on any layout.
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set(); // keys hit since the last frame was consumed
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mouseClicked = false;

  function keyName(event) {
    return event.code;
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) pressed.add(keyName(event));
    keys.add(keyName(event));
  });
  window.addEventListener('keyup', (event) => keys.delete(keyName(event)));
  window.addEventListener('blur', () => { keys.clear(); mouseDown = false; });

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) { mouseDown = true; mouseClicked = true; }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    down(code) { return keys.has(code); },
    // True once for the frame after the key went down.
    hit(code) { return pressed.has(code); },
    axis() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      return { x, y };
    },
    get mouse() { return { x: mouseX, y: mouseY, down: mouseDown, clicked: mouseClicked }; },
    endFrame() { pressed.clear(); mouseClicked = false; },
  };
}
