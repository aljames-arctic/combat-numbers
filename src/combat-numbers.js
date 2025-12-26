/**
 * This is your JavaScript entry file for Foundry VTT.
 * Register custom settings, sheets, and constants using the Foundry API.
 * Change this heading to be more descriptive to your module, or remove it.
 * Author: 1000Nettles
 * Content License: MIT
 * Software License: MIT
 */

import _ from 'lodash';
import registerSettings from './module/settings';
import CombatNumberLayer from './module/CombatNumberLayer';
import Renderer from './module/Renderer';
import SocketController from './module/SocketController';
import TokenUpdateCoordinator from './module/TokenUpdateCoordinator';
import ActorUpdateCoordinator from './module/ActorUpdateCoordinator';
import TokenCalculator from './module/calculator/TokenCalculator';
import ActorCalculator from './module/calculator/ActorCalculator';
import HpObjectPathFinder from './module/HpObjectPathFinder';
import ControlsGenerator from './module/ControlsGenerator';
import State from './module/State';
import Appearance from './module/Appearance';
import CombatNumbersApi from './external/CombatNumbersApi';
import Masking from './module/Masking';
import Constants from './module/Constants';

/* eslint no-console: ['error', { allow: ['warn', 'log', 'debug'] }] */
/* global CONFIG */
/* global Canvas */
/* global Hooks */
/* global foundry */
/* global game */
/* global canvas */
/* global mergeObject */

/**
 * Our Renderer instance for use within hooks.
 */
let renderer;

/**
 * Our SocketController instance for use within hooks.
 */
let socketController;

/**
 * Our ActorUpdateCoordinator instance for use within hooks.
 */
let actorUpdateCoordinator;

/**
 * Our TokenUpdastate.test.jsteCoordinator instance for use within hooks.
 */
let tokenUpdateCoordinator;

/**
 * Our TokenCalculator instance for use within hooks.
 */
let tokenCalculator;

/**
 * Our ActorCalculator instance for use within hooks.
 */
let actorCalculator;

/**
 * Our State instance for use within hooks.
 */
let state;

/**
 * Our Masking instance for use within hooks.
 */
let masking;

function registerStaticLayer() {
  CONFIG.Canvas.layers.combatNumbers = {
    layerClass: CombatNumberLayer,
    group: 'effects',
  };
}

/**
 * Find the currently viewed Scene for the User.
 *
 * @return {Scene|null}
 */
function findViewedScene() {
  return game.scenes.find((s) => s.isView);
}

/* ------------------------------------ */
/* Initialize module                    */
/* ------------------------------------ */
Hooks.once('init', async () => {
  console.log('combat-numbers | Initializing combat-numbers');

  // Register custom module settings.
  registerSettings();

  registerStaticLayer();

  state = new State();
});

/**
 * Add a new layer to the canvas.
 *
 * This happens every time a scene change takes place, hence the `on`.
 */
Hooks.on('canvasReady', async () => {
  const layer = canvas.layers.find(
    (targetLayer) => targetLayer instanceof CombatNumberLayer,
  );

  const scene = canvas.scene;
  const appearance = new Appearance(
    game.settings.get(Constants.MODULE_NAME, 'appearance'),
    scene.grid,
  );

  masking = new Masking(state, game.settings);

  renderer = new Renderer(
    layer,
    game.settings,
    state,
    appearance,
  );

  // Ensure that we only have a single socket open for our module so we don't
  // clutter up open sockets when changing scenes (or, more specifically,
  // rendering new canvases.)
  if (socketController instanceof SocketController) {
    await socketController.deactivate();
  }

  socketController = new SocketController(game.socket, game.user, state, renderer);

  const hpObjectPathFinder = new HpObjectPathFinder(game.settings);
  tokenCalculator = new TokenCalculator(hpObjectPathFinder);
  actorCalculator = new ActorCalculator(hpObjectPathFinder);

  actorUpdateCoordinator = new ActorUpdateCoordinator(
    renderer,
    socketController,
    actorCalculator,
    state,
    masking,
  );
  tokenUpdateCoordinator = new TokenUpdateCoordinator(
    renderer,
    socketController,
    tokenCalculator,
    state,
    masking,
  );

  await socketController.init();

  // Set the initial default of the masking setting.
  const maskDefault = !!(game.settings.get(
    Constants.MODULE_NAME,
    'mask_default',
  ));
  state.setIsMask(maskDefault);

  // Register our API for macros and other modules to hook into if necessary.
  global.combatNumbers = new CombatNumbersApi(state);
});

Hooks.on('preUpdateActor', (actor, delta, options) => {
  if (!options.diff) {
    return;
  }

  const viewedScene = findViewedScene();
  if (!viewedScene) {
    return;
  }

  actorUpdateCoordinator.coordinatePreUpdate(
    actor,
    delta,
    actor.getActiveTokens(),
    viewedScene,
  );
});

Hooks.on('preUpdateToken', (tokenDoc, delta, options) => {
  if (
    !options.diff
    || tokenDoc.hidden
  ) {
    return;
  }

  // If the entity does not contain the specific data we need, let's grab
  // it from the `game` object's relevant actor. This can take place if a token
  // has been dragged to the scene and has not been populated yet with all its
  // data in some systems. (For example, PF2E.)
  if (tokenCalculator.shouldUseActorCoordination(tokenDoc)) {
    const actorId = tokenDoc.actorId;
    const actorData = _.get(delta, 'actorData', null);

    // If we don't even have the appropriate data to use, just exit. This
    // could happen if a "lightweight" update has taken place, and someone is
    // just updating specific Token attributes.
    if (actorId === null || actorData === null) {
      return;
    }

    const origActor = game.actors.get(actorId);

    if (!origActor) {
      console.warn('combat-numbers | Cannot find associated actor to token');
      return;
    }

    const viewedScene = tokenDoc.scene;
    if (!viewedScene) {
      return;
    }

    actorUpdateCoordinator.coordinatePreUpdate(
      origActor,
      actorData,
      [tokenDoc],
      viewedScene,
    );

    return;
  }

  tokenUpdateCoordinator.coordinatePreUpdate(tokenDoc);
});

Hooks.on('updateToken', (tokenDoc, delta, options) => {
  if (
    !options.diff
    || tokenDoc.hidden
  ) {
    return;
  }

  tokenUpdateCoordinator.coordinateUpdate(tokenDoc, delta);
});

Hooks.on('getSceneControlButtons', (controls) => {
  const showControls = !!(game.settings.get(
    Constants.MODULE_NAME,
    'show_controls',
  ));

    const controlsGenerator = new ControlsGenerator(state);
  controlsGenerator.generate(
    controls,
    game.user.isGM,
    showControls,
  );
});
