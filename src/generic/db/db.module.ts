import { Global, Module } from "@nestjs/common";
import { DBService } from "./db.service.js";
import { SecretManagerModule } from "../secret-manager/secret-manager.module.js";

@Global()
@Module({
  imports: [SecretManagerModule],
  providers: [DBService],
  exports: [DBService]
})
export class DBModule {}