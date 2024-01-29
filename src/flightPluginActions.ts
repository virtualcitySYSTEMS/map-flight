import {
  createFlightVisualization,
  FlightInstance,
  FlightPlayer,
  FlightVisualization,
} from '@vcmap/core';
import type { VcsAction, VcsUiApp } from '@vcmap/ui';

export function setupFlightListItemPlayer(
  app: VcsUiApp,
  flightInstance: FlightInstance,
  actions: VcsAction[],
): () => void {
  function removeAction(action: VcsAction): void {
    const index = actions.findIndex((a) => a.name === action.name);
    if (index > -1) {
      actions.splice(index, 1);
    }
  }

  let player: FlightPlayer | undefined;
  const listener: (() => void)[] = [];

  function setupListener(playAction: VcsAction, stopAction: VcsAction): void {
    listener.forEach((cb) => cb());
    listener.slice(0);
    listener.push(
      player!.stateChanged.addEventListener((state) => {
        if (state === 'stopped') {
          removeAction(stopAction);
          playAction.icon = 'mdi-play';
          playAction.title = 'flight.playTooltip';
        } else {
          if (!actions.includes(stopAction)) {
            actions.push(stopAction);
          }
          if (state === 'paused') {
            playAction.icon = 'mdi-play';
            playAction.title = 'flight.playTooltip';
          } else {
            playAction.icon = 'mdi-pause';
            playAction.title = 'flight.pauseTooltip';
          }
        }
      }),
      player!.destroyed.addEventListener(() => {
        player = undefined;
        removeAction(stopAction);
        playAction.icon = 'mdi-play';
      }),
    );
  }

  const stopAction: VcsAction = {
    name: 'stop',
    icon: 'mdi-square',
    title: 'flight.stopTooltip',
    callback: () => {
      player?.stop();
    },
  };

  const playAction: VcsAction = {
    name: 'play',
    icon: 'mdi-play',
    title: 'flight.playTooltip',
    callback: async () => {
      if (player) {
        if (player.state === 'playing') {
          player.pause();
        } else {
          player.play();
        }
      } else {
        player = await app.flights.setPlayerForFlight(flightInstance);
        setupListener(playAction, stopAction);
        player?.play();
      }
    },
  };

  if (!actions.includes(playAction)) {
    actions.push(playAction);
  }

  const playerChangedListener = app.flights.playerChanged.addEventListener(
    (flightPlayer) => {
      if (!player && flightPlayer?.flightInstanceName === flightInstance.name) {
        player = flightPlayer;
        setupListener(playAction, stopAction);
      }
    },
  );

  return () => {
    listener.forEach((cb) => cb());
    playerChangedListener();
    if (player) {
      player.stop();
      player.destroy();
      player = undefined;
    }
    removeAction(playAction);
  };
}

export function createZoomToFlightAction(
  app: VcsUiApp,
  flightInstance: FlightInstance,
): { action: VcsAction; destroy: () => void } {
  let flightVis: FlightVisualization | undefined;

  return {
    action: {
      name: 'flight.zoom',
      title: 'flight.zoom',
      async callback(): Promise<void> {
        if (!flightVis) {
          flightVis = await createFlightVisualization(flightInstance, app);
        }
        await flightVis.zoomToExtent();
      },
    },
    destroy(): void {
      flightVis?.destroy();
    },
  };
}
