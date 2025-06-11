<template>
  <v-sheet>
    <VcsFlightComponent
      v-if="hasFlightInstance"
      :parent-id="parentId"
      hide-name
      hide-title
    />
    <v-divider class="mt-3" />
    <div class="d-flex w-full justify-space-between px-2 pt-2 pb-1">
      <VcsFormButton
        icon="$vcsComponentsPlus"
        :disabled="currentIsPersisted || !isValid"
        @click="addToMyWorkspace"
      />
      <VcsFormButton variant="filled" @click="newFlight">
        {{ $t('flight.new') }}
      </VcsFormButton>
    </div>
  </v-sheet>
</template>

<script lang="ts">
  import { VSheet, VDivider } from 'vuetify/components';
  import type { PropType, ShallowRef, Ref } from 'vue';
  import {
    provide,
    inject,
    ref,
    shallowRef,
    nextTick,
    defineComponent,
    onUnmounted,
    watch,
  } from 'vue';
  import type { VcsUiApp, WindowState } from '@vcmap/ui';
  import { VcsFlightComponent, VcsFormButton } from '@vcmap/ui';
  import { FlightInstance, moduleIdSymbol } from '@vcmap/core';
  import { name } from '../package.json';
  import type { FlightPlugin } from './index.js';

  function setupListener(
    instance: ShallowRef<FlightInstance>,
    isValid: Ref<boolean>,
  ): () => void {
    isValid.value = instance.value.isValid();
    const listener = [
      instance.value.propertyChanged.addEventListener(() => {
        isValid.value = instance.value.isValid();
      }),
      instance.value.anchorsChanged.addEventListener(() => {
        isValid.value = instance.value.isValid();
      }),
    ];
    return () => {
      listener.forEach((cb) => {
        cb();
      });
    };
  }

  export default defineComponent({
    name: 'FlightWindow',
    components: {
      VcsFormButton,
      VSheet,
      VcsFlightComponent,
      VDivider,
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
      const isValid = ref(false);
      const flightInstance = shallowRef();
      if (currentIsPersisted.value) {
        flightInstance.value = app.flights.getByKey(props.flightInstanceName)!;
        if (flightInstance.value.properties?.title) {
          windowState.headerTitle = flightInstance.value.properties
            .title as string;
        }
      } else {
        flightInstance.value = new FlightInstance({});
      }

      provide('flightInstance', flightInstance);

      let destroy = setupListener(flightInstance, isValid);

      const stopWatching = watch(flightInstance, () => {
        destroy();
        destroy = setupListener(flightInstance, isValid);
      });

      onUnmounted(() => {
        destroy();
        stopWatching();
      });

      return {
        currentIsPersisted,
        isValid,
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
          plugin?.selectFlight(flightInstance.value);
          currentIsPersisted.value = true;
          windowState.headerTitle = title;
        },
        async newFlight(): Promise<void> {
          plugin?.clearSelection();
          // close child window
          const childWindowIds = app.windowManager.componentIds.filter((id) =>
            id.includes('edit-anchor'),
          );
          childWindowIds.forEach((id) => {
            app.windowManager.remove(id);
          });
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
