# CLAUDE.md — Atlas (nom de code provisoire)

## Le produit en une phrase
SaaS de **spécification source-cible "as code"** pour data platforms : pour chaque colonne d'une table cible,
on décrit de façon **structurée** (pas en texte libre) sa provenance (système/ERP → table → colonne),
les jointures, les conversions de type et les règles métier. La spec est versionnée dans Git,
validée, et génère du code (dbt / SQL) et la documentation.

## Principe différenciant (ne jamais le perdre de vue)
- Les **jointures, types, règles et provenances multi-systèmes sont des objets de premier niveau**,
  pas des chaînes de caractères.
- **Compatible ODCS** (Open Data Contract Standard, Bitol / Linux Foundation) en import/export,
  sans en dépendre : notre format est plus riche, ODCS est une sortie.
- **Git-native** : la source de vérité est un format texte (YAML) lisible et diffable.

## Stack (voir docs/adr/0001-stack.md)
- Monorepo **pnpm + Turborepo**, **TypeScript** strict partout.
- `apps/web` : **Next.js** (App Router), **Tailwind CSS**, **shadcn/ui**,
  **React Flow** (graphes de jointures / lineage), **Monaco** (éditeur YAML/SQL).
- `packages/core` : métamodèle (schémas **Zod**), parseur/sérialiseur YAML, validation,
  générateurs (dbt, SQL, ODCS, Markdown). **Aucune dépendance UI.**
- `packages/cli` : CLI `atlas validate | generate | import | diff`.
- Données : **PostgreSQL** (Supabase), ORM **Drizzle**, multi-tenant par organisation avec RLS.
- Auth : Supabase Auth. Paiement (plus tard) : Stripe.
- Tests : **Vitest** (unitaires), **Playwright** (e2e).
- Plus tard, si besoin d'analyse SQL avancée : petit service Python (sqlglot), isolé.

## Arborescence
```
apps/web/            application SaaS
packages/core/       cœur métier (métamodèle, validation, générateurs)
packages/cli/        ligne de commande
docs/                spécifications produit (sources de vérité fonctionnelles)
docs/adr/            décisions d'architecture (une décision = un fichier daté)
```

## Documentation produit (lire UNIQUEMENT ce qui concerne la tâche)
| Fichier | Contenu |
|---|---|
| docs/00-vision.md | ambitions, problème, positionnement, non-objectifs |
| docs/01-perimetre.md | personas, cas d'usage, hors scope |
| docs/02-metamodele.md | objets du domaine et leurs relations (**cœur du produit**) |
| docs/03-format-spec.md | grammaire YAML + correspondance ODCS |
| docs/04-architecture.md | composants, flux, sécurité, multi-tenant |
| docs/05-modules/*.md | un fichier par module fonctionnel |
| docs/06-ux/navigation-menus.md | arborescence des menus et écrans |
| docs/06-ux/ecrans/*.md | un fichier par écran |
| docs/07-roadmap.md | phases, jalons, critères de sortie |

## Règles de travail (efficience)
1. **Lire le minimum** : ne charger que les fichiers docs pertinents pour la tâche en cours.
2. **Plan d'abord** pour toute tâche touchant plus de 2 fichiers : proposer le plan, attendre validation.
3. **Modifier, ne pas réécrire** : éditions ciblées ; jamais régénérer un fichier entier sans demande explicite.
4. **Une décision structurante = un ADR** dans docs/adr/ (contexte, options, décision, conséquences).
5. **Le métamodèle fait foi** : tout changement de concept passe d'abord par docs/02-metamodele.md,
   puis par les schémas Zod de packages/core.
6. Quand une spec est ambiguë : poser la question, ne pas inventer.
7. Mettre à jour ce fichier si la stack ou l'arborescence change (garder < 100 lignes).

## Conventions
- Docs produit en **français** ; code, noms de fichiers de code, commits et commentaires en **anglais**.
- Commits : Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- Format des docs : titres numérotés, identifiants stables pour les exigences (`MAP-012`, `UX-004`…),
  statut en tête de fichier (`Brouillon` / `Validé`).
- Chaque fonctionnalité de la roadmap référence ses identifiants d'exigences.
