import { loadData } from "./load-data";

export async function seed() {
  await loadData();
}

if (require.main === module || process.argv[1]?.includes("seed")) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seed error:", err);
      process.exit(1);
    });
}
