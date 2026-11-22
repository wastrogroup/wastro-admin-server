import { getSiteSettings, updateSiteSettings } from "./settings.repository.js";

export type SiteSettings = {
  maintenanceMode: boolean;
  updatedAt: string;
};

function mapSettings(row: { maintenance_mode: boolean; updated_at: Date }): SiteSettings {
  return {
    maintenanceMode: row.maintenance_mode,
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function getSettingsService(): Promise<SiteSettings> {
  return mapSettings(await getSiteSettings());
}

export async function updateSettingsService(input: {
  maintenanceMode: boolean;
}): Promise<SiteSettings> {
  return mapSettings(await updateSiteSettings(input));
}
