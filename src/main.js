import './styles.css';

/** @type {ReturnType<typeof import('./tridimensional/triApp.js').initTriApp> | null} */
let triApp = null;
let classicModule = null;

async function switchVariant(variant) {
  const classicRoot = document.getElementById('classic-root');
  const triRoot = document.getElementById('tri-root');

  if (variant === 'classic') {
    if (triApp) {
      const { destroyTriApp } = await import('./tridimensional/triApp.js');
      destroyTriApp(triApp);
      triApp = null;
    }
    triRoot?.classList.add('hidden');
    classicRoot?.classList.remove('hidden');
    if (!classicModule) {
      classicModule = await import('./classic/classicApp.js');
    }
    classicModule.initClassicApp();
    return;
  }

  if (classicModule) {
    classicModule.destroyClassicApp();
  }
  classicRoot?.classList.add('hidden');
  triRoot?.classList.remove('hidden');

  const { initTriApp, destroyTriApp } = await import('./tridimensional/triApp.js');
  if (triApp) {
    destroyTriApp(triApp);
  }
  triApp = initTriApp(triRoot);
}

function readVariant() {
  const selected = document.querySelector('input[name="game-variant"]:checked');
  return selected?.value === 'tri' ? 'tri' : 'classic';
}

document.querySelectorAll('input[name="game-variant"]').forEach((input) => {
  input.addEventListener('change', () => {
    switchVariant(readVariant());
  });
});

switchVariant(readVariant());
