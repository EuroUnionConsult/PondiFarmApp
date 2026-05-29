// Resultados pré-calculados para demo offline — usados quando o servidor não está disponível
// Baseados em valores reais da literatura (Ruchay 2022, Nilchuen 2025)

export type DemoAnimal = {
  label: string;
  breed: string;
  measurements: {
    body_length_cm: number;
    withers_height_cm: number;
    thoracic_depth_cm: number;
    rump_width_cm: number;
    chest_girth_cm: number;
  };
  result: {
    estimated_weight_kg: number;
    confidence_pct: number;
    accuracy_note: string;
  };
};

export const DEMO_ANIMALS: DemoAnimal[] = [
  {
    label: 'Novilha Minhota',
    breed: 'minhota',
    measurements: {
      body_length_cm: 152.4,
      withers_height_cm: 126.8,
      thoracic_depth_cm: 65.9,
      rump_width_cm: 50.2,
      chest_girth_cm: 194.3,
    },
    result: {
      estimated_weight_kg: 387.5,
      confidence_pct: 91.2,
      accuracy_note: 'Estimativa por visão computacional 2D · Precisão aumentada com LiDAR na versão final',
    },
  },
  {
    label: 'Vaca Alentejana',
    breed: 'alentejana',
    measurements: {
      body_length_cm: 163.7,
      withers_height_cm: 134.2,
      thoracic_depth_cm: 72.4,
      rump_width_cm: 56.1,
      chest_girth_cm: 208.6,
    },
    result: {
      estimated_weight_kg: 512.0,
      confidence_pct: 93.7,
      accuracy_note: 'Estimativa por visão computacional 2D · Precisão aumentada com LiDAR na versão final',
    },
  },
  {
    label: 'Touro Barrosão',
    breed: 'barrosã',
    measurements: {
      body_length_cm: 178.2,
      withers_height_cm: 138.5,
      thoracic_depth_cm: 78.1,
      rump_width_cm: 60.4,
      chest_girth_cm: 226.8,
    },
    result: {
      estimated_weight_kg: 648.3,
      confidence_pct: 89.4,
      accuracy_note: 'Estimativa por visão computacional 2D · Precisão aumentada com LiDAR na versão final',
    },
  },
];

export function getDemoResult(breed: string): DemoAnimal {
  const match = DEMO_ANIMALS.find(a => a.breed === breed.toLowerCase());
  return match ?? DEMO_ANIMALS[0];
}
