import { openDatabase } from "../src/lib/server/database/sqlite/connection";
import { SqliteModelConfigurationRepository } from "../src/lib/server/database/sqlite/model-configuration-repository";

async function main() {
  const database = openDatabase(process.argv[2]);
  try {
    const repository = new SqliteModelConfigurationRepository(database);
    for (let index = 0; index < 20; index++) await repository.activate(process.argv[3]);
  } finally { database.close(); }
}
void main();
