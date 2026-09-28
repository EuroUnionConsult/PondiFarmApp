# External training datasets

This directory is the manual staging area for external cattle weight datasets.

Do not download datasets automatically from application code. Before using a
dataset, review its licence, citation requirements, column meanings, units, and
whether the target value is real measured weight rather than a previous
estimate.

Expected workflow:

1. Place reviewed raw files under `backend/ml/datasets/external/`.
2. Normalize each dataset into the internal CSV format under
   `backend/ml/datasets/processed/`.
3. Train offline with `backend/ml/training/train_weight_model.py`.
4. Review metrics and metadata before enabling the trained model.

Minimum normalized CSV columns:

```csv
dataset_source,external_animal_id,breed,sex,age_months,body_length_cm,withers_height_cm,thoracic_depth_cm,rump_width_cm,chest_girth_cm,real_weight_kg
```

Large raw datasets and generated processed datasets should not be committed.

## Coortes normalizadas presentes

Geradas por `ml/training/normalize_public_cohorts.py` a partir das fontes
públicas, e versionadas por serem pequenas (44 KB no total) e necessárias para
reproduzir o modelo do dispositivo.

| Ficheiro | n | Raça | Medidas | Papel |
|---|---|---|---|---|
| `cowdatabase_hereford_103.csv` | 103 | Hereford | 5 | **treino** do modelo base |
| `cowdatabase2_angus_96.csv` | 96 | Aberdeen Angus | 2 | **teste** — transferência entre raças |
| `cowdatabase3_angus_93.csv` | 93 | Aberdeen Angus | 2 | ⛔ **não juntar ao treino** |
| `acl_limousine_15.csv` | 15 | Limousine | 3 | calibração de enviesamento |

Colunas vazias significam que a coorte não mede essa variável, não que o valor
se perdeu. CowDatabase2 e 3 só registam cernelha, altura da garupa, largura do
peito e perímetro torácico.

### Porque é que o CowDatabase3 não entra no treino
O peso dessa coorte tem coeficiente de variação de **3,43%** — 93 novilhas todas
entre 560 e 680 kg. Quase não contém informação sobre a relação forma→peso, mas
contribui com 93 linhas que puxam o ajuste. Medido: treinar só com o
CowDatabase2 prevê o Hereford com 5,80% de erro; juntar o CowDatabase3 leva-o a
**8,43%**. O dobro dos dados, quase o dobro do erro.

Não é o número de animais que treina um modelo, é a variação entre eles.

### Reproduzir o modelo que corre no telemóvel
```
python backend/ml/training/reproduce_on_device_model.py
```
Reajusta a partir destes CSV e confirma, valor a valor, que bate com o `COEF`,
`INTERCEPT`, `MEDIAN` e o fator de raça de `mobile/src/lib/weightModel.ts`.
Devolve código diferente de zero se divergirem.
