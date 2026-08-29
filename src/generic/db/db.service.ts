import { Injectable, OnModuleInit, OnApplicationShutdown, Logger } from "@nestjs/common";
import { EnvironmentService } from "../environment/environment.module.js";
import { Pool, QueryConfigValues } from "pg";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getDirname } from "../util/get-dirname.util.js";

@Injectable()
export class DBService implements OnModuleInit, OnApplicationShutdown  {
  private readonly PASSWORD_FILE = join(getDirname(), '..', '..', '..', 'secrets', 'db_password.txt');
  private readonly pool: Pool
  private readonly logger = new Logger(DBService.name)
  
  constructor(private readonly environment: EnvironmentService) {
    this.pool = new Pool({
      host: this.environment.get('DBHOST'),
      user: this.environment.get('DBUSER'),
      port: this.environment.get('DBPORT'),
      database: this.environment.get('DBNAME'),
      password: async () => {
        const fileContent = await readFile(this.PASSWORD_FILE, 'utf8');
        return fileContent.trim();
      }
    })

    this.pool.on('error', (error) => {
      this.logger.error(`Idle client error: ${error.message}`);
    });
  }

  async query<T extends string[]>(query: string, params?: QueryConfigValues<T>) {
    let client
    
    try {
      client = await this.pool.connect();
    } catch (e) {
      console.error(e)
      throw e
    }
    
    try {
      return await client.query(query, params);
    } finally {
      client.release();
    }
  }

  async onModuleInit() {
    const client = await this.pool.connect();
    this.logger.log('Connected to db')
        
    client.release();
  }

  async onApplicationShutdown() {
    await this.pool.end()
    this.logger.log('Terminal connection to db')
  }
}