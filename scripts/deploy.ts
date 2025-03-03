import {DEF_ACCOUNT_CONF, loadConfigAndApply, MY_ACCOUNT} from "../src/web3/global";
import {Command} from "commander";
import {HexString} from "aptos";
import {isHexEqual, isStringAddress} from "../src/utils/check";
import {MovePublisher} from "../src/momentum-safe/move-publisher";
import {MomentumSafe} from "../src/momentum-safe/momentum-safe";
import * as Aptos from "../src/web3/global";
import {makeModulePublishTx} from "../src/momentum-safe/msafe-txn";
import {printSeparator, printTxDetails, promptForYN} from "../src/cmd/common";
import {loadMomentumSafe} from "./common";

const program = new Command();


const cli = program
  .version("0.0.1")
  .description("Momentum Safe move deployer script. Deploy the compiled MOVE package on blockchain.")
  .option("-c, --config <string>", "config file of aptos profile", DEF_ACCOUNT_CONF)
  .option("-p --profile <string>", "profile to use in aptos config", "default")
  .option("-n --network <string>", "network (devnet, testnet), use deployed address", "devnet")
  .requiredOption("--msafe <string>", "momentum safe address")
  .requiredOption("--move-dir <string>", "move directory contains Move.toml")
  .parse(process.argv);


async function main() {
  const args = await parseAndLoadConfig();

  // load msafe
  const msafe = await loadMomentumSafe(HexString.ensure(args.msafe));

  // make module publish transaction
  const sn = await msafe.getNextSN();
  const msafeTxn = await makeModulePublishTx(
    msafe.address,
    {moveDir: args.moveDir},
    {sequenceNumber: sn}
  );

  // Confirm transaction details
  await printTxDetails(msafeTxn.getTxnInfo());
  printSeparator();
  const userConfirm = await promptForYN("Do you confirm with the transaction?", true);
  if (!userConfirm) {
    console.error("User canceled operation");
    process.exit(1);
  }

  // Submit transaction
  const res = await msafe.initTransaction(MY_ACCOUNT, msafeTxn);
  const myHash = (res.pendingTx as any).hash;
  console.log(`\tTransaction ${myHash} submitted to blockchain`);
  await Aptos.waitForTransaction(myHash);
  console.log(`\tTransaction confirmed on chain.`);
}

async function parseAndLoadConfig(): Promise<configArg> {
  const args = getArguments();
  validateArguments(args);

  await loadConfigAndApply({
    configFilePath: args.config,
    profile: args.profile,
    network: args.network,
  });
  return args;
}

type configArg = {
  config: string,
  profile: string,
  network: string,
  msafe: HexString,
  moveDir: string,
}

function getArguments(): configArg {
  return {
    config: cli.opts().config,
    profile: cli.opts().profile,
    network: cli.opts().network,
    msafe: HexString.ensure(cli.opts().msafe),
    moveDir: cli.opts().moveDir,
  };
}

function validateArguments(ca: configArg) {
  if (!isStringAddress(ca.msafe.hex())) {
    throw Error("invalid msafe address: " + ca.msafe);
  }
  if (!MovePublisher.isDirValid(ca.moveDir)) {
    throw Error("invalid move dir: " + ca.msafe);
  }
}

(async () => main())();
