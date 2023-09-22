import type { HexString, ParsedTransaction, ValidBIP32Path } from "../../types/internal"
import { Command, templateAlternative, COMMAND_INIT, COMMAND_APPEND_CONST_DATA, COMMAND_FINISH, COMMAND_APPEND_DATA_BUFFER_DO_NOT_SHOW } from "./commands"
import { date_to_buf, uint16_to_buf, uint32_to_buf } from "../../utils/serialize"
import { validate } from "../../utils/parse"
import { InvalidDataReason } from "../../errors";
import { template_trnsfiopubky } from "./template_trnsfiopubky";

export function templete_all(chainId: HexString, tx: ParsedTransaction, parsedPath: ValidBIP32Path): Array<Command> {
    //Validate template expectations
    validate(tx.context_free_actions.length == 0, InvalidDataReason.CONTEXT_FREE_ACTIONS_NOT_SUPPORTED);
    validate(tx.actions.length == 1, InvalidDataReason.MULTIPLE_ACTIONS_NOT_SUPPORTED);

    //Match action
    const actionCommands: Array<Command> = templateAlternative([
        template_trnsfiopubky,
    ])(chainId, tx, parsedPath)
    if (actionCommands.length == 0) return [];

    return [
        COMMAND_INIT(chainId, parsedPath),
        COMMAND_APPEND_DATA_BUFFER_DO_NOT_SHOW(Buffer.concat([
            date_to_buf(tx.expiration).reverse(),
            uint16_to_buf(tx.ref_block_num).reverse(),
            uint32_to_buf(tx.ref_block_prefix).reverse()
        ]), 10, 10),
        COMMAND_APPEND_CONST_DATA("0000000001" as HexString),
        ...actionCommands,
        COMMAND_APPEND_CONST_DATA("000000000000000000000000000000000000000000000000000000000000000000" as HexString),
        COMMAND_FINISH(parsedPath),
    ];
}