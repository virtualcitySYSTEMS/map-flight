<template>
  <v-sheet>
    <VcsFlightComponent
      v-if="hasFlightInstance"
      :parent-id="parentId"
      hide-name
      hide-title
    />
    <div class="d-flex w-full justify-space-between px-2 pt-2 pb-1">
      <VcsFormButton
        icon="$vcsComponents"
        :disabled="currentIsPersisted"
        @click="addToMyWorkspace"
      />
      <VcsFormButton variant="filled" @click="newFlight">
        {{ $t('flight.new') }}
      </VcsFormButton>
    </div>
  </v-sheet>
</template>

<script lang="ts">
  import { VSheet } from 'vuetify/lib';
  import {
    provide,
    inject,
    ref,
    shallowRef,
    nextTick,
    defineComponent,
    PropType,
  } from 'vue';
  import {
    VcsFlightComponent,
    VcsFormButton,
    VcsUiApp,
    WindowState,
  } from '@vcmap/ui';
  import { FlightInstance, moduleIdSymbol } from '@vcmap/core';
  import { name } from '../package.json';
  import type { FlightPlugin } from './index.js';

  export default defineComponent({
    name: 'FlightWindow',
    components: {
      VcsFormButton,
      VSheet,
      VcsFlightComponent,
    },
    props: {
      flightInstanceName: {
        type: String,
        default: undefined,
      },
      windowState: {
        type: Object as PropType<WindowState>,
        default: () => ({}),
      },
    },
    setup(props) {
      const { windowState } = props;
      const app = inject('vcsApp') as VcsUiApp;
      const plugin = app.plugins.getByKey(name) as FlightPlugin;
      const hasFlightInstance = ref(true);
      const currentIsPersisted = ref(
        app.flights.hasKey(props.flightInstanceName),
      );
      const flightInstance = shallowRef();
      if (currentIsPersisted.value) {
        flightInstance.value = app.flights.getByKey(props.flightInstanceName);
        if (flightInstance.value.properties?.title) {
          windowState.headerTitle = flightInstance.value.properties.title;
        }
      } else {
        flightInstance.value = new FlightInstance({});
      }
      provide('flightInstance', flightInstance);

      return {
        currentIsPersisted,
        hasFlightInstance,
        parentId: windowState.id,
        addToMyWorkspace(): void {
          const title = `flight-${
            [...app.flights].filter(
              (f) => f[moduleIdSymbol] === app.dynamicModuleId,
            ).length + 1
          }`;
          flightInstance.value.properties = {
            title,
          };
          app.flights.add(flightInstance.value);
          plugin.selectFlight(flightInstance.value);
          currentIsPersisted.value = true;
          windowState.headerTitle = title;
        },
        async newFlight(): Promise<void> {
          plugin.clearSelection();
          // close child window
          const childWindowIds = app.windowManager.componentIds.filter((id) =>
            id.includes('edit-anchor'),
          );
          childWindowIds.forEach((id) => app.windowManager.remove(id));
          hasFlightInstance.value = false;
          await nextTick();
          flightInstance.value = new FlightInstance({});
          hasFlightInstance.value = true;
          currentIsPersisted.value = false;
          windowState.headerTitle = 'flight.titleTemporary';
        },
      };
    },
  });
</script>
