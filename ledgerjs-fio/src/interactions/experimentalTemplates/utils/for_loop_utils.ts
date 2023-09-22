import { Command } from "../commands";
import { HexString } from "types/internal";

// TODO Do we need to calculate allowed iteration hash for START_FOR? This should be handled by the Merkle tree somehow. How to implement START_FOR command?
export const calculateAllowedIterationsHash = (allowedIterations: Array<Command>): HexString => {
    // TODO implement maybe?
}