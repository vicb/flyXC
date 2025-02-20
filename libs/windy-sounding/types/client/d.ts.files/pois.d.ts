import type { DataSpecifications } from '@windy/dataSpecifications.d';
import type { Pois } from '@windy/rootScope.d';
import type { LoadedTranslations } from '@windy/types';

export type PoisCheckboxeDef = {
  checkboxTranslation?: keyof LoadedTranslations;
  checkboxText?: string;
  bindStore: keyof DataSpecifications;
};

export type PoisCheckboxes = Record<Pois, PoisCheckboxeDef[]>;
