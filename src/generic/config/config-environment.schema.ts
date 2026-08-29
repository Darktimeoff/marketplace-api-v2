import * as z from "zod"; 

const configEnvironmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DBPORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DBHOST: z.string().min(1),
  DBUSER: z.string().min(1),
  DBNAME: z.string().min(1)
})

export type ConfigEnvironmentType = z.infer<typeof configEnvironmentSchema>

export function validate(data: Record<string, string>) {
  const result = configEnvironmentSchema.safeParse(data);
  if (!result.success) {
    console.error(`Invalid environment configuration`)
    for (const issue of result.error.issues) {
      console.error(`${issue.path.join('.') || '(root)'}: ${issue.message}`)
    }
    
    process.exit(1)
  }

  return Object.freeze(result.data)
}