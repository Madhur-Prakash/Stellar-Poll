import {
  Contract,
  rpc as SorobanRpc,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  nativeToScVal,
  scValToNative,
  Address,
  xdr,
} from "@stellar/stellar-sdk";

export const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID ?? "";
export const TESTNET_RPC_URL = "https://soroban-testnet.stellar.org";
export const NETWORK_PASSPHRASE = Networks.TESTNET;

const server = new SorobanRpc.Server(TESTNET_RPC_URL);

export interface PollData {
  question: string;
  options: string[];
  votes: number[];
  total: number;
}

// ---------- Read calls (simulate only, no wallet needed) ----------

async function simulateRead(method: string, args: xdr.ScVal[] = []) {
  if (!CONTRACT_ID) throw new Error("CONTRACT_ID not set in environment");
  const contract = new Contract(CONTRACT_ID);
  // Use a well-known funded testnet account as the simulated source
  const sourceAccount = await server.getAccount(
    process.env.NEXT_PUBLIC_SIMULATED_SOURCE_ADDRESS ??
    "GAPHXA6K4EFTG77ESEAM6UWGCZZFBRROYOZKWKO4PDESNXOZMYAVSBBK"
  );
  const tx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(0)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (!SorobanRpc.Api.isSimulationSuccess(sim)) {
    throw new Error("Simulation failed: " + JSON.stringify(sim));
  }
  return scValToNative(sim.result!.retval);
}

export async function getPollData(): Promise<PollData> {
  try {
    const [question, options, votes] = await Promise.all([
      simulateRead("get_question"),
      simulateRead("get_options"),
      simulateRead("get_all_votes"),
    ]);

    const votesArr = votes as number[];

    return {
      question: question as string,
      options: options as string[],
      votes: votesArr,
      total: votesArr.reduce((a, b) => a + b, 0),
    };
  } catch (err) {
    console.error("getPollData failed:", err);
    throw err;
  }
}

export async function hasVoted(voterAddress: string): Promise<boolean> {
  try {
    return (await simulateRead("has_voted", [new Address(voterAddress).toScVal()])) as boolean;
  } catch {
    return false;
  }
}

export async function getVoterChoice(voterAddress: string): Promise<number | null> {
  try {
    return (await simulateRead("get_voter_choice", [new Address(voterAddress).toScVal()])) as number;
  } catch {
    return null;
  }
}

// ---------- Write calls (needs wallet signature) ----------

export async function buildVoteTransaction(
  voterAddress: string,
  optionIndex: number
): Promise<string> {
  if (!CONTRACT_ID) throw new Error("CONTRACT_ID not set");
  const contract = new Contract(CONTRACT_ID);
  const account = await server.getAccount(voterAddress);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        "vote",
        new Address(voterAddress).toScVal(),
        nativeToScVal(optionIndex, { type: "u32" })
      )
    )
    .setTimeout(180)
    .build();

  const prepared = await server.prepareTransaction(tx);
  return prepared.toXDR();
}

export async function submitToRpc(signedXDR: string): Promise<string> {
  const tx = TransactionBuilder.fromXDR(signedXDR, NETWORK_PASSPHRASE);
  const send = await server.sendTransaction(tx as Parameters<typeof server.sendTransaction>[0]);
  if (send.status === "ERROR") {
    throw new Error("Submit failed: " + JSON.stringify(send.errorResult));
  }
  return send.hash;
}

export async function waitForTransaction(
  hash: string,
  maxRetries = 20
): Promise<"SUCCESS" | "FAILED"> {
  for (let i = 0; i < maxRetries; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const result = await server.getTransaction(hash);
    if (result.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) return "SUCCESS";
    if (result.status === SorobanRpc.Api.GetTransactionStatus.FAILED) return "FAILED";
  }
  return "FAILED";
}
