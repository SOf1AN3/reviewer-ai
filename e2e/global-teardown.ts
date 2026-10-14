import { cleanupE2eTestData } from "./helpers";

/**
 * Global teardown Playwright — exécuté une fois, après toute la suite,
 * même en cas d'échec de tests.
 *
 * Playwright n'accepte qu'un CHEMIN de fichier pour `globalTeardown`
 * (type `string`) : ce fichier n'est donc qu'un point d'entrée mince vers la
 * logique de nettoyage, qui vit dans `e2e/helpers.ts`
 * (`cleanupE2eTestData`), avec ses garde-fous de suppression ciblée.
 *
 * La fonction ne lève jamais : un échec de nettoyage est signalé par un
 * avertissement sans faire échouer la suite.
 */
export default cleanupE2eTestData;
