// Public surface for the finance service. Callers should keep importing from
// `@/lib/services/finance` — the split into sibling files is an internal
// reorganization. Internal helpers (shared.ts) are deliberately not re-exported.

export { listAccounts, saveAccount, type SaveFinanceAccountInput } from "./accounts";
export { listGoals, saveGoal, type SaveFinanceGoalInput } from "./goals";
export {
  countTransactions,
  deleteAllTransactions,
  deleteImportBatch,
  getSpendCentsSince,
  importStatement,
  importTransactions,
  listImportBatches,
  listTransactions,
  updateMatchingTransactionCategories,
  updateTransactionCategory,
  type ImportOptions,
  type ImportResult,
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
export { deleteShopRule, listShopRules, saveShopRule, type SaveShopRuleInput } from "./rules";
export { handleTellerWebhookEvent } from "./webhooks";
export {
  archiveBill,
  deleteBudget,
  getMoneyDateDone,
  listBills,
  listBudgets,
  listPaychecks,
  savePaychecks,
  saveBudgets,
  markBillPaid,
  markMoneyDateDone,
  saveBill,
  saveBudget,
  type SaveBillInput,
} from "./planning";
export {
  moveFinanceData,
  summarizeMovableFinance,
  type MovableFinanceSummary,
  type MoveFinanceInput,
  type MoveFinanceResult,
} from "./transfer";
export {
  addEntry,
  addMove,
  setAsideToPot,
  setEntryPot,
  catchUpBalances,
  markCardPaid,
  setCardStatement,
  commitStatementCheck,
  countEntriesSince,
  deleteEntry,
  isTrackingSetupError,
  listAccountPlans,
  listBalanceSnapshots,
  listStatementChecks,
  previewStatementCheck,
  saveAccountPlan,
  updateAccountBalance,
  updateEntry,
  type AddEntryInput,
  type AddMoveInput,
  type CommitStatementInput,
  type StatementLineInput,
  type StatementPreview,
  type UpdateEntryInput,
} from "./tracking";
export { createShortcutKey, hasShortcutKey, verifyShortcutKey } from "./shortcut";
