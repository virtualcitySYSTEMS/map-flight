import {
  CollectionComponentClass,
  createZoomToFlightAction,
  createExportFlightAction,
  setupFlightListItemPlayer,
  createSupportedMapMappingFunction,
  EditorCollectionComponentClass,
  makeEditorCollectionComponentClass,
  ToolboxType,
  VcsAction,
  VcsPlugin,
  VcsUiApp,
  WindowComponentOptions,
  WindowSlot,
  importFlights,
  createListImportAction,
} from '@vcmap/ui';
import {
  type FlightInstance,
  CesiumMap,
  defaultDynamicModuleId,
} from '@vcmap/core';
import { reactive } from 'vue';
import { name, version, mapVersion } from '../package.json';
import FlightCategory from './FlightCategory.js';
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

  const action = reactive<VcsAction>({
    name: 'flight-plugin-action',
    title: 'flight.title',
    icon: '$vcsViewpointFlight',
    active: app.windowManager.has(windowComponent.id!),
    disabled: !(app.maps.activeMap instanceof CesiumMap),
    callback(): void {
      if (action.active) {
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
  });

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
    app.maps.mapActivated.addEventListener((map) => {
      if (!(map instanceof CesiumMap)) {
        if (app.windowManager.has(windowComponent.id!)) {
          app.windowManager.remove(windowComponent.id!);
        }
        action.disabled = true;
      } else {
        action.disabled = false;
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
    FlightCategory,
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

  const editorCollectionComponent = makeEditorCollectionComponentClass(
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

  editorCollectionComponent.addItemMapping({
    mappingFunction: createSupportedMapMappingFunction(
      [CesiumMap.className],
      app.maps,
    ),
    owner: name,
  });

  const { action: importAction, destroy: importDestroy } =
    createListImportAction(
      (files) => importFlights(app, files, defaultDynamicModuleId),
      app.windowManager,
      name,
      'category-manager',
    );

  destroyFunctions.push(importDestroy);
  collectionComponent.addActions([importAction]);

  app.categoryManager.addMappingFunction<FlightInstance>(
    () => true,
    (item, _c, listItem) => {
      const { action: zoomAction, destroy: zoomDestroy } =
        createZoomToFlightAction(app, item);
      const { action: exportAction, destroy: exportDestroy } =
        createExportFlightAction(item);
      const { action: exportPathAction, destroy: exportPathDestroy } =
        createExportFlightAction(item, true);
      listItem.actions.push(zoomAction, exportAction, exportPathAction);
      const destroyPlayer = setupFlightListItemPlayer(
        app,
        item,
        listItem.actions,
      );

      listItem.destroyFunctions.push(
        zoomDestroy,
        exportDestroy,
        exportPathDestroy,
        destroyPlayer,
      );
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
    collectionComponent: editorCollectionComponent,
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
        },
      },
      en: {
        flight: {
          title: 'Camera flights',
          titleTemporary: 'Temporary camera flight',
          new: 'New',
        },
      },
    },
    destroy(): void {
      destroyCollectionComponent();
    },
  };
}
