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

Geradas a partir das fontes públicas por `normalize_public_cohorts.py` (as
quatro primeiras), `normalize_limousin_series.py` e `normalize_simmental_lidar.py`.
São versionadas por serem pequenas (~94 KB no total) e necessárias para
reproduzir o modelo do dispositivo e os benchmarks. As fontes brutas não são.

| Ficheiro | n | Raça | Medidas | Papel |
|---|---|---|---|---|
| `cowdatabase_hereford_103.csv` | 103 | Hereford | 5 | **treino** do modelo base |
| `cowdatabase2_angus_96.csv` | 96 | Aberdeen Angus | 2 | **teste** — transferência entre raças |
| `cowdatabase3_angus_93.csv` | 93 | Aberdeen Angus | 2 | ⛔ **não juntar ao treino** |
| `acl_limousine_15.csv` | 15 | Limousine | 3 | calibração de enviesamento |
| `limousin_series_269.csv` | 269 | Limousine | 5 | benchmark leave-one-series-out |
| `simmental_uav_lidar_95.csv` | 95 (45 animais) | Simmental | 7, de LiDAR | ⛔ **sem sinal de peso** |

Colunas vazias significam que a coorte não mede essa variável, não que o valor
se perdeu. CowDatabase2 e 3 só registam cernelha, altura da garupa, largura do
peito e perímetro torácico.

### Licença e atribuição
Estado real de cada coorte, incluindo o que **não** está verificado. Uma coorte
sem licença confirmada não deve aparecer em proposta, preprint ou material
comercial antes de o estado ser resolvido.

| Coorte | Origem | Licença | Estado |
|---|---|---|---|
| CowDatabase (Hereford) | Ruchay et al. 2020, Comput. Electron. Agric. 179:105821 | não verificada | ⚠️ citar sempre a publicação; confirmar termos antes de uso comercial |
| CowDatabase2 / 3 (Angus) | mesma linhagem de publicações | não verificada | ⚠️ idem |
| `limousin_series_269.csv` | FECL / LIMUSINEX-ES, centros de Badajoz e Aranjuez | **não declarada** | 🔴 a fonte foi descrita como "extração de dados públicos". Público ≠ licenciado para reutilização comercial. **Por resolver, e é esta a coorte que vai para a submissão.** |
| `simmental_uav_lidar_95.csv` | Wang et al. 2024, Zenodo 11277007 | CC-BY 4.0 | ✅ conforme declarado na fonte que nos encaminhou o dataset. Uso comercial permitido **com atribuição obrigatória** — se este dado aparecer em qualquer figura ou tabela, a citação vai junto |
| `acl_limousine_15.csv` | ACL, teste de performance série 03/2022 | acordo direto | ✅ obtido e confirmado junto da ACL |

A chave de rebanho Limousine (`Limousin_Herd_Key_CONFIDENTIAL_v5.xlsx`) é
confidencial e **não entra no repositório** em nenhuma forma, nem derivada. Os
identificadores presentes no `limousin_series_269.csv` são os números de registo
que já constam do dataset público.

### Porque é que o CowDatabase3 não entra no treino
O peso dessa coorte tem coeficiente de variação de **3,43%** — 93 novilhas todas
entre 560 e 680 kg. Quase não contém informação sobre a relação forma→peso, mas
contribui com 93 linhas que puxam o ajuste. Medido: treinar só com o
CowDatabase2 prevê o Hereford com 5,80% de erro; juntar o CowDatabase3 leva-o a
**8,43%**. O dobro dos dados, quase o dobro do erro.

Não é o número de animais que treina um modelo, é a variação entre eles.

### Porque é que o Simmental não entra no treino
É a única coorte pública cujas medidas vêm de 3D e não de fita, e por isso a
candidata óbvia a pré-treinar a cadeia forma-3D → peso. Não serve. Em
leave-one-animal-out — leave-one-animal e não leave-one-row, porque são 95
registos de apenas 45 animais, cada um sobrevoado até três vezes — as sete
variáveis do LiDAR fazem 6,70% contra um preditor nulo de 8,13%. Ganho de 1,4 pp
com sete variáveis em 45 animais.

A causa é a modalidade de aquisição, não o extrator. **LiDAR aéreo não mede
perímetro torácico** — vê o animal de cima e não fecha uma circunferência. E o
perímetro é a variável mais preditiva do problema: sozinha faz 3,79% na coorte
Limousine. Por comparação, a mesma família de modelos por fita faz 3,05% contra
um nulo de 8,16% — cinco pontos de ganho, não um.

Continua a servir para testar a **extração** de medidas a partir de nuvens, que
é outra questão e não depende de haver sinal de peso nos descritores.

### Benchmarks
Quatro protocolos fixos. Cada um compara com o preditor nulo e devolve código
diferente de zero se o resultado sair da tolerância do valor de referência.
Os três últimos correm só com a biblioteca-padrão (`python3 <ficheiro>`, sem
instalar nada); o leave-one-series-out precisa de numpy.

```
python backend/ml/training/benchmark_leave_one_series_out.py   # generalização entre séries
python backend/ml/training/benchmark_category_strategies.py    # fator vs. treinar com machos
python backend/ml/training/benchmark_cross_cohort_transfer.py  # o número atravessa para outra coorte?
python backend/ml/training/benchmark_lidar_signal.py           # há sinal de peso no LiDAR aéreo?
```

O `benchmark_cross_cohort_transfer.py` é o que mede a afirmação que interessa ao
produto. O leave-one-series-out dá 3,04%, mas mede generalização **dentro** da
população espanhola e do seu protocolo de medição. Treinar nela e prever os 15
touros da ACL dá **15,53%**, e nenhuma correção de escala bate o preditor nulo.
As duas coortes contradizem-se nas médias — os animais da ACL medem menos em
perímetro e em cernelha, e pesam mais. Isso é convenção de medição, não
biologia, e enquanto não estiver resolvido não se devem aplicar coeficientes de
uma à outra.

### Reproduzir o modelo que corre no telemóvel
```
python backend/ml/training/reproduce_on_device_model.py
```
Reajusta a partir destes CSV e confirma, valor a valor, que bate com o `COEF`,
`INTERCEPT`, `MEDIAN` e o fator de raça de `mobile/src/lib/weightModel.ts`.
Devolve código diferente de zero se divergirem.
