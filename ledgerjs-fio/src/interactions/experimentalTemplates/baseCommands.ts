import { COMMAND, VALUE_FORMAT, VALUE_VALIDATION, VALUE_POLICY, VALUE_STORAGE_COMPARE } from "./commands";
import { constDataShowMessage, constDataAppendData, constDataStartCountedSection } from "./commands";
import { Buffer } from "buffer";
import { HexString, Uint8_t, Uint32_t } from "types/internal";
import { uint32_to_buf } from "../../utils/serialize";
import { lenlen } from "./utils/utils";


export type TxIndependentCommandBase = {
    name: COMMAND,
    serializedConstData: HexString,
    children?: Array<TxIndependentCommandBase>,
}

//---------------------INSTRUCTION SPECIFIC BASE COMMANDS---------------------------------

const defaultCommandBase: TxIndependentCommandBase = {
    name: COMMAND.NONE,
    serializedConstData: Buffer.from("").toString("hex") as HexString,
}

export function BASE_COMMAND_NONE(): TxIndependentCommandBase {
    return defaultCommandBase;
}

export function BASE_COMMAND_INIT(): TxIndependentCommandBase {
    return {
        ...defaultCommandBase,
        name: COMMAND.INIT,
    }
}

export function BASE_COMMAND_APPEND_CONST_DATA(constData: HexString): TxIndependentCommandBase {
    return {
        ...defaultCommandBase,
        name: COMMAND.APPEND_CONST_DATA,
        serializedConstData: constData,
    }
}

export function BASE_COMMAND_SHOW_MESSAGE(key: string, value: string): TxIndependentCommandBase {
    return {
        ...defaultCommandBase,
        name: COMMAND.SHOW_MESSAGE,
        serializedConstData: constDataShowMessage(
            key,
            value
        ),
    }
}

export function BASE_COMMAND_APPEND_DATA_BUFFER_DO_NOT_SHOW(bufLenMin: number = 0, bufLenMax: number = 0xFFFFFFFF): TxIndependentCommandBase {
    return {
        ...defaultCommandBase,
        name: COMMAND.APPEND_DATA,
        serializedConstData: constDataAppendData(
            VALUE_FORMAT.VALUE_FORMAT_BUFFER_SHOW_AS_HEX,
            VALUE_VALIDATION.VALUE_VALIDATION_INBUFFER_LENGTH, BigInt(bufLenMin), BigInt(bufLenMax),
            VALUE_POLICY.VALUE_DO_NOT_SHOW_ON_DEVICE,
            VALUE_STORAGE_COMPARE.DO_NOT_COMPARE,
            ""
        ),
    }
}

export function BASE_COMMAND_APPEND_DATA_STRING_DO_NOT_SHOW(varData: Buffer, bufLenMin: number = 0, bufLenMax: number = 0xFFFFFFFF): TxIndependentCommandBase {
    return {
        ...defaultCommandBase,
        name: COMMAND.APPEND_DATA,
        serializedConstData: constDataAppendData(
            VALUE_FORMAT.VALUE_FORMAT_ASCII_STRING,
            VALUE_VALIDATION.VALUE_VALIDATION_INBUFFER_LENGTH, BigInt(bufLenMin), BigInt(bufLenMax),
            VALUE_POLICY.VALUE_DO_NOT_SHOW_ON_DEVICE,
            VALUE_STORAGE_COMPARE.DO_NOT_COMPARE,
            ""
        ),
    }
}

export function BASE_COMMAND_APPEND_DATA_STRING_SHOW(key: string, bufLenMin: number = 0, bufLenMax: number = 0xFFFFFFFF): TxIndependentCommandBase {
    return {
        ...defaultCommandBase,
        name: COMMAND.APPEND_DATA,
        serializedConstData: constDataAppendData(
            VALUE_FORMAT.VALUE_FORMAT_ASCII_STRING,
            VALUE_VALIDATION.VALUE_VALIDATION_INBUFFER_LENGTH, BigInt(bufLenMin), BigInt(bufLenMax),
            VALUE_POLICY.VALUE_SHOW_ON_DEVICE,
            VALUE_STORAGE_COMPARE.DO_NOT_COMPARE,
            key
        ),
    }
}

export function BASE_COMMAND_APPEND_DATA_STRING_WITH_LENGTH_DO_NOT_SHOW(bufLenMin: number = 0, bufLenMax: number = 0xFFFFFFFF): TxIndependentCommandBase {
    return {
        ...defaultCommandBase,
        name: COMMAND.APPEND_DATA,
        serializedConstData: constDataAppendData(
            VALUE_FORMAT.VALUE_FORMAT_ASCII_STRING_WITH_LENGTH,
            VALUE_VALIDATION.VALUE_VALIDATION_INBUFFER_LENGTH, BigInt(bufLenMin + lenlen(bufLenMin)), BigInt(bufLenMax + lenlen(bufLenMax)),
            VALUE_POLICY.VALUE_DO_NOT_SHOW_ON_DEVICE,
            VALUE_STORAGE_COMPARE.DO_NOT_COMPARE,
            ""
        ),
    }
}

export function BASE_COMMAND_APPEND_DATA_STRING_WITH_LENGTH_SHOW(key: string, bufLenMin: number = 0, bufLenMax: number = 0xFFFFFFFF): TxIndependentCommandBase {
    return {
        ...defaultCommandBase,
        name: COMMAND.APPEND_DATA,
        serializedConstData: constDataAppendData(
            VALUE_FORMAT.VALUE_FORMAT_ASCII_STRING_WITH_LENGTH,
            VALUE_VALIDATION.VALUE_VALIDATION_INBUFFER_LENGTH, BigInt(bufLenMin + lenlen(bufLenMin)), BigInt(bufLenMax + lenlen(bufLenMax)),
            VALUE_POLICY.VALUE_SHOW_ON_DEVICE,
            VALUE_STORAGE_COMPARE.DO_NOT_COMPARE,
            key
        ),
    }
}

export function BASE_COMMAND_APPEND_DATA_STRING_WITH_LENGTH_SHOW_IF_NON_EMPTY(key: string, bufLenMin: number = 0, bufLenMax: number = 0xFFFFFFFF): TxIndependentCommandBase {
    return {
        ...defaultCommandBase,
        name: COMMAND.APPEND_DATA,
        serializedConstData: constDataAppendData(
            VALUE_FORMAT.VALUE_FORMAT_ASCII_STRING_WITH_LENGTH,
            VALUE_VALIDATION.VALUE_VALIDATION_INBUFFER_LENGTH, BigInt(bufLenMin + lenlen(bufLenMin)), BigInt(bufLenMax + lenlen(bufLenMax)),
            VALUE_POLICY.VALUE_SHOW_ON_DEVICE_IF_NONEMPTY,
            VALUE_STORAGE_COMPARE.DO_NOT_COMPARE,
            key
        ),
    }
}

export function BASE_COMMAND_APPEND_DATA_NAME_SHOW(key: string): TxIndependentCommandBase {
    return {
        ...defaultCommandBase,
        name: COMMAND.APPEND_DATA,
        serializedConstData: constDataAppendData(
            VALUE_FORMAT.VALUE_FORMAT_NAME,
            VALUE_VALIDATION.VALUE_VALIDATION_NONE, BigInt(0), BigInt(0),
            VALUE_POLICY.VALUE_SHOW_ON_DEVICE,
            VALUE_STORAGE_COMPARE.DO_NOT_COMPARE,
            key
        ),
    }
}

export function BASE_COMMAND_APPEND_DATA_FIO_AMOUNT_SHOW(key: string, minAmount: number = 0, maxAmount: bigint = BigInt("0x7FFFFFFFFFFFFFFF")): TxIndependentCommandBase {
    return {
        ...defaultCommandBase,
        name: COMMAND.APPEND_DATA,
        serializedConstData: constDataAppendData(
            VALUE_FORMAT.VALUE_FORMAT_FIO_AMOUNT,
            VALUE_VALIDATION.VALUE_VALIDATION_NUMBER, BigInt(minAmount), BigInt(maxAmount),
            VALUE_POLICY.VALUE_SHOW_ON_DEVICE,
            VALUE_STORAGE_COMPARE.DO_NOT_COMPARE,
            key
        ),
    }
}

export function BASE_COMMAND_APPEND_DATA_UINT64_SHOW(key: string, minAmount: number = 0, maxAmount: bigint = BigInt("0x7FFFFFFFFFFFFFFF")): TxIndependentCommandBase {
    return {
        ...defaultCommandBase,
        name: COMMAND.APPEND_DATA,
        serializedConstData: constDataAppendData(
            VALUE_FORMAT.VALUE_FORMAT_UINT64,
            VALUE_VALIDATION.VALUE_VALIDATION_NUMBER, BigInt(minAmount), BigInt(maxAmount),
            VALUE_POLICY.VALUE_SHOW_ON_DEVICE,
            VALUE_STORAGE_COMPARE.DO_NOT_COMPARE,
            key
        ),
    }
}

// export function BASE_COMMAND_START_COUNTED_SECTION(min: number = 0, max: number = 0xFFFFFFFF): TxIndependentCommandBase {
//     return {
//         ...defaultCommandBase,
//         name: COMMAND.START_COUNTED_SECTION,
//         serializedConstData: constDataStartCountedSection(
//             VALUE_FORMAT.VALUE_FORMAT_VARUINT32, VALUE_VALIDATION.VALUE_VALIDATION_NUMBER, BigInt(min), BigInt(max),
//         ),
//     }
// }

// export function BASE_COMMAND_END_COUNTED_SECTION(): TxIndependentCommandBase {
//     return {
//         ...defaultCommandBase,
//         name: COMMAND.END_COUNTED_SECTION,
//     }
// }


export function BASE_COMMANDS_COUNTED_SECTION(commandBases: Array<TxIndependentCommandBase>, min: number = 0, max: number = 0xFFFFFFFF): Array<TxIndependentCommandBase> {
    return [
        {
            ...defaultCommandBase,
            name: COMMAND.START_COUNTED_SECTION,
            serializedConstData: constDataStartCountedSection(
                VALUE_FORMAT.VALUE_FORMAT_VARUINT32, VALUE_VALIDATION.VALUE_VALIDATION_NUMBER, BigInt(min), BigInt(max),
            ),
        },
        ...commandBases,
        {
            ...defaultCommandBase,
            name: COMMAND.END_COUNTED_SECTION,
        }
    ]
}

export function BASE_COMMAND_STORE_VALUE(register: Uint8_t): TxIndependentCommandBase {
    return {
        ...defaultCommandBase,
        name: COMMAND.STORE_VALUE,
        serializedConstData: Buffer.from([register as Uint8_t]).toString("hex") as HexString,
    }
}

// TODO this is very different from original COMMAND_FINISH. Research this.
export function BASE_COMMAND_FINISH(): TxIndependentCommandBase {
    return {
        ...defaultCommandBase,
        name: COMMAND.FINISH,
    }
}

export function BASE_ADD_STORAGE_CHECK(check: VALUE_STORAGE_COMPARE, c: TxIndependentCommandBase): TxIndependentCommandBase {
    const constData: Buffer = Buffer.from(c.serializedConstData, "hex")
    const policyAndStorage: Uint8_t = constData[18] as Uint8_t
    const newValue: Uint8_t = ((policyAndStorage & 0x0F) | check) as Uint8_t
    constData.writeUInt8(newValue, 18)
    return {
        ...c,
        serializedConstData: constData.toString("hex") as HexString,
    }
}

export function BASE_COMMAND_APPEND_DATA_MEMO_HASH(): TxIndependentCommandBase {
    return {
        ...defaultCommandBase,
        name: COMMAND.APPEND_DATA,
        serializedConstData: constDataAppendData(
            VALUE_FORMAT.VALUE_FORMAT_MEMO_HASH,
            VALUE_VALIDATION.VALUE_VALIDATION_NONE, BigInt(0), BigInt(0),
            VALUE_POLICY.VALUE_DO_NOT_SHOW_ON_DEVICE,
            VALUE_STORAGE_COMPARE.DO_NOT_COMPARE,
            ""
        ),
    }
}


export function BASE_COMMAND_APPEND_DATA_CHAIN_CODE_TOKEN_CODE_PUBLIC_ADDR_SHOW(key: string): TxIndependentCommandBase {
    return {
        ...defaultCommandBase,
        name: COMMAND.APPEND_DATA,
        serializedConstData: constDataAppendData(
            VALUE_FORMAT.VALUE_FORMAT_CHAIN_CODE_TOKEN_CODE_PUBLIC_ADDR,
            VALUE_VALIDATION.VALUE_VALIDATION_NONE, BigInt(0), BigInt(0),
            VALUE_POLICY.VALUE_SHOW_ON_DEVICE,
            VALUE_STORAGE_COMPARE.DO_NOT_COMPARE,
            key
        ),
    }
}

export function BASE_COMMAND_START_FOR_LOOP(allowedIterations: Array<TxIndependentCommandBase>, minIterations: Uint32_t, maxIterations: Uint32_t): TxIndependentCommandBase {
    // We don't need allowedIterationsHash as the Merkle tree solves this
    const serializedConstData = Buffer.concat([
        uint32_to_buf(minIterations),
        uint32_to_buf(maxIterations),
    ]).toString('hex') as HexString;
    return {
        ...defaultCommandBase,
        name: COMMAND.START_FOR,
        serializedConstData,
        children: allowedIterations,
    }
}

export function BASE_COMMAND_END_FOR_LOOP(): TxIndependentCommandBase {
    return {
        ...defaultCommandBase,
        name: COMMAND.END_FOR,
    }
}