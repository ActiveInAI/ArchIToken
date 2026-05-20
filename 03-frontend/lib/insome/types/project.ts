export type ProjectStatus = "draft" | "generating" | "ready" | "archived";

export type MeasurementUnit = "m" | "ft";

export interface Project {
  readonly id: string;
  readonly name: string;
  readonly thumbnail: string;
  readonly status: ProjectStatus;
  readonly updatedAt: number;
  readonly area?: number;
  readonly unit?: MeasurementUnit;
  readonly bedrooms?: number;
}
