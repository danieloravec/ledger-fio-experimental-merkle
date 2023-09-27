import type { Uint8_t, HexString, ParsedTransaction, ParsedTransferFIOTokensData, Uint32_t } from "../../../types/internal"
import {
    VALUE_STORAGE_COMPARE,
} from "../commands"
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
    BASE_COMMAND_APPEND_DATA_STRING_WITH_LENGTH_DO_NOT_SHOW,
    BASE_COMMAND_FOR_LOOP
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
        // TODO remove the part below, it is just a testing garbage
        BASE_COMMAND_FOR_LOOP([
            [
                BASE_COMMAND_SHOW_MESSAGE("Hello", "Test"),
                BASE_COMMAND_APPEND_DATA_STRING_WITH_LENGTH_SHOW("Some string"),
                BASE_COMMAND_APPEND_DATA_STRING_WITH_LENGTH_SHOW("Another string"),
            ],
            [
                BASE_COMMAND_SHOW_MESSAGE("Key", "Value"),
                ...BASE_COMMANDS_COUNTED_SECTION([
                    BASE_COMMAND_APPEND_DATA_STRING_WITH_LENGTH_SHOW("Something"),
                    BASE_COMMAND_APPEND_DATA_STRING_WITH_LENGTH_SHOW("Something else"),
                ])
            ]
        ], 1 as Uint32_t, 6 as Uint32_t),
        BASE_COMMAND_STORE_VALUE(1 as Uint8_t),
        BASE_COMMAND_SHOW_MESSAGE("Padding", "Fill"),
    ];
}

// export function template_base_trnsfiopubky(): Array<{
//     commandBase: TxIndependentCommandBase,
//     getVarArgs: (tx: ParsedTransaction) => Array<Buffer>
// }> {
//     return [
//         {
//             commandBase: BASE_COMMAND_APPEND_CONST_DATA(
//                 Buffer.from("fio.token", "ascii").toString("hex") +
//                 Buffer.from("trnsfiopubky", "ascii").toString("hex") +
//                 "01" as HexString
//             ),
//             getVarArgs: (tx: ParsedTransaction) => []
//         },
//         {
//             commandBase: BASE_COMMAND_SHOW_MESSAGE("Action", "Transfer FIO tokens"),
//             getVarArgs: (tx: ParsedTransaction) => []
//         },
//         {
//             commandBase: BASE_COMMAND_STORE_VALUE(1 as Uint8_t),
//             getVarArgs: (tx: ParsedTransaction) => [Buffer.from(tx.actions[0].authorization[0].actor, "hex")]
//         },
//         {
//             commandBase: BASE_ADD_STORAGE_CHECK(
//                 VALUE_STORAGE_COMPARE.COMPARE_REGISTER1,
//                 BASE_COMMAND_APPEND_DATA_BUFFER_DO_NOT_SHOW(8, 8)
//             ),
//             getVarArgs: (tx: ParsedTransaction) => [Buffer.from(tx.actions[0].authorization[0].actor, "hex")]
//         },
//         {
//             commandBase: BASE_COMMAND_APPEND_DATA_BUFFER_DO_NOT_SHOW(8, 8),
//             getVarArgs: (tx: ParsedTransaction) => [Buffer.from(tx.actions[0].authorization[0].permission, "hex")]
//         },
//         {
//             commandBase: BASE_COMMAND_START_COUNTED_SECTION(),
//             getVarArgs: (tx: ParsedTransaction) => []
//         },
//         {
//             commandBase: BASE_COMMAND_APPEND_DATA_STRING_WITH_LENGTH_SHOW("Payee Pubkey"),
//             getVarArgs: (tx: ParsedTransaction) => [Buffer.from((tx.actions[0].data as ParsedTransferFIOTokensData).payee_public_key)]
//         },
//         {
//             commandBase: BASE_COMMAND_APPEND_DATA_FIO_AMOUNT_SHOW("Amount"),
//             getVarArgs: (tx: ParsedTransaction) => [uint64_to_buf((tx.actions[0].data as ParsedTransferFIOTokensData).amount).reverse()]
//         },
//         {
//             commandBase: BASE_COMMAND_APPEND_DATA_FIO_AMOUNT_SHOW("Max fee"),
//             getVarArgs: (tx: ParsedTransaction) => [uint64_to_buf(tx.actions[0].data.max_fee).reverse()]
//         },
//         {
//             commandBase: BASE_ADD_STORAGE_CHECK(
//                 VALUE_STORAGE_COMPARE.COMPARE_REGISTER1,
//                 BASE_COMMAND_APPEND_DATA_BUFFER_DO_NOT_SHOW(8, 8)
//             ),
//             getVarArgs: (tx: ParsedTransaction) => [Buffer.from(tx.actions[0].data.actor, "hex")]
//         },
//         {
//             commandBase: BASE_COMMAND_APPEND_DATA_STRING_WITH_LENGTH_DO_NOT_SHOW(),
//             getVarArgs: (tx: ParsedTransaction) => [Buffer.from((tx.actions[0].data as ParsedTransferFIOTokensData).tpid)]
//         },
//         {
//             commandBase: BASE_COMMAND_END_COUNTED_SECTION(),
//             getVarArgs: (tx: ParsedTransaction) => []
//         },
//     ];

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
// }
