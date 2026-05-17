// Public surface for the finance service. Callers should keep importing from
// `@/lib/services/finance` — the split into sibling files is an internal
// reorganization. Internal helpers (shared.ts) are deliberately not re-exported.

export { listAccounts, saveAccount, type SaveFinanceAccountInput } from "./accounts";
export { listGoals, saveGoal, type SaveFinanceGoalInput } from "./goals";
export {
  countTransactions,
  deleteAllTransactions,
  getSpendCentsSince,
  importStatement,
  importTransactions,
  listTransactions,
  updateMatchingTransactionCategories,
  updateTransactionCategory,
  type ImportStatementInput,
} from "./transactions";
export {
  disconnectFinanceConnection,
  linkTellerConnection,
  listLinkedConnections,
  markFinanceConnectionDisconnected,
  type LinkedFinanceConnectionSummary,
} from "./connections";
export { syncFinanceConnection } from "./teller-sync";
export { handleTellerWebhookEvent } from "./webhooks";
