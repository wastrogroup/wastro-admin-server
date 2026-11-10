import { config as loadEnv } from "dotenv";
import { z } from "zod";
import { closePool } from "../database/connection/pool.js";
import {
  assignRoleByName,
  upsertBootstrapAdmin,
} from "../modules/auth/auth.repository.js";
import { hashPassword } from "../modules/auth/auth.service.js";

loadEnv();

const bootstrapSchema = z.object({
  ADMIN_BOOTSTRAP_NAME: z.string().min(1).default("Super Admin"),
  ADMIN_BOOTSTRAP_EMAIL: z.string().email(),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().min(12),
});

async function main() {
  const parsed = bootstrapSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid bootstrap admin env: ${details}`);
  }

  const passwordHash = await hashPassword(parsed.data.ADMIN_BOOTSTRAP_PASSWORD);
  const user = await upsertBootstrapAdmin({
    name: parsed.data.ADMIN_BOOTSTRAP_NAME,
    email: parsed.data.ADMIN_BOOTSTRAP_EMAIL,
    passwordHash,
  });

  await assignRoleByName(user.id, "super_admin");

  console.log(`Bootstrap admin ready: ${user.email} (${user.id})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
