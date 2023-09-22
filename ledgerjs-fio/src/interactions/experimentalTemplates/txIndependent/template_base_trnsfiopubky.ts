import type { Uint8_t } from "../../../types/internal"
import { COMMAND, TxIndependentCommandBase } from "../commands"


export function template_base_trnsfiopubky(): Array<TxIndependentCommandBase> {

    // TODO storage checks are not included here. Is that an issue?
    // TODO don't use strings for command names, but use constants from utils/command_names.ts (and first define them there)
    // TODO incorporate encodings to send data
    return [
        {
            name: COMMAND.APPEND_CONST_DATA,
            params: {}
        },
        {
            name: COMMAND.SHOW_MESSAGE,
            params: {
                key: "Action",
                value: "Transfer FIO tokens"
            }
        },
        {
            name: COMMAND.STORE_VALUE,
            params: {
                register: 1 as Uint8_t,
            }
        },
        {
            name: COMMAND.APPEND_DATA,
            params: {
                minBufLen: 8,
                maxBufLen: 8,
                show: false
            }
        },
        {
            name: COMMAND.APPEND_DATA,
            params: {
                minBufLen: 8,
                maxBufLen: 8,
                show: false
            }
        },
        {
            name: COMMAND.APPEND_DATA,
            params: {
                key: "Payee Pubkey",
                show: true
            }
        },
        {
            name: COMMAND.APPEND_DATA,
            params: {
                key: "Amount",
                show: true
            }
        },
        {
            name: COMMAND.APPEND_DATA,
            params: {
                key: "Max fee",
                show: true
            }
        },
        {
            name: COMMAND.APPEND_DATA,
            params: {
                minBufLen: 8,
                maxBufLen: 8,
                show: false
            }
        },
        {
            name: COMMAND.APPEND_DATA,
            params: {
                show: false
            }
        }
    ]

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
