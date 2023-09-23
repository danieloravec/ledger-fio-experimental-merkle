import { assert } from "../../utils/assert";
import { InvalidDataReason } from "../../errors";
import { HexString, Uint8_t, ParsedTransaction, ValidBIP32Path, VarlenAsciiString } from "types/internal";
import { buf_to_hex, path_to_buf, varuint32_to_buf } from "../../utils/serialize";
import type { SignedTransactionData } from "../../types/public";
import { chunkBy } from "../../utils/ioHelpers"
import { validate } from "../../utils/parse";
import { TxIndependentCommandBase } from "./baseCommands";

export const enum COMMAND {
    NONE = 0x00,
    INIT = 0x01,
    APPEND_CONST_DATA = 0x02,
    SHOW_MESSAGE = 0x03,
    APPEND_DATA = 0x04,
    START_COUNTED_SECTION = 0x05,
    END_COUNTED_SECTION = 0x06,
    STORE_VALUE = 0x07,
    START_FOR = 0x08,
    END_FOR = 0x09,
    START_ITER = 0x0A,
    END_ITER = 0x0B,
    FINISH = 0x0C,
};

export const enum VALUE_FORMAT {
    VALUE_FORMAT_BUFFER_SHOW_AS_HEX = 0x01,
    VALUE_FORMAT_ASCII_STRING = 0x02,
    VALUE_FORMAT_NAME = 0x03,
    VALUE_FORMAT_ASCII_STRING_WITH_LENGTH = 0x04,

    VALUE_FORMAT_FIO_AMOUNT = 0x10,
    VALUE_FORMAT_UINT64 = 0x14,
    VALUE_FORMAT_VARUINT32 = 0x17,

    VALUE_FORMAT_MEMO_HASH = 0x20,
    VALUE_FORMAT_CHAIN_CODE_TOKEN_CODE_PUBLIC_ADDR = 0x21,
}

export const enum VALUE_VALIDATION {
    VALUE_VALIDATION_NONE = 1,
    VALUE_VALIDATION_INBUFFER_LENGTH = 2,
    VALUE_VALIDATION_NUMBER = 3,
}

export const enum VALUE_POLICY {
    VALUE_SHOW_ON_DEVICE = 5,
    VALUE_SHOW_ON_DEVICE_IF_NONEMPTY = 6,
    VALUE_DO_NOT_SHOW_ON_DEVICE = 2,
}

export const enum VALUE_STORAGE_COMPARE {
    DO_NOT_COMPARE = 0x00,
    COMPARE_REGISTER1 = 0x10,
    COMPARE_REGISTER2 = 0x20,
    COMPARE_REGISTER3 = 0x30,
    COMPARE_REGISTER1_DECODE_NAME = 0x40,
}

export type DataAction = (b: Buffer, s: SignedTransactionData) => SignedTransactionData

export const dhDataAction: DataAction = (b, s) => {
    return {
        dhEncryptedData: s.dhEncryptedData + b.toString(),
        txHashHex: s.txHashHex,
        witness: s.witness
    }
}


export type Command = {
    command: COMMAND,
    p2: Uint8_t,
    constData: HexString,
    varData: Buffer,
    expectedResponseLength?: number,
    dataAction: DataAction,
    txLen: number, //This is necessary to make counted sections work
}

export const defaultCommand: Command = {
    command: COMMAND.NONE,
    p2: 0 as Uint8_t,
    constData: "" as HexString,
    varData: Buffer.from(""),
    dataAction: dhDataAction, //does nothing if there is no DH
    txLen: 0
}

export type TransactionTemplate = (chainId: HexString, tx: ParsedTransaction, parsedPath: ValidBIP32Path) => Array<Command>;

export function constDataAppendData(format: VALUE_FORMAT, validation: VALUE_VALIDATION, arg1: bigint, arg2: bigint,
    policy: VALUE_POLICY, storage: VALUE_STORAGE_COMPARE, key: string): HexString {
    const buf = Buffer.allocUnsafe(20 + key.length);
    buf.writeUInt8(format, 0);
    buf.writeUInt8(validation, 1);
    buf.writeBigUInt64LE(arg1, 2);
    buf.writeBigUInt64LE(arg2, 10);
    buf.writeUInt8(policy | storage, 18);
    buf.writeUInt8(key.length, 19);
    buf.write(key, 20);
    return buf.toString("hex") as HexString;
}

export function constDataShowMessage(key: string, value: string) {
    const buf = Buffer.allocUnsafe(2 + key.length + value.length);
    buf.writeUInt8(key.length, 0);
    buf.write(key, 1);
    buf.writeUInt8(value.length, 1 + key.length);
    buf.write(value, 2 + key.length);
    return buf.toString("hex") as HexString;
}

export function constDataStartCountedSection(format: VALUE_FORMAT, validation: VALUE_VALIDATION, arg1: bigint, arg2: bigint): HexString {
    const buf = Buffer.allocUnsafe(18);
    buf.writeUInt8(format, 0);
    buf.writeUInt8(validation, 1);
    buf.writeBigUInt64LE(arg1, 2);
    buf.writeBigUInt64LE(arg2, 10);
    return buf.toString("hex") as HexString;
}

export function getCommandVarLength(commands: Array<Command>): number {
    let len: number = 0;
    for (let i = 0; i < commands.length; i++) {
        len += commands[i].txLen;
    }
    return len;
}

export function templateAlternative(templates: Array<TransactionTemplate>): TransactionTemplate {
    return (chainId, tx, path) => {
        for (const t of templates) {
            const commands: Array<Command> = t(chainId, tx, path);
            if (commands.length != 0) { //template match
                return commands;
            }
        }
        return [];
    }
}

export function makeCommandFromBase(commandBase: TxIndependentCommandBase, varData?: Buffer, txLen?: number): Command {
    return {
        ...defaultCommand,
        command: commandBase.name,
        constData: commandBase.serializedConstData,
        varData: varData ?? defaultCommand.varData,
        txLen: txLen ?? defaultCommand.txLen,
    }
}

//---------------------INSTRUCTION SPECIFIC COMMANDS---------------------------------

export function COMMAND_NONE(commandBase: TxIndependentCommandBase): Command {
    return makeCommandFromBase(commandBase);
}

export function COMMAND_INIT(commandBase: TxIndependentCommandBase, chainId: HexString, parsedPath: ValidBIP32Path): Command {
    const varData = Buffer.concat([Buffer.from(chainId, "hex"), path_to_buf(parsedPath)]);
    return makeCommandFromBase(commandBase, varData, varData.length);
}

export function COMMAND_APPEND_CONST_DATA(commandBase: TxIndependentCommandBase): Command {
    return makeCommandFromBase(commandBase, defaultCommand.varData, Buffer.from(commandBase.serializedConstData, "hex").length);
}

export function COMMAND_SHOW_MESSAGE(commandBase: TxIndependentCommandBase): Command {
    return makeCommandFromBase(commandBase);
}

export function COMMAND_APPEND_DATA_BUFFER_DO_NOT_SHOW(commandBase: TxIndependentCommandBase, varData: Buffer): Command {
    return makeCommandFromBase(commandBase, varData, varData.length);
}

export function COMMAND_APPEND_DATA_STRING_DO_NOT_SHOW(commandBase: TxIndependentCommandBase, varData: Buffer): Command {
    return makeCommandFromBase(commandBase, varData, varData.length);
}

export function COMMAND_APPEND_DATA_STRING_SHOW(commandBase: TxIndependentCommandBase, varData: Buffer): Command {
    return makeCommandFromBase(commandBase, varData, varData.length);
}

export function COMMAND_APPEND_DATA_STRING_WITH_LENGTH_DO_NOT_SHOW(commandBase: TxIndependentCommandBase, varData: Buffer): Command {
    const vD = Buffer.concat([varuint32_to_buf(varData.length), varData]);
    return makeCommandFromBase(commandBase, vD, vD.length);
}

export function COMMAND_APPEND_DATA_STRING_WITH_LENGTH_SHOW(commandBase: TxIndependentCommandBase, varData: Buffer): Command {
    const vD = Buffer.concat([varuint32_to_buf(varData.length), varData]);
    return makeCommandFromBase(commandBase, vD, vD.length);
}

export function COMMAND_APPEND_DATA_STRING_WITH_LENGTH_SHOW_IF_NON_EMPTY(commandBase: TxIndependentCommandBase, varData: Buffer): Command {
    const vD = Buffer.concat([varuint32_to_buf(varData.length), varData]);
    return makeCommandFromBase(commandBase, vD, vD.length);
}

export function COMMAND_APPEND_DATA_NAME_SHOW(commandBase: TxIndependentCommandBase, name: HexString): Command {
    const varData = Buffer.from(name, "hex");
    return makeCommandFromBase(commandBase, varData, varData.length);
}

export function COMMAND_APPEND_DATA_FIO_AMOUNT_SHOW(commandBase: TxIndependentCommandBase, varData: Buffer): Command {
    return makeCommandFromBase(commandBase, varData, varData.length);
}

export function COMMAND_APPEND_DATA_UINT64_SHOW(commandBase: TxIndependentCommandBase, varData: Buffer): Command {
    return makeCommandFromBase(commandBase, varData, varData.length);
}

export function COMMAND_START_COUNTED_SECTION(commandBase: TxIndependentCommandBase): Command {
    return makeCommandFromBase(commandBase);
}

export function COMMAND_END_COUNTED_SECTION(commandBase: TxIndependentCommandBase): Command {
    return makeCommandFromBase(commandBase);
}

// export function COMMANDS_COUNTED_SECTION(commandBase: TxIndependentCommandBase, commands: Array<Command>): Array<Command> {
//     const varData = varuint32_to_buf(getCommandVarLength(commands));
//     return [
//         {
//             ...defaultCommand,
//             command: commandBase.name,
//             constData: commandBase.serializedConstData,
//             varData: varData,
//             txLen: varData.length
//         },
//         ...commands,
//         {
//             ...defaultCommand,
//             command: COMMAND.END_COUNTED_SECTION,
//         }
//     ]
// }

export function COMMAND_STORE_VALUE(commandBase: TxIndependentCommandBase, varData: Buffer): Command {
    return {
        ...defaultCommand,
        command: commandBase.name,
        p2: Buffer.from(commandBase.serializedConstData, "hex")[0] as Uint8_t, // register number
        varData: varData,
    }
}

// TODO investigate this, commandBase.serializedConstData is not used here, but it should maybe. Although it only contains the command name...
export function COMMAND_FINISH(commandBase: TxIndependentCommandBase, parsedPath: ValidBIP32Path): Command {
    return {
        ...defaultCommand,
        command: commandBase.name,
        expectedResponseLength: 65 + 32,
        dataAction: (b, s) => {
            const [witnessSignature, hash, rest] = chunkBy(b, [65, 32])
            assert(rest.length === 0, "invalid response length")

            return {
                dhEncryptedData: s.dhEncryptedData,
                txHashHex: buf_to_hex(hash),
                witness: {
                    path: parsedPath,
                    witnessSignatureHex: buf_to_hex(witnessSignature),
                },
            }

        },
    }
}

export function ADD_STORAGE_CHECK(commandBase: TxIndependentCommandBase, c: Command): Command {
    return {
        ...c,
        constData: commandBase.serializedConstData,
    }
}

export function COMMAND_APPEND_DATA_MEMO_HASH(commandBase: TxIndependentCommandBase, memo?: VarlenAsciiString, hash?: VarlenAsciiString, offline_url?: VarlenAsciiString): Command {
    var varData: Buffer = Buffer.from("");
    if (memo === undefined) {
        validate(hash !== undefined, InvalidDataReason.INVALID_HASH);
        validate(offline_url !== undefined, InvalidDataReason.INVALID_OFFLINE_URL);
        varData = Buffer.concat([
            Buffer.from("0001", "hex"),
            varuint32_to_buf(hash.length),
            Buffer.from(hash),
            Buffer.from("01", "hex"),
            varuint32_to_buf(offline_url.length),
            Buffer.from(offline_url),
        ])
    }
    else {
        validate(hash === undefined, InvalidDataReason.INVALID_HASH);
        validate(hash === undefined, InvalidDataReason.INVALID_OFFLINE_URL);
        varData = Buffer.concat([
            Buffer.from("01", "hex"),
            varuint32_to_buf(memo.length),
            Buffer.from(memo),
            Buffer.from("0000", "hex"),
        ])
    }
    return makeCommandFromBase(commandBase, varData, varData.length);
}


export function COMMAND_APPEND_DATA_CHAIN_CODE_TOKEN_CODE_PUBLIC_ADDR_SHOW(commandBase: TxIndependentCommandBase, chainCode: VarlenAsciiString, tokenCode: VarlenAsciiString, publicAddr: VarlenAsciiString): Command {
    const varData: Buffer = Buffer.concat([
        varuint32_to_buf(tokenCode.length),
        Buffer.from(tokenCode),
        varuint32_to_buf(chainCode.length),
        Buffer.from(chainCode),
        varuint32_to_buf(publicAddr.length),
        Buffer.from(publicAddr),
    ]);
    return makeCommandFromBase(commandBase, varData, varData.length);
}

// TODO how to work with children reasonably?
export function COMMAND_START_FOR_LOOP(commandBase: TxIndependentCommandBase): Command {
    return makeCommandFromBase(commandBase);
}

export function COMMAND_END_FOR_LOOP(commandBase: TxIndependentCommandBase): Command {
    return makeCommandFromBase(commandBase);
}
