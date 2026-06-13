import { z } from "zod";

const ncmRegex = /^\d{8}$/;
const cfopRegex = /^\d{4}$/;
const cestRegex = /^\d{7}$/;

export const ncmSchema = z
  .string()
  .regex(ncmRegex, "NCM deve ter 8 dígitos")
  .optional()
  .nullable()
  .or(z.literal("").transform(() => null));

export const cfopSchema = z
  .string()
  .regex(cfopRegex, "CFOP deve ter 4 dígitos")
  .optional()
  .nullable()
  .or(z.literal("").transform(() => null));

export const cestSchema = z
  .string()
  .regex(cestRegex, "CEST deve ter 7 dígitos")
  .optional()
  .nullable()
  .or(z.literal("").transform(() => null));

const SIMPLE_CSOSN = new Set(["101", "102", "103", "201", "202", "203", "300", "400", "500", "900"]);
const CLASSIC_CST = new Set(["00", "10", "20", "30", "40", "41", "50", "51", "60", "70", "90"]);

export function validateCstForRegime(cst: string, taxRegime: string): boolean {
  const v = cst.trim();
  if (taxRegime === "simples") return SIMPLE_CSOSN.has(v) || /^\d{3}$/.test(v);
  return CLASSIC_CST.has(v) || /^\d{2}$/.test(v);
}

export const cstSchemaForRegime = (taxRegime: string) =>
  z
    .string()
    .max(10)
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null))
    .refine(
      (v) => v == null || validateCstForRegime(v, taxRegime),
      "CST/CSOSN inválido para o regime tributário",
    );

export const icmsOrigemSchema = z
  .enum(["0", "1", "2", "3", "4", "5", "6", "7", "8"])
  .optional()
  .nullable();

export const icmsRatesSchema = z.record(z.string().length(2), z.number().min(0).max(100)).optional();
