import type {HexString, ParsedTransaction, ParsedTransferFIOTokensData, Uint8_t, ValidBIP32Path} from "../types/internal"

import {InvalidDataReason} from "../errors"
import type {SignedTransactionData, Version} from "../types/public"
import {assert} from "../utils/assert"
import {chunkBy} from "../utils/ioHelpers"
import {validate} from "../utils/parse"
import {buf_to_hex, date_to_buf, path_to_buf, uint8_to_buf, uint16_to_buf, uint32_to_buf, uint64_to_buf} from "../utils/serialize"
import {INS} from "./common/ins"
import type {Interaction, SendParams} from "./common/types"
import {ensureLedgerAppVersionCompatible} from "./getVersion"
import {templete_trnsfiopubky} from "./transactionTemplates/template_trnsfiopubky"

const send = (params: {
    p1: number,
    p2: number,
    data: Buffer,
    expectedResponseLength?: number
}): SendParams => ({ins: INS.SIGN_TX, ...params})


export function* signTransaction(version: Version, parsedPath: ValidBIP32Path, chainId: HexString, tx: ParsedTransaction): Interaction<SignedTransactionData> {
    ensureLedgerAppVersionCompatible(version)

    const commands = templete_trnsfiopubky(chainId, tx, parsedPath);

    let result: SignedTransactionData = {txHashHex: "", witness: {path: parsedPath, witnessSignatureHex: ""}};

    for(const command of commands) {
        validate(command.constData.length + command.varData.length +2 <= 255, InvalidDataReason.UNEXPECTED_ERROR);
        result = command.dataAction(
            yield send({
                p1: command.command,
                p2: command.p2,
                data: Buffer.concat([
                    uint8_to_buf(Buffer.from(command.constData, "hex").length as Uint8_t),
                    uint8_to_buf(command.varData.length as Uint8_t),
                    Buffer.from(command.constData, "hex"), 
                    command.varData,
                ]),
                expectedResponseLength: command.expectedResponseLength,
            }),
            result
        )
    }
    return result;
}
