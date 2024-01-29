import {
  CollectionComponentClass,
  createListExportAction,
  createListImportAction,
  EditorCollectionComponentClass,
  makeEditorCollectionComponentClass,
  ToolboxType,
  VcsAction,
  VcsPlugin,
  VcsUiApp,
  WindowComponentOptions,
  WindowSlot,
} from '@vcmap/ui';
import type { Ctor, FlightInstance } from '@vcmap/core';
import { name, version, mapVersion } from '../package.json';
import FlightCategory from './FlightCategory.js';
import {
  createZoomToFlightAction,
  setupFlightListItemPlayer,
} from './flightPluginActions.js';
import { exportFlights, importFlights } from './importExportHelper.js';
import FlightWindow from './FlightWindow.vue';

function getFlightEditorWindowId(
  collectionComponent: CollectionComponentClass<FlightInstance>,
): string {
  return `${collectionComponent.id}-editor`;
}

function setupFlightButton(
  app: VcsUiApp,
  collectionComponent: CollectionComponentClass<FlightInstance>,
): () => void {
  const windowComponent: WindowComponentOptions = {
    id: getFlightEditorWindowId(collectionComponent),
    parentId: 'category-manager',
    component: FlightWindow,
    slot: WindowSlot.DYNAMIC_CHILD,
    state: {
      headerTitle: 'flight.titleTemporary',
      headerIcon: '$vcsViewpointFlight',
      infoUrlCallback: app.getHelpUrlCallback('/tools/flight.html'),
    },
    props: {},
  };

  const action: VcsAction = {
    name: 'flight-plugin-action',
    title: 'flight.title',
    icon: '$vcsViewpointFlight',
    active: app.windowManager.has(windowComponent.id!),
    callback(): void {
      if (this.active) {
        app.windowManager.remove(windowComponent.id!);
      } else {
        windowComponent.props = {};
        if (collectionComponent.selection.value.length > 0) {
          if (collectionComponent.selection.value.length === 1) {
            (
              windowComponent.props as { flightInstanceName?: string }
            ).flightInstanceName = collectionComponent.selection.value[0].name;
          } else {
            collectionComponent.selection.value.splice(0);
          }
        }
        app.windowManager.add(windowComponent, name);
      }
    },
  };

  const listeners = [
    app.windowManager.added.addEventListener(({ id }) => {
      if (id === windowComponent.id) {
        action.active = true;
      }
    }),
    app.windowManager.removed.addEventListener(({ id }) => {
      if (id === windowComponent.id) {
        action.active = false;
      }
    }),
  ];

  if (app.toolboxManager.has(name)) {
    app.toolboxManager.remove(name);
  }
  app.toolboxManager.add(
    {
      id: name,
      type: ToolboxType.SINGLE,
      action,
    },
    name,
  );

  return (): void => {
    listeners.forEach((cb) => {
      cb();
    });
  };
}

async function setupFlightEditorCollectionComponent(app: VcsUiApp): Promise<{
  collectionComponent: EditorCollectionComponentClass<FlightInstance>;
  destroy: () => void;
}> {
  const destroyFunctions: (() => void)[] = [];
  app.categoryClassRegistry.registerClass(
    app.dynamicModuleId,
    FlightCategory.className,
    FlightCategory as Ctor<typeof FlightCategory>,
  );

  const { collectionComponent } =
    await app.categoryManager.requestCategory<FlightInstance>(
      {
        type: FlightCategory.className,
        name: 'flights',
        title: 'flight.title',
      },
      name,
      {
        selectable: true,
        renamable: true,
        removable: true,
        overflowCount: 3,
      },
    );

  const editorCollecitonComponent = makeEditorCollectionComponentClass(
    app,
    collectionComponent,
    {
      editor: (item: FlightInstance) => ({
        component: FlightWindow,
        state: {
          headerTitle: 'flight.titleTemporary',
          headerIcon: '$vcsViewpointFlight',
          infoUrlCallback: app.getHelpUrlCallback('/tools/flight.html'),
        },
        props: {
          flightInstanceName: item.name,
        },
      }),
    },
    'category-manager',
  );

  const { action: exportAction, destroy: exportDestroy } =
    createListExportAction(
      collectionComponent.selection,
      () =>
        exportFlights(
          collectionComponent.selection.value
            .map((l) => collectionComponent.collection.getByKey(l.name))
            .filter((f): f is FlightInstance => !!f),
        ),
      name,
    );

  const { action: exportPathAction, destroy: exportPathDestroy } =
    createListExportAction(
      collectionComponent.selection,
      () =>
        exportFlights(
          collectionComponent.selection.value
            .map((l) => collectionComponent.collection.getByKey(l.name))
            .filter((f): f is FlightInstance => !!f),
          true,
        ),
      name,
    );
  exportPathAction.action.name = 'flight.exportPath';

  const { action: importAction, destroy: importDestroy } =
    createListImportAction(
      (files) => importFlights(app, files),
      app.windowManager,
      name,
      'category-manager',
    );

  destroyFunctions.push(exportDestroy, exportPathDestroy, importDestroy);
  collectionComponent.addActions([
    exportAction,
    exportPathAction,
    importAction,
  ]);

  app.categoryManager.addMappingFunction<FlightInstance>(
    () => true,
    (item, _c, listItem) => {
      const { action: zoomAction, destroy: zoomDestroy } =
        createZoomToFlightAction(app, item);
      listItem.actions.push(zoomAction);
      const destroyPlayer = setupFlightListItemPlayer(
        app,
        item,
        listItem.actions,
      );
      listItem.destroyFunctions.push(zoomDestroy, destroyPlayer);
      const { titleChanged } = listItem;
      listItem.titleChanged = (title): void => {
        titleChanged?.(title);
        const flightWindow = app.windowManager.get(
          getFlightEditorWindowId(collectionComponent),
        );
        if (
          flightWindow &&
          (flightWindow.props as { flightInstanceName?: string })
            .flightInstanceName === item.name
        ) {
          flightWindow.state.headerTitle = title;
        }
      };
    },
    name,
    [collectionComponent.id],
  );

  destroyFunctions.push(setupFlightButton(app, collectionComponent));

  return {
    collectionComponent: editorCollecitonComponent,
    destroy(): void {
      destroyFunctions.forEach((cb) => cb());
    },
  };
}

export type FlightPlugin = VcsPlugin<
  Record<never, never>,
  Record<never, never>
> & {
  selectFlight(flightInstance: FlightInstance): void;
  clearSelection(): void;
};
/**
 * Implementation of VcsPlugin interface. This function should not throw! Put exceptions in initialize instead.
 * @returns {import("@vcmap/ui/src/vcsUiApp").VcsPlugin<T, PluginState>}
 * @template {Object} T
 */
export default function flightPlugin(): FlightPlugin {
  let collectionComponent:
    | EditorCollectionComponentClass<FlightInstance>
    | undefined;

  let destroyCollectionComponent = (): void => {};
  return {
    get name(): string {
      return name;
    },
    get version(): string {
      return version;
    },
    get mapVersion(): string {
      return mapVersion;
    },
    async initialize(vcsUiApp: VcsUiApp): Promise<void> {
      const { collectionComponent: component, destroy } =
        await setupFlightEditorCollectionComponent(vcsUiApp);
      collectionComponent = component;
      destroyCollectionComponent = destroy;
    },
    selectFlight(flightInstance: FlightInstance): void {
      if (collectionComponent) {
        const listItem = collectionComponent.getListItemForItem(flightInstance);
        if (listItem) {
          collectionComponent.selection.value = [listItem];
        }
      }
    },
    clearSelection(): void {
      collectionComponent?.selection.value.splice(0);
    },
    getDefaultOptions(): Record<never, never> {
      return {};
    },
    toJSON(): Record<never, never> {
      return {};
    },
    i18n: {
      de: {
        flight: {
          title: 'Kameraflüge',
          titleTemporary: 'Temporärer Kameraflug',
          new: 'Neu',
          zoom: 'Auf Ausdehnung zoomen',
          exportPath: 'Flugpfad(e) exportieren',
        },
      },
      en: {
        flight: {
          title: 'Camera flights',
          titleTemporary: 'Temporary camera flight',
          new: 'New',
          zoom: 'Zoom to extent',
          exportPath: 'Export flight path(s)',
        },
      },
    },
    destroy(): void {
      destroyCollectionComponent();
    },
  };
}
