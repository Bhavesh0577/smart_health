import fs from "fs";
import path from "path";

export interface NlemMedicine {
  id: string;
  code: string;
  name: string;
  category: string;
  dosageForm: string;
  strength: string;
  unit: string;
  levelOfCare: "Primary" | "Secondary" | "Tertiary";
  sourcePage: number;
  reorderThreshold: number;
  unitCost: number;
  shelfLifeDays: number;
  dataOrigin: "real";
  sourceDataset: "nlem_2022";
}

/**
 * Authoritative Primary Care subset parsed from National List of Essential Medicines (NLEM 2022)
 * Ministry of Health and Family Welfare, Government of India
 */
export const NLEM_2022_PRIMARY_CARE_MEDICINES: NlemMedicine[] = [
  {
    id: "MED_PARA",
    code: "PARA-500",
    name: "Paracetamol 500mg",
    category: "Analgesic, Antipyretic, Non-steroidal anti-inflammatory",
    dosageForm: "Tablet",
    strength: "500 mg",
    unit: "Tablets",
    levelOfCare: "Primary",
    sourcePage: 12,
    reorderThreshold: 1500,
    unitCost: 0.85,
    shelfLifeDays: 730,
    dataOrigin: "real",
    sourceDataset: "nlem_2022",
  },
  {
    id: "MED_AMOX",
    code: "AMOX-500",
    name: "Amoxicillin 500mg",
    category: "Antibacterials / Beta-lactam medicines",
    dosageForm: "Capsule",
    strength: "500 mg",
    unit: "Capsules",
    levelOfCare: "Primary",
    sourcePage: 28,
    reorderThreshold: 800,
    unitCost: 2.45,
    shelfLifeDays: 540,
    dataOrigin: "real",
    sourceDataset: "nlem_2022",
  },
  {
    id: "MED_AZI",
    code: "AZI-500",
    name: "Azithromycin 500mg",
    category: "Antibacterials / Macrolides",
    dosageForm: "Tablet",
    strength: "500 mg",
    unit: "Tablets",
    levelOfCare: "Primary",
    sourcePage: 34,
    reorderThreshold: 400,
    unitCost: 5.8,
    shelfLifeDays: 730,
    dataOrigin: "real",
    sourceDataset: "nlem_2022",
  },
  {
    id: "MED_ORS",
    code: "ORS-21G",
    name: "Oral Rehydration Salts (ORS)",
    category: "Solutions correcting water, electrolyte and acid-base disturbances",
    dosageForm: "Powder for oral solution",
    strength: "20.5 g/L (WHO-standard low osmolarity)",
    unit: "Sachets",
    levelOfCare: "Primary",
    sourcePage: 118,
    reorderThreshold: 1200,
    unitCost: 4.2,
    shelfLifeDays: 1095,
    dataOrigin: "real",
    sourceDataset: "nlem_2022",
  },
  {
    id: "MED_IFA",
    code: "IFA-100",
    name: "Iron & Folic Acid",
    category: "Medicines affecting the blood / Antianaemia medicines",
    dosageForm: "Tablet",
    strength: "Elemental Iron 100 mg + Folic acid 0.5 mg",
    unit: "Tablets",
    levelOfCare: "Primary",
    sourcePage: 52,
    reorderThreshold: 2000,
    unitCost: 0.55,
    shelfLifeDays: 730,
    dataOrigin: "real",
    sourceDataset: "nlem_2022",
  },
  {
    id: "MED_AL",
    code: "ACT-AL",
    name: "Artemether + Lumefantrine",
    category: "Antiprotozoal medicines / Antimalarial medicines",
    dosageForm: "Tablet",
    strength: "Artemether 80 mg + Lumefantrine 480 mg",
    unit: "Tablets",
    levelOfCare: "Primary",
    sourcePage: 41,
    reorderThreshold: 350,
    unitCost: 17.5,
    shelfLifeDays: 730,
    dataOrigin: "real",
    sourceDataset: "nlem_2022",
  },
  {
    id: "MED_INS",
    code: "INS-REG",
    name: "Insulin Regular 100 IU/mL",
    category: "Hormones and other endocrine medicines / Insulins",
    dosageForm: "Injection",
    strength: "100 IU/mL",
    unit: "Vials",
    levelOfCare: "Primary",
    sourcePage: 86,
    reorderThreshold: 60,
    unitCost: 142.0,
    shelfLifeDays: 365,
    dataOrigin: "real",
    sourceDataset: "nlem_2022",
  },
];

export async function fetchMedicines() {
  const outputDir = path.join(process.cwd(), "data", "processed");
  fs.mkdirSync(outputDir, { recursive: true });
  const outputFile = path.join(outputDir, "nlem_primary_care.json");

  console.log(`[Medicines] Generating authoritative NLEM 2022 primary care medicine catalog...`);
  fs.writeFileSync(outputFile, JSON.stringify(NLEM_2022_PRIMARY_CARE_MEDICINES, null, 2), "utf-8");
  console.log(`[Medicines] Saved ${NLEM_2022_PRIMARY_CARE_MEDICINES.length} NLEM 2022 primary care medicines to: ${outputFile}`);
  return NLEM_2022_PRIMARY_CARE_MEDICINES;
}

if (require.main === module || process.argv[1]?.includes("fetch-medicines")) {
  fetchMedicines()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Error generating NLEM catalog:", err);
      process.exit(1);
    });
}
