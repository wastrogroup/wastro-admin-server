import { z } from "zod";

export const updateSettingsSchema = z.object({
  maintenanceMode: z.boolean(),
});
