# Assets 3D — fontes e licenças

Biblioteca usada: **Grab3D** (CC0 1.0, sem login, sem atribuição). Modelos em `client/public/models/`.

| Arquivo | Origem | Licença | Dimensões |
| --- | --- | --- | --- |
| semi-truck.glb | https://grab3d.com/models/vehicles/semi-truck/ | CC0 | 2,92 × 18,16 × 4,00 m |
| delivery-truck.glb | https://grab3d.com/models/vehicles/delivery-truck/ | CC0 | — |
| delivery-van.glb | https://grab3d.com/models/vehicles/delivery-van/ | CC0 | — |
| tanker-truck.glb | https://grab3d.com/models/vehicles/tanker-truck/ | CC0 | — |
| forklift.glb | https://grab3d.com/models/vehicles/forklift/ | CC0 | — |
| 1990s-sedan / hatchback / suv / delivery-van | https://grab3d.com/models/vehicles/ | CC0 | — |

Download direto: `https://grab3d.com/dl/<slug>/<slug>.glb`. Textura 2K, estilo "stylized".

Alternativas avaliadas: Poly Haven (realista, sem veículos), Kenney Car Kit (low poly, https://kenney.nl/assets/car-kit), Sketchfab (exige login para baixar), Khronos glTF-Sample-Assets (CesiumMilkTruck).

## Observações de integração

O GLB tem eixos Z (comprimento no eixo Z). Rotação aplicada: `Math.PI` para o caminhão olhar para +Z. Materiais são clonados por instância para permitir cor por veículo (`applyGlb` em `client/src/scene/logisticsScene.ts`).
