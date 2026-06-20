# Transaction Flow — Full Lifecycle

This document traces the complete path of a vote from the moment a user clicks "Submit Vote" to the moment the blockchain confirms it and the UI updates.

> **Related:** [Smart Contract](smart-contract.md) · [Frontend](frontend.md) · [API Reference](api-reference.md) · [Deployment — Troubleshooting](deployment.md#troubleshooting)

---

## Pipeline Overview

```
User clicks "Submit Vote"
         │
         ▼
┌─────────────────────────┐
│ 1. Pre-flight checks    │  (balance, wallet connected, option selected)
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ 2. Build transaction    │  (status: "building")
│    - Fetch seq number   │
│    - Construct TX       │
│    - prepareTransaction │
└──────────┬──────────────┘
           │ unsigned XDR
           ▼
┌─────────────────────────┐
│ 3. Sign transaction     │  (status: "signing")
│    - Freighter popup    │
│    - User approves      │
└──────────┬──────────────┘
           │ signed XDR
           ▼
┌─────────────────────────┐
│ 4. Submit to network    │  (status: "submitting")
│    - sendTransaction()  │
│    - Returns tx hash    │
└──────────┬──────────────┘
           │ tx hash
           ▼
┌─────────────────────────┐
│ 5. Await confirmation   │  (status: "confirming")
│    - Poll getTransaction│
│    - Every 2s, 20 tries │
└──────────┬──────────────┘
           │ SUCCESS / FAILED
           ▼
┌─────────────────────────┐
│ 6. Post-transaction     │  (status: "success" / "failed")
│    - Refresh poll data  │
│    - Update voter state │
│    - Append to feed     │
│    - Refresh balance    │
└─────────────────────────┘
```

---

## Stage 1 — Pre-flight Checks

**Code location:** `VoteForm.tsx:handleVote()`

```typescript
if (selected === null || !address) return;

if (balance !== null && parseFloat(balance) < 0.1) {
  setErrorMsg("Insufficient balance...");
  return;
}
```

**Checks performed:**
- `selected !== null` — an option must be chosen (UI button is disabled without this, but defense in depth)
- `address` is non-null — wallet must be connected
- `balance >= 0.1 XLM` — minimum for transaction fees

**Why 0.1 XLM?** The base Soroban transaction fee is tiny (~100 stroops = 0.00001 XLM). The 0.1 threshold is conservative — it ensures the user has some buffer and can always pay fees. The actual fee will be much less.

If balance check fails, no network call is made. The error shows inline in the form.

---

## Stage 2 — Build Transaction

**Status:** `"building"`

**Code location:** [`lib/contract.ts:buildVoteTransaction()`](api-reference.md#buildvotetransactionvoteraddress-string-optionindex-number-promisestring)

```typescript
export async function buildVoteTransaction(
  voterAddress: string,
  optionIndex: number
): Promise<string> {
  const contract = new Contract(CONTRACT_ID);
  const account = await server.getAccount(voterAddress);   // [1]

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        "vote",
        new Address(voterAddress).toScVal(),               // [2]
        nativeToScVal(optionIndex, { type: "u32" })        // [3]
      )
    )
    .setTimeout(180)                                       // [4]
    .build();

  const prepared = await server.prepareTransaction(tx);   // [5]
  return prepared.toXDR();                                // [6]
}
```

**[1] Fetch account:** Gets the current sequence number for the voter's account from the Soroban RPC. Each transaction must use the next sequence number — this prevents replay attacks.

**[2] Voter address as ScVal:** The Soroban contract takes an `Address` type. `new Address(addr).toScVal()` serializes the Stellar public key into the XDR ScVal format that Soroban understands.

**[3] Option index as ScVal:** `nativeToScVal(index, { type: "u32" })` converts a JavaScript number to a Soroban `u32` XDR value. The type hint is required — without it, the SDK might serialize it as `i128` or `i64`.

**[4] Timeout 180 seconds:** The transaction expires if not submitted within 3 minutes. This gives the user time to review and sign in Freighter without the TX becoming invalid.

**[5] prepareTransaction:** This is a Soroban-specific step. The RPC simulates the transaction and adds the **auth footprint** — a declaration of which contract storage entries this transaction will read and write. Soroban requires this footprint to be in the transaction before it's signed.

Without `prepareTransaction()`, the signed transaction would be rejected on-chain with a footprint error.

**[6] Return XDR string:** The prepared unsigned transaction serialized as a base64 XDR string, ready for signing.

---

## Stage 3 — Sign Transaction

**Status:** `"signing"`

**Code location:** [`hooks/useWalletKit.ts:signTransaction()`](api-reference.md#srchooksusewalletkitts)

```typescript
const result = await StellarWalletsKit.signTransaction(xdr, {
  networkPassphrase: Networks.TESTNET,
});
return result.signedTxXdr;
```

This call opens the Freighter browser extension popup. Freighter:
1. Decodes the XDR to show the user a human-readable transaction summary
2. Waits for user to click "Approve" or "Reject"
3. On Approve: signs with the user's private key and returns the signed XDR
4. On Reject: throws an error

**Network passphrase:** `Networks.TESTNET` = `"Test SDF Network ; September 2015"`. This is included in the transaction signature to prevent cross-network replay (a signed testnet TX cannot be submitted to mainnet).

**Error handling:** If the user rejects:
```typescript
const walletErr = classifyError(err);
if (walletErr.type === "REJECTED") {
  setState((s) => ({ ...s, error: walletErr }));  // store in hook
  throw new Error("REJECTED");                    // propagate to VoteForm
}
```

`VoteForm.handleVote()` catches `"REJECTED"` and resets status to `"idle"` without marking as `"failed"` — the user can try again.

---

## Stage 4 — Submit to Network

**Status:** `"submitting"`

**Code location:** `lib/contract.ts:submitToRpc()`

```typescript
export async function submitToRpc(signedXDR: string): Promise<string> {
  const tx = TransactionBuilder.fromXDR(signedXDR, NETWORK_PASSPHRASE);
  const send = await server.sendTransaction(tx);
  if (send.status === "ERROR") {
    throw new Error("Submit failed: " + JSON.stringify(send.errorResult));
  }
  return send.hash;
}
```

**`fromXDR()`:** Deserializes the signed XDR back into a Transaction object. The Soroban SDK needs a `Transaction` instance, not a raw XDR string, for submission.

**`server.sendTransaction()`:** Broadcasts the signed transaction to the Stellar Testnet Soroban RPC. Returns immediately with:
- `status: "PENDING"` — accepted, being processed
- `status: "ERROR"` — rejected before inclusion (malformed TX, etc.)
- `hash` — the transaction hash for polling

**The hash is returned even for PENDING** — we use this hash to poll for confirmation.

---

## Stage 5 — Await Confirmation

**Status:** `"confirming"`

**Code location:** `lib/contract.ts:waitForTransaction()`

```typescript
export async function waitForTransaction(
  hash: string,
  maxRetries = 20
): Promise<"SUCCESS" | "FAILED"> {
  for (let i = 0; i < maxRetries; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const result = await server.getTransaction(hash);
    if (result.status === GetTransactionStatus.SUCCESS) return "SUCCESS";
    if (result.status === GetTransactionStatus.FAILED) return "FAILED";
    // status === NOT_FOUND means still pending, continue polling
  }
  return "FAILED";
}
```

**Poll every 2 seconds, up to 20 retries = 40 second max wait.**

**`getTransaction()` statuses:**
- `SUCCESS` — the transaction was included in a ledger and all operations succeeded. The contract's `vote()` function ran.
- `FAILED` — the transaction was included but one or more operations failed. Most likely: the contract panicked (e.g., "already voted" — see [smart-contract.md — Error Conditions](smart-contract.md#error-conditions)).
- `NOT_FOUND` — the transaction hasn't been included in a ledger yet. Keep waiting.

**Why NOT_FOUND instead of 404?** Soroban RPC returns NOT_FOUND both for "never submitted" and "still pending". The hash returned in Stage 4 guarantees the TX was accepted, so NOT_FOUND means pending.

**Failure after 40 seconds:** Returns `"FAILED"`. The transaction may still get included later (Stellar ledger closes every ~5 seconds). In practice, 40 seconds is well beyond any normal network delay.

---

## Stage 6 — Post-Transaction Update

**Code location:** `app/page.tsx` callback chain

```typescript
const handleVoteSuccess = () => {
  refresh();          // triggers useContractEvents to fetch updated poll data
  checkVoteStatus();  // re-runs hasVoted() + getVoterChoice() for current user
};

const handleVoteCast = (option, txHash) => {
  const newItem: FeedItem = { id: String(++feedCounter), voter: address, option, txHash, timestamp: new Date() };
  setFeed((prev) => [newItem, ...prev.slice(0, 19)]);
};
```

And in `VoteForm`:
```typescript
if (result === "SUCCESS") {
  setStatus("success");
  refreshBalance();               // re-fetch XLM after fee deduction
  onVoteCast?.(options[selected], hash);
  onVoteSuccess();
}
```

**Order of updates:**
1. `setStatus("success")` — UI shows green confirmation immediately
2. `refreshBalance()` — updates balance display (fees deducted)
3. `onVoteCast()` — adds item to activity feed
4. `onVoteSuccess()` → `refresh()` + `checkVoteStatus()` — fetches updated vote counts and confirms voter status

The vote counts shown in `PollCard` will update within the next render cycle after `refresh()` returns with new data from the RPC.

---

## Error Scenarios

→ UI display of each error type: [design-system.md — Error/Warning Banners](design-system.md#errorwarning-banners) · Full troubleshooting guide: [deployment.md — Troubleshooting](deployment.md#troubleshooting)

### Freighter not installed

Caught in `connect()` → `WalletError { type: "NOT_FOUND" }`. VoteForm's Submit button never activates because `address` is null.

### User rejects connection

Caught in `connect()` → `WalletError { type: "REJECTED" }`. WalletPanel shows red banner.

### User rejects signing

Thrown by `signTransaction()` as `"REJECTED"`. Caught in `handleVote()`. `status` resets to `"idle"` — the form remains usable for another attempt.

### Insufficient XLM

Caught before any network call by the balance check. Inline red message in VoteForm.

### Contract "already voted" panic

The transaction is submitted and confirmed but the contract panics. `waitForTransaction()` returns `"FAILED"`. `VoteForm` shows `"Transaction was submitted but failed on-chain"`. The on-chain state is unchanged (the vote was not counted).

### Network timeout / RPC down

`getAccount()` or `simulateTransaction()` may throw if the RPC is unavailable. These surface as `status: "failed"` with the raw error message.

### Transaction stuck (NOT_FOUND after 20 retries)

`waitForTransaction()` returns `"FAILED"` after 40 seconds. The transaction may still be included later — the user should check Stellar.Expert with the displayed hash.

---

## Sequence Diagram

```
User         VoteForm        useWalletKit      lib/contract    Soroban RPC     Contract
 │               │                │                 │               │              │
 │ click Submit  │                │                 │               │              │
 │──────────────▶│                │                 │               │              │
 │               │ balance check  │                 │               │              │
 │               │◀───────────────│                 │               │              │
 │               │                │                 │               │              │
 │               │ buildVoteTransaction              │               │              │
 │               │────────────────────────────────▶│               │              │
 │               │                │                 │ getAccount()  │              │
 │               │                │                 │──────────────▶│              │
 │               │                │                 │◀──────────────│              │
 │               │                │                 │ prepareTransaction()          │
 │               │                │                 │──────────────▶│              │
 │               │                │                 │◀──────────────│              │
 │               │◀────────────────────────────────│ unsigned XDR  │              │
 │               │                │                 │               │              │
 │               │ signTransaction(xdr)             │               │              │
 │               │───────────────▶│                 │               │              │
 │ Freighter     │                │ StellarWalletsKit.signTransaction()            │
 │◀──────────────│                │                 │               │              │
 │ approve       │                │                 │               │              │
 │──────────────▶│                │                 │               │              │
 │               │◀───────────────│ signed XDR      │               │              │
 │               │                │                 │               │              │
 │               │ submitToRpc(signedXdr)           │               │              │
 │               │────────────────────────────────▶│               │              │
 │               │                │                 │ sendTransaction()             │
 │               │                │                 │──────────────▶│              │
 │               │                │                 │◀──────────────│ hash         │
 │               │◀────────────────────────────────│ hash          │              │
 │               │                │                 │               │              │
 │               │ waitForTransaction(hash)         │               │              │
 │               │────────────────────────────────▶│               │              │
 │               │                │                 │ getTransaction() x N         │
 │               │                │                 │──────────────▶│──────────────▶
 │               │                │                 │               │ contract.vote()
 │               │                │                 │               │◀─────────────│
 │               │                │                 │◀──────────────│ SUCCESS       │
 │               │◀────────────────────────────────│ "SUCCESS"     │              │
 │               │                │                 │               │              │
 │ feed update   │                │                 │               │              │
 │◀──────────────│                │                 │               │              │
 │ poll refresh  │                │                 │               │              │
 │◀──────────────│                │                 │               │              │
```
