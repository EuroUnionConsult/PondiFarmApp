from dataclasses import dataclass
from typing import Dict, List, Optional


@dataclass
class PredictionDiagnostics:
    is_formula_based: bool
    is_trained_model: bool
    requires_ground_truth_validation: bool
    warnings: List[str]

    def to_dict(self) -> Dict[str, object]:
        return {
            "is_formula_based": self.is_formula_based,
            "is_trained_model": self.is_trained_model,
            "requires_ground_truth_validation": self.requires_ground_truth_validation,
            "warnings": self.warnings,
        }


@dataclass
class WeightPredictionResult:
    estimated_weight_kg: float
    confidence_score: float
    model_version: str
    estimation_method: str
    diagnostics: PredictionDiagnostics

    @property
    def confidence_pct(self) -> float:
        return round(self.confidence_score * 100.0, 1)

    def to_dict(self) -> Dict[str, object]:
        return {
            "estimated_weight_kg": self.estimated_weight_kg,
            "confidence_score": self.confidence_score,
            "confidence_pct": self.confidence_pct,
            "model_version": self.model_version,
            "estimation_method": self.estimation_method,
            "diagnostics": self.diagnostics.to_dict(),
        }


@dataclass
class RegisteredWeightModel:
    model_version: str
    estimation_method: str
    is_formula_based: bool
    is_trained_model: bool
    model: Optional[object]
    metadata: Dict[str, object]
