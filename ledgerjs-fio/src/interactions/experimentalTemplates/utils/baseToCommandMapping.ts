// import * as commands from "../commands";
// import * as baseCommands from "../baseCommands";


// // TODO can we add reasonable types here? For now, any is used.
// // TODO add restArgs correctness checks
// export const baseToCommandMapping = (commandBase: baseCommands.TxIndependentCommandBase, restArgs: any[] = []) => {
//     // BASE_COMMAND_NONE
//     if (commandBase instanceof baseCommands.BASE_COMMAND_NONE) {
//         return commands.COMMAND_NONE(commandBase);
//     }
//     // BASE_COMMAND_INIT
//     if (commandBase instanceof baseCommands.BASE_COMMAND_INIT) {
//         return commands.COMMAND_INIT(commandBase, restArgs[0], restArgs[1]);
//     }
//     // BASE_COMMAND_APPEND_CONST_DATA
//     if (commandBase instanceof baseCommands.BASE_COMMAND_APPEND_CONST_DATA) {
//         return commands.COMMAND_APPEND_CONST_DATA(commandBase);
//     }
//     // BASE_COMMAND_SHOW_MESSAGE
//     if (commandBase instanceof baseCommands.BASE_COMMAND_SHOW_MESSAGE) {
//         return commands.COMMAND_SHOW_MESSAGE(commandBase);
//     }
//     // BASE_COMMAND_APPEND_DATA_BUFFER_DO_NOT_SHOW
//     if (commandBase instanceof baseCommands.BASE_COMMAND_APPEND_DATA_BUFFER_DO_NOT_SHOW) {
//         return commands.COMMAND_APPEND_DATA_BUFFER_DO_NOT_SHOW(commandBase, restArgs[0]);
//     }
//     // BASE_COMMAND_APPEND_DATA_STRING_DO_NOT_SHOW
//     if (commandBase instanceof baseCommands.BASE_COMMAND_APPEND_DATA_STRING_DO_NOT_SHOW) {
//         return commands.COMMAND_APPEND_DATA_STRING_DO_NOT_SHOW(commandBase, restArgs[0]);
//     }
//     // BASE_COMMAND_APPEND_DATA_STRING_SHOW
//     if (commandBase instanceof baseCommands.BASE_COMMAND_APPEND_DATA_STRING_SHOW) {
//         return commands.COMMAND_APPEND_DATA_STRING_SHOW(commandBase, restArgs[0]);
//     }
//     // BASE_COMMAND_APPEND_DATA_STRING_WITH_LENGTH_DO_NOT_SHOW
//     if (commandBase instanceof baseCommands.BASE_COMMAND_APPEND_DATA_STRING_WITH_LENGTH_DO_NOT_SHOW) {
//         return commands.COMMAND_APPEND_DATA_STRING_WITH_LENGTH_DO_NOT_SHOW(commandBase, restArgs[0]);
//     }
//     // BASE_COMMAND_APPEND_DATA_STRING_WITH_LENGTH_SHOW
//     if (commandBase instanceof baseCommands.BASE_COMMAND_APPEND_DATA_STRING_WITH_LENGTH_SHOW) {
//         return commands.COMMAND_APPEND_DATA_STRING_WITH_LENGTH_SHOW(commandBase, restArgs[0]);
//     }
//     // BASE_COMMAND_APPEND_DATA_STRING_WITH_LENGTH_SHOW_IF_NON_EMPTY
//     if (commandBase instanceof baseCommands.BASE_COMMAND_APPEND_DATA_STRING_WITH_LENGTH_SHOW_IF_NON_EMPTY) {
//         return commands.COMMAND_APPEND_DATA_STRING_WITH_LENGTH_SHOW_IF_NON_EMPTY(commandBase, restArgs[0]);
//     }
//     // BASE_COMMAND_APPEND_DATA_NAME_SHOW
//     if (commandBase instanceof baseCommands.BASE_COMMAND_APPEND_DATA_NAME_SHOW) {
//         return commands.COMMAND_APPEND_DATA_NAME_SHOW(commandBase, restArgs[0]);
//     }
//     // BASE_COMMAND_APPEND_DATA_FIO_AMOUNT_SHOW
//     if (commandBase instanceof baseCommands.BASE_COMMAND_APPEND_DATA_FIO_AMOUNT_SHOW) {
//         return commands.COMMAND_APPEND_DATA_FIO_AMOUNT_SHOW(commandBase, restArgs[0]);
//     }
//     // BASE_COMMAND_APPEND_DATA_UINT64_SHOW
//     if (commandBase instanceof baseCommands.BASE_COMMAND_APPEND_DATA_UINT64_SHOW) {
//         return commands.COMMAND_APPEND_DATA_UINT64_SHOW(commandBase, restArgs[0]);
//     }
//     // BASE_COMMAND_START_COUNTED_SECTION
//     if (commandBase instanceof baseCommands.BASE_COMMAND_START_COUNTED_SECTION) {
//         return commands.COMMAND_START_COUNTED_SECTION(commandBase);
//     }
//     // BASE_COMMAND_END_COUNTED_SECTION
//     if (commandBase instanceof baseCommands.BASE_COMMAND_END_COUNTED_SECTION) {
//         return commands.COMMAND_END_COUNTED_SECTION(commandBase);
//     }
//     // BASE_COMMAND_STORE_VALUE
//     if (commandBase instanceof baseCommands.BASE_COMMAND_STORE_VALUE) {
//         return commands.COMMAND_STORE_VALUE(commandBase, restArgs[0]);
//     }
//     // BASE_COMMAND_FINISH
//     if (commandBase instanceof baseCommands.BASE_COMMAND_FINISH) {
//         return commands.COMMAND_FINISH(commandBase, restArgs[0]);
//     }
//     // BASE_ADD_STORAGE_CHECK
//     if (commandBase instanceof baseCommands.BASE_ADD_STORAGE_CHECK) {
//         return commands.ADD_STORAGE_CHECK(commandBase, restArgs[0]);
//     }
//     // BASE_COMMAND_APPEND_DATA_MEMO_HASH
//     if (commandBase instanceof baseCommands.BASE_COMMAND_APPEND_DATA_MEMO_HASH) {
//         return commands.COMMAND_APPEND_DATA_MEMO_HASH(commandBase, restArgs[0], restArgs[1], restArgs[2]);
//     }
//     // BASE_COMMAND_APPEND_DATA_CHAIN_CODE_TOKEN_CODE_PUBLIC_ADDR_SHOW
//     if (commandBase instanceof baseCommands.BASE_COMMAND_APPEND_DATA_CHAIN_CODE_TOKEN_CODE_PUBLIC_ADDR_SHOW) {
//         return commands.COMMAND_APPEND_DATA_CHAIN_CODE_TOKEN_CODE_PUBLIC_ADDR_SHOW(commandBase, restArgs[0], restArgs[1], restArgs[2]);
//     }
//     // BASE_COMMAND_START_FOR_LOOP
//     if (commandBase instanceof baseCommands.BASE_COMMAND_START_FOR_LOOP) {
//         return commands.COMMAND_START_FOR_LOOP(commandBase);
//     }
//     // BASE_COMMAND_END_FOR_LOOP
//     if (commandBase instanceof baseCommands.BASE_COMMAND_END_FOR_LOOP) {
//         return commands.COMMAND_END_FOR_LOOP(commandBase);
//     }
// }

