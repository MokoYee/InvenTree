import {
  ModelInformationDict,
  type ModelInformationInterface
} from '@lib/enums/ModelInformation';
import type { ModelType } from '@lib/enums/ModelType';

/*
 * Extract model definition given the provided type - returns translatable strings for labels as string, not functions
 * @param type - ModelType to extract information from
 * @returns ModelInformationInterface
 */
export function getModelInfo(type: ModelType): ModelInformationInterface {
  return {
    ...ModelInformationDict[type],
    label: ModelInformationDict[type].label(),
    label_multiple: ModelInformationDict[type].label_multiple()
  };
}

/*
 * Normalize backend content type values and return a user-facing model label
 * @param type - Raw model type value, e.g. "part" or "part.part"
 * @returns translated model label when known, otherwise the original value
 */
export function getModelTypeLabel(type?: string | null): string {
  if (!type) {
    return '-';
  }

  const normalizedType = String(type).split('.').pop() as ModelType | undefined;

  if (normalizedType && normalizedType in ModelInformationDict) {
    return ModelInformationDict[normalizedType].label();
  }

  return String(type);
}
