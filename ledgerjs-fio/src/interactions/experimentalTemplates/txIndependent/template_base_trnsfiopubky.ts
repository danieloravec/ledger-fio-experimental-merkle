import type { Uint8_t, HexString } from "../../../types/internal"
import { COMMAND, VALUE_STORAGE_COMPARE, VALUE_FORMAT, VALUE_POLICY, VALUE_VALIDATION } from "../commands"
import {
    TxIndependentCommandBase,
    BASE_COMMAND_APPEND_CONST_DATA,
    BASE_COMMAND_SHOW_MESSAGE,
    BASE_COMMAND_STORE_VALUE,
    BASE_ADD_STORAGE_CHECK,
    BASE_COMMAND_APPEND_DATA_BUFFER_DO_NOT_SHOW,
    BASE_COMMANDS_COUNTED_SECTION,
    BASE_COMMAND_APPEND_DATA_STRING_WITH_LENGTH_SHOW,
    BASE_COMMAND_APPEND_DATA_FIO_AMOUNT_SHOW,
    BASE_COMMAND_APPEND_DATA_STRING_WITH_LENGTH_DO_NOT_SHOW
} from "../baseCommands";


export function template_base_trnsfiopubky(): Array<TxIndependentCommandBase> {
    return [
        BASE_COMMAND_APPEND_CONST_DATA(
            Buffer.from("fio.token", "ascii").toString("hex") +
            Buffer.from("trnsfiopubky", "ascii").toString("hex") +
            "01" as HexString
        ),
        BASE_COMMAND_SHOW_MESSAGE("Action", "Transfer FIO tokens"),
        BASE_COMMAND_STORE_VALUE(1 as Uint8_t),
        BASE_ADD_STORAGE_CHECK(VALUE_STORAGE_COMPARE.COMPARE_REGISTER1,
            BASE_COMMAND_APPEND_DATA_BUFFER_DO_NOT_SHOW(8, 8)),
        BASE_COMMAND_APPEND_DATA_BUFFER_DO_NOT_SHOW(8, 8),
        ...BASE_COMMANDS_COUNTED_SECTION([
            BASE_COMMAND_APPEND_DATA_STRING_WITH_LENGTH_SHOW("Payee Pubkey"),
            BASE_COMMAND_APPEND_DATA_FIO_AMOUNT_SHOW("Amount"),
            BASE_COMMAND_APPEND_DATA_FIO_AMOUNT_SHOW("Max fee"),
            BASE_ADD_STORAGE_CHECK(VALUE_STORAGE_COMPARE.COMPARE_REGISTER1,
                BASE_COMMAND_APPEND_DATA_BUFFER_DO_NOT_SHOW(8, 8)),
            BASE_COMMAND_APPEND_DATA_STRING_WITH_LENGTH_DO_NOT_SHOW(),
        ]),
    ];

    // return [
    //     COMMAND_APPEND_CONST_DATA(tx.actions[0].account + tx.actions[0].name + "01" as HexString),
    //     COMMAND_SHOW_MESSAGE("Action", "Transfer FIO tokens"),
    //     COMMAND_STORE_VALUE(1 as Uint8_t, Buffer.from(tx.actions[0].authorization[0].actor, "hex")),
    //     ADD_STORAGE_CHECK(VALUE_STORAGE_COMPARE.COMPARE_REGISTER1,
    //         COMMAND_APPEND_DATA_BUFFER_DO_NOT_SHOW(Buffer.from(authorization.actor, "hex"), 8, 8)),
    //     COMMAND_APPEND_DATA_BUFFER_DO_NOT_SHOW(Buffer.from(authorization.permission, "hex"), 8, 8),
    //     ...COMMANDS_COUNTED_SECTION([
    //         COMMAND_APPEND_DATA_STRING_WITH_LENGTH_SHOW("Payee Pubkey", Buffer.from(actionData.payee_public_key)),
    //         COMMAND_APPEND_DATA_FIO_AMOUNT_SHOW("Amount", uint64_to_buf(actionData.amount).reverse()),
    //         COMMAND_APPEND_DATA_FIO_AMOUNT_SHOW("Max fee", uint64_to_buf(actionData.max_fee).reverse()),
    //         ADD_STORAGE_CHECK(VALUE_STORAGE_COMPARE.COMPARE_REGISTER1,
    //             COMMAND_APPEND_DATA_BUFFER_DO_NOT_SHOW(Buffer.from(actionData.actor, "hex"), 8, 8)),
    //         COMMAND_APPEND_DATA_STRING_WITH_LENGTH_DO_NOT_SHOW(Buffer.from(actionData.tpid)),
    //     ]),
    // ];
}
