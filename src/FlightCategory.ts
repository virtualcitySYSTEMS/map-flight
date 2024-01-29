import { Category, FlightInstance, VcsApp } from '@vcmap/core';

class FlightCategory extends Category<FlightInstance> {
  static get className(): string {
    return 'FlightCategory';
  }

  setApp(app: VcsApp): void {
    super.setApp(app);
    this.setCollection(app.flights);
  }
}

export default FlightCategory;
